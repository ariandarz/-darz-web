/**
 * Friendly re-exports of the generated schema types (`schema.d.ts` is
 * regenerated from the live backend — never edit it). Import domain types
 * from here, not from `./schema` directly, so a schema regen that renames a
 * component is a one-line fix in this file.
 */
import type { components } from './schema';

type Schemas = components['schemas'];

/** A PATCH body whose optimistic lock is **required**. drf-spectacular types every
 * `Patched*` body with `expected_version` optional, yet the backend needs it:
 * without it the view 500s (a `KeyError` on `validated.pop`, C-6), with a stale
 * one it 409s. Wrap every locked PATCH body in this so the compiler catches a
 * missing lock. */
export type Locked<T> = Omit<T, 'expected_version'> & { expected_version: number };

/** `artist` is nullable at the DB level (`on_delete=SET_NULL` — legacy rows
 * with an unmatched artist name) even though the generated type omits `null`;
 * every consumer must handle it. `allowed_actions` (G-F1-3), `is_saved`/
 * `saved_at` (G-P6-1) and `refine_tags` (G7) all ride along automatically —
 * they're just more fields on the same `ArtworkCollector` schema now. */
export type Artwork = Omit<Schemas['ArtworkCollector'], 'artist'> & {
  artist: Schemas['ArtistCollector'] | null;
};
/** A row of the collector's curated works (`GET /api/catalog/artworks/selections/`)
 * — the same artwork, plus `selection_name` (G-P24-1): the name of the named
 * selection that granted it, `null` for a bare per-work grant. */
export type ArtworkSelection = Artwork & Pick<Schemas['ArtworkSelection'], 'selection_name'>;
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

/** External auction-house result — market-intelligence comparables. Widened
 * in backend Phase 11-admin (BE-R1…R3 closed the Phase 8 gap list): image,
 * medium, estimates, hammer vs realized, sections, highlights. One
 * serializer for collector read and admin CRUD — nothing on it is
 * confidential; `artist_display_name` is the label to show. Admin PATCH
 * requires `expected_version` (G-LOCK-1). */
export type AuctionRecord = Schemas['AuctionRecord'];

/** `GET /api/auctions(/admin)/records/` params. */
export interface AuctionRecordQuery {
  search?: string;
  /** `sale_date` | `-sale_date` | `price_amount` | `-price_amount` (+ created_at) */
  ordering?: string;
  artist?: string;
  /** past | upcoming | live — the old Records tab's own sections (BE-R6). */
  section?: string;
  /** admin-only (BE-R4): sold | unsold | passed | withdrawn | pending. */
  status?: string;
  is_highlight?: string;
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

/** Per-kind `detail` — the generated union over the backend's
 * `DETAIL_SERIALIZERS` (`apps/crm/serializers.py`, G-P5-1 / G-F1-1). Keys
 * outside a kind's serializer are dropped server-side; an offer's `amount`
 * and `counter_amount` are decimal **strings** — format them, never coerce. */
export type RequestDetail = Schemas['RequestDetail'];
export type OfferDetail = Schemas['OfferDetail'];
export type ViewingDetail = Schemas['ViewingDetail'];
export type ViewingMode = Schemas['ModeEnum'];
export type Currency = Schemas['CurrencyEnum'];
/** A hold's `detail` — **not** in the generated union: `HoldDetailSerializer`
 * takes no input, so the schema has nothing to publish for it, yet the stored
 * row carries the server-set expiry (now + 48 h, `Hold.DEFAULT_TTL`). */
export interface HoldDetail {
  expires_at?: string;
}

/** `detail` as the collector sends it on `POST /api/crm/requests/`. The
 * generated members, minus what the server sets itself: an offer's
 * `counter_amount`/`counter_currency` are read-only echoes of an admin counter.
 * `currency` also admits `''`: a work with no currency can still show Make an
 * Offer, and sending the blank lets the backend's own 400 reach the collector
 * — the behaviour this form has always had (flagged in `API_ADOPTION_PLAN.md`). */
export type OfferDetailInput = Omit<
  OfferDetail,
  'counter_amount' | 'counter_currency' | 'currency'
> & { currency: Currency | '' };
export type RequestDetailInput =
  OfferDetailInput | ViewingDetail | Schemas['SimpleDetail'] | Schemas['PurchaseIntentDetail'];

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
  /** Case-insensitive, OR'd across the collector's display name, the artwork
   * title and its artist's display name (backend G-5, 2026-09-21). Message
   * bodies are **not** searched — a hit there would return a row whose visible
   * columns contain nothing like the term, so it was left as its own decision. */
  search?: string;
  kind?: string;
  status?: string;
  /** Filterable, but there is no way to SET an assignee — `RequestAdmin` is
   * read-only end to end and no endpoint assigns one — and the field comes
   * back as a bare uuid with no name. See `AdminRequestsPage`'s header. */
  assignee?: string;
  archived?: boolean;
  per_page?: number;
  page?: number;
}

export type CollectorActivity = Schemas['CollectorActivity'];
export type PublishedRecommendation = Schemas['CollectorPublishedRecommendation'];

/** The collector's stored questionnaire (backend Phase 25).
 *
 * `answers` is declared `unknown` by the generated types, and honestly so: the
 * backend field is a JSONField holding `[{q, a}, …]` and nothing validates its
 * shape on read. Iterate it through `asArray` — see `docs/HANDOFF.md` §6. */
export type CollectorQuestionnaire = Schemas['CollectorQuestionnaire'];
/** One `{q, a}` pair — free text on both sides, so a past submission stays
 * readable after the question bank is edited. */
export type QuestionnaireAnswer = Schemas['QuestionnaireAnswer'];
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

/** A named Collector Club selection (backend Phase 35) — a management layer
 * over `ArtworkSelectionGrant`: saving one syncs the underlying per-(artwork,
 * collector) grants, and removing a pair only revokes its grant if no OTHER
 * selection still wants it (two selections can overlap; verified by a real
 * backend test). Reads nest `{id,title}` / `{id,display_name}`; writes take
 * `artwork_ids` / `collector_ids` + `expected_version`. */
export type CollectorSelection = Schemas['CollectorSelection'];

/** One collector self-logged event (view/save/search/login) — the admin
 * Collector Activity feed (backend Phase 28), nested like the request feed. */
export type CollectorActivityAdmin = Schemas['CollectorActivityAdmin'];

/** `GET /api/catalog/admin/data-health/` (backend Phase 23). Item shapes vary
 * per check (`apps/catalog/health.py`), so they stay loose here and the desk
 * reads them defensively. Only 3 of the old desk's ~8 checks exist — the rest
 * diagnosed the old client-sync architecture. */
export interface DataHealthReport {
  duplicate_images: { count: number; items: Array<Record<string, unknown>> };
  incomplete_records: { count: number; items: Array<Record<string, unknown>> };
  published_but_hidden: { count: number; items: Array<Record<string, unknown>> };
  healthy: boolean;
}

/** The Import desk's staging queue (backend Phase 23) — "nothing touches the
 * catalogue until confirmed", the old desk's own rule. */
export type ArtworkImportBatch = Schemas['ArtworkImportBatch'];
export type ArtworkImportBatchList = Schemas['ArtworkImportBatchList'];
export type ArtworkImportRow = Schemas['ArtworkImportRow'];

/** The owner Memberships desk's row (backend Phase 30). `plan` is constrained
 * to the COLLECTOR tiers — the backend's own deviation from the old desk's
 * Basic/Premium/Free-Invite `MEMB_PLANS` (`darz-studio.html:33131`), made so a
 * redeemed code sets a real `Collector.tier`. No payment processing anywhere,
 * by design. */
export type MembershipCodeAdmin = Schemas['MembershipCodeAdmin'];

/** The collector's own membership summary (`GET /api/auth/my-membership/`,
 * G-MEMB-3/6/7): `tier` (`CollectorTierEnum`, or null), `status` (the
 * collector's `access_status`) and `active_until` — a **date** (`YYYY-MM-DD`),
 * the expiry of the most recently redeemed code, `null` when none was ever
 * redeemed (an admin-set tier has no end date). */
export type MyMembership = Schemas['MyMembership'];

/** The collector's own profile edit (`PATCH /api/auth/me/`, G-B1): exactly
 * `full_name` · `phone` · `city` · `preferred_language`. `email`, `display_name`,
 * `tier` and `access_status` are admin-controlled and not accepted. No lock —
 * the serializer takes no `expected_version`. */
export type MeUpdate = Schemas['PatchedCollectorProfileUpdate'];
/** `preferred_language` values (`Collector.LANGUAGE_CHOICES`). The labels are
 * NOT in `/api/options/` (C-14), so this enum is the only vocabulary source. */
export type PreferredLanguage = Schemas['PreferredLanguageEnum'];

/** The owner "Team logins" desk's row (backend Phase 31). The password exists
 * only on the create response, exactly once. */
export type TeamUserAdmin = Schemas['TeamUserAdmin'];

/** The live app theme (backend Phase 32) — `theme` is a freeform object with
 * no fixed schema on either side; the Market App decides what the keys mean
 * (`docs/ADMIN_ARCHITECTURE.md` §4: `features`, `contact`, `copy`, `social`).
 * Served identically by the public `GET /api/app-theme/` (`AllowAny`) and the
 * admin read. */
export type AppTheme = Schemas['AppTheme'];
/** A named checkpoint — an explicit "Save version", never an automatic
 * snapshot (the old panel's two distinct buttons). */
export type AppThemeVersion = Schemas['AppThemeVersion'];

/** Admin Collectors desk (backend Phase 27) — `CollectorAdminSerializer`:
 * every field, admin-only surface. `version` is the optimistic-lock counter;
 * send it back on PATCH or the write 409s. */
export type CollectorAdmin = Schemas['CollectorAdmin'];

/** `GET/POST /api/auth/admin/collectors/` query — `apps/accounts/filters.py::
 * CollectorFilterSet`: free-text `search` over display_name/full_name/email/
 * phone, exact `tier`/`access_status`, `ordering` of name|-name|created|-created. */
export interface CollectorAdminQuery {
  search?: string;
  tier?: string;
  access_status?: string;
  ordering?: 'name' | '-name' | 'created' | '-created';
  per_page?: number;
  page?: number;
}

/** One issued key, as the admin surface serializes it — the hash never
 * leaves the server; `access_key` (plaintext) exists ONLY on the issue/approve
 * responses, exactly once. */
export type AccessKeyAdmin = Schemas['AccessKeyAdmin'];

/** A collector sign-in event (backend Phase 33) — the real log,
 * `AccessKey.last_used_at` only keeps the most recent. */
export type CollectorLoginEvent = Schemas['CollectorLoginEvent'];

/** The review queue's row (backend Phase 34) — `AccessRequestAdminSerializer`.
 * The list defaults to `status=pending` server-side. */
export type AccessRequestAdmin = Schemas['AccessRequestAdmin'];

/**
 * `GET /api/dashboard/admin/summary/` (backend Phase 29).
 *
 * Declared by hand rather than taken from `schema.d.ts`: the backend returns a
 * plain dict assembled in `DashboardService.summary()`, so drf-spectacular has
 * no serializer to describe it and the generated type is `unknown`. The shape
 * below is that function, read directly — keep the two in step.
 *
 * `new_by_kind` is keyed by request kind, each counted at **that kind's own
 * "just arrived" status** (`apps.crm.lifecycle.KIND_INITIAL_STATUS`), not at a
 * universal "new" — this codebase has a per-kind status vocabulary and the old
 * panel's single "new" tile does not survive it.
 */
export interface DashboardSummary {
  requests: {
    new_by_kind: Record<string, number>;
    new_total: number;
    resolved_total: number;
  };
  today: {
    requests_created: number;
    collectors_created: number;
    bids_placed: number;
    collector_logins: number;
  };
  collectors: { total: number; active: number };
  catalogue: {
    total: number;
    available: number;
    on_hold: number;
    reserved: number;
    sold: number;
  };
  auctions: { live_now: number; scheduled: number; registrations_pending: number };
  exhibitions: { pending_review: number };
}

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
  /**
   * **Client-side only — never sent as a query param.** When on, the
   * catalogue's base set becomes the collector's curated works
   * (`GET /api/catalog/artworks/selections/`) instead of the public grid.
   * This is the old app's "Curated for You" chip (app.html:8583-8594,
   * behaviour :8871) — a *filter on the same grid*, which is why it lives in
   * the query rather than in a second controller. `CatalogueController`
   * strips it before the request.
   */
  curated?: boolean;
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

/** Admin artwork row/detail — `ArtworkAdminSerializer`, all fields. The list
 * rows carry NO images and the artist as a bare uuid + `artist_name_raw`
 * (G-CAT-1: no thumbnail or resolved artist name on the admin list row — the
 * desk resolves names against the artists roster instead). Updates require
 * `expected_version`; `availability_status`/`is_published` are read-only and
 * change only through `/transition/` and `/publish/`·`/unpublish/`. */
export type ArtworkAdmin = Schemas['ArtworkAdmin'];

/** An artwork's stored image — read-only shape; upload is multipart, the
 * object key is always server-generated. */
export type ArtworkImageAdmin = Schemas['ArtworkImage'];

/** Admin artist row — `ArtistAdminSerializer`. The admin roster list takes no
 * filters at all (no search/ordering/works count — G-CAT-3); the desk fetches
 * pages and searches client-side. */
export type ArtistAdmin = Schemas['ArtistAdmin'];

/** The admin catalogue list's query — `ArtworkFilterSet`, shared with the
 * collector catalogue: `search` over artist name/title/medium/dimensions,
 * exact `artist`(id)/`availability_status`/`currency`/`price_type`,
 * `medium` icontains, `ordering` year|-year|artist|-artist|price|-price
 * (price only within one currency — frontend rule). The admin list adds
 * `year`/`source`/`published`/`has_images` from `ArtworkAdminFilterSet`
 * (backend G-2, 2026-09-21) — see the fields below; before that date the old
 * desk's Market-App/Year/Source dropdowns had no server counterpart, which is
 * what G-CAT-2 recorded. */
export interface ArtworkAdminQuery {
  search?: string;
  artist?: string;
  availability_status?: string;
  currency?: string;
  price_type?: string;
  medium?: string;
  ordering?: string;
  /* ── admin-only (backend G-2, 2026-09-21) ─────────────────────────────
   * On `ArtworkAdminFilterSet`, a subclass the admin view alone applies —
   * `source` is internal and `published` is meaningless on the public
   * collector list, so neither is reachable there. */
  /** Exact year. Repeats widen to IN, as the old desk's multi-year pick did. */
  year?: string | string[];
  /** Exact `source_name` — the gallery or dealer the work came through. */
  source?: string;
  /** The old "Market App: in the app / not in the app". */
  published?: boolean;
  /** The old "Images: with / without". */
  has_images?: boolean;
  page?: number;
  per_page?: number;
}

/** `GET /catalog/admin/artworks/facets/` — the Year and Source dropdown
 * vocabularies, computed over the same filtered queryset the list would
 * return, so the options narrow as the other filters do. The old desk built
 * both client-side from the whole in-memory library; a paginated list cannot,
 * which is why this endpoint exists. */
export interface ArtworkFacets {
  years: number[];
  sources: string[];
}

/** A sale — `SaleAdminSerializer` (backend Phase 7 sales admin). Since G-SALE-3
 * the row nests `artwork {id,title}`, `collector {id,display_name}` and
 * `responsible {id,name} | null`; `source_request` and `lot` stay bare uuids.
 * **Input still takes plain ids** (`SaleCreateInput` / `SalePatch`), so the read
 * and write shapes differ on purpose. The commercial snapshot (price/commission/
 * discount/fees) is draft-only editable — locked once confirmed (R7); `status`
 * moves only through `/transition/` on the linear chain, `payment_status` /
 * `delivery_status` through their own setters. */
export type SaleAdmin = Schemas['SaleAdmin'];
export type SaleCreateInput = Schemas['SaleCreate'];
/** `PATCH …/sales/{id}/` — the lock is required (C-6). */
export type SalePatch = Locked<Schemas['PatchedSaleUpdate']>;

/** The sales list takes exactly one filter: `status`. No search, no payment/
 * delivery filter, no aggregates (G-SALE-1/2). */
export interface SaleQuery {
  status?: string;
  page?: number;
  per_page?: number;
}

/** A document — `DocumentSerializer` (backend Phase 11 documents admin).
 * `fields` is the document's own freeform content (shape depends on `kind`,
 * which is deliberately freeform — the old taxonomy's ~28 kinds grew
 * continuously). `pdf_url` is the stored rendering: the backend NEVER
 * generates document visuals — the client renders and `upload`s (that
 * contract is the Studio's D18 half). Lifecycle: draft (editable) →
 * confirm (needs an uploaded PDF, locks) → sign; archive any time.
 * `owner_lock` restricts confirm/sign/edit to the owner role. */
export type DocumentAdmin = Schemas['Document'];
export type DocumentVersionAdmin = Schemas['DocumentVersion'];

/** One of the signed-in collector's own documents (`GET /api/documents/`,
 * G-DOC-1) — `CollectorDocumentSerializer`: collector-safe fields only, never
 * the freeform `fields` blob. Only shared documents of a collector-visible
 * kind reach this list (`Document.COLLECTOR_VISIBLE_KINDS`), newest-shared
 * first. `pdf_url` is a signed, expiring URL, or `null` before a PDF exists. */
export type CollectorDocument = Schemas['CollectorDocument'];
/** `GET /api/documents/public/{kind}/` — the latest confirmed, public-visibility
 * document of a kind, served whole (`DocumentSerializer`), `AllowAny`. A kind
 * with nothing published is a 404. */
export type PublicDocument = Schemas['Document'];

/** The documents list takes exactly one filter: exact `kind`. */
export interface DocumentQuery {
  kind?: string;
  page?: number;
  per_page?: number;
}

/** A source link — `GalleryLinkSerializer` (backend Phase 10/12): one
 * gallery / dealer / artist / collector who shares works with Darz, plus
 * their no-login portal (token + PIN, revealed ONCE at issue — the same
 * shown-once contract as access keys). `feat_funnel` /
 * `feat_funnel_activity` are the per-link sales-funnel display toggles. */
export type GalleryLinkAdmin = Schemas['GalleryLink'];

/** One assigned work on a link — the portal reads this SNAPSHOT, never the
 * live artwork (a later edit must not retroactively change what a source
 * saw). `funnel_status` is the Darz-set override; blank derives live. */
export type GalleryLinkArtwork = Schemas['GalleryLinkArtwork'];

/** A pricelist a partner sent from the portal — `GalleryPricelistSerializer`
 * (`title`, `notes`, `created_at`). The file behind it is stored
 * (`GalleryPricelist.object_key`) but not serialized, so the desk can name
 * the submission and not open it (G-PORT-14). */
export type GalleryPricelistAdmin = Schemas['GalleryPricelist'];

/** A portal submission in the review queue — approving an availability /
 * price / correction update applies it to the artwork through the real
 * catalog services; the other kinds record intent only. */
export type GalleryUpdateAdmin = Schemas['GalleryUpdate'];

/** Admin lot — `LotAdminSerializer`: the collector shape PLUS the
 * confidential `reserve_amount` and `leading_bidder`, with the artwork as a
 * bare uuid. Lots are create-only (no PATCH — G-AUC-2); they move through
 * `go-live` and `close` (+`?force=` sells under reserve). */
export type LotAdmin = Schemas['LotAdmin'];

/** A paddle request — `BidderRegistrationAdminSerializer`. Approving assigns
 * the auction's next sequential paddle number server-side. */
export type BidderRegistrationAdmin = Schemas['BidderRegistrationAdmin'];

/** A ledger entry — `LedgerEntrySerializer` (backend Phase 11's accounting,
 * owner-only end to end). Four books (Darz · Koocheh · Personal · Expenses
 * Arian — the old app's own ledgers), income/expense, seven statuses, the
 * manual-FX fields and the sale labels. `book` is immutable after create. */
export type LedgerEntryAdmin = Schemas['LedgerEntry'];

export interface LedgerQuery {
  book?: string;
  entry_type?: string;
  status?: string;
  category?: string;
  person?: string;
  position?: string;
  /** YYYY-MM */
  month?: string;
  page?: number;
  per_page?: number;
}

/** `GET /accounting/admin/ledger/summary/?book=&month=` — the old
 * `acctSummary` served: per-currency buckets, never summed across
 * currencies, plus the manual-rate converted-income view (`acctConv`). */
export interface LedgerSummary {
  book: string;
  month: string;
  currencies: string[];
  by_currency: Record<
    string,
    {
      currency: string;
      income: string;
      expense: string;
      salaries: string;
      pending: string;
      net: string;
      count: number;
    }
  >;
  converted_income: Record<string, string>;
}

/** A private deal — `PrivateDealSerializer` (owner-only): the old panel's
 * Private Deals CRM in full — parties, payment tracks, commission, follow-up,
 * 15 money fields each with its own currency companion, the per-deal `calc`
 * roll-up (server-computed, per currency, never mixed) and slotted
 * attachments with served URLs. */
export type PrivateDealAdmin = Schemas['PrivateDeal'];

export interface DealQuery {
  status?: string;
  pay_status?: string;
  artist_label?: string;
  buyer_name?: string;
  seller_name?: string;
  /** YYYY-MM over deal_date */
  month?: string;
  page?: number;
  per_page?: number;
}

/** `GET /accounting/admin/deals/summary/` — `pdealSummary` served: the same
 * per-currency discipline as the ledger summary. */
export interface DealsSummary {
  currencies: string[];
  by_currency: Record<
    string,
    {
      sale: string;
      commission: string;
      costs: string;
      expenses: string;
      received: string;
      net: string;
      remaining: string;
    }
  >;
  count?: number;
}

/** A receipt / invoice on a ledger entry. Upload is multipart (`file` + an
 * optional freeform `kind`); `file_url` is served by the backend, so the desk
 * never builds a storage URL itself. Setting one flips the entry's own
 * read-only `has_receipt`. */
export type LedgerAttachment = Schemas['LedgerAttachment'];
/** A file on a private deal. Same shape, but `slot` is a closed vocabulary
 * (`accounting.deal_attachment_slot`) rather than freeform. */
export type DealAttachment = Schemas['DealAttachment'];

/** The Expenses-Arian receipt-review extension — `ArianReceiptReview`, a
 * 1:1 on a ledger entry in that book only. `dup_status` is re-scanned by the
 * server on every save, so the desk never computes it. */
export type ArianReviewWrite = Schemas['ArianReviewWrite'];
/** The stored review, as it rides on `LedgerEntry.arian_review`. The generated
 * type is not nullable, but the field IS null on an entry outside the
 * Expenses-Arian book (the extension is a 1:1 that only exists there), so
 * every reader must treat it as optional. */
export type ArianReceiptReview = Schemas['ArianReceiptReview'];

/** The ownership-settlement worksheet: a single `slug: "default"` row whose
 * `state` is freeform JSON (sheets → sections → rows, plus config), with an
 * optimistic-lock `version` and explicit named snapshots. The old desk kept
 * this in its own device-local store (`darz_settlement_v1`) inside an iframe;
 * here it is one owner-only server record, which is the point of porting it. */
export type SettlementWorksheet = Schemas['SettlementWorksheet'];
export type SettlementWorksheetVersion = Schemas['SettlementWorksheetVersion'];

/** `GET /api/admin/audit-log/` (backend Phase 33, `IsOwner`) — append-only,
 * written by `apps.core.audit.record_audit` on every privileged mutation and
 * never edited. `changes` is freeform JSON whose shape depends on `action`. */
export type AuditLogEntry = Schemas['AuditLog'];

export interface AuditLogQuery {
  action?: string;
  entity_type?: string;
  page?: number;
  per_page?: number;
}

/** `GET /catalog/admin/artworks/{id}/selection-grants/` — which collectors
 * may see a curated ("selected") work. A grant is per `(artwork, collector)`
 * and several selections can want the same pair, which is why revoking is
 * the server's decision and not a row delete the desk can predict. */
export type ArtworkSelectionGrant = Schemas['ArtworkSelectionGrant'];

/* ─── Gallery Portal (Phase 14) — the no-login partner surface ─────────────
 * `/api/gallery/portal/{token}/…` — token in the path, PIN on every request
 * (`?pin=` on GET, a `pin` field on writes). Shapes mirror
 * `apps/gallery/serializers.py` + `views.py::portal_state`. */

/** `GalleryLinkArtwork.snapshot` — the denormalized per-link copy the portal
 * reads (`apps/gallery/services.py::GalleryLinkArtworkService.assign`). The
 * portal never sees the live Artwork; note there is NO image key (G-PORT-1). */
export interface PortalSnapshot {
  title?: string | null;
  artist?: string | null;
  year?: string | null;
  medium?: string | null;
  material?: string | null;
  dimensions?: string | null;
  price_amount?: string | null;
  currency?: string | null;
  price_type?: string | null;
  availability_status?: string | null;
}

/** One funnel entry from `FunnelDerivationService.for_link` — stage is the
 * `gallery.funnel_stage` enum; `activity` present only with
 * `feat_funnel_activity` (always anonymous aggregates). */
export interface PortalFunnel {
  stage: string;
  activity?: {
    offers: number;
    holds: number;
    requests: number;
    saves: number;
    views: number;
    last_activity_at: string | null;
  };
}

export interface PortalWork {
  id: string;
  link: string;
  artwork: string;
  snapshot: PortalSnapshot;
  funnel_status: string;
  created_at: string;
  /** injected by `portal_state` when the link has `feat_funnel` */
  funnel?: PortalFunnel | null;
}

export interface PortalPricelist {
  id: string;
  title: string;
  notes: string;
  created_at: string;
}

export interface PortalMessage {
  id: string;
  sender: 'portal' | 'admin';
  body: string;
  read_at: string | null;
  created_at: string;
}

/** `GET /gallery/portal/{token}/` — the link (minus token/pin_hash) plus the
 * three embedded lists. */
export interface PortalState {
  id: string;
  source_type: 'gallery' | 'artist' | 'collector' | 'dealer';
  name: string;
  status: string;
  theme: Record<string, unknown>;
  feature_flags: Record<string, unknown>;
  feat_funnel: boolean;
  feat_funnel_activity: boolean;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  expires_at: string | null;
  issued_by: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  assigned_artworks: PortalWork[];
  pricelists: PortalPricelist[];
  messages: PortalMessage[];
}

/** `POST /gallery/portal/{token}/updates/` body (minus the riding `pin`). */
export interface PortalUpdateSubmit {
  kind: string;
  artwork?: string | null;
  payload?: Record<string, unknown>;
}

export interface PortalUpdateRow {
  id: string;
  link: string;
  artwork: string | null;
  kind: string;
  payload: Record<string, unknown>;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string;
  created_at: string;
}

/** One priced line of a composed exhibition package
 * (`ExhibitionServiceLineSerializer`). */
export interface PortalServiceLine {
  id: string;
  service_key: string;
  title: string;
  description: string;
  price: string | null;
  currency: string;
  status: 'proposed' | 'confirmed' | 'declined' | 'delivered';
  admin_note: string;
  position: number;
  created_at: string;
}

/** `views.py::_portal_exhibition_dict` — the source's trimmed view of one
 * show. `service_lines`/`documents` fill only once Darz has published it. */
export interface PortalExhibition {
  id: string;
  title: string;
  event_date: string;
  venue: string;
  artists: string;
  note: string;
  project: string;
  gallery_note: string;
  gallery_selected: string[];
  request_status: 'draft' | 'requested' | 'approved' | 'rejected';
  published: boolean;
  currency: string;
  discount: string;
  created_at: string;
  service_lines: PortalServiceLine[];
  documents: DocumentAdmin[];
}

/** `GET /gallery/portal/{token}/exhibitions/catalogue/` — the seeded services
 * menu (`apps/gallery/exhibition_catalogue.py`), admin-overridable per event. */
export interface PortalCatalogueEntry {
  key: string;
  title: string;
  description: string;
  default_price: number | null;
}

/** Gallery-owned fields of a show — what `create`/`PATCH` from the portal may
 * carry (`ExhibitionEventCreateSerializer` / `…UpdateSerializer`). */
export interface PortalExhibitionInput {
  title?: string;
  event_date?: string;
  venue?: string;
  artists?: string;
  note?: string;
  gallery_note?: string;
  project?: string;
}

/** Admin tier of one exhibition (`ExhibitionEventSerializer`) — the portal's
 * trimmed `PortalExhibition` plus the admin-owned fields. */
export interface ExhibitionAdmin {
  id: string;
  link: string;
  title: string;
  event_date: string;
  venue: string;
  artists: string;
  note: string;
  project: string;
  gallery_selected: string[];
  gallery_note: string;
  request_status: 'draft' | 'requested' | 'approved' | 'rejected';
  currency: string;
  discount: string;
  admin_note: string;
  published: boolean;
  gallery_updated_at: string | null;
  admin_updated_at: string | null;
  created_by: string | null;
  service_lines: PortalServiceLine[];
  version: number;
  created_at: string;
  updated_at: string;
}

/** One composed line (`ExhibitionServiceLineInputSerializer`) — `compose`
 * REPLACES the whole package with these. */
export interface ExhibitionLineInput {
  service_key: string;
  title?: string;
  description?: string;
  price?: string | null;
  currency?: string;
  status?: 'proposed' | 'confirmed' | 'declined' | 'delivered';
  admin_note?: string;
  position?: number;
}

/** Admin-owned PATCH fields (`ExhibitionAdminUpdateSerializer`). */
export interface ExhibitionAdminPatch {
  title?: string;
  event_date?: string;
  venue?: string;
  artists?: string;
  project?: string;
  currency?: string;
  discount?: string;
  admin_note?: string;
  request_status?: 'draft' | 'requested' | 'approved' | 'rejected';
}

export interface ExhibitionQuery {
  link?: string;
  request_status?: string;
  published?: 'true' | 'false';
  page?: number;
  per_page?: number;
}

/* ---- Projects (backend Phase 31, `apps/projects`) — frontend Phase 11c ----
   The old panel's Projects group (`darz-studio.html:13235-15534`) over the
   server-side store. The JSON-shaped fields (`deliverables`, `money`, `stages`,
   `partner_roles`, `links`, package `lines`/`counts`/…) come through as
   `unknown`: the backend stores the old panel's own shapes verbatim (its
   serializer descriptions spell them out) and `features/admin/projects/
   projectForm.ts` owns the typed readers/writers for them. */
export type ProjectAdmin = Schemas['Project'];
export type ProjectPartnerRef = Schemas['_ProjectPartnerOrg'];
export type ProjectCategory = Schemas['ProjectCategoryEnum'];
export type ProjectStage = Schemas['StageEnum'];
/** Named through the field, not the enum: drf-spectacular renamed the colliding
 * enum (`ProjectStatusEnum` → `Status2c3Enum`) once G-PROJ-2 made `status`
 * writable, and it will rename it again on the next collision (C-2). */
export type ProjectStatus = Schemas['Project']['status'];
export type ProjectCreateInput = Schemas['ProjectCreate'];
/** `PATCH …/projects/{id}/` — the optimistic lock is required, not optional. */
export type ProjectPatch = Omit<Schemas['PatchedProjectUpdate'], 'expected_version'> & {
  expected_version: number;
};
export type ProjectAttachmentAdmin = Schemas['ProjectAttachment'];
export type ProjectDashboard = Schemas['ProjectDashboardSummary'];
/** One row of `GET …/projects/reports/` (`reports_deliverables_rollup`). */
export interface ProjectReportRow {
  project_id: string;
  project_no: string;
  project_name: string;
  deliverable: Record<string, unknown>;
}
export type PartnerOrgAdmin = Schemas['PartnerOrg'];
export type ServiceCatalogItemAdmin = Schemas['ServiceCatalogItem'];
export type ServiceCategory = Schemas['ProjectServiceCategoryEnum'];
export type PackageTemplateAdmin = Schemas['PackageTemplate'];
export type ChecklistTemplateAdmin = Schemas['ChecklistTemplate'];

type Editable<T> = Omit<T, 'id' | 'version' | 'created_at' | 'updated_at'>;
export type PartnerOrgInput = Editable<PartnerOrgAdmin>;
export type PartnerOrgPatch = Partial<PartnerOrgInput> & { expected_version: number };
export type ServiceCatalogItemInput = Editable<ServiceCatalogItemAdmin>;
export type ServiceCatalogItemPatch = Partial<ServiceCatalogItemInput> & {
  expected_version: number;
};
export type PackageTemplateInput = Editable<PackageTemplateAdmin>;
export type PackageTemplatePatch = Partial<PackageTemplateInput> & {
  expected_version: number;
};
export type ChecklistTemplateInput = Editable<ChecklistTemplateAdmin>;
export type ChecklistTemplatePatch = Partial<ChecklistTemplateInput> & {
  expected_version: number;
};

/** `ProjectFilterSet` — search on name/no/client_name/venue; exact status,
 * stage, category, archived; ordering `created|-created|name|-name`.
 * `archived` is a boolean here and the service spells it `True`/`False` on
 * the wire: the filter hands the raw string to Django's BooleanField, which
 * 400s on the lowercase `true`/`false` the endpoint's own docs name
 * (found live; G-PROJ-6). */
export interface ProjectQuery {
  search?: string;
  status?: string;
  stage?: string;
  category?: string;
  archived?: boolean;
  ordering?: 'created' | '-created' | 'name' | '-name';
  page?: number;
  per_page?: number;
}
export interface PartnerOrgQuery {
  search?: string;
  page?: number;
  per_page?: number;
}
export interface ServiceCatalogQuery {
  search?: string;
  category?: string;
  page?: number;
  per_page?: number;
}
export interface PageQuery {
  page?: number;
  per_page?: number;
}
