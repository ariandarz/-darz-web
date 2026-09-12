import { useContext, useEffect, useSyncExternalStore } from 'react';
import type { Artwork } from '../../api/types';
import type { ArtworkCache } from './ArtworkCache';
import { ArtworkCacheContext } from './artworkCacheContext';

export function useArtworkCache(): ArtworkCache {
  const cache = useContext(ArtworkCacheContext);
  if (!cache) throw new Error('useArtworkCache must be used within <ArtworkCacheProvider>.');
  return cache;
}

/** The artworks for `ids`, fetched on demand; `undefined` while loading,
 * `null` when unavailable. */
export function useArtworks(ids: ReadonlyArray<string | null | undefined>) {
  const cache = useArtworkCache();
  const key = ids.filter(Boolean).join('|');
  useEffect(() => {
    cache.ensureAll(key ? key.split('|') : []);
  }, [cache, key]);
  const snap = useSyncExternalStore(
    (cb) => cache.subscribe(cb),
    () => cache.getSnapshot(),
    () => cache.getSnapshot(),
  );
  return (id: string | null | undefined): Artwork | null | undefined =>
    id ? snap.byId.get(id) : null;
}
