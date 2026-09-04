/**
 * ArtistListController — the Artists list. Sibling of `CatalogueController`;
 * both extend `ListController` and differ only in which service call they wire.
 */
import type { CatalogService } from '../../api/services';
import type { Artist, ArtistQuery, Paginated } from '../../api/types';
import { ListController } from '../shared/ListController';

export class ArtistListController extends ListController<Artist, ArtistQuery> {
  private readonly catalog: CatalogService;

  constructor(catalog: CatalogService, initial: ArtistQuery = {}) {
    super(initial);
    this.catalog = catalog;
  }

  protected fetchPage(query: ArtistQuery): Promise<Paginated<Artist>> {
    return this.catalog.artists(query);
  }
}
