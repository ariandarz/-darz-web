/**
 * The Collectors desk's overview strip — the old panel's `colx-ov`
 * (`darz-studio.html:32634`), rebuilt from what this backend can actually
 * count.
 *
 * ## Two of the old four tiles exist; two do not, and are not faked
 *
 * | old tile (`:32633`) | here |
 * | --- | --- |
 * | **Collectors** | the roster's `total_count` |
 * | **VIP** | `?tier=vip`'s `total_count` |
 * | **Active 30d** | **absent** — needs a last-activity timestamp per collector; the row has none, and the only activity endpoint is per-collector |
 * | **Engaged** (has any activity) | **absent** — same aggregate, same absence |
 *
 * In their place is **Active**, which this backend *does* know:
 * `access_status = active`. It is a different question from the old "Active
 * 30d" — access rather than behaviour — so it carries its own label rather
 * than quietly occupying the old tile's name. Recorded as **G-COL-1**.
 *
 * ## Why the counts ignore the desk's filters
 *
 * The old strip was computed from the **full** roster, not the filtered view,
 * and said so at its own call site: *"so Admin always sees the true totals"*
 * (`:32632`). Ported as-is — a strip that moved with the filter below it would
 * be answering a different question from the one it appears to ask, and the
 * desk already shows the filtered count in its pager.
 *
 * ## Why counts, not a new endpoint
 *
 * Each tile is one `per_page: 1` read of a list the desk already talks to;
 * `total_count` comes back in the envelope's pagination. No aggregate
 * endpoint, no new backend surface, and a tile whose read fails shows `—`
 * rather than a zero — an unknown number and none are different facts, and a
 * confident `0 VIP` would be the worse lie.
 */

export interface CollectorCounts {
  /** `null` = not loaded yet, or the read failed. */
  total: number | null;
  vip: number | null;
  active: number | null;
}

export interface CollectorTile {
  key: string;
  label: string;
  value: string;
  /** Shown under the number when the tile needs a caveat. */
  note?: string;
}

export const EMPTY_COUNTS: CollectorCounts = { total: null, vip: null, active: null };

function show(n: number | null): string {
  return n === null ? '—' : n.toLocaleString('en-US');
}

export function collectorTiles(counts: CollectorCounts): CollectorTile[] {
  return [
    { key: 'total', label: 'Collectors', value: show(counts.total) },
    { key: 'vip', label: 'VIP', value: show(counts.vip) },
    {
      key: 'active',
      label: 'Active',
      value: show(counts.active),
      // Named so nobody reads it as the old "Active 30d".
      note: 'access is open',
    },
  ];
}
