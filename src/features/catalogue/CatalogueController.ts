/**
 * CatalogueController — query state + fetching for the collector catalogue.
 *
 * Same shape as `AuthSession` / `ThemeController`: a framework-free class with
 * an immutable `getSnapshot()` and `subscribe()`, wrapped by `useCatalogue()`.
 * Holds the current filter/sort/search/page, runs the `CatalogService` call,
 * and exposes results + pagination + load status. A stale response (the query
 * changed while it was in flight) is dropped.
 */
import type { CatalogService } from '../../api/services';
import type { Artwork, CatalogueQuery, Paginated } from '../../api/types';

export type LoadStatus = 'idle' | 'loading' | 'error';

export interface CatalogueSnapshot {
  query: CatalogueQuery;
  results: Artwork[];
  pagination: Paginated<Artwork>['pagination'] | null;
  status: LoadStatus;
  error: string | null;
}

type Listener = () => void;

const EMPTY: CatalogueSnapshot = {
  query: {},
  results: [],
  pagination: null,
  status: 'idle',
  error: null,
};

export class CatalogueController {
  private readonly catalog: CatalogService;
  private snapshot: CatalogueSnapshot;
  private readonly listeners = new Set<Listener>();
  /** bumped on every load() — a response from an older token is ignored */
  private token = 0;

  constructor(catalog: CatalogService, initial: CatalogueQuery = {}) {
    this.catalog = catalog;
    this.snapshot = { ...EMPTY, query: { page: 1, ...initial } };
  }

  getSnapshot(): CatalogueSnapshot {
    return this.snapshot;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Merge a query patch. Any change except `page` resets to page 1 (a new
   * filter should start at the top, like the old app's `apply()`). */
  setQuery(patch: Partial<CatalogueQuery>): void {
    const onlyPage = Object.keys(patch).length === 1 && 'page' in patch;
    const next: CatalogueQuery = {
      ...this.snapshot.query,
      ...patch,
      page: onlyPage ? patch.page : 1,
    };
    this.patch({ query: next });
    void this.load();
  }

  setPage(page: number): void {
    this.setQuery({ page });
  }

  reload(): Promise<void> {
    return this.load();
  }

  private async load(): Promise<void> {
    const mine = ++this.token;
    this.patch({ status: 'loading', error: null });
    try {
      const data = await this.catalog.artworks(this.snapshot.query);
      if (mine !== this.token) return; // superseded
      this.patch({
        results: data.results,
        pagination: data.pagination,
        status: 'idle',
      });
    } catch (err) {
      if (mine !== this.token) return;
      this.patch({ status: 'error', error: (err as Error).message });
    }
  }

  private patch(part: Partial<CatalogueSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...part };
    this.listeners.forEach((fn) => fn());
  }
}
