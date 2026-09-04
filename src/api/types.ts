/**
 * Friendly re-exports of the generated schema types (`schema.d.ts` is
 * regenerated from the live backend — never edit it). Import domain types
 * from here, not from `./schema` directly, so a schema regen that renames a
 * component is a one-line fix in this file.
 */
import type { components } from './schema';

type Schemas = components['schemas'];

export type Artwork = Schemas['ArtworkCollector'];
export type Artist = Schemas['ArtistCollector'];
export type ArtworkImage = Schemas['ArtworkImage'];
export type SavedArtwork = Schemas['SavedArtwork'];
export type CollectorRequest = Schemas['RequestCollector'];
export type CollectorActivity = Schemas['CollectorActivity'];
export type PublishedRecommendation = Schemas['CollectorPublishedRecommendation'];
export type Me = Schemas['Me'];
export type Principal = Me['principal'];

/** The `data` block of every paginated list endpoint (see
 * `apps.core.pagination.CustomPagination`). */
export interface Paginated<T> {
  results: T[];
  pagination: {
    page: number;
    per_page: number;
    total_pages: number;
    total_count: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

/** Shared list params. `tag` may repeat. */
export interface CatalogueQuery {
  artist?: string;
  availability_status?: string;
  price_min?: number | string;
  price_max?: number | string;
  medium?: string;
  currency?: string;
  price_type?: string;
  tag?: string | string[];
  per_page?: number;
  page?: number;
}
