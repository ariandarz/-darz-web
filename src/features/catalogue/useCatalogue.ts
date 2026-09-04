/**
 * Hooks over the catalogue. `useCatalogue` owns a `CatalogueController` for
 * the component's lifetime and subscribes to it; `useResource` is a tiny
 * one-shot fetch for the detail / artist pages.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useApi } from '../../api/hooks';
import type { CatalogueQuery } from '../../api/types';
import { CatalogueController, type CatalogueSnapshot } from './CatalogueController';

export function useCatalogue(initial: CatalogueQuery = {}): {
  state: CatalogueSnapshot;
  setQuery: CatalogueController['setQuery'];
  setPage: CatalogueController['setPage'];
  reload: CatalogueController['reload'];
} {
  const { catalog } = useApi();
  // Lazy initializer — `initial` is only read once, for this page's first
  // render; the controller then owns the query and outlives re-renders.
  const [controller] = useState(() => new CatalogueController(catalog, initial));

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

export type AsyncState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'ok'; data: T; error: null }
  | { status: 'error'; data: null; error: string };

/** Fetch once, keyed by `deps`. For the artwork / artist detail pages. */
export function useResource<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    status: 'loading',
    data: null,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading', data: null, error: null });
    fetcher().then(
      (data) => alive && setState({ status: 'ok', data, error: null }),
      (err: unknown) =>
        alive && setState({ status: 'error', data: null, error: (err as Error).message }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
