/**
 * QuestionnaireController — the questionnaire's state machine, framework-free.
 *
 * Port of the old app's `QA` / `QSTEP` module-level pair plus the functions
 * that mutate them (`startQ` :10015, `qform` :10082, `qpickStep`, `qnext`,
 * `qback`, `qconfirm` :11430) — one object instead of two globals, on the same
 * `Observable` base every other controller here extends (CLAUDE.md's
 * "Domain/logic layer — OOP with inheritance"). The view is a function
 * component that reads the snapshot; nothing about the flow lives in it.
 *
 * **Step numbering is the old app's, deliberately.** Step 0 is the contact
 * step ("About you"); steps 1…N index the bank one-based, so `answers[n]`
 * belongs to `bank[n-1]`. That is the key a saved draft is written under, and
 * why `QVER` exists — see `questions.ts`.
 *
 * ## Where the questions come from (G-P25-2(a))
 *
 * `load()` reads the owner's active set (`GET …/question-set/`) alongside the
 * collector's saved answers, and runs on it when it has questions. When the
 * server has no active set (its empty shape) or the read fails, the built-in /
 * theme bank is used instead — the screen never goes empty. The draft version
 * follows the bank actually in use (`ResolvedBank.version`), so a draft saved
 * against a different set of questions is discarded, not mis-attached.
 *
 * ## What the backend takes, and what it does not
 *
 * `POST /api/recommendations/questionnaire/` accepts exactly `{answers: [{q, a}]}`
 * — free text on both sides, full-replace, and the server feeds it to
 * `CollectorProfileService.build()`. So:
 *
 *  - **Every answer, including the contact step, is submitted as a `{q, a}`
 *    pair.** The old app's admin read the same flat text list, so a past
 *    submission stays readable after the bank is edited.
 *  - **The contact step also updates the collector's account (G-Q-1).** The
 *    old app wrote `email` / `phone` / `commLang` back onto the collector
 *    (:11442). After a successful submit the controller sends the phone and
 *    the language through `PATCH /api/auth/me/` (`AuthService.updateMe`) —
 *    the language as the backend's code (`languageFromLabel`: English → `en`,
 *    Farsi → `fa`; French has no backend value and is not sent). **Email is
 *    not written** — the backend does not accept it (admin-controlled), so it
 *    reaches Darz only as an answer. The write is best-effort: the answers
 *    are already with Darz, and a failed account write must not turn a sent
 *    profile into an error.
 *  - The contact fields **pre-fill from the account** when there is no draft,
 *    as `startQ` pre-filled from the collector (`s.phone||u.phone`, :10015).
 *
 * ## Where the draft lives
 *
 * The SERVER holds the submitted answers (`GET` 404s until the first submit).
 * An in-progress draft is per-device, in `localStorage`, exactly as the old
 * app kept it (`persistQ`, :10013) — a collector who closes the app mid-way
 * comes back to their place. It is a convenience, never a source of truth:
 * every read is wrapped, a private window that throws simply starts fresh, and
 * the draft is cleared on a successful submit so the server's copy is the only
 * one left.
 */
import { asArray } from '../../api/shapes';
import type { RecommendationService } from '../../api/services';
import type { MeUpdate } from '../../api/types';
import { languageFromLabel } from '../profile/account';
import { Observable } from '../shared/Observable';
import {
  fallbackBank,
  servedBank,
  type Question,
  type QuestionnaireIntro,
  type ResolvedBank,
} from './questions';

/** Which screen the flow is on — `qintro` / `qform` / `qreview` / `qDone`. */
/** Whether a `GET …/questionnaire/` read means "already sent". The backend now
 * answers a never-submitted collector with 200 and `answered: false` (G-P25-1),
 * so a successful read is not proof. A payload without the flag (an older
 * backend) falls back to `submitted_at`. */
export function isQuestionnaireAnswered(saved: {
  answered?: boolean | null;
  submitted_at?: string | null;
}): boolean {
  if (typeof saved.answered === 'boolean') return saved.answered;
  return Boolean(saved.submitted_at);
}

export type QStage = 'intro' | 'step' | 'review' | 'done';

export interface Contact {
  email: string;
  phone: string;
  lang: string;
}

export interface QuestionnaireSnapshot {
  stage: QStage;
  /** 0 = the contact step; 1…bank.length index the bank one-based. */
  step: number;
  bank: Question[];
  /** The intro screen's copy — the served set's title/intro over the
   * built-in wording (see `questions.ts`). */
  intro: QuestionnaireIntro;
  /** Whether the bank is the owner's served set or the built-in fallback. */
  source: ResolvedBank['source'];
  contact: Contact;
  /** Multi-select answers, per step. A free-text step stores `[text]`. */
  answers: Record<number, string[]>;
  /** The one optional free-text field a step may carry (`ansExtra`). */
  extras: Record<number, string>;
  /** Whether this collector has already sent a profile (server-side). */
  submitted: boolean;
  /** `submitted_at` from the server, for the "Sent to Darz · date" badge. */
  submittedAt: string | null;
  status: 'loading' | 'idle' | 'saving';
  error: string | null;
}

const DRAFT_KEY = 'darz_questionnaire';

/** The one account call the controller makes — `AuthService.updateMe`. */
export interface AccountWriter {
  updateMe(body: MeUpdate): Promise<unknown>;
}

/** The contact step's account write (G-Q-1): the phone and the language code,
 * whichever are filled in and mean something to `PATCH /auth/me/`. Empty when
 * there is nothing to send. Email is never in it (not writable). */
export function contactPatch(contact: Contact): MeUpdate {
  const body: MeUpdate = {};
  const phone = contact.phone.trim();
  if (phone) body.phone = phone;
  const lang = languageFromLabel(contact.lang);
  if (lang) body.preferred_language = lang;
  return body;
}

interface Draft {
  qver?: number | string;
  email?: string;
  phone?: string;
  lang?: string;
  ans?: Record<number, string[]>;
  ansExtra?: Record<number, string>;
}

function readDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Draft)
      : {};
  } catch {
    return {};
  }
}

/** The contact step's three answers, as the `{q, a}` rows Darz reads. The
 * labels are the old form's own field labels (`:10094-10098`). */
const CONTACT_LABELS: ReadonlyArray<readonly [keyof Contact, string]> = [
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['lang', 'Preferred communication language'],
];

export class QuestionnaireController extends Observable<QuestionnaireSnapshot> {
  private readonly api: RecommendationService;
  private readonly account: AccountWriter | null;
  /** The draft version of the bank in use — see `ResolvedBank.version`. */
  private version: number | string;

  constructor(api: RecommendationService, account: AccountWriter | null = null) {
    // Read ONCE, here and in `load()`, not per render — `startQ` (:10016) does
    // the same, so a theme save mid-questionnaire cannot renumber the steps
    // under the collector.
    const initial = fallbackBank();
    super({
      stage: 'intro',
      step: 0,
      bank: initial.bank,
      intro: initial.intro,
      source: initial.source,
      contact: { email: '', phone: '', lang: '' },
      answers: {},
      extras: {},
      submitted: false,
      submittedAt: null,
      status: 'loading',
      error: null,
    });
    this.api = api;
    this.account = account;
    this.version = initial.version;
  }

  /** The served set when it has questions, the built-in bank otherwise —
   * including when the read fails. Never throws. */
  private async resolveBank(): Promise<ResolvedBank> {
    try {
      return servedBank(await this.api.questionSet()) ?? fallbackBank();
    } catch {
      return fallbackBank();
    }
  }

  /**
   * `startQ` (:10015): restore the draft (falling back to `prefill`, the
   * account's own values), then ask the server whether a
   * profile was already sent. A returning collector lands on the review; a new
   * one sees the intro.
   *
   * The backend answers 200 `{answers: [], submitted_at: null, answered: false}`
   * for a collector who never sent one (G-P25-1) — so the 200 alone means
   * nothing; `answered` decides (`isQuestionnaireAnswered`). An older backend
   * answered that case with a 404, and any error is still treated as "not yet"
   * on purpose: a questionnaire that cannot be read is still one the collector
   * can fill in, and refusing to open the screen over it would be worse than
   * starting fresh.
   */
  async load(prefill: Partial<Contact> = {}): Promise<void> {
    // Both reads go out together; the bank must be known before the draft is
    // judged, because the draft's version is compared with the bank's.
    const savedRead = this.api.questionnaire();
    // An unobserved rejection while the set is awaited would be reported as
    // unhandled; it is handled below, at the `await`.
    savedRead.catch(() => undefined);
    const resolved = await this.resolveBank();
    this.version = resolved.version;
    const draft = readDraft();
    const fresh = draft.qver !== resolved.version;
    this.patch({
      bank: resolved.bank,
      intro: resolved.intro,
      source: resolved.source,
      contact: {
        email: draft.email || prefill.email || '',
        phone: draft.phone || prefill.phone || '',
        lang: draft.lang || prefill.lang || '',
      },
      answers: fresh ? {} : sanitiseAnswers(draft.ans),
      extras: fresh ? {} : sanitiseExtras(draft.ansExtra),
    });

    try {
      const saved = await savedRead;
      if (!isQuestionnaireAnswered(saved)) {
        this.patch({ submitted: false, status: 'idle', stage: 'intro' });
        return;
      }
      const answers = asArray<{ q?: unknown; a?: unknown }>(saved.answers);
      this.patch({
        submitted: true,
        submittedAt: saved.submitted_at ?? null,
        status: 'idle',
        stage: 'review',
      });
      // Only adopt the server's answers when there is no usable local draft —
      // a draft the collector was part-way through is newer than what they
      // last sent, and silently replacing it would lose their edits.
      if (fresh || Object.keys(this.getSnapshot().answers).length === 0) {
        this.adoptServerAnswers(answers);
      }
    } catch {
      this.patch({ submitted: false, status: 'idle', stage: 'intro' });
    }
  }

  /** Map the server's flat `{q, a}` list back onto the current bank — the
   * served set's prompts when one is in use — by question text, the one join
   * key that survives the bank being reordered.
   * A question that is no longer in the bank is simply not shown, which is
   * what `QVER` already promises. */
  private adoptServerAnswers(rows: ReadonlyArray<{ q?: unknown; a?: unknown }>): void {
    const { bank } = this.getSnapshot();
    const answers: Record<number, string[]> = {};
    const contact: Contact = { ...this.getSnapshot().contact };
    for (const row of rows) {
      const q = typeof row.q === 'string' ? row.q : '';
      const a = typeof row.a === 'string' ? row.a : '';
      if (!q || !a) continue;
      const contactField = CONTACT_LABELS.find(([, label]) => label === q);
      if (contactField) {
        if (!contact[contactField[0]]) contact[contactField[0]] = a;
        continue;
      }
      const index = bank.findIndex((b) => b.q === q);
      if (index < 0) continue;
      // Options were joined with " · " on the way out; a free-text answer has
      // no separator and comes back as a single element, which is exactly how
      // a free-text step stores it.
      answers[index + 1] = a.split(' · ').filter((v) => v.trim() !== '');
    }
    this.patch({ answers, contact });
  }

  /* ---- navigation --------------------------------------------------- */

  begin(): void {
    this.patch({ stage: 'step', step: 0 });
  }

  /** `qStepHidden` (:9996) — a conditional step whose trigger is not met. */
  isHidden(step: number): boolean {
    const { bank, answers } = this.getSnapshot();
    const b = bank[step - 1];
    if (!b?.showIf) return false;
    const source = bank.findIndex((x) => x.q === b.showIf!.q);
    if (source < 0) return false;
    return !(answers[source + 1] ?? []).includes(b.showIf.has);
  }

  /** `qVisibleSteps` (:10002) — step 0 plus every unhidden bank step. Drives
   * the progress bar and the "n / N" counter, so a skipped conditional never
   * leaves a phantom segment. */
  visibleSteps(): number[] {
    const { bank } = this.getSnapshot();
    const out = [0];
    for (let i = 1; i <= bank.length; i++) if (!this.isHidden(i)) out.push(i);
    return out;
  }

  next(): void {
    const { step, bank } = this.getSnapshot();
    let n = step + 1;
    while (n <= bank.length && this.isHidden(n)) n++;
    if (n > bank.length) {
      this.patch({ stage: 'review' });
      return;
    }
    this.patch({ step: n });
  }

  /** `qback` — step 0's back leaves the questionnaire, which the view handles;
   * returns false when there is nowhere further back to go. */
  back(): boolean {
    const { step, stage } = this.getSnapshot();
    if (stage === 'review') {
      const visible = this.visibleSteps();
      this.patch({ stage: 'step', step: visible[visible.length - 1] ?? 0 });
      return true;
    }
    if (step <= 0) return false;
    let n = step - 1;
    while (n >= 1 && this.isHidden(n)) n--;
    this.patch({ step: n });
    return true;
  }

  /** "Edit answers" / "Update answers" on the review (`DZ.openQ`). */
  edit(): void {
    this.patch({ stage: 'step', step: 0 });
  }

  /* ---- answering ----------------------------------------------------- */

  setContact(field: keyof Contact, value: string): void {
    this.patch({ contact: { ...this.getSnapshot().contact, [field]: value } });
    this.persist();
  }

  /** `qpickStep` (:10111) — single-select replaces, multi-select toggles. */
  pick(step: number, option: string, single: boolean): void {
    const current = this.getSnapshot().answers[step] ?? [];
    const next = single
      ? current.includes(option)
        ? []
        : [option]
      : current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
    this.patch({ answers: { ...this.getSnapshot().answers, [step]: next } });
    this.persist();
  }

  /** The free-text step (`qtext`) — stored as a one-element list so every
   * step reads the same way. */
  setText(step: number, value: string): void {
    this.patch({
      answers: { ...this.getSnapshot().answers, [step]: value.trim() ? [value] : [] },
    });
    this.persist();
  }

  /** The optional field beside a step's options (`qextra`). */
  setExtra(step: number, value: string): void {
    this.patch({ extras: { ...this.getSnapshot().extras, [step]: value } });
    this.persist();
  }

  /** Whether Continue is enabled (`canCont`, :10119): the contact step always
   * is, an optional or option-less step always is, and everything else needs
   * an answer or its extra field filled. */
  canContinue(): boolean {
    const { step, bank, answers, extras } = this.getSnapshot();
    if (step === 0) return true;
    const b = bank[step - 1];
    if (!b) return true;
    const optional = /optional/i.test(b.hint) || b.opts.length === 0;
    if (optional) return true;
    if ((answers[step] ?? []).length > 0) return true;
    return !!b.extra && (extras[step] ?? '').trim() !== '';
  }

  /* ---- submit --------------------------------------------------------- */

  /**
   * `qconfirm` (:11430). Full-replace on the server; on success the local
   * draft is cleared, because the server's copy is now the answer and a stale
   * draft would quietly win the next `load()`.
   */
  async submit(): Promise<boolean> {
    this.patch({ status: 'saving', error: null });
    try {
      const saved = await this.api.submitQuestionnaire(this.payload());
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // A private window that refuses to remove is harmless: the server has
        // the answers, and the next load() re-adopts them over the draft.
      }
      await this.writeContact();
      this.patch({
        status: 'idle',
        stage: 'done',
        submitted: true,
        submittedAt: saved.submitted_at ?? new Date().toISOString(),
      });
      return true;
    } catch (err: unknown) {
      this.patch({
        status: 'idle',
        error: err instanceof Error ? err.message : 'Could not send your profile.',
      });
      return false;
    }
  }

  /** The `{q, a}` list the server stores — contact first, then every visible
   * answered step, with a step's extra field appended the way the review
   * renders it (`:10130`). */
  payload(): Array<{ q: string; a: string }> {
    const { bank, contact, answers, extras } = this.getSnapshot();
    const rows: Array<{ q: string; a: string }> = [];
    for (const [field, label] of CONTACT_LABELS) {
      const value = contact[field].trim();
      if (value) rows.push({ q: label, a: value });
    }
    bank.forEach((b, i) => {
      const n = i + 1;
      if (this.isHidden(n)) return;
      const picked = (answers[n] ?? []).join(' · ');
      const extra = b.extra ? (extras[n] ?? '').trim() : '';
      const a = extra
        ? picked
          ? `${picked} · ${b.extra}: ${extra}`
          : `${b.extra}: ${extra}`
        : picked;
      if (a) rows.push({ q: b.q, a });
    });
    return rows;
  }

  /** G-Q-1 — the contact step onto the account. Best-effort by design: see
   * the header. */
  private async writeContact(): Promise<void> {
    if (!this.account) return;
    const body = contactPatch(this.getSnapshot().contact);
    if (Object.keys(body).length === 0) return;
    try {
      await this.account.updateMe(body);
    } catch {
      // the answers reached Darz; the account keeps its previous values
    }
  }

  private persist(): void {
    const { contact, answers, extras } = this.getSnapshot();
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          qver: this.version,
          email: contact.email,
          phone: contact.phone,
          lang: contact.lang,
          ans: answers,
          ansExtra: extras,
          ts: Date.now(),
        }),
      );
    } catch {
      // Storage full, disabled, or a private window — the flow carries on in
      // memory. Losing a draft is a worse outcome than not having one, never
      // a reason to stop.
    }
  }
}

function sanitiseAnswers(raw: unknown): Record<number, string[]> {
  const out: Record<number, string[]> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(k);
    if (!Number.isInteger(n)) continue;
    const list = asArray<unknown>(v).filter((x): x is string => typeof x === 'string');
    if (list.length) out[n] = list;
  }
  return out;
}

function sanitiseExtras(raw: unknown): Record<number, string> {
  const out: Record<number, string> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(k);
    if (Number.isInteger(n) && typeof v === 'string') out[n] = v;
  }
  return out;
}
