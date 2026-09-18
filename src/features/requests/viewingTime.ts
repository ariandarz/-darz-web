/** Date helpers for the viewing sheet — kept out of the component file so
 * fast refresh stays clean (same split as `rows.ts` / `catalogue/format.ts`). */

/** `YYYY-MM-DDTHH:mm` in local time — the value a `datetime-local` input takes. */
export function toLocalInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`;
}
