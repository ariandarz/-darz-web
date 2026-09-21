/**
 * ArtworksController — the Artworks Database roster
 * (`GET /api/catalog/admin/artworks/`, backend Phase 7). Query params are the
 * server's own `ArtworkFilterSet` — shared with the collector catalogue:
 * `search` (artist name / title / medium / dimensions), exact `artist` (id) /
 * `availability_status` / `currency` / `price_type`, `medium` icontains,
 * `ordering` year|-year|artist|-artist|price|-price (no token = newest
 * published first), and — admin-only, since G-2 landed 2026-09-21 — `year`,
 * `source`, `published` and `has_images` from `ArtworkAdminFilterSet`. The
 * four the old desk had and this one still does not (completeness, size
 * ranges, duplicate images, Gallery Portal) are named on the panel itself,
 * not dropped silently.
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
