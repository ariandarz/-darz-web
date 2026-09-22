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
 */
import { asArray } from '../../api/shapes';
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
