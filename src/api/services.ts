/**
 * Resource services — one class per backend resource group, all extending
 * `ResourceService`. The base owns the `ApiClient` handle + `basePath` and the
 * verb helpers; subclasses are a thin, typed list of the endpoints they wrap.
 *
 * This is the layer feature code (Phase 4+) talks to — never `fetch`, never a
 * raw path. Mirrors the backend's app split (`catalog`, `crm`,
 * `recommendations`, `core`), the way `CLAUDE.md` asks component boundaries to
 * mirror the old app's real modules.
 */
import type { ApiClient } from './ApiClient';
import type { AuthSession, Me } from './AuthSession';
import type { RequestOptions } from './HttpClient';
import type {
  AdminRequest,
  AdminRequestQuery,
  Artist,
  ArtistQuery,
  Artwork,
  Auction,
  AuctionNotification,
  AuctionQuery,
  AuctionRecord,
  AuctionRecordQuery,
  BidderRegistration,
  BidHistoryItem,
  CatalogueQuery,
  CollectorActivity,
  CollectorRequest,
  CollectorRequestQuery,
  CreatedRequest,
  Lot,
  Paginated,
  PublishedRecommendation,
  RequestDetail,
  RequestKind,
  RequestMessage,
  RequestMessageQuery,
  SavedArtwork,
  SavedArtworkQuery,
} from './types';

export abstract class ResourceService {
  protected readonly client: ApiClient;
  protected readonly basePath: string;

  constructor(client: ApiClient, basePath: string) {
    this.client = client;
    this.basePath = basePath;
  }

  protected list<T>(path: string, query?: RequestOptions['query']) {
    return this.client.send<Paginated<T>>('GET', this.basePath + path, { query });
  }
  protected retrieve<T>(path: string, query?: RequestOptions['query']) {
    return this.client.send<T>('GET', this.basePath + path, { query });
  }
  protected create<T>(path: string, body?: unknown) {
    return this.client.send<T>('POST', this.basePath + path, { body });
  }
  protected remove(path: string) {
    return this.client.send<void>('DELETE', this.basePath + path);
  }
}

/** `/api/catalog/` — the collector catalogue (read-only for V1). */
export class CatalogService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/catalog');
  }

  artworks(query: CatalogueQuery = {}) {
    return this.list<Artwork>('/artworks/', query as RequestOptions['query']);
  }
  artwork(id: string) {
    return this.retrieve<Artwork>(`/artworks/${id}/`);
  }
  artists(query: ArtistQuery = {}) {
    return this.list<Artist>('/artists/', query as RequestOptions['query']);
  }
  artist(id: string) {
    return this.retrieve<Artist>(`/artists/${id}/`);
  }
}

/** `/api/crm/` — the collector's own requests, activity log, and saved works. */
export class CrmService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/crm');
  }

  /** The collector's own requests. `kind`/`status` are server-side filters. */
  requests(query: CollectorRequestQuery = {}) {
    return this.list<CollectorRequest>('/requests/', query as RequestOptions['query']);
  }
  /** File a request. `client_req_id` is the idempotency key the backend
   * dedupes on per collector: the same key answers 200 with the row it
   * already holds instead of creating a second one (`replayed: true`). */
  async createRequest(body: {
    kind: RequestKind;
    artwork?: string | null;
    detail?: RequestDetail;
    client_req_id?: string;
  }): Promise<CreatedRequest> {
    const res = await this.client.sendEnveloped<CollectorRequest>(
      'POST',
      this.basePath + '/requests/',
      { body },
    );
    return { row: res.data, replayed: res.status === 200 };
  }

  /** The reply thread on one of the collector's own requests, oldest first
   * (`GET /api/crm/requests/{id}/messages/`). */
  messages(requestId: string, query: RequestMessageQuery = {}) {
    return this.list<RequestMessage>(
      `/requests/${requestId}/messages/`,
      query as RequestOptions['query'],
    );
  }
  /** Post to the thread (`POST .../messages/`). The backend marks the
   * collector's own message seen by the collector; the team sees it unread. */
  postMessage(requestId: string, body: string, artworkRefs: string[] = []) {
    return this.create<RequestMessage>(`/requests/${requestId}/messages/`, {
      body,
      artwork_refs: artworkRefs,
    });
  }
  /** Mark every team message on the thread seen (`POST .../mark-seen/`). */
  markSeen(requestId: string) {
    return this.create<{ unread_count: number }>(`/requests/${requestId}/messages/mark-seen/`);
  }

  /** Admin: the unified feed of every request across every kind
   * (`GET /api/crm/admin/requests/`, filterable by kind/status/assignee/
   * archived). `collector`/`artwork` are nested objects now (G-F1-7), not
   * bare uuids; `allowed_transitions` reports the legal next statuses. */
  adminRequests(query: AdminRequestQuery = {}) {
    return this.list<AdminRequest>('/admin/requests/', query as RequestOptions['query']);
  }
  /** Admin: the thread on any request (`GET /api/crm/admin/requests/{id}/messages/`). */
  adminMessages(requestId: string, query: RequestMessageQuery = {}) {
    return this.list<RequestMessage>(
      `/admin/requests/${requestId}/messages/`,
      query as RequestOptions['query'],
    );
  }
  /** Admin: reply on a request's thread. */
  adminPostMessage(requestId: string, body: string, artworkRefs: string[] = []) {
    return this.create<RequestMessage>(`/admin/requests/${requestId}/messages/`, {
      body,
      artwork_refs: artworkRefs,
    });
  }
  /** Admin: mark every collector message on the thread seen. */
  adminMarkSeen(requestId: string) {
    return this.create<{ unread_count: number }>(
      `/admin/requests/${requestId}/messages/mark-seen/`,
    );
  }
  /** Admin: move one request to another status (`POST .../transition/`). */
  transitionRequest(id: string, toStatus: string, note = '') {
    return this.create<AdminRequest>(`/admin/requests/${id}/transition/`, {
      to_status: toStatus,
      note,
    });
  }
  logActivity(body: { kind: string; artwork?: string; metadata?: Record<string, unknown> }) {
    return this.create<CollectorActivity>('/activity/', body);
  }
  /** `?artwork=` (repeatable) and `?ordering=` (G-P6-2/G-P6-4); default order
   * is newest-first. */
  saved(query: SavedArtworkQuery = {}) {
    return this.list<SavedArtwork>('/saved/', query as RequestOptions['query']);
  }
  /** The response's `created` flag distinguishes newly-saved/restored from
   * an already-saved no-op (G-P6-3). */
  save(artworkId: string) {
    return this.create<SavedArtwork>('/saved/', { artwork: artworkId });
  }
  unsave(artworkId: string) {
    return this.remove(`/saved/${artworkId}/`);
  }
}

/** `/api/auctions/` — collector-facing auction browse + live lot state
 * (Phase 8). Bidding/registration/notifications land in later steps; step 1
 * is read-only. Live price movement comes over the WebSocket
 * (`LotSocket`), not from here. */
export class AuctionService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/auctions');
  }

  auctions(query: AuctionQuery = {}) {
    return this.list<Auction>('/', query as RequestOptions['query']);
  }
  auction(id: string) {
    return this.retrieve<Auction>(`/${id}/`);
  }
  /** Lots in one auction (`GET /api/auctions/{auction_pk}/lots/`). */
  lots(auctionId: string, query: { per_page?: number; page?: number } = {}) {
    return this.list<Lot>(`/${auctionId}/lots/`, query);
  }
  /** One lot's public live state (`GET /api/auctions/lots/{id}/`). */
  lot(id: string) {
    return this.retrieve<Lot>(`/lots/${id}/`);
  }
  /** Anonymous bid ladder — paddle number + amount only. */
  bidHistory(lotId: string, query: { per_page?: number; page?: number } = {}) {
    return this.list<BidHistoryItem>(`/lots/${lotId}/bids/`, query);
  }

  /** The collector's own paddle registrations (Phase 8 step 2). */
  registrations(query: { per_page?: number; page?: number } = {}) {
    return this.list<BidderRegistration>('/registrations/', query);
  }
  /** Request a paddle. `agreeTerms` accepts the auction's Conditions of Sale
   * (required when `auction.terms_required`). */
  register(auctionId: string, agreeTerms: boolean) {
    return this.create<BidderRegistration>('/registrations/', {
      auction: auctionId,
      agree_terms: agreeTerms,
    });
  }
  /** Place a proxy/max bid. `maxAmount` is the confidential ceiling; the
   * server resolves the displayed price and returns the updated lot. */
  placeBid(lotId: string, maxAmount: number | string) {
    return this.create<Lot>(`/lots/${lotId}/bids/`, { max_amount: String(maxAmount) });
  }

  /** The collector's auction notifications, newest first (Phase 8 step 3).
   * `outbid` / `won` / `lost` / `closing_soon`. */
  notifications(query: { per_page?: number; page?: number } = {}) {
    return this.list<AuctionNotification>('/notifications/', query);
  }
  /** Mark one notification read. */
  markRead(id: string) {
    return this.create<AuctionNotification>(`/notifications/${id}/read/`);
  }

  /** External auction-house results — read-only comparables (Phase 8 step 4).
   * `search` / `ordering` / `artist` are server-side. */
  records(query: AuctionRecordQuery = {}) {
    return this.list<AuctionRecord>('/records/', query as RequestOptions['query']);
  }
  record(id: string) {
    return this.retrieve<AuctionRecord>(`/records/${id}/`);
  }
}

/** `/api/recommendations/` — the admin-curated "Selected for you" batches. */
export class RecommendationService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/recommendations');
  }

  published(query: { per_page?: number; page?: number } = {}) {
    return this.list<PublishedRecommendation>('/published/', query);
  }
  dismiss(id: string) {
    return this.create<PublishedRecommendation>(`/published/${id}/dismiss/`);
  }
}

/** Most keys are a flat `[{value, label}]` list, but a few aren't — e.g.
 * `crm.request_status_by_kind` (`{kind: [{value,label}]}`, G-F1-4) and
 * `catalog.refine_dimensions_enabled` (`string[]`, G7) are shaped
 * differently and read live (an owner toggle applies immediately, not just
 * after the next deploy). Cast at the read site with the typed helpers in
 * `./types` (`RequestStatusByKind`, etc.) rather than assuming every key is
 * a flat list. */
export type OptionsMap = Record<string, unknown>;

/** `GET /api/options/` — every choice field as `{value, label}` (or, for a
 * few dynamic keys, a differently-shaped live value — see `OptionsMap`).
 * Cached for the tab's lifetime; never hardcode a label lookup. */
export class OptionsService extends ResourceService {
  private cache: Promise<OptionsMap> | null = null;

  constructor(client: ApiClient) {
    super(client, '');
  }

  all(): Promise<OptionsMap> {
    this.cache ??= this.retrieve<OptionsMap>('/options/');
    return this.cache;
  }
  reload(): Promise<OptionsMap> {
    this.cache = this.retrieve<OptionsMap>('/options/');
    return this.cache;
  }
}

/** Auth — delegates the token lifecycle to `AuthSession`, adds the one
 * authenticated auth endpoint that isn't part of it (`membership/redeem/`). */
export class AuthService extends ResourceService {
  private readonly session: AuthSession;

  constructor(client: ApiClient, session: AuthSession) {
    super(client, '/auth');
    this.session = session;
  }

  loginTeam(email: string, password: string): Promise<Me> {
    return this.session.loginTeam(email, password);
  }
  loginCollector(accessKey: string): Promise<Me> {
    return this.session.loginCollector(accessKey);
  }
  logout(): Promise<void> {
    return this.session.logout();
  }
  me(): Promise<Me> {
    return this.session.loadMe();
  }
  redeemMembership(code: string) {
    return this.create<{ plan: string; tier: string; redeemed_at: string }>(
      '/membership/redeem/',
      { code },
    );
  }
}
