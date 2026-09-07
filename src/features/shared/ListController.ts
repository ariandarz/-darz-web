/**
 * ListController<T, Q> — abstract base for "paginated collection with a
 * query" screens. Owns the query/results/pagination/status state machine and
 * the stale-response guard; the snapshot + observer plumbing comes from the
 * shared `Observable` base (same `getSnapshot()` / `subscribe()` shape as
 * `AuthSession` / `ThemeController`). Subclasses implement only
 * `fetchPage(query)` — this is the inheritance seam the catalogue and artist
 * lists share instead of duplicating the state machine.
 *
 * `CatalogueController` (artworks) and `ArtistListController` (artists) both
 * extend this.
 */
import type { Paginated } from '../../api/types';
import { Observable } from './Observable';

export type LoadStatus = 'idle' | 'loading' | 'error';

export interface ListSnapshot<T, Q> {
  query: Q;
  results: T[];
  pagination: Paginated<T>['pagination'] | null;
  status: LoadStatus;
  error: string | null;
}

export abstract class ListController<T, Q extends { page?: number }> extends Observable<
  ListSnapshot<T, Q>
> {
  /** bumped on every load() — a response from an older token is ignored */
  private token = 0;

  protected constructor(initialQuery: Q) {
    super({
      query: { ...initialQuery, page: initialQuery.page ?? 1 },
      results: [],
      pagination: null,
      status: 'idle',
      error: null,
    });
  }

  /** Subclass hook: run the actual API call for this query. */
  protected abstract fetchPage(query: Q): Promise<Paginated<T>>;

  /** Merge a query patch. Any change except `page` resets to page 1 — a new
   * filter/search/sort should start at the top, like the old app's apply(). */
  setQuery(patch: Partial<Q>): void {
    const onlyPage = Object.keys(patch).length === 1 && 'page' in patch;
    const next = {
      ...this.getSnapshot().query,
      ...patch,
      page: onlyPage ? patch.page : 1,
    } as Q;
    this.patch({ query: next });
    void this.load();
  }

  setPage(page: number): void {
    this.setQuery({ page } as Partial<Q>);
  }

  reload(): Promise<void> {
    return this.load();
  }

  private async load(): Promise<void> {
    const mine = ++this.token;
    this.patch({ status: 'loading', error: null });
    try {
      const data = await this.fetchPage(this.getSnapshot().query);
      if (mine !== this.token) return; // superseded
      this.patch({ results: data.results, pagination: data.pagination, status: 'idle' });
    } catch (err) {
      if (mine !== this.token) return;
      this.patch({ status: 'error', error: (err as Error).message });
    }
  }
}
