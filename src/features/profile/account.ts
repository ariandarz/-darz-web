/**
 * The Account card's logic, kept out of the view so it runs in the node test
 * project: which fields the collector may edit, the payload a save sends, and
 * the communication-language vocabulary.
 *
 * ## The fields — old card vs. this backend
 *
 * `profAccountHTML` (app.html:9765-9788) edits five things: Full name · Email ·
 * Phone · City (`field('name'|'email'|'phone'|'city')`, :9783) and the
 * Preferred communication language (`dzSel('uLangSel', COMM_LANGS, …)`, :9784).
 * `PATCH /api/auth/me/` (G-B1, `CollectorProfileUpdateSerializer`) accepts
 * exactly four: `full_name` · `phone` · `city` · `preferred_language`.
 *
 * **Email is the gap.** It is admin-controlled on this backend (not writable),
 * and `/auth/me/` does not even return it for a collector (`_collector_me_payload`
 * sends no `email`), so a read-only field would always be empty. It is left out
 * of the card and flagged — backend candidate: return the collector's email on
 * `Me` (read-only), and the card grows a disabled Email field.
 *
 * ## The language vocabulary
 *
 * The old list is `COMM_LANGS = ['English','Farsi','French']` (app.html:10008),
 * stored as the label itself. The backend stores a code from
 * `Collector.LANGUAGE_CHOICES` — `PreferredLanguageEnum` = `fa` · `en` — and
 * `/api/options/` does not serve those choices (C-14). So:
 *
 *  - the **values** are the schema enum's, and nothing else;
 *  - the **labels** come from `/api/options/` the day it serves
 *    `accounts.preferred_language`, and until then from the old app's own
 *    wording for the same language ("English", "Farsi" — not the backend's
 *    "Persian", which no collector-facing screen ever printed);
 *  - **French has no backend value** and is not offered (flagged).
 */
import type { Me } from '../../api/AuthSession';
import type { OptionsMap } from '../../api/services';
import type { Choice, MeUpdate, PreferredLanguage } from '../../api/types';

/** The four fields `PATCH /auth/me/` accepts, in the old card's order. */
export const ACCOUNT_FIELDS = ['full_name', 'phone', 'city', 'preferred_language'] as const;
export type AccountField = (typeof ACCOUNT_FIELDS)[number];
export type AccountValues = Record<AccountField, string>;

/** `PreferredLanguageEnum`, in the old `COMM_LANGS` order (English first). */
export const LANGUAGES = ['en', 'fa'] as const satisfies readonly PreferredLanguage[];

/** The old app's own name for each backend language (app.html:10008). */
const OLD_LABEL: Record<PreferredLanguage, string> = { en: 'English', fa: 'Farsi' };

/** The Account form's starting values — every field as a string, so an
 * absent/null server value is simply empty. */
export function accountValues(me: Me | null): AccountValues {
  return {
    full_name: me?.full_name ?? '',
    phone: me?.phone ?? '',
    city: me?.city ?? '',
    preferred_language: me?.preferred_language ?? '',
  };
}

/**
 * The PATCH body for a save: every editable field whose trimmed value differs
 * from what the server last said, and nothing else. Empty when nothing
 * changed — the caller then sends no request at all. A language the backend
 * does not know is dropped rather than sent to be rejected.
 */
export function accountPatch(values: Partial<AccountValues>, me: Me | null): MeUpdate {
  const current = accountValues(me);
  const body: MeUpdate = {};
  for (const field of ACCOUNT_FIELDS) {
    const raw = values[field];
    if (raw === undefined) continue;
    const value = raw.trim();
    if (value === current[field]) continue;
    if (field === 'preferred_language') {
      if (value === '' || isLanguage(value))
        body.preferred_language = value as PreferredLanguage;
      continue;
    }
    body[field] = value;
  }
  return body;
}

export function isLanguage(value: string): value is PreferredLanguage {
  return (LANGUAGES as readonly string[]).includes(value);
}

/** The Dropdown's options: enum values, labelled from `/api/options/` when it
 * serves them, else in the old app's words (see the header). */
export function languageOptions(options: OptionsMap | null): Array<{
  value: string;
  label: string;
}> {
  const served = (options?.['accounts.preferred_language'] as Choice[] | undefined) ?? [];
  return LANGUAGES.map((value) => ({
    value,
    label: served.find((c) => c.value === value)?.label ?? OLD_LABEL[value],
  }));
}

/** The questionnaire keeps the old label as its answer text (Darz reads the
 * `{q, a}` list); this is the code the same choice means on the account. */
export function languageFromLabel(label: string): PreferredLanguage | null {
  const hit = LANGUAGES.find((v) => OLD_LABEL[v] === label.trim());
  return hit ?? null;
}

/** …and back, for pre-filling the questionnaire from the account. */
export function labelForLanguage(value: string | null | undefined): string {
  return value && isLanguage(value) ? OLD_LABEL[value] : '';
}
