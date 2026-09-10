/**
 * AuctionListController — the auctions list (`GET /api/auctions/`). All
 * query/pagination/stale-response state lives in the shared `ListController`
 * base; this class only wires the `AuctionService.auctions` call, exactly as
 * `CatalogueController` / `ArtistListController` do.
 */
import type { AuctionService } from '../../api/services';
import type { Auction, AuctionQuery, Paginated } from '../../api/types';
import { ListController } from '../shared/ListController';

export type {
  LoadStatus,
  ListSnapshot as AuctionListSnapshot,
} from '../shared/ListController';

export class AuctionListController extends ListController<Auction, AuctionQuery> {
  private readonly auctions: AuctionService;

  constructor(auctions: AuctionService, initial: AuctionQuery = {}) {
    super(initial);
    this.auctions = auctions;
  }

  protected fetchPage(query: AuctionQuery): Promise<Paginated<Auction>> {
    return this.auctions.auctions(query);
  }
}
