/**
 * SavedListController — the `/saved` page's paginated list.
 *
 * Before `docs/PHASE_6_API_GAPS.md` G-P6-1/G-P6-2, `SavedItemsPage` had to
 * hold the collector's *entire* saved set in memory (`SavedController.
 * fetchAll()`, walking every page) because there was nowhere else to answer
 * "is this saved?". Now that `Artwork.is_saved` answers that per-artwork,
 * `/saved` can be a normal paginated list — the same `ListController` seam
 * `CatalogueController` and `AdminRequestsController` already use, instead
 * of a one-off full-list read.
 *
 * Default order is newest-first (`-created_at`, G-P6-4) — the server's own
 * documented default, so this class doesn't even need to set `ordering`
 * unless the page wants to offer a sort control.
 */
import type { CrmService } from '../../api/services';
import type { Paginated, SavedArtwork, SavedArtworkQuery } from '../../api/types';
import { ListController } from '../shared/ListController';

export class SavedListController extends ListController<SavedArtwork, SavedArtworkQuery> {
  private readonly crm: CrmService;

  constructor(crm: CrmService, initial: SavedArtworkQuery = {}) {
    super(initial);
    this.crm = crm;
  }

  protected fetchPage(query: SavedArtworkQuery): Promise<Paginated<SavedArtwork>> {
    return this.crm.saved(query);
  }
}
