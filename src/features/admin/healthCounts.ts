/**
 * The Data Health desk's counts panel — the old panel's **"Data Health &
 * Counts"** grid (`_dzDataOverview`, `darz-studio.html:26277-26340`).
 *
 * **G-HEALTH-1, built 2026-09-22.** The audit recorded eight of that panel's
 * twelve boxes as "absent with no reason recorded anywhere, which is the gap",
 * and called it the largest of the open items. This is the answer to it:
 * **four of the eight are built, and four are not — each for a named reason.**
 *
 * The audit's own recommendation was "one aggregate on the existing
 * data-health endpoint, not eight client reads". That is still the right
 * backend answer, and it is not available: the owner's 2026-09-22 decision is
 * frontend-only, the backend is not moving. So this does the client half, and
 * it costs **one extra read**, not eight — because two of the four are numbers
 * `GET /catalog/admin/data-health/` already returns and the desk already has.
 *
 * ## The eight, one by one
 *
 * | old box (`:26317-26340`) | here |
 * | --- | --- |
 * | **Market App Artworks** | `?published=true` — one `per_page: 1` read |
 * | **Incomplete Records** | `report.incomplete_records.count`, already loaded |
 * | **Duplicate Artworks** | `report.duplicate_images.count`, already loaded. The old tile's own definition is "extra copies that share the SAME image — the only collision-proof signal", which is exactly what this check computes, so it is the same number and not an approximation |
 * | **Archived / Unavailable** | `sold + archived + withdrawn` from `ArtworkAvailabilityStatusEnum`, three `per_page: 1` reads. The old list is `sold · withdrawn · unavailable · archived · removed · expired` (`:26311`); the last three have no counterpart in this enum, and `on_hold` / `reserved` are deliberately excluded — a held work is still being offered |
 * | **Gallery- / Dealer- / Artist-Sourced** | **absent.** The artwork carries `source_name`, a free string; the source TYPE (`gallery · artist · collector · dealer`) lives on `GalleryLink`, the Sources & Partners model. Counting by type would mean joining every partner's type to every artwork's name — one read per partner, client-side. Backend gap **G-HEALTH-2**: a `source_type` filter on `ArtworkAdminFilterSet`, or the three counts on the health report |
 * | **Deleted (permanent)** | **absent.** The old tile counts cloud tombstones so the owner can see deletions are final. This backend soft-deletes and exposes no count of deleted rows. Backend gap **G-HEALTH-3** |
 * | **Recently Added** | **absent.** "Added in the last 30 days" needs a date comparison, and `ArtworkAdminFilterSet` has none. Backend gap **G-HEALTH-4**: one `created_after=` filter |
 *
 * The four the audit listed as "this architecture's and correctly gone"
 * (Active artworks in cloud · Synced artworks · Sync issues · Admin database
 * artworks "on this device") stay gone. Each is about a device-local copy
 * drifting from a cloud, and there is one database here.
 *
 * ## Why there are no band headings
 *
 * The old grid groups its twelve boxes under three `dz-ovsec` headings
 * (Storage & visibility · Where artworks come from · Quality & lifecycle,
 * `:26316-26331`). They are not ported, and the reason is arithmetic: the
 * middle band is entirely G-HEALTH-2, and the remaining four boxes split 1 and
 * 3 — two headings over rows of one and three tiles read as clutter, not
 * structure. The headings earn their place at twelve boxes and should come
 * back with them, whenever the gaps below are closed.
 *
 * ## Why a failed read shows `—`
 *
 * Same rule as every other strip in this panel (`collectorTiles.ts`): an
 * unknown number and none are different facts, and on a HEALTH desk the
 * confident zero is worse than elsewhere — "0 incomplete records" is the
 * screen saying everything is fine.
 */
import type { DataHealthReport } from '../../api/types';

/** The statuses the old panel counts as archived, intersected with this
 * backend's enum — see the table above. */
export const ARCHIVED_STATUSES = ['sold', 'archived', 'withdrawn'] as const;

export interface HealthCounts {
  /** `null` = not loaded yet, or the read failed. */
  published: number | null;
  archived: number | null;
}

export const EMPTY_HEALTH_COUNTS: HealthCounts = { published: null, archived: null };

export interface HealthTile {
  key: string;
  /** The old box's title, verbatim (`:26317-26340`). */
  title: string;
  value: string;
  /** The old box's one-line explanation, which changes with the number on the
   * two quality tiles exactly as it does there. */
  exp: string;
  /** `warn` draws the attention border — the old `dz-ovbox--warn`. */
  tone?: 'warn';
}

function show(n: number | null): string {
  return n === null ? '—' : n.toLocaleString('en-US');
}

/**
 * The four buildable boxes, in the old panel's own order and band grouping
 * (Storage & visibility → Quality & lifecycle; the middle band, "Where
 * artworks come from", is the one that is entirely G-HEALTH-2).
 *
 * `report` may be null — the desk renders the panel before the checks land,
 * and two tiles read from it.
 */
export function healthTiles(
  counts: HealthCounts,
  report: DataHealthReport | null,
): HealthTile[] {
  const incomplete = countOf(report?.incomplete_records);
  const duplicates = countOf(report?.duplicate_images);
  return [
    {
      key: 'published',
      title: 'Market App Artworks',
      value: show(counts.published),
      exp: 'Visible to collectors right now',
    },
    {
      key: 'incomplete',
      title: 'Incomplete Records',
      value: show(incomplete),
      exp: incomplete ? 'Missing required fields' : 'All records complete',
      tone: incomplete ? 'warn' : undefined,
    },
    {
      key: 'duplicates',
      title: 'Duplicate Artworks',
      value: show(duplicates),
      exp: duplicates ? 'Same image — extra copies' : 'No duplicates found',
      tone: duplicates ? 'warn' : undefined,
    },
    {
      key: 'archived',
      title: 'Archived / Unavailable',
      value: show(counts.archived),
      exp: 'Sold, withdrawn or archived',
      tone: counts.archived ? 'warn' : undefined,
    },
  ];
}

/** A check's `count`, or `null` when the report is absent or the field is not
 * a number — the report's items are typed loosely and this desk has already
 * been bitten once by trusting a response's shape (docs/HANDOFF.md §6). */
function countOf(check: { count?: unknown } | undefined): number | null {
  return typeof check?.count === 'number' ? check.count : null;
}
