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
 * The first is `requestWaitHours` (G-3).
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

/** Test seam — resets the store between cases. Not used by app code. */
export function __resetOwnerSettings(): void {
  settings = {};
}
