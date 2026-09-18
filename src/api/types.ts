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
 * every consumer must handle it. `allowed_actions` (G-F1-3), `is_saved`/
 * `saved_at` (G-P6-1) and `refine_tags` (G7) all ride along automatically —
 * they're just more fields on the same `ArtworkCollector` schema now. */
export type Artwork = Omit<Schemas['ArtworkCollector'], 'artist'> & {
  artist: Schemas['ArtistCollector'] | null;
};
export type Artist = Schemas['ArtistCollector'];
export type ArtworkImage = Schemas['ArtworkImage'];
export type SavedArtwork = Schemas['SavedArtwork'];

/** The four collector actions the gallery can allow/disallow per artwork
 * (`Artwork.allowed_actions`, already resolved server-side — an empty stored
 * list means all four, but the client never sees the raw list, only the
 * resolved one). See `docs/API_INTEGRATION_GAPS.md` G-F1-3. */
export type CollectorAction = 'purchase' | 'hold' | 'offer' | 'viewing';

/** Auctions (Phase 8). `Auction` carries `lots_count`; `Lot` (the collector
 * tier) nests the full `artwork` and a request-aware `is_leading` — no
 * `reserve_amount`/`leading_bidder` identity is ever exposed here. Same
 * `artist`-nullable caveat as `Artwork`. */
export type Auction = Schemas['Auction'];
export type Lot = Omit<Schemas['LotCollector'], 'artwork'> & { artwork: Artwork };
export type BidHistoryItem = Schemas['BidHistory'];
export type AuctionStatus = Schemas['AuctionStatusEnum'];
export type LotStatus = Schemas['LotStatusEnum'];

/** The collector's own paddle registration for an auction (Phase 8 step 2). */
export type BidderRegistration = Schemas['BidderRegistrationCollector'];
export type RegistrationStatus = Schemas['BidderRegistrationStatusEnum'];

/** Auction notification (Phase 8 step 3). `payload` is `unknown` in the
 * schema; shape by `kind`: outbid/won → `{ amount: string }`, lost → `{}`,
 * closing_soon → `{ ends_at: string }` (documented on the list endpoint).
 * `lot_artwork_title` / `lot_number` are null when the lot was deleted. */
export type AuctionNotification = Schemas['Notification'];
export type NotificationKind = Schemas['NotificationKindEnum'];

/** External auction-house result — market-intelligence comparables, read-only
 * for collectors (Phase 8 step 4). Backend has ~10 fields; the old app's
 * Records tab showed more (image, medium, estimates, hammer-vs-realized …) —
 * see `docs/PHASE_8_API_GAPS.md`. */
export type AuctionRecord = Schemas['AuctionRecord'];

/** `GET /api/auctions/records/` params. */
export interface AuctionRecordQuery {
  search?: string;
  /** `sale_date` | `-sale_date` | `price_amount` | `-price_amount` (+ created_at) */
  ordering?: string;
  artist?: string;
  per_page?: number;
  page?: number;
}

/** The read-only frame `apps.auctions.consumers.LotConsumer` pushes on every
 * accepted bid / go-live / close (`_broadcast_lot_state`). Not in the OpenAPI
 * document — this is the shape the consumer builds by hand. */
export interface LotStateFrame {
  lot_id: string;
  status: LotStatus;
  current_amount: string | null;
  bid_count: number;
  leading_bidder_id: string | null;
  reserve_met: boolean;
  ends_at: string;
}

/** Auctions list params (`GET /api/auctions/`). */
export interface AuctionQuery {
  per_page?: number;
  page?: number;
}
/** `RequestCollector` now carries `unread_count` (G-F1-6, unseen team
 * replies); `RequestAdmin` nests `collector`/`artwork` (G-F1-7, no more bare
 * uuids), reports `allowed_transitions` (G-F1-4) and `unread_count` (unseen
 * collector replies), plus `contact_snapshot`/`admin_archived`. */
export type CollectorRequest = Schemas['RequestCollector'];
export type AdminRequest = Schemas['RequestAdmin'];

/** One message on a request's reply thread (backend Phase 19.3,
 * `RequestMessage`). `sender` is `collector` | `team`; the thread lists
 * oldest-first. `artwork_refs` is `unknown` in the schema — it is a list of
 * artwork uuids the message refers to. */
export type RequestMessage = Omit<Schemas['RequestMessage'], 'artwork_refs'> & {
  artwork_refs: string[];
};
export type RequestMessageSender = Schemas['RequestMessageSenderEnum'];

/** `GET /api/crm/requests/{id}/messages/` params. */
export interface RequestMessageQuery {
  per_page?: number;
  page?: number;
}

/** What `POST /api/crm/requests/` answers. `replayed` is true when the
 * backend already held a request with this `client_req_id` and returned it
 * again (HTTP 200) instead of creating a second one (201) — the idempotency
 * contract that makes a retry or a double-tap safe. */
export interface CreatedRequest {
  row: CollectorRequest;
  replayed: boolean;
}

/** The 8 request kinds the backend accepts (`RequestKindEnum`). The old app's
 * action verbs map onto these: buy→purchase, hold→hold, visit→viewing,
 * offer→offer, "Request price"→price, "Ask about"→information. */
export type RequestKind = Schemas['RequestKindEnum'];

/** Per-kind `detail` shapes, typed **by hand** from the backend's
 * `DETAIL_SERIALIZERS` (`apps/crm/serializers.py:14-51`, `development` @
 * 3801786) because the OpenAPI document still publishes `detail` as an
 * opaque object — `detail_polymorphic_serializer()` exists there with no
 * call site (`docs/PHASE_5_API_GAPS.md` G-P5-1, formerly G-F1-1). Keys
 * outside a kind's serializer are dropped server-side, and the stored
 * `detail` is the serializer's own output (an offer's `amount` comes back as
 * a string). */
export interface HoldDetail {
  /** server-set on create: now + 48 h (`Hold.DEFAULT_TTL`); never sent */
  expires_at?: string;
}
export interface OfferDetail {
  amount: number | string;
  currency: string;
  counter_of?: string | null;
}
export type ViewingMode = 'in_person' | 'virtual';
export interface ViewingDetail {
  /** ISO-8601 — required by the backend */
  preferred_time: string;
  /** required by the backend */
  mode: ViewingMode;
}
/** `information` · `price` · `availability` · `message` */
export interface MessageDetail {
  message?: string;
}
export interface PurchaseDetail {
  notes?: string;
}
export type RequestDetail =
  HoldDetail | OfferDetail | ViewingDetail | MessageDetail | PurchaseDetail;

/** Collector's own request list params (`GET /api/crm/requests/`). */
export interface CollectorRequestQuery {
  kind?: string;
  status?: string;
  per_page?: number;
  page?: number;
}

/** Admin unified request feed params (`GET /api/crm/admin/requests/`).
 * `archived` filters `admin_archived` (Q13). */
export interface AdminRequestQuery {
  kind?: string;
  status?: string;
  assignee?: string;
  archived?: boolean;
  per_page?: number;
  page?: number;
}

export type CollectorActivity = Schemas['CollectorActivity'];
export type PublishedRecommendation = Schemas['CollectorPublishedRecommendation'];
export type Me = Schemas['Me'];
export type Principal = Me['principal'];

/** One `{value, label}` choice, as `GET /api/options/` returns every flat
 * choice field. */
export interface Choice {
  value: string;
  label: string;
}

/** `crm.request_status_by_kind` on `GET /api/options/` (G-F1-4) — the legal
 * status vocabulary per request kind, derived live from
 * `apps.crm.lifecycle.TRANSITIONS` so it can never drift from the backend's
 * guarded state machine. Never hardcode this lookup (CLAUDE.md). */
export type RequestStatusByKind = Record<string, Choice[]>;

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
  /** "Refine" smart-filter dimensions (G7) — `refine_subject`, `refine_colour`,
   * `refine_scale`, `refine_priceRange`, `refine_decade`, `refine_mood`,
   * `refine_visualLanguage`, `refine_artistType`, `refine_collectingValue`,
   * plus the two bonus dims `refine_theme`/`refine_medium`. The full param
   * list + vocab comes from `GET /api/options/` (`catalog.refine_dimension` /
   * `catalog.refine_vocab` / `catalog.refine_dimensions_enabled`) — never
   * hardcode it. Each may repeat (pass a string[]) — AND-combined, like `tag`. */
  [refineParam: `refine_${string}`]: string | string[] | number | undefined;
}

/** Artists list params (`GET /api/catalog/artists/`). */
export interface ArtistQuery {
  search?: string;
  /** `name` | `-name` | `works` */
  ordering?: string;
  per_page?: number;
  page?: number;
}

/** Saved-list params (`GET /api/crm/saved/`, G-P6-2). `artwork` is
 * repeatable — pass a string[] to ask about several specific works. */
export interface SavedArtworkQuery {
  artwork?: string | string[];
  /** `created_at` | `-created_at`; default `-created_at` (G-P6-4) */
  ordering?: string;
  per_page?: number;
  page?: number;
}

/**
 * The gate's "Request access" submission (backend Phase 34,
 * `POST /api/auth/access-requests/`). Field names are the backend's
 * `AccessRequestCreateSerializer`; they are also, field for field, what the
 * old app's `submitRequest` sends (app.html:2554-2566).
 *
 * `email` and `phone` are two fields here but **one** input in the UI — the
 * old gate asks for "Email or phone" and splits on the `@` character
 * (app.html:2558). Owner decision D2, 2026-09-18: keep the single field.
 */
export interface AccessRequestInput {
  name: string;
  email?: string;
  phone?: string;
  city?: string;
  why?: string;
  /** "How you heard of Darz" in the UI. */
  referral_source?: string;
  /** From `?ref=` or `localStorage.darz_ref` — referral attribution. */
  ref_code?: string;
  /** Sent, but ignored by the backend today — see G-P34-1. */
  client_req_id?: string;
}

/** What `POST /api/auth/access-requests/` returns (201). */
export interface AccessRequest {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  why: string;
  referral_source: string;
  ref_code: string;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
}
