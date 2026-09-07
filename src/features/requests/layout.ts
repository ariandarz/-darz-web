/**
 * Layout maths for the secondary-action row, kept out of the component file so
 * `ActionButtons.tsx` exports only a component (fast refresh) and this stays
 * unit-testable.
 *
 * app.html:9241 (v458) — "secondary actions adapt to count: 1→full, 2→2-up,
 * 3→3-up, 4→2×2, 5+→3-up. flex-grow fills any partial last row so buttons are
 * always aligned, never orphaned." The count is carried to CSS as `--an`.
 */
export function columnsFor(count: number): number {
  if (count <= 1) return 1;
  if (count === 2 || count === 4) return 2;
  return 3;
}
