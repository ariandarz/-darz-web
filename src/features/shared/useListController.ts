/**
 * Generic React seam over any `ListController` subclass — one hook shared by
 * `useCatalogue` (artworks) and `useArtistList` (artists) instead of each
 * reimplementing the lazy-construct + subscribe wiring.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ListController, ListSnapshot } from './ListController';

export function useListController<T, Q extends { page?: number }>(
  factory: () => ListController<T, Q>,
): {
  state: ListSnapshot<T, Q>;
  setQuery: (patch: Partial<Q>) => void;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
} {
  // Lazy initializer — `factory` is only invoked once, for this page's first
  // render; the controller then owns the query and outlives re-renders.
  const [controller] = useState(factory);

  useEffect(() => {
    void controller.reload();
  }, [controller]);

  const state = useSyncExternalStore(
    (cb) => controller.subscribe(cb),
    () => controller.getSnapshot(),
    () => controller.getSnapshot(),
  );

  return {
    state,
    setQuery: (patch) => controller.setQuery(patch),
    setPage: (page) => controller.setPage(page),
    reload: () => controller.reload(),
  };
}
