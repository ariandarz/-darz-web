/**
 * The Data Health desk's counts panel — the old panel's **"Data Health &
 * Counts"** grid (`_dzDataOverview`, `darz-studio.html:26284-26345`).
 *
 * **All nine catalogue boxes are built (V1 Phase 4).** G-HEALTH-1 (2026-09-22)
 * built four; the other five waited on backend gaps that are now closed:
 * `source_type` (G-HEALTH-2), the report's `deleted_records` (G-HEALTH-3) and
 * `created_after` (G-HEALTH-4).
 *
 * | old box (`:26317-26340`) | here |
 * | --- | --- |
 * | **Market App Artworks** | `?published=true` — one `per_page: 1` read |
 * | **Gallery- / Dealer- / Artist-Sourced** | `?source_type=gallery|dealer|artist` — three `per_page: 1` reads. `source_type` is blank until an admin sets it (no backfill from the free-text source), so these count classified works only |
 * | **Incomplete Records** | `report.incomplete_records.count` |
 * | **Duplicate Artworks** | `report.duplicate_images.count` — the old tile's own definition, "the SAME image" |
 * | **Deleted (permanent)** | `report.deleted_records.count` (soft-deleted rows) |
 * | **Recently Added** | `?created_after=<now − 30 days>` — "Added in the last 30 days" |
 * | **Archived / Unavailable** | `sold + archived + withdrawn`, three `per_page: 1` reads. The old list is `sold · withdrawn · unavailable · archived · removed · expired` (`:26311`); the last three have no counterpart in this enum, and `on_hold` / `reserved` are deliberately excluded — a held work is still being offered |
 *
 * The four boxes that were this architecture's and correctly gone (Active
 * artworks in cloud · Synced artworks · Sync issues · Admin database artworks
 * "on this device") stay gone — each is about a device-local copy drifting
 * from a cloud, and there is one database here.
 *
 * **The three band headings are back** (`dz-ovsec`, `:26316`, `:26321`,
 * `:26331`) now that each band has its tiles.
 *
 * **Links.** A box the old panel made clickable opens its list (`go`):
 * Market App → the Database `published`; Incomplete → `complete=false`
 * (the old `details:'incomplete'`); Duplicates → `duplicate_images`; Recently
 * Added → `created_after` (the old "latest 50 added"). **Deviation, flagged:**
 * the three Sourced boxes opened the Sources & Partners sections
 * (`sourcesGo('galleries')` …), which list partners, not works; here they
 * open the Database filtered to exactly the works counted — the old
 * dashboard's rule that a counter equals the list it opens (`:21349`).
 * Archived (old: the Archive section — no counterpart) and Deleted are not
 * links.
 *
 * **Why a failed read shows `—`:** an unknown number and none are different
 * facts, and on a HEALTH desk the confident zero is worse than elsewhere —
 * "0 incomplete records" is the screen saying everything is fine.
 */
import type { ArtworkAdminQuery, DataHealthReport } from '../../api/types';
import { databaseLink } from './artworkQuery';

/** The statuses the old panel counts as archived, intersected with this
 * backend's enum — see the table above. */
export const ARCHIVED_STATUSES = ['sold', 'archived', 'withdrawn'] as const;

/** The three source kinds the old middle band counts (`:26322-26324`), in its
 * order. Values are `Artwork.SOURCE_TYPE_CHOICES` (`catalog/models.py:125`). */
export const SOURCED = [
  { key: 'gallery', title: 'Gallery-Sourced', exp: 'Received from galleries' },
  { key: 'dealer', title: 'Dealer-Sourced', exp: 'Received from dealers' },
  { key: 'artist', title: 'Artist-Sourced', exp: 'Direct from artists' },
] as const;
export type SourceKind = (typeof SOURCED)[number]['key'];

export interface HealthCounts {
  /** `null` = not loaded yet, or the read failed. */
  published: number | null;
  archived: number | null;
  recent: number | null;
  sourced: Record<SourceKind, number | null>;
}

export const EMPTY_HEALTH_COUNTS: HealthCounts = {
  published: null,
  archived: null,
  recent: null,
  sourced: { gallery: null, dealer: null, artist: null },
};

/** The count reads the panel makes, each a `per_page: 1` list read whose
 * `total_count` is the number. `since` is the Recently Added window's start,
 * fixed once so the count and its link agree. */
export function healthCountQueries(since: string): {
  published: ArtworkAdminQuery;
  recent: ArtworkAdminQuery;
  sourced: Record<SourceKind, ArtworkAdminQuery>;
  archived: ArtworkAdminQuery[];
} {
  return {
    published: { published: true },
    recent: { created_after: since },
    sourced: {
      gallery: { source_type: 'gallery' },
      dealer: { source_type: 'dealer' },
      artist: { source_type: 'artist' },
    },
    archived: ARCHIVED_STATUSES.map((availability_status) => ({ availability_status })),
  };
}

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
  /** Where tapping the box goes — see the header. */
  to?: string;
}

export interface HealthBand {
  /** The old `dz-ovsec` heading. */
  title: string;
  tiles: HealthTile[];
}

function show(n: number | null): string {
  return n === null ? '—' : n.toLocaleString('en-US');
}

/**
 * The nine boxes in the old panel's three bands and order.
 *
 * `report` may be null — the desk renders the panel before the checks land,
 * and three tiles read from it.
 */
export function healthBands(
  counts: HealthCounts,
  report: DataHealthReport | null,
  since: string,
): HealthBand[] {
  const incomplete = countOf(report?.incomplete_records);
  const duplicates = countOf(report?.duplicate_images);
  const deleted = countOf(report?.deleted_records);
  return [
    {
      title: 'Storage & visibility',
      tiles: [
        {
          key: 'published',
          title: 'Market App Artworks',
          value: show(counts.published),
          exp: 'Visible to collectors right now',
          to: databaseLink({ published: true }),
        },
      ],
    },
    {
      title: 'Where artworks come from',
      tiles: SOURCED.map((s) => ({
        key: `sourced-${s.key}`,
        title: s.title,
        value: show(counts.sourced[s.key]),
        exp: s.exp,
        to: databaseLink({ source_type: s.key }),
      })),
    },
    {
      title: 'Quality & lifecycle',
      tiles: [
        {
          key: 'incomplete',
          title: 'Incomplete Records',
          value: show(incomplete),
          exp: incomplete ? 'Missing required fields' : 'All records complete',
          tone: incomplete ? 'warn' : undefined,
          to: databaseLink({ complete: false }),
        },
        {
          key: 'duplicates',
          title: 'Duplicate Artworks',
          value: show(duplicates),
          exp: duplicates ? 'Same image — extra copies' : 'No duplicates found',
          tone: duplicates ? 'warn' : undefined,
          to: databaseLink({ duplicate_images: true }),
        },
        {
          key: 'deleted',
          title: 'Deleted (permanent)',
          value: show(deleted),
          // The old line was "Tombstoned — can’t come back" (`:26338`): a
          // cloud tombstone. Here a delete is a soft delete the backend can
          // restore, so that promise would be false — adapted, flagged.
          exp: 'Removed from the Database',
        },
        {
          key: 'recent',
          title: 'Recently Added',
          value: show(counts.recent),
          exp: 'Added in the last 30 days',
          to: databaseLink({ created_after: since }),
        },
        {
          key: 'archived',
          title: 'Archived / Unavailable',
          value: show(counts.archived),
          exp: 'Sold, withdrawn or archived',
          tone: counts.archived ? 'warn' : undefined,
        },
      ],
    },
  ];
}

/** Every tile, flat, in order — for tests and anything that does not draw bands. */
export function healthTiles(
  counts: HealthCounts,
  report: DataHealthReport | null,
  since: string,
): HealthTile[] {
  return healthBands(counts, report, since).flatMap((b) => b.tiles);
}

/** A check's `count`, or `null` when the report is absent or the field is not
 * a number — the report's items are typed loosely and this desk has already
 * been bitten once by trusting a response's shape (docs/HANDOFF.md §6). */
function countOf(check: { count?: unknown } | undefined): number | null {
  return typeof check?.count === 'number' ? check.count : null;
}
