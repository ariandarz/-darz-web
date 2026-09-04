/**
 * CatalogueController — the artwork list. All query/pagination/stale-response
 * state lives in the shared `ListController` base; this class only wires the
 * `CatalogService.artworks` call.
 */
import type { CatalogService } from '../../api/services';
import type { Artwork, CatalogueQuery, Paginated } from '../../api/types';
import { ListController } from '../shared/ListController';

export type { LoadStatus, ListSnapshot as CatalogueSnapshot } from '../shared/ListController';

export class CatalogueController extends ListController<Artwork, CatalogueQuery> {
  private readonly catalog: CatalogService;

  constructor(catalog: CatalogService, initial: CatalogueQuery = {}) {
    super(initial);
    this.catalog = catalog;
  }

  protected fetchPage(query: CatalogueQuery): Promise<Paginated<Artwork>> {
    return this.catalog.artworks(query);
  }
}
