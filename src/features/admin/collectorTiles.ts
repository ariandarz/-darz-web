/**
 * The Collectors desk's overview strip — the old panel's `colx-ov`
 * (`darz-studio.html:32626-32631`): **Collectors · VIP · Active 30d ·
 * Engaged**, in that order, with the old labels.
 *
 * Since G-COL-1 the four numbers come from one aggregate,
 * `GET /api/auth/admin/collectors/summary/` → `{collectors, vip, active_30d,
 * engaged}`, counted server-side over the whole roster — the old strip's own
 * rule, "computed from the FULL roster (not the filtered view) so Admin
 * always sees the true totals" (`:32626-32627`). The three `per_page: 1` count reads
 * this strip used to make, and the stand-in "Active · access is open" tile,
 * are gone.
 *
 * The backend's definitions (`accounts/services.py:365-392`): Active 30d = a
 * behavioural signal in the last 30 days; Engaged = took an active step ever
 * (any request, or a saved artwork) — the old `withActs` ("has any activity").
 *
 * A failed or pending read shows `—` on every tile rather than a zero — an
 * unknown number and none are different facts, and a confident `0 VIP` would
 * be the worse lie.
 */
import type { CollectorDeskSummary } from '../../api/types';

export interface CollectorTile {
  key: keyof CollectorDeskSummary;
  label: string;
  value: string;
}

/** The old `ovItems` (`:32630`), label for label. */
const TILES: ReadonlyArray<readonly [keyof CollectorDeskSummary, string]> = [
  ['collectors', 'Collectors'],
  ['vip', 'VIP'],
  ['active_30d', 'Active 30d'],
  ['engaged', 'Engaged'],
];

function show(n: unknown): string {
  return typeof n === 'number' ? n.toLocaleString('en-US') : '—';
}

/** `summary` is `null` until the read lands, or when it failed. A field that
 * is not a number shows `—` — the response is read defensively. */
export function collectorTiles(summary: CollectorDeskSummary | null): CollectorTile[] {
  return TILES.map(([key, label]) => ({ key, label, value: show(summary?.[key]) }));
}

/** The roster row's "last active" line — the old card's `lastLine`
 * (`:32649`): "Last active <d Mon yyyy>" or "No activity yet".
 * `last_activity_at` is a list-only rollup (C-16). */
export function lastActiveLine(at: string | null | undefined): string {
  if (!at) return 'No activity yet';
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return 'No activity yet';
  return `Last active ${d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;
}
