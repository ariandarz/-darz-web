/**
 * ArtworksController — the Artworks Database roster
 * (`GET /api/catalog/admin/artworks/`, backend Phase 7). Query params are the
 * server's own `ArtworkAdminFilterSet`: `search` (artist name / title / medium
 * / dimensions), exact `artist` (id) / `availability_status` / `currency` /
 * `price_type`, `medium` icontains, `ordering` year|-year|artist|-artist|
 * price|-price (no token = newest first), and the admin-only `year`, `source`,
 * `published`, `has_images` (G-2), `gallery_portal`, `complete`,
 * `duplicate_images`, `size` (Phase 5b), `source_type` (G-HEALTH-2) and
 * `created_after` (G-HEALTH-4). The facets call takes the same query.
 */
import type { CatalogAdminService } from '../../api/services';
import type { ArtworkAdmin, ArtworkAdminQuery, Paginated } from '../../api/types';
import { ListController } from '../shared/ListController';

export class ArtworksController extends ListController<ArtworkAdmin, ArtworkAdminQuery> {
  private readonly catalog: CatalogAdminService;

  constructor(catalog: CatalogAdminService, initial: ArtworkAdminQuery = {}) {
    super(initial);
    this.catalog = catalog;
  }

  protected fetchPage(query: ArtworkAdminQuery): Promise<Paginated<ArtworkAdmin>> {
    return this.catalog.artworks(query);
  }
}
