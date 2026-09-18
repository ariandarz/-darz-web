/**
 * CatalogueController — the artwork list. All query/pagination/stale-response
 * state lives in the shared `ListController` base; this class only wires the
 * `CatalogService` call.
 *
 * Two sources, one list. `query.curated` switches the base set to the
 * collector's curated works — the old app's "Curated for You" chip, which is
 * a **filter on the same grid**, never a separate section (app.html:8890
 * records that the separate section was removed at v669). Keeping it in the
 * query means the base's own rule applies for free: any change except `page`
 * resets to page 1, exactly like the old `apply()`.
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
    // `curated` is a client-side switch, not a server param — strip it, or it
    // would ride along as `?curated=true` on every request.
    const { curated, ...params } = query;
    return curated ? this.catalog.artworkSelections(params) : this.catalog.artworks(params);
  }

  /** Is the grid currently showing the curated set? */
  get isCurated(): boolean {
    return this.getSnapshot().query.curated === true;
  }

  /** The chip: on → curated base, off → the public grid. Page resets itself. */
  setCurated(on: boolean): void {
    this.setQuery({ curated: on || undefined });
  }
}
