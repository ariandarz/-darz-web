/**
 * Friendly re-exports of the generated schema types (`schema.d.ts` is
 * regenerated from the live backend — never edit it). Import domain types
 * from here, not from `./schema` directly, so a schema regen that renames a
 * component is a one-line fix in this file.
 */
import type { components } from './schema';

type Schemas = components['schemas'];

/** `artist` is nullable at the DB level (`on_delete=SET_NULL` — legacy rows
 * with an unmatched artist name) even though the generated type omits `null`;
 * every consumer must handle it. */
export type Artwork = Omit<Schemas['ArtworkCollector'], 'artist'> & {
  artist: Schemas['ArtistCollector'] | null;
};
export type Artist = Schemas['ArtistCollector'];
export type ArtworkImage = Schemas['ArtworkImage'];
export type SavedArtwork = Schemas['SavedArtwork'];
export type CollectorRequest = Schemas['RequestCollector'];
export type AdminRequest = Schemas['RequestAdmin'];

/** The 8 request kinds the backend accepts (`RequestKindEnum`). The old app's
 * action verbs map onto these: buy→purchase, hold→hold, visit→viewing,
 * offer→offer, "Request price"→price, "Ask about"→information. */
export type RequestKind = Schemas['RequestKindEnum'];

/** `RequestCreate.detail` is `unknown` in the generated schema — the backend's
 * per-kind shapes (`apps.crm.serializers.DETAIL_SERIALIZERS`) are not published
 * in the OpenAPI document. See `docs/FLOW_1_API_GAPS.md` (gap G-F1-1): what we
 * send here is the frontend's best reading, not a contract we can typecheck. */
export type RequestDetail = Record<string, unknown>;

/** Collector's own request list params (`GET /api/crm/requests/`). */
export interface CollectorRequestQuery {
  kind?: string;
  status?: string;
  per_page?: number;
  page?: number;
}

/** Admin unified request feed params (`GET /api/crm/admin/requests/`). */
export interface AdminRequestQuery {
  kind?: string;
  status?: string;
  assignee?: string;
  per_page?: number;
  page?: number;
}
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

/** Collector catalogue list params (`GET /api/catalog/artworks/`). `tag` may
 * repeat. See `darzmarket-api` `ArtworkFilterSet`. */
export interface CatalogueQuery {
  artist?: string;
  availability_status?: string;
  price_min?: number | string;
  price_max?: number | string;
  medium?: string;
  currency?: string;
  price_type?: string;
  tag?: string | string[];
  /** icontains over artist name + title + medium + dimensions */
  search?: string;
  /** `year` | `-year` | `artist` | `-artist` | `price` | `-price`; absent = newest published */
  ordering?: string;
  per_page?: number;
  page?: number;
}

/** Artists list params (`GET /api/catalog/artists/`). */
export interface ArtistQuery {
  search?: string;
  /** `name` | `-name` | `works` */
  ordering?: string;
  per_page?: number;
  page?: number;
}
