/**
 * The questionnaire's question bank — `QB` / `QB_DEFAULT` (app.html:9973-9984)
 * and the owner-editable override around it (`_qbLive` / `_qbIntro`, :9990-9993).
 *
 * The ten questions below are **verbatim** from the old app, in its order,
 * with its section names, hints, `extra` field and `note`. They are the
 * built-in fallback, exactly as `QB_DEFAULT` is there: used when the owner has
 * never edited the bank, and when the theme fetch fails.
 *
 * **`QVER` is why this file is versioned** (:9973). A rewrite of the bank bumps
 * it, and a returning collector's saved draft — keyed by the previous question
 * ORDER — is then discarded rather than shown against the new questions. Their
 * contact details are kept; the answers start fresh. Keep that contract: the
 * draft is indexed by step number, so reordering the bank without bumping
 * `QVER` silently attaches every answer to the wrong question.
 *
 * Answers reach the backend as `{q, a}` text pairs (`QuestionnaireAnswer`),
 * which is the same thing the old app synced to Admin, so every past
 * submission stays readable even after the bank changes.
 *
 * ## The served set comes first (G-P25-2(a), V1 Phase 9a)
 *
 * The owner now edits the questions on the backend, and
 * `GET /api/recommendations/question-set/` serves the one active set. The
 * precedence, highest first:
 *
 *  1. **The served set** (`servedBank`), when it has at least one usable
 *     question. Its `title` / `intro` replace the intro's title and lede.
 *  2. **The theme override** (`liveBank` / `liveIntro`) — the old app's own
 *     owner-edit path, unchanged.
 *  3. **The built-in bank below** (`QB_DEFAULT` / `INTRO_DEFAULT`).
 *
 * **The built-in bank is kept on purpose, not left over.** The endpoint's
 * "no set is active" answer is an empty shape (`id: null`, `questions: []`),
 * and the read can fail; in both cases the collector still gets a
 * questionnaire, and the one they get is the old app's own content
 * (app.html:9973-9984) — so the screen never goes empty. The plan's "delete
 * the bank" line (V1_IMPLEMENTATION_PLAN Phase 9) is superseded by this: it
 * stays as the fallback.
 *
 * A served set has its own draft version (`servedVersion`) — a hash of the
 * questions' texts, types and options in order, so an owner edit that changes
 * what step N asks discards a stale local draft, and a save that changes
 * nothing the collector sees does not.
 */
import { asArray } from '../../api/shapes';
import type { QuestionSet } from '../../api/types';
import { settingRecord, settingUnknown } from '../shell/ownerSettings';

/** Bumped when the bank is rewritten — see the file header. */
export const QVER = 2;

export interface Question {
  /** The step's eyebrow — the old bank's `sec`. */
  sec: string;
  /** `Choose one` · `Select all` · `Optional` — drives single-select and
   * whether the step may be skipped (`:10104`). */
  hint: string;
  q: string;
  opts: string[];
  /** One optional free-text field under the options (`:10113`). */
  extra?: string;
  /** A small note under the field (`:10114`). */
  note?: string;
  /** A conditional step: shown only once `showIf.q` has `showIf.has` picked
   * (v618, `:9996-10001`). Nothing in the built-in bank uses it — it is here
   * because an owner-edited bank may, and dropping it would silently show a
   * question the owner meant to gate. */
  showIf?: { q: string; has: string };
}

export const QB_DEFAULT: readonly Question[] = [
  {
    sec: 'Taste',
    hint: 'Choose one',
    q: 'Which draws your eye first?',
    opts: [
      'Abstraction',
      'Figuration',
      'Minimal & spare',
      'Conceptual',
      'Calligraphic & word',
      'Photography',
    ],
  },
  {
    sec: 'Taste',
    hint: 'Choose one',
    q: 'What holds you with a work?',
    opts: [
      'The idea',
      'The material & making',
      'Colour & light',
      'Stillness & restraint',
      'Emotional charge',
      'Mastery of craft',
    ],
  },
  {
    sec: 'Taste',
    hint: 'Select all',
    q: 'Which mediums do you collect?',
    opts: [
      'Painting',
      'Works on paper',
      'Sculpture',
      'Photography',
      'Mixed media & installation',
      'Open to all',
    ],
  },
  {
    sec: 'Direction',
    hint: 'Choose one',
    q: 'Where are you in your collecting?',
    opts: [
      'Just beginning',
      'Building a collection',
      'An established collection',
      'Collecting for an institution',
    ],
  },
  {
    sec: 'Direction',
    hint: 'Select all',
    q: 'Your range for a single work?',
    opts: [
      'Up to $5,000',
      '$5,000–15,000',
      '$15,000–50,000',
      '$50,000–150,000',
      'Above $150,000',
      'Prefer to discuss',
    ],
  },
  {
    sec: 'Direction',
    hint: 'Choose one',
    q: 'How are you collecting right now?',
    opts: [
      'Actively acquiring',
      'Open to the right work',
      'Watching & learning',
      'Following a particular artist',
    ],
  },
  {
    sec: 'Practical',
    hint: 'Choose one',
    q: 'Where will you collect from?',
    opts: ['Inside Iran — in Toman', 'Outside Iran — in USD / EUR', 'Both'],
    extra: 'Your city, if you like',
    note: 'Payment terms may vary by artwork.',
  },
  {
    sec: 'Practical',
    hint: 'Select all',
    q: 'What should Darz prepare for you?',
    opts: [
      'Available works',
      'Private deals',
      'Auction alerts',
      'Curated selections',
      'Newly introduced artists',
    ],
  },
  {
    sec: 'Contact',
    hint: 'Choose one',
    q: 'How should Darz reach you?',
    opts: ['WhatsApp', 'In-app chat', 'Either'],
  },
  {
    sec: 'In your words',
    hint: 'Optional',
    q: 'Anything you’re looking for, or artists you follow?',
    opts: [],
  },
];

/** The intro screen's five editable strings (`theme.qbIntro`, :10038-10044).
 * Every field falls back to the built-in Darz wording. */
export interface QuestionnaireIntro {
  eyebrow: string;
  title: string;
  lede: string;
  fine: string;
  button: string;
  stitle: string;
}

export const INTRO_DEFAULT: QuestionnaireIntro = {
  eyebrow: 'Collector Profile',
  title: 'A few questions about\nhow you collect',
  lede:
    'A few thoughtful questions help Darz understand your taste, priorities, and collecting ' +
    'rhythm — so each selection we share feels more precise, relevant, and considered.',
  fine: 'Private — used only for Darz advisory, recommendations, and curated selections.',
  button: 'Begin',
  stitle: 'Collector profile',
};

/**
 * The three Roman-numeral points — **`pts` / `rows`, app.html:10025-10032 —
 * are NOT ported, because the old app does not render them.**
 *
 * `qintro()` builds `rows` from `pts` (Taste · Collecting logic ·
 * Communication, each with a serif numeral and a hairline rule, per the v511
 * comment above it) and then never concatenates it into `main.innerHTML`. The
 * shipped intro is eyebrow → title → lede → hairline → fine print, and nothing
 * else. Verified by reading the full statement at :10046-10055: `rows` appears
 * once, on the line that assigns it.
 *
 * So they are recorded here rather than built. Reviving them would be adding a
 * section to an approved screen on the strength of an unused variable — the
 * opposite of a faithful port. If the owner wants them, it is three lines in
 * `QuestionnairePage`'s `Intro` and this note is the spec. Recorded as
 * **G-Q-2**.
 */

/** Preferred communication language (`COMM_LANGS`, :10008). */
export const COMM_LANGS = ['English', 'Farsi', 'French'] as const;

/** `_qbValid` (:9991) — a bank is usable only if every entry has a real
 * question string. An owner who clears the box in App Design gets the built-in
 * bank back rather than a blank questionnaire. */
function isUsableBank(value: unknown): value is Question[] {
  const rows = asArray<unknown>(value);
  return (
    rows.length > 0 &&
    rows.every(
      (r) =>
        !!r &&
        typeof r === 'object' &&
        typeof (r as Question).q === 'string' &&
        (r as Question).q.trim() !== '',
    )
  );
}

/**
 * The live bank — `theme.qbQuestions` when the owner has set a usable one,
 * the built-in otherwise (`_qbLive`, :9992).
 *
 * Read at the START of a session, not per render, exactly as `startQ` does
 * (:10016) — so a saved owner edit shows without a new deploy, and a theme
 * that changes mid-questionnaire cannot renumber the steps under the
 * collector's feet.
 */
export function liveBank(): Question[] {
  const raw = settingUnknown('qbQuestions');
  if (!isUsableBank(raw)) return [...QB_DEFAULT];
  // Normalise each row so a hand-edited theme cannot put a non-array in
  // `opts` and blank the screen on `.map` — the crash this repo keeps writing
  // (docs/HANDOFF.md §6).
  return raw.map((r) => ({
    sec: typeof r.sec === 'string' ? r.sec : '',
    hint: typeof r.hint === 'string' ? r.hint : '',
    q: r.q,
    opts: asArray<unknown>(r.opts).filter((o): o is string => typeof o === 'string'),
    extra: typeof r.extra === 'string' ? r.extra : undefined,
    note: typeof r.note === 'string' ? r.note : undefined,
    showIf:
      r.showIf &&
      typeof r.showIf === 'object' &&
      typeof r.showIf.q === 'string' &&
      typeof r.showIf.has === 'string'
        ? { q: r.showIf.q, has: r.showIf.has }
        : undefined,
  }));
}

/** The live intro copy — `theme.qbIntro` merged over the built-in wording,
 * field by field, as `_qbIntro` + the `_i*` fallbacks do (:10039-10044). */
export function liveIntro(): QuestionnaireIntro {
  const raw = settingRecord('qbIntro');
  const pick = (key: keyof QuestionnaireIntro): string => {
    const v = raw[key];
    return typeof v === 'string' && v.trim() !== '' ? v : INTRO_DEFAULT[key];
  };
  return {
    eyebrow: pick('eyebrow'),
    title: pick('title'),
    lede: pick('lede'),
    fine: pick('fine'),
    button: pick('button'),
    stitle: pick('stitle'),
  };
}

/* ---- the served set (G-P25-2(a)) ----------------------------------------- */

/** What the controller runs on: the bank, the intro copy, and the draft
 * version a saved draft must match to be restored. */
export interface ResolvedBank {
  bank: Question[];
  intro: QuestionnaireIntro;
  /** `QVER` for the built-in / theme bank; `set:<hash>` for a served one. */
  version: number | string;
  source: 'served' | 'builtin';
}

/** The built-in (or theme-edited) bank — the fallback when nothing is served. */
export function fallbackBank(): ResolvedBank {
  return { bank: liveBank(), intro: liveIntro(), version: QVER, source: 'builtin' };
}

/** One served option's display text: the `{value, label}` label, falling back
 * to the value; a bare string is accepted too. The label is what the collector
 * picks and what goes out in `{q, a}`. */
function optionText(o: unknown): string {
  if (typeof o === 'string') return o.trim();
  if (!o || typeof o !== 'object') return '';
  const { label, value } = o as { label?: unknown; value?: unknown };
  if (typeof label === 'string' && label.trim()) return label.trim();
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Map a served question set onto the screen's `Question` shape, or `null`
 * when it has nothing usable (the empty "no active set" shape, a malformed
 * payload, or questions that are all blank) — the caller then falls back.
 *
 *  - `single_choice` → `hint: 'Choose one'` with its option labels (the step
 *    renders single-select from the hint, as it always has).
 *  - `text` → `hint: 'Optional'`, no options — the free-text step.
 *  - `sec` (the step's eyebrow) is blank: the served set has no section
 *    names, and inventing one would be new copy.
 *  - A `single_choice` question whose options are all unusable is kept as a
 *    free-text step rather than dropped, so it still gets asked.
 *
 * Questions are ordered by `order` (the server already does; a stable sort
 * here keeps a hand-built payload honest).
 */
export function servedBank(set: Partial<QuestionSet> | null | undefined): ResolvedBank | null {
  if (!set || typeof set !== 'object') return null;
  const rows = asArray<Record<string, unknown>>(set.questions)
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !!r && typeof r === 'object')
    .sort((a, b) => {
      const oa = typeof a.r.order === 'number' ? a.r.order : 0;
      const ob = typeof b.r.order === 'number' ? b.r.order : 0;
      return oa - ob || a.i - b.i;
    });
  const bank: Question[] = [];
  for (const { r } of rows) {
    const q = typeof r.prompt === 'string' ? r.prompt.trim() : '';
    if (!q) continue;
    const opts =
      r.question_type === 'text'
        ? []
        : asArray<unknown>(r.options)
            .map(optionText)
            .filter((o) => o !== '');
    bank.push({ sec: '', hint: opts.length ? 'Choose one' : 'Optional', q, opts });
  }
  if (bank.length === 0) return null;

  const base = liveIntro();
  const title = typeof set.title === 'string' ? set.title.trim() : '';
  const lede = typeof set.intro === 'string' ? set.intro.trim() : '';
  return {
    bank,
    intro: { ...base, title: title || base.title, lede: lede || base.lede },
    version: servedVersion(bank),
    source: 'served',
  };
}

/** The draft version of a served bank — `set:` + a short hash of every
 * step's question, hint and options, in order. The draft is indexed by step
 * number, so this is exactly "does step N still ask the same thing". A string
 * can never equal the numeric `QVER`, so switching between the served set and
 * the built-in bank always discards the other's draft. */
export function servedVersion(bank: readonly Question[]): string {
  const text = bank.map((b) => [b.q, b.hint, ...b.opts].join('\u0001')).join('\u0002');
  // djb2 — not security, just a compact stable fingerprint.
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `set:${(h >>> 0).toString(36)}:${bank.length}`;
}
