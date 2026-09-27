/**
 * ArtistsController — the admin Artists roster
 * (`GET /api/catalog/admin/artists/`) over `ArtistAdminFilterSet` (G-CAT-3):
 * server `search` over the display name and `ordering`
 * name|-name|created|-created|works. Paged by the shared `ListController`, so
 * a roster past the backend's 100-row clamp is reached by the pager rather
 * than walked whole or silently cut (C-5).
 */
import { MAX_PER_PAGE } from '../../api/paging';
import type { CatalogAdminService } from '../../api/services';
import type { ArtistAdmin, ArtistAdminQuery, Paginated } from '../../api/types';
import { ListController } from '../shared/ListController';

/** The old desk's default sort, "Sort: Most works" (`APF`, `darz-studio.html:
 * 33359`; the select at `:33587`). A page is the backend's ceiling — the old
 * desk drew every artist at once, so pages are as large as the API allows. */
export const ARTISTS_DEFAULT_QUERY: ArtistAdminQuery = {
  ordering: 'works',
  per_page: MAX_PER_PAGE,
};

export class ArtistsController extends ListController<ArtistAdmin, ArtistAdminQuery> {
  private readonly catalog: CatalogAdminService;

  constructor(
    catalog: CatalogAdminService,
    initial: ArtistAdminQuery = ARTISTS_DEFAULT_QUERY,
  ) {
    super(initial);
    this.catalog = catalog;
  }

  protected fetchPage(query: ArtistAdminQuery): Promise<Paginated<ArtistAdmin>> {
    return this.catalog.artists(query);
  }
}
