/** One `ArtworkCache` per session (mounted inside the collector layout). */
import { useState, type ReactNode } from 'react';
import { useApi } from '../../api/hooks';
import { ArtworkCache } from './ArtworkCache';
import { ArtworkCacheContext } from './artworkCacheContext';

export function ArtworkCacheProvider({ children }: { children: ReactNode }) {
  const { catalog } = useApi();
  const [cache] = useState(() => new ArtworkCache(catalog));
  return <ArtworkCacheContext.Provider value={cache}>{children}</ArtworkCacheContext.Provider>;
}
