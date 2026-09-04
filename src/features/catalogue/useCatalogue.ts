/**
 * Hooks over the catalogue. `useCatalogue` / `useArtistList` wrap the shared
 * `useListController` over their respective controllers; `useResource` is a
 * tiny one-shot fetch for the artwork / artist detail pages.
 */
import { useEffect, useState } from 'react';
import { useApi } from '../../api/hooks';
import type { ArtistQuery, CatalogueQuery } from '../../api/types';
import { useListController } from '../shared/useListController';
import { ArtistListController } from './ArtistListController';
import { CatalogueController } from './CatalogueController';

export function useCatalogue(initial: CatalogueQuery = {}) {
  const { catalog } = useApi();
  return useListController(() => new CatalogueController(catalog, initial));
}

export function useArtistList(initial: ArtistQuery = {}) {
  const { catalog } = useApi();
  return useListController(() => new ArtistListController(catalog, initial));
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
