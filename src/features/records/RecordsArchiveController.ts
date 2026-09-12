/**
 * RecordsArchiveController — the collector's Records archive, read once per
 * session and derived in memory: every `AuctionRecord` from the five v0.1
 * houses, grouped by artist, with a search over artist / title / house.
 *
 * Why client-side: the backend (`GET /api/auctions/records/`) filters by
 * `?artist=<uuid>` and `?search=`, but has no house filter and no per-artist
 * aggregate (see docs/PHASE_8_API_GAPS.md) — and DEC-13 makes the collector
 * surface "search an artist, see that artist's complete history", which the
 * old app also computed in the browser (`recordsView`, app.html:5004-5025;
 * `artistView`, :5341-5381). The archive is bounded (≤ 2,000 rows, 100 per
 * page) and read fresh on every load — nothing is persisted.
 */
import type { AuctionService } from '../../api/services';
import type { AuctionRecord } from '../../api/types';
import { Observable } from '../shared/Observable';
import { artistInsights, isAllowedHouse, resultOf, type ArtistInsights } from './insights';

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

export type ArchiveStatus = 'idle' | 'loading' | 'ready' | 'error';
export type ViewMode = 'card' | 'list';
export type RecordSort = 'recent' | 'yearAsc' | 'hi' | 'lo';

export interface ArtistGroup {
  /** the artist uuid when linked, else the raw name */
  key: string;
  name: string;
  records: AuctionRecord[];
  /** the highest sold result that has an image, else the first with one, else the first */
  best: AuctionRecord;
}

export interface ArchiveSnapshot {
  status: ArchiveStatus;
  /** every record from an allowed house, newest sale first */
  records: AuctionRecord[];
  error: string | null;
  view: ViewMode;
  sort: RecordSort;
  search: string;
}

const EMPTY: ArchiveSnapshot = {
  status: 'idle',
  records: [],
  error: null,
  view: 'card',
  sort: 'recent',
  search: '',
};

export function artistKeyOf(r: AuctionRecord): string {
  return r.artist ?? `name:${(r.artist_display_name ?? r.artist_name_raw ?? '').trim()}`;
}
export function artistNameOf(r: AuctionRecord): string {
  return r.artist_display_name ?? r.artist_name_raw ?? 'Unattributed';
}

export function sortRecords(list: AuctionRecord[], sort: RecordSort): AuctionRecord[] {
  const byDate = (a: AuctionRecord, b: AuctionRecord) =>
    String(b.sale_date ?? '').localeCompare(String(a.sale_date ?? ''));
  const out = [...list];
  switch (sort) {
    case 'recent':
      return out.sort(byDate);
    case 'yearAsc':
      return out.sort((a, b) => -byDate(a, b));
    case 'hi':
      // priced first (highest), unpriced after by date — never across currencies:
      // callers rank within one artist, whose dominant currency the insights name
      return out.sort((a, b) => resultOf(b) - resultOf(a) || byDate(a, b));
    case 'lo':
      return out.sort((a, b) => {
        const ra = resultOf(a);
        const rb = resultOf(b);
        if (ra && rb) return ra - rb;
        if (ra) return -1;
        if (rb) return 1;
        return byDate(a, b);
      });
  }
}

export class RecordsArchiveController extends Observable<ArchiveSnapshot> {
  private readonly auctions: AuctionService;
  private inflight: Promise<void> | null = null;

  constructor(auctions: AuctionService) {
    super(EMPTY);
    this.auctions = auctions;
  }

  ensureLoaded(): Promise<void> {
    if (this.getSnapshot().status === 'ready') return Promise.resolve();
    return this.reload();
  }

  reload(): Promise<void> {
    if (this.inflight) return this.inflight;
    const run = this.load().finally(() => {
      this.inflight = null;
    });
    this.inflight = run;
    return run;
  }

  private async load(): Promise<void> {
    this.patch({ status: 'loading', error: null });
    try {
      const all: AuctionRecord[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const data = await this.auctions.records({
          per_page: PAGE_SIZE,
          page,
          ordering: '-sale_date',
        });
        all.push(...data.results);
        if (!data.pagination.has_next) break;
      }
      this.patch({ status: 'ready', records: all.filter(isAllowedHouse) });
    } catch (err: unknown) {
      this.patch({ status: 'error', error: (err as Error).message });
    }
  }

  reset(): void {
    this.replace(EMPTY);
  }

  setView(view: ViewMode): void {
    this.patch({ view });
  }
  setSort(sort: RecordSort): void {
    this.patch({ sort });
  }
  setSearch(search: string): void {
    this.patch({ search });
  }

  /** Artists with at least one record, sorted by name, optionally filtered by
   * the search (artist name). */
  artists(): ArtistGroup[] {
    const q = this.getSnapshot().search.trim().toLowerCase();
    const by = new Map<string, AuctionRecord[]>();
    for (const r of this.getSnapshot().records) {
      const k = artistKeyOf(r);
      by.set(k, [...(by.get(k) ?? []), r]);
    }
    const groups: ArtistGroup[] = [];
    for (const [key, records] of by) {
      const name = artistNameOf(records[0]);
      if (q && !name.toLowerCase().includes(q)) continue;
      groups.push({ key, name, records, best: bestOf(records) });
    }
    return groups.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** One artist's records (all of them), by artist uuid or `name:` key. */
  forArtist(key: string): AuctionRecord[] {
    return this.getSnapshot().records.filter((r) => artistKeyOf(r) === key);
  }

  artistName(key: string): string | null {
    const first = this.forArtist(key)[0];
    return first ? artistNameOf(first) : null;
  }

  insightsFor(key: string): ArtistInsights {
    return artistInsights(this.forArtist(key));
  }

  byId(id: string): AuctionRecord | null {
    return this.getSnapshot().records.find((r) => r.id === id) ?? null;
  }
}

function bestOf(records: AuctionRecord[]): AuctionRecord {
  let best: AuctionRecord | null = null;
  let bestV = -1;
  for (const r of records) {
    const v = resultOf(r);
    if (r.image_url && v > bestV) {
      bestV = v;
      best = r;
    }
  }
  return best ?? records.find((r) => r.image_url) ?? records[0];
}
