/**
 * Amount-field helpers, ported from `app.html`.
 *
 * `groupDigits` is `DZ.fmtNum` (:11085, v752 "live thousands-grouping for
 * amount fields") reduced to a pure string function so it can be unit-tested
 * and driven from React state instead of mutating the DOM node.
 * `parseAmount` is `Lib.num()` — it strips the commas again on submit, so the
 * grouping never changes what gets parsed.
 */

/** "12000" → "12,000". Strips non-digits and leading zeros, like the original. */
export function groupDigits(raw: string): string {
  const digits = String(raw ?? '')
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '');
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';
}

/** "12,000" → 12000. `NaN`-free: anything unparseable is 0. */
export function parseAmount(raw: string | number | null | undefined): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const n = Number(String(raw ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Caret position after regrouping — the original restores it by digit count
 * (`app.html:11085`) so typing in the middle of the number doesn't jump. */
export function caretAfterGrouping(grouped: string, digitsBeforeCaret: number): number {
  let seen = 0;
  let i = 0;
  for (; i < grouped.length && seen < digitsBeforeCaret; i += 1) {
    const code = grouped.charCodeAt(i);
    if (code >= 48 && code <= 57) seen += 1;
  }
  return i;
}

/** How many digits precede the caret in the raw (ungrouped-aware) value. */
export function digitsBefore(raw: string, caret: number): number {
  return raw.slice(0, caret).replace(/\D/g, '').length;
}
