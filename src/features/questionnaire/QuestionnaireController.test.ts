/**
 * The questionnaire's flow, exercised without a browser.
 *
 * Three things here are regressions waiting to happen, and each has a case:
 * the step→bank one-based offset (get it wrong and every answer attaches to
 * the neighbouring question), `QVER` discarding a stale draft (get it wrong
 * and a returning collector sees last year's answers against this year's
 * questions), and reading a server response's shape without trusting it —
 * the crash this repo has now written eight times (docs/HANDOFF.md §6).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  QuestionnaireController,
  contactPatch,
  isQuestionnaireAnswered,
} from './QuestionnaireController';
import { QB_DEFAULT, QVER, servedVersion } from './questions';
import { __resetOwnerSettings } from '../shell/ownerSettings';

/**
 * This suite runs in vitest's node environment (`vitest.config.ts`), which has
 * no `localStorage` — so the draft store gets a minimal in-memory stand-in
 * here rather than the whole suite getting a DOM.
 *
 * Worth noting what the absence proves on its own: the controller wraps every
 * storage call, so under plain node it already runs with the draft silently
 * disabled, which is exactly the private-window case. The shim is here to test
 * the path where storage WORKS.
 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
}
globalThis.localStorage = new MemoryStorage();
globalThis.Storage = MemoryStorage as unknown as typeof Storage;

type Api = {
  questionnaire: () => Promise<{
    answers?: unknown;
    submitted_at: string | null;
    answered?: boolean;
  }>;
  submitQuestionnaire: (
    answers: Array<{ q: string; a: string }>,
  ) => Promise<{ answers?: unknown; submitted_at: string }>;
  questionSet: () => Promise<unknown>;
};

/** The server's "no active set" answer (G-P25-2) — 200, never 404. */
const EMPTY_SET = { id: null, title: '', intro: '', is_active: false, questions: [] };

/** A small active set: two single-choice questions and one free-text one,
 * served out of `order` to prove the controller sorts. */
const SERVED_SET = {
  id: 'qs1',
  title: 'Tell us how you collect',
  intro: 'Three short questions.',
  is_active: true,
  version: 3,
  questions: [
    { id: 'q3', prompt: 'Anything else?', question_type: 'text', options: [], order: 2 },
    {
      id: 'q1',
      prompt: 'What draws you?',
      question_type: 'single_choice',
      options: [
        { value: 'abs', label: 'Abstraction' },
        { value: 'fig', label: 'Figuration' },
      ],
      order: 0,
    },
    {
      id: 'q2',
      prompt: 'Your stage?',
      question_type: 'single_choice',
      options: [
        { value: 'new', label: 'Just beginning' },
        { value: 'est', label: 'Established' },
      ],
      order: 1,
    },
  ],
};

/** A service stand-in — only the methods the controller calls. The question
 * set defaults to the empty shape, so every older case runs on the built-in
 * bank exactly as before. */
function api(over: Partial<Api> = {}): Api {
  return {
    questionnaire: () => Promise.reject(new Error('404')),
    submitQuestionnaire: (answers) =>
      Promise.resolve({ answers, submitted_at: '2026-09-22T10:00:00Z' }),
    questionSet: () => Promise.resolve(EMPTY_SET),
    ...over,
  };
}

function make(over: Partial<Api> = {}) {
  // The controller only ever touches these two methods; the cast keeps the
  // test from having to stand up the whole ApiClient.
  return new QuestionnaireController(api(over) as never);
}

beforeEach(() => {
  localStorage.clear();
  __resetOwnerSettings();
});

describe('load', () => {
  it('opens on the intro when the read fails (an older backend 404s)', async () => {
    const c = make();
    await c.load();
    expect(c.getSnapshot().stage).toBe('intro');
    expect(c.getSnapshot().submitted).toBe(false);
    expect(c.getSnapshot().status).toBe('idle');
  });

  it('opens on the intro on the 200 "never answered" read (G-P25-1)', async () => {
    // The current backend answers a first-run collector with 200, not 404 —
    // treating any 200 as "submitted" showed an empty review (C-3).
    const c = make({
      questionnaire: () =>
        Promise.resolve({ answers: [], submitted_at: null, answered: false }),
    });
    await c.load();
    expect(c.getSnapshot().stage).toBe('intro');
    expect(c.getSnapshot().submitted).toBe(false);
    expect(c.getSnapshot().status).toBe('idle');
  });

  it('opens on the review when the read says answered', async () => {
    const c = make({
      questionnaire: () =>
        Promise.resolve({ answers: [], submitted_at: '2026-09-01T00:00:00Z', answered: true }),
    });
    await c.load();
    expect(c.getSnapshot().stage).toBe('review');
    expect(c.getSnapshot().submitted).toBe(true);
  });

  it('opens a returning collector straight on the review', async () => {
    const c = make({
      questionnaire: () =>
        Promise.resolve({ answers: [], submitted_at: '2026-09-01T00:00:00Z' }),
    });
    await c.load();
    expect(c.getSnapshot().stage).toBe('review');
    expect(c.getSnapshot().submitted).toBe(true);
    expect(c.getSnapshot().submittedAt).toBe('2026-09-01T00:00:00Z');
  });

  it('survives a server answers field that is not a list', async () => {
    // The eighth instance of this bug would have been here: `answers` is an
    // untyped JSONField, so `{}` and `null` really do come back.
    for (const answers of [null, {}, 'nope', 42]) {
      const c = make({
        questionnaire: () => Promise.resolve({ answers, submitted_at: 'x' }),
      });
      await c.load();
      expect(c.getSnapshot().stage).toBe('review');
      expect(c.getSnapshot().answers).toEqual({});
    }
  });

  it('maps the server answers back onto the bank by question text', async () => {
    const c = make({
      questionnaire: () =>
        Promise.resolve({
          answers: [
            { q: 'Email', a: 'a@b.c' },
            { q: QB_DEFAULT[2].q, a: 'Painting · Sculpture' },
            { q: 'a question no longer in the bank', a: 'ignored' },
          ],
          submitted_at: 'x',
        }),
    });
    await c.load();
    const s = c.getSnapshot();
    expect(s.contact.email).toBe('a@b.c');
    // one-based: QB_DEFAULT[2] is step 3
    expect(s.answers[3]).toEqual(['Painting', 'Sculpture']);
    expect(Object.keys(s.answers)).toEqual(['3']);
  });

  it('keeps a local draft rather than overwriting it with the sent answers', async () => {
    localStorage.setItem(
      'darz_questionnaire',
      JSON.stringify({ qver: QVER, ans: { 1: ['Figuration'] }, email: 'draft@x.y' }),
    );
    const c = make({
      questionnaire: () =>
        Promise.resolve({
          answers: [{ q: QB_DEFAULT[0].q, a: 'Abstraction' }],
          submitted_at: 'x',
        }),
    });
    await c.load();
    expect(c.getSnapshot().answers[1]).toEqual(['Figuration']);
  });

  it('discards a draft written under an older QVER', async () => {
    localStorage.setItem(
      'darz_questionnaire',
      JSON.stringify({ qver: QVER - 1, ans: { 1: ['Figuration'] }, email: 'keep@x.y' }),
    );
    const c = make();
    await c.load();
    // The answers go; the contact details are kept, exactly as the old app
    // promises (`startQ`, app.html:10016).
    expect(c.getSnapshot().answers).toEqual({});
    expect(c.getSnapshot().contact.email).toBe('keep@x.y');
  });

  it('starts fresh when the stored draft is corrupt', async () => {
    localStorage.setItem('darz_questionnaire', '{not json');
    const c = make();
    await expect(c.load()).resolves.toBeUndefined();
    expect(c.getSnapshot().answers).toEqual({});
  });
});

describe('served question set (G-P25-2(a))', () => {
  it('runs on the served set, in order, with its title and intro', async () => {
    const c = make({ questionSet: () => Promise.resolve(SERVED_SET) });
    await c.load();
    const s = c.getSnapshot();
    expect(s.source).toBe('served');
    expect(s.bank.map((b) => b.q)).toEqual([
      'What draws you?',
      'Your stage?',
      'Anything else?',
    ]);
    expect(s.bank[0]).toEqual({
      sec: '',
      hint: 'Choose one',
      q: 'What draws you?',
      opts: ['Abstraction', 'Figuration'],
    });
    // text → the free-text step: no options, optional
    expect(s.bank[2].opts).toEqual([]);
    expect(s.intro.title).toBe('Tell us how you collect');
    expect(s.intro.lede).toBe('Three short questions.');
    // the fields the set does not carry keep the built-in wording
    expect(s.intro.button).toBe('Begin');
  });

  it('falls back to the built-in bank on the empty shape', async () => {
    const c = make({ questionSet: () => Promise.resolve(EMPTY_SET) });
    await c.load();
    expect(c.getSnapshot().source).toBe('builtin');
    expect(c.getSnapshot().bank).toEqual([...QB_DEFAULT]);
    expect(c.getSnapshot().intro.title).toBe('A few questions about\nhow you collect');
  });

  it('falls back to the built-in bank when the read fails', async () => {
    const c = make({ questionSet: () => Promise.reject(new Error('500')) });
    await c.load();
    expect(c.getSnapshot().source).toBe('builtin');
    expect(c.getSnapshot().bank).toEqual([...QB_DEFAULT]);
    expect(c.getSnapshot().status).toBe('idle');
  });

  it('falls back when every served question is unusable', async () => {
    const c = make({
      questionSet: () =>
        Promise.resolve({ ...SERVED_SET, questions: [{ prompt: '  ' }, null, 'x'] }),
    });
    await c.load();
    expect(c.getSnapshot().source).toBe('builtin');
  });

  it('discards a draft saved against the built-in bank, keeping the contact', async () => {
    localStorage.setItem(
      'darz_questionnaire',
      JSON.stringify({ qver: QVER, ans: { 1: ['Figuration'] }, email: 'keep@x.y' }),
    );
    const c = make({ questionSet: () => Promise.resolve(SERVED_SET) });
    await c.load();
    expect(c.getSnapshot().answers).toEqual({});
    expect(c.getSnapshot().contact.email).toBe('keep@x.y');
  });

  it('keeps a draft saved against the same served set, and drops it once the set changes', async () => {
    const first = make({ questionSet: () => Promise.resolve(SERVED_SET) });
    await first.load();
    first.pick(1, 'Figuration', true);
    const saved = JSON.parse(localStorage.getItem('darz_questionnaire') ?? '{}') as {
      qver: unknown;
    };
    expect(saved.qver).toBe(servedVersion(first.getSnapshot().bank));

    // same questions, a re-save that only bumped `version` — the draft stays
    const again = make({ questionSet: () => Promise.resolve({ ...SERVED_SET, version: 4 }) });
    await again.load();
    expect(again.getSnapshot().answers[1]).toEqual(['Figuration']);

    // the owner reworded step 1 — the draft is stale and goes
    const edited = {
      ...SERVED_SET,
      questions: SERVED_SET.questions.map((q) =>
        q.id === 'q1' ? { ...q, prompt: 'Which draws your eye?' } : q,
      ),
    };
    const later = make({ questionSet: () => Promise.resolve(edited) });
    await later.load();
    expect(later.getSnapshot().answers).toEqual({});
  });

  it('maps sent answers back by the served question texts, and sends them as {q, a}', async () => {
    const c = make({
      questionSet: () => Promise.resolve(SERVED_SET),
      questionnaire: () =>
        Promise.resolve({
          answers: [
            { q: 'Your stage?', a: 'Established' },
            { q: 'Anything else?', a: 'Quiet works' },
            { q: QB_DEFAULT[0].q, a: 'Abstraction' },
          ],
          submitted_at: 'x',
          answered: true,
        }),
    });
    await c.load();
    // a built-in question is not in the served set, so its answer is not shown
    expect(c.getSnapshot().answers).toEqual({ 2: ['Established'], 3: ['Quiet works'] });
    expect(c.payload()).toEqual([
      { q: 'Your stage?', a: 'Established' },
      { q: 'Anything else?', a: 'Quiet works' },
    ]);
  });

  it('a single_choice step is single-select and required', async () => {
    const c = make({ questionSet: () => Promise.resolve(SERVED_SET) });
    await c.load();
    c.begin();
    c.next();
    expect(c.getSnapshot().step).toBe(1);
    expect(c.canContinue()).toBe(false);
    c.pick(1, 'Abstraction', true);
    c.pick(1, 'Figuration', true);
    expect(c.getSnapshot().answers[1]).toEqual(['Figuration']);
    expect(c.canContinue()).toBe(true);
  });
});

describe('answering', () => {
  it('single-select replaces, multi-select accumulates', async () => {
    const c = make();
    await c.load();
    c.pick(1, 'Abstraction', true);
    c.pick(1, 'Figuration', true);
    expect(c.getSnapshot().answers[1]).toEqual(['Figuration']);

    c.pick(3, 'Painting', false);
    c.pick(3, 'Sculpture', false);
    expect(c.getSnapshot().answers[3]).toEqual(['Painting', 'Sculpture']);
    c.pick(3, 'Painting', false);
    expect(c.getSnapshot().answers[3]).toEqual(['Sculpture']);
  });

  it('tapping the chosen single-select option again clears it', async () => {
    const c = make();
    await c.load();
    c.pick(1, 'Abstraction', true);
    c.pick(1, 'Abstraction', true);
    expect(c.getSnapshot().answers[1]).toEqual([]);
  });

  it('gates Continue on an answer, except where the old form does not', async () => {
    const c = make();
    await c.load();
    c.begin();
    expect(c.canContinue()).toBe(true); // contact step — always

    c.next();
    expect(c.getSnapshot().step).toBe(1);
    expect(c.canContinue()).toBe(false);
    c.pick(1, 'Abstraction', true);
    expect(c.canContinue()).toBe(true);
  });

  it('accepts a step answered only through its extra field', async () => {
    // Step 7 ("Where will you collect from?") is the one with `extra`.
    const c = make();
    await c.load();
    c.begin();
    for (let i = 0; i < 7; i++) c.next();
    expect(c.getSnapshot().step).toBe(7);
    expect(c.canContinue()).toBe(false);
    c.setExtra(7, 'Tehran');
    expect(c.canContinue()).toBe(true);
  });

  it('lets the final free-text step be skipped', async () => {
    const c = make();
    await c.load();
    c.begin();
    for (let i = 0; i < QB_DEFAULT.length; i++) c.next();
    expect(c.getSnapshot().step).toBe(QB_DEFAULT.length);
    expect(c.canContinue()).toBe(true);
  });

  it('goes to the review past the last step, and back again', async () => {
    const c = make();
    await c.load();
    c.begin();
    for (let i = 0; i <= QB_DEFAULT.length; i++) c.next();
    expect(c.getSnapshot().stage).toBe('review');
    expect(c.back()).toBe(true);
    expect(c.getSnapshot().stage).toBe('step');
    expect(c.getSnapshot().step).toBe(QB_DEFAULT.length);
  });

  it('reports that step 0 has nowhere further back — the view exits', async () => {
    const c = make();
    await c.load();
    c.begin();
    expect(c.back()).toBe(false);
  });
});

describe('payload', () => {
  it('sends contact first, then every answered step, skipping the blanks', async () => {
    const c = make();
    await c.load();
    c.setContact('email', 'a@b.c');
    c.setContact('lang', 'Farsi');
    c.pick(1, 'Abstraction', true);
    c.pick(3, 'Painting', false);
    c.pick(3, 'Sculpture', false);

    expect(c.payload()).toEqual([
      { q: 'Email', a: 'a@b.c' },
      { q: 'Preferred communication language', a: 'Farsi' },
      { q: QB_DEFAULT[0].q, a: 'Abstraction' },
      { q: QB_DEFAULT[2].q, a: 'Painting · Sculpture' },
    ]);
  });

  it('appends a step extra the way the review renders it', async () => {
    const c = make();
    await c.load();
    c.pick(7, 'Both', true);
    c.setExtra(7, 'Tehran');
    expect(c.payload()).toContainEqual({
      q: QB_DEFAULT[6].q,
      a: 'Both · Your city, if you like: Tehran',
    });
  });

  it('sends an extra with no option picked', async () => {
    const c = make();
    await c.load();
    c.setExtra(7, 'Tehran');
    expect(c.payload()).toEqual([{ q: QB_DEFAULT[6].q, a: 'Your city, if you like: Tehran' }]);
  });
});

describe('submit', () => {
  it('clears the draft and lands on the thank-you screen', async () => {
    const c = make();
    await c.load();
    c.pick(1, 'Abstraction', true);
    expect(localStorage.getItem('darz_questionnaire')).not.toBeNull();

    await expect(c.submit()).resolves.toBe(true);
    expect(c.getSnapshot().stage).toBe('done');
    expect(c.getSnapshot().submitted).toBe(true);
    expect(localStorage.getItem('darz_questionnaire')).toBeNull();
  });

  it('keeps the collector on the review with a message when the send fails', async () => {
    const c = make({ submitQuestionnaire: () => Promise.reject(new Error('Network down')) });
    await c.load();
    c.pick(1, 'Abstraction', true);

    await expect(c.submit()).resolves.toBe(false);
    expect(c.getSnapshot().stage).not.toBe('done');
    expect(c.getSnapshot().error).toBe('Network down');
    expect(c.getSnapshot().status).toBe('idle');
    // The draft survives a failed send — losing it would lose the answers.
    expect(localStorage.getItem('darz_questionnaire')).not.toBeNull();
  });

  it('carries on when localStorage refuses to write', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    const c = make();
    await c.load();
    expect(() => c.pick(1, 'Abstraction', true)).not.toThrow();
    expect(c.getSnapshot().answers[1]).toEqual(['Abstraction']);
    setItem.mockRestore();
  });
});

describe('isQuestionnaireAnswered', () => {
  it('trusts the flag when present, else falls back to submitted_at', () => {
    expect(isQuestionnaireAnswered({ answered: false, submitted_at: 'x' })).toBe(false);
    expect(isQuestionnaireAnswered({ answered: true, submitted_at: null })).toBe(true);
    expect(isQuestionnaireAnswered({ submitted_at: '2026-09-01T00:00:00Z' })).toBe(true);
    expect(isQuestionnaireAnswered({ submitted_at: null })).toBe(false);
  });
});

/** G-Q-1 — the contact step reaches the account through `PATCH /auth/me/`. */
describe('the contact step writes the account', () => {
  it('shapes only what the account takes: phone and the language code, never email', () => {
    expect(contactPatch({ email: 'a@b.c', phone: ' 0912 ', lang: 'Farsi' })).toEqual({
      phone: '0912',
      preferred_language: 'fa',
    });
    expect(contactPatch({ email: '', phone: '', lang: 'English' })).toEqual({
      preferred_language: 'en',
    });
    // French has no backend value; an empty form sends nothing at all
    expect(contactPatch({ email: 'a@b.c', phone: '', lang: 'French' })).toEqual({});
  });

  it('sends it after a successful submit', async () => {
    const updateMe = vi.fn(() => Promise.resolve({}));
    const c = new QuestionnaireController(api() as never, { updateMe });
    await c.load();
    c.setContact('phone', '0912 000');
    c.setContact('lang', 'English');
    await expect(c.submit()).resolves.toBe(true);
    expect(updateMe).toHaveBeenCalledWith({ phone: '0912 000', preferred_language: 'en' });
  });

  it('does not write the account when the send fails', async () => {
    const updateMe = vi.fn(() => Promise.resolve({}));
    const c = new QuestionnaireController(
      api({ submitQuestionnaire: () => Promise.reject(new Error('down')) }) as never,
      { updateMe },
    );
    await c.load();
    c.setContact('phone', '0912');
    await c.submit();
    expect(updateMe).not.toHaveBeenCalled();
  });

  it('a failed account write never turns a sent profile into an error', async () => {
    const c = new QuestionnaireController(api() as never, {
      updateMe: () => Promise.reject(new Error('403')),
    });
    await c.load();
    c.setContact('phone', '0912');
    await expect(c.submit()).resolves.toBe(true);
    expect(c.getSnapshot().stage).toBe('done');
    expect(c.getSnapshot().error).toBeNull();
  });

  it('pre-fills the contact from the account when there is no draft', async () => {
    const c = make();
    await c.load({ phone: '0912', lang: 'Farsi' });
    expect(c.getSnapshot().contact).toEqual({ email: '', phone: '0912', lang: 'Farsi' });
  });

  it('a draft wins over the account pre-fill', async () => {
    const first = make();
    await first.load();
    first.setContact('phone', '0935');
    const second = make();
    await second.load({ phone: '0912' });
    expect(second.getSnapshot().contact.phone).toBe('0935');
  });
});
