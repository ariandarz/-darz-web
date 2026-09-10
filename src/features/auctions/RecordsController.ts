/**
 * RecordsController — the external auction-house results archive
 * (`GET /api/auctions/records/`). Query/pagination/stale-guard come from the
 * shared `ListController`; this only wires `AuctionService.records` and adds a
 * debounced `setSearch` (same shape as the catalogue toolbar).
 */
import type { AuctionService } from '../../api/services';
import type { AuctionRecord, AuctionRecordQuery, Paginated } from '../../api/types';
import { ListController } from '../shared/ListController';

export type { LoadStatus, ListSnapshot as RecordsSnapshot } from '../shared/ListController';

export class RecordsController extends ListController<AuctionRecord, AuctionRecordQuery> {
  private readonly auctions: AuctionService;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(auctions: AuctionService, initial: AuctionRecordQuery = {}) {
    super({ per_page: 24, ...initial });
    this.auctions = auctions;
  }

  protected fetchPage(query: AuctionRecordQuery): Promise<Paginated<AuctionRecord>> {
    return this.auctions.records(query);
  }

  /** Debounced free-text search (300ms), like the catalogue toolbar. */
  setSearch(search: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.setQuery({ search: search.trim() || undefined });
    }, 300);
  }

  setOrdering(ordering: string | undefined): void {
    this.setQuery({ ordering });
  }
}
