/**
 * The Memberships desk's overview strip — the old panel's four-stat row
 * (`darz-studio.html:33342`), rebuilt from what this backend can count.
 *
 * **G-MEMB-1, decided 2026-09-22 the same way G-4 and G-CLUB-2 were**: two of
 * the old four are answerable, and the other two are named rather than faked.
 *
 * | old tile (`:33342`) | here |
 * | --- | --- |
 * | **Total members** | the ledger's `total_count` |
 * | **Active** | `?status=active`'s `total_count` |
 * | **Premium** | **absent.** The old panel's plans are Basic / Premium / Free Invite (`:33131`); this backend constrains a code's `plan` to `CollectorTierEnum` (`vip · active · new · institutional`), so a redeemed code sets a real `Collector.tier`. There is no Premium to count — it is a different vocabulary, not a missing filter. The desk header already records this deviation |
 * | **Expiring ≤ 7d** | **absent.** `MembershipCodeFilterSet` takes `plan`, `search` and `status` only — no date comparison — so this cannot be asked server-side. Counting it from the loaded page would answer "on this page", which is a different and misleading number. Backend gap **G-MEMB-7**: one `expires_before=` filter would give it |
 *
 * **"Expiring ≤ 7d" is the one worth raising.** It is the only tile of the four
 * that drives an action — it is how the owner knows whom to message before a
 * membership lapses — and the desk's own Expiry column already shows the day
 * math per row (`expiryParts`). What is missing is only the ability to ask the
 * ledger rather than the page.
 *
 * Counts, not an aggregate endpoint, for the reason `collectorTiles.ts` gives.
 */

export interface MembershipCounts {
  /** `null` = not loaded yet, or the read failed. */
  total: number | null;
  active: number | null;
}

export interface MembershipTile {
  key: string;
  label: string;
  value: string;
}

export const EMPTY_MEMBERSHIP_COUNTS: MembershipCounts = { total: null, active: null };

function show(n: number | null): string {
  return n === null ? '—' : n.toLocaleString('en-US');
}

export function membershipTiles(counts: MembershipCounts): MembershipTile[] {
  return [
    { key: 'total', label: 'Total members', value: show(counts.total) },
    { key: 'active', label: 'Active', value: show(counts.active) },
  ];
}
