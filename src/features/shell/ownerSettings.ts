/**
 * The owner's runtime settings — the non-feature half of `theme`.
 *
 * `features.ts` already merges `theme.features` over the build-time flag table
 * at boot. The same freeform theme object (backend Phase 32, public
 * `GET /api/app-theme/`) is where the old panel kept every other
 * owner-adjustable value, and this is the reader for those: one store, set
 * once before first paint, with typed accessors that never throw on a theme
 * someone hand-edited into a bad shape.
 *
 * Deliberately separate from `design/ThemeController`, which is the Paper ⇄
 * Black *visual* theme and has nothing to do with this.
 *
 * Kept tiny on purpose: a setting belongs here only once something reads it.
 * The first is `requestWaitHours` (G-3); the questionnaire's owner-editable
 * bank and intro copy (`qbQuestions` / `qbIntro`) are the second and third.
 */

let settings: Record<string, unknown> = {};

/**
 * Called once at boot, beside `applyRuntimeFeatures`, with the raw `theme`
 * object. A failed fetch applies nothing, so every accessor falls back to the
 * value the code ships with — a dead theme endpoint must never change
 * behaviour, only fail to customise it.
 */
export function applyOwnerSettings(rawTheme: unknown): void {
  settings =
    rawTheme && typeof rawTheme === 'object' && !Array.isArray(rawTheme)
      ? (rawTheme as Record<string, unknown>)
      : {};
}

/**
 * A positive finite number from the theme, or `fallback`.
 *
 * Strict on purpose. The theme is hand-editable JSON, so `"18"`, `0`, `-1`,
 * `null` and `"soon"` are all things that can really be in there, and a
 * setting that silently became `0` would turn a "waiting too long" threshold
 * into "everything is overdue". A string of digits is accepted — it is the
 * one wrong type a person editing JSON in a text box produces by accident —
 * but nothing else is.
 */
export function settingNumber(key: string, fallback: number): number {
  const raw = settings[key];
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * A non-empty string from the theme, or `fallback`.
 *
 * Trims, and treats a blank string as unset — an owner who clears the box in
 * App Design means "none", not "empty string", and the one caller that has to
 * tell those apart (the membership sheet's WhatsApp number) shows a different
 * line when there is no number at all.
 */
export function settingString(key: string, fallback: string): string {
  const raw = settings[key];
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : fallback;
}

/**
 * The raw value under `key`, unread and unchecked — for a setting whose shape
 * is the reader's business rather than this module's.
 *
 * `settingNumber` above can decide what a good number is; it cannot decide
 * what a good *question bank* is, and a half-validator here would be a second
 * place to keep that rule in step with `questions.ts`. So this hands the value
 * over as `unknown`, which forces the reader to narrow it — see
 * `questionnaire/questions.ts::liveBank`, which does exactly that and falls
 * back to the built-in bank when the theme holds something unusable.
 */
export function settingUnknown(key: string): unknown {
  return settings[key];
}

/**
 * A plain object from the theme, or `{}` — for a settings GROUP whose fields
 * are each optional (`qbIntro`'s six strings).
 *
 * Returns `{}` rather than null for an array, a string or a missing key, so a
 * caller reads `record[field]` without a guard and gets `undefined` — which is
 * what its own per-field fallback already handles. An array is excluded
 * deliberately: `typeof [] === 'object'`, and an array reaching a field-by-field
 * reader gives every field `undefined` anyway, but saying so here keeps the
 * type honest.
 */
export function settingRecord(key: string): Record<string, unknown> {
  const raw = settings[key];
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

/** Test seam — resets the store between cases. Not used by app code. */
export function __resetOwnerSettings(): void {
  settings = {};
}
