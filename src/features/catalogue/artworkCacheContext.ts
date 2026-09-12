import { createContext } from 'react';
import type { ArtworkCache } from './ArtworkCache';

export const ArtworkCacheContext = createContext<ArtworkCache | null>(null);
