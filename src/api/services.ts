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
  AccessRequest,
  AccessRequestInput,
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
  AccessKeyAdmin,
  AccessRequestAdmin,
  AppTheme,
  AppThemeVersion,
  ArtworkImportBatch,
  ArtworkImportBatchList,
  ArtworkImportRow,
  DataHealthReport,
  CollectorActivityAdmin,
  CollectorAdmin,
  CollectorAdminQuery,
  CollectorSelection,
  CollectorLoginEvent,
  CollectorRequestQuery,
  MembershipCodeAdmin,
  TeamUserAdmin,
  DashboardSummary,
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
  ArtworkAdmin,
  ArtworkAdminQuery,
  ArtworkImageAdmin,
  ArtistAdmin,
  SaleAdmin,
  SaleQuery,
  DocumentAdmin,
  DocumentQuery,
  DocumentVersionAdmin,
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
  /**
   * The collector's curated works (backend Phase 24) — the `selected` /
   * `private_selection` artworks explicitly granted to them. Deliberately a
   * different endpoint, not a filter on `/artworks/`: the backend guarantees
   * "a work here never also appears in the main catalogue response"
   * (`ArtworkService.selection_queryset`), which is the old `club_items`
   * behaviour. Needs a collector session; a team token gets a 403.
   */
  artworkSelections(query: CatalogueQuery = {}) {
    return this.list<Artwork>('/artworks/selections/', query as RequestOptions['query']);
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
  /** Admin: the collector self-logged activity feed (backend Phase 28) —
   * view / save / search / login events, nested collector/artwork. */
  adminActivity(
    query: {
      collector?: string;
      kind?: string;
      artwork?: string;
      per_page?: number;
      page?: number;
    } = {},
  ) {
    return this.list<CollectorActivityAdmin>(
      '/admin/activity/',
      query as RequestOptions['query'],
    );
  }
  /** Admin: the named Collector Club selections (backend Phase 35). */
  adminSelections(query: { per_page?: number; page?: number } = {}) {
    return this.list<CollectorSelection>(
      '/admin/selections/',
      query as RequestOptions['query'],
    );
  }
  createSelection(body: {
    name: string;
    note?: string;
    artwork_ids?: string[];
    collector_ids?: string[];
  }) {
    return this.create<CollectorSelection>('/admin/selections/', body);
  }
  /** Saving syncs the underlying grants; the lock field is `expected_version`
   * here, not `version` — the serializer's own naming. */
  updateSelection(
    id: string,
    body: {
      name?: string;
      note?: string;
      artwork_ids?: string[];
      collector_ids?: string[];
      expected_version: number;
    },
  ) {
    return this.client.send<CollectorSelection>(
      'PATCH',
      `${this.basePath}/admin/selections/${id}/`,
      {
        body,
      },
    );
  }
  deleteSelection(id: string) {
    return this.remove(`/admin/selections/${id}/`);
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

/** `/api/auth/admin/` — the panel's Collectors cluster (backend Phases 27, 33,
 * 34): collector CRUD, access keys, login events, and the access-request
 * review queue. Kept apart from `AuthService`, which is the session's own
 * surface (login/logout/me) — this one is a desk. */
export class AdminAccountsService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/auth/admin');
  }

  collectors(query: CollectorAdminQuery = {}) {
    return this.list<CollectorAdmin>('/collectors/', query as RequestOptions['query']);
  }
  collector(id: string) {
    return this.retrieve<CollectorAdmin>(`/collectors/${id}/`);
  }
  createCollector(body: Partial<CollectorAdmin>) {
    return this.create<CollectorAdmin>('/collectors/', body);
  }
  /** PATCH with the row's own `version` — a stale one 409s (Phase 7 rule). */
  updateCollector(id: string, body: Partial<CollectorAdmin> & { version: number }) {
    return this.client.send<CollectorAdmin>('PATCH', `${this.basePath}/collectors/${id}/`, {
      body,
    });
  }
  deleteCollector(id: string) {
    return this.remove(`/collectors/${id}/`);
  }

  accessKeys(collectorId: string, query: { per_page?: number; page?: number } = {}) {
    return this.list<AccessKeyAdmin>(
      `/collectors/${collectorId}/access-keys/`,
      query as RequestOptions['query'],
    );
  }
  /** Issue — the response carries `access_key` (the plaintext) exactly once,
   * never re-exposed by any read (`ShownOnceSecret` is its only home). */
  issueAccessKey(collectorId: string, expiresAt: string | null = null) {
    return this.create<AccessKeyAdmin & { access_key: string }>(
      `/collectors/${collectorId}/access-keys/`,
      expiresAt ? { expires_at: expiresAt } : {},
    );
  }
  revokeAccessKey(keyId: string) {
    return this.create<AccessKeyAdmin>(`/access-keys/${keyId}/revoke/`);
  }
  /** The old desk's "+1 week" / "+1 month" / "Make permanent" (Phase 33). */
  extendAccessKey(keyId: string, extend: '1w' | '1m' | 'none') {
    return this.create<AccessKeyAdmin>(`/access-keys/${keyId}/extend/`, { extend });
  }
  loginEvents(collectorId: string, query: { per_page?: number; page?: number } = {}) {
    return this.list<CollectorLoginEvent>(
      `/collectors/${collectorId}/login-events/`,
      query as RequestOptions['query'],
    );
  }

  // --- Memberships (owner-only, backend Phase 30) --------------------------
  membershipCodes(
    query: {
      search?: string;
      plan?: string;
      status?: string;
      per_page?: number;
      page?: number;
    } = {},
  ) {
    return this.list<MembershipCodeAdmin>(
      '/membership-codes/',
      query as RequestOptions['query'],
    );
  }
  /** Blank `code` auto-generates `DZ-<plan letter>-<6 unambiguous chars>`. */
  createMembershipCode(body: Partial<MembershipCodeAdmin>) {
    return this.create<MembershipCodeAdmin>('/membership-codes/', body);
  }
  updateMembershipCode(id: string, body: Partial<MembershipCodeAdmin> & { version: number }) {
    return this.client.send<MembershipCodeAdmin>(
      'PATCH',
      `${this.basePath}/membership-codes/${id}/`,
      { body },
    );
  }
  /** The old desk's `membRenew` rule, server-side: +1 month from
   * max(expiry, today), and reactivates. */
  renewMembershipCode(id: string) {
    return this.create<MembershipCodeAdmin>(`/membership-codes/${id}/renew/`);
  }
  deleteMembershipCode(id: string) {
    return this.remove(`/membership-codes/${id}/`);
  }

  // --- Team logins (owner-only, backend Phase 31) ---------------------------
  teamUsers(query: { search?: string; role?: string; per_page?: number; page?: number } = {}) {
    return this.list<TeamUserAdmin>('/team-users/', query as RequestOptions['query']);
  }
  /** The generated password rides back exactly once. */
  createTeamUser(body: { email: string; name?: string; role?: string }) {
    return this.create<TeamUserAdmin & { password: string }>('/team-users/', body);
  }
  updateTeamUser(id: string, body: Partial<TeamUserAdmin> & { version: number }) {
    return this.client.send<TeamUserAdmin>('PATCH', `${this.basePath}/team-users/${id}/`, {
      body,
    });
  }
  deleteTeamUser(id: string) {
    return this.remove(`/team-users/${id}/`);
  }

  /** The review queue. The server defaults to `status=pending`. */
  accessRequests(
    query: { status?: string; search?: string; per_page?: number; page?: number } = {},
  ) {
    return this.list<AccessRequestAdmin>(
      '/access-requests/',
      query as RequestOptions['query'],
    );
  }
  /** Approve — creates the Collector AND issues its first key in one action;
   * the plaintext rides back once on `access_key`. */
  approveAccessRequest(id: string, tier: string | null = null) {
    return this.create<AccessRequestAdmin & { access_key: string }>(
      `/access-requests/${id}/approve/`,
      tier ? { tier } : {},
    );
  }
  declineAccessRequest(id: string) {
    return this.create<AccessRequestAdmin>(`/access-requests/${id}/decline/`);
  }
}

/** `/api/catalog/admin/` — the admin catalogue (backend Phase 7 CRUD +
 * Phase 23 operations): artworks and artists CRUD, the guarded status
 * machine, publish/unpublish, images, the Data Health report and the Import
 * staging queue. */
export class CatalogAdminService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/catalog/admin');
  }

  dataHealth() {
    return this.retrieve<DataHealthReport>('/data-health/');
  }

  /** The admin catalogue list — same filterset as the collector one (search
   * over artist/title/medium/dimensions) but visibility-unrestricted, which is
   * what the Database desk and the selection pickers need (a private work is
   * the point). Rows are the full `ArtworkAdminSerializer`. */
  artworks(query: ArtworkAdminQuery = {}) {
    return this.list<ArtworkAdmin>('/artworks/', query as RequestOptions['query']);
  }
  artwork(id: string) {
    return this.retrieve<ArtworkAdmin>(`/artworks/${id}/`);
  }
  createArtwork(body: Partial<ArtworkAdmin>) {
    return this.create<ArtworkAdmin>('/artworks/', body);
  }
  /** PATCH — the lock field on this serializer is `expected_version` (the
   * artwork's own current `version`), like CollectorSelection. */
  updateArtwork(id: string, body: Partial<ArtworkAdmin> & { expected_version: number }) {
    return this.client.send<ArtworkAdmin>('PATCH', `${this.basePath}/artworks/${id}/`, {
      body,
    });
  }
  /** Soft delete — the backend keeps the row (`is_deleted`), audit-logged. */
  deleteArtwork(id: string) {
    return this.client.send<void>('DELETE', `${this.basePath}/artworks/${id}/`);
  }
  /** Guarded state machine (`apps.catalog.lifecycle.AVAILABILITY_TRANSITIONS`)
   * — an illegal move is a 400, so the desk only offers legal targets (see
   * `transitionTargets` in `artworkForm.ts`). */
  transitionArtwork(id: string, toStatus: string) {
    return this.create<ArtworkAdmin>(`/artworks/${id}/transition/`, { to_status: toStatus });
  }
  /** The per-work Market App membership — what the old desk's toggle wrote. */
  publishArtwork(id: string) {
    return this.create<ArtworkAdmin>(`/artworks/${id}/publish/`);
  }
  unpublishArtwork(id: string) {
    return this.create<ArtworkAdmin>(`/artworks/${id}/unpublish/`);
  }

  /** An artwork's images — a plain array (not paginated). Upload is multipart
   * (`file` + ordering/is_primary/alt_text); there is no PATCH — to change
   * the primary you upload the replacement as primary and remove the old
   * (noted on the desk). Delete is soft; the stored object stays. */
  artworkImages(artworkId: string) {
    return this.retrieve<ArtworkImageAdmin[]>(`/artworks/${artworkId}/images/`);
  }
  uploadArtworkImage(
    artworkId: string,
    file: File,
    opts: { ordering?: number; isPrimary?: boolean; altText?: string } = {},
  ) {
    const form = new FormData();
    form.append('file', file);
    if (opts.ordering !== undefined) form.append('ordering', String(opts.ordering));
    if (opts.isPrimary) form.append('is_primary', 'true');
    if (opts.altText) form.append('alt_text', opts.altText);
    return this.client.send<ArtworkImageAdmin>(
      'POST',
      `${this.basePath}/artworks/${artworkId}/images/`,
      { body: form },
    );
  }
  deleteArtworkImage(artworkId: string, imageId: string) {
    return this.client.send<void>(
      'DELETE',
      `${this.basePath}/artworks/${artworkId}/images/${imageId}/`,
    );
  }

  /** The admin artists roster — the backend list takes NO filters (G-CAT-3:
   * no search/ordering/works count), only pagination; the desk fetches a page
   * and searches client-side. */
  artists(query: { page?: number; per_page?: number } = {}) {
    return this.list<ArtistAdmin>('/artists/', query as RequestOptions['query']);
  }
  createArtist(body: Partial<ArtistAdmin>) {
    return this.create<ArtistAdmin>('/artists/', body);
  }
  updateArtist(id: string, body: Partial<ArtistAdmin> & { expected_version: number }) {
    return this.client.send<ArtistAdmin>('PATCH', `${this.basePath}/artists/${id}/`, { body });
  }
  deleteArtist(id: string) {
    return this.client.send<void>('DELETE', `${this.basePath}/artists/${id}/`);
  }

  importBatches(query: { per_page?: number; page?: number } = {}) {
    return this.list<ArtworkImportBatchList>(
      '/import/batches/',
      query as RequestOptions['query'],
    );
  }
  importBatch(id: string) {
    return this.retrieve<ArtworkImportBatch>(`/import/batches/${id}/`);
  }
  /** The client parses the source (CSV/paste/…) and stages structured rows —
   * the backend's own division of labour. */
  stageImportBatch(source: string, rows: Array<Record<string, unknown>>) {
    return this.create<ArtworkImportBatch>('/import/batches/', { source, rows });
  }
  /** Runs every non-rejected row through the real artwork-create path; a row
   * that fails is marked `error` with the detail attached and does not block
   * the rest — per-row review, never all-or-nothing. */
  confirmImportBatch(id: string) {
    return this.create<ArtworkImportBatch>(`/import/batches/${id}/confirm/`);
  }
  discardImportBatch(id: string) {
    return this.create<ArtworkImportBatch>(`/import/batches/${id}/discard/`);
  }
  updateImportRow(batchId: string, rowId: string, resolvedData: Record<string, unknown>) {
    return this.client.send<ArtworkImportRow>(
      'PATCH',
      `${this.basePath}/import/batches/${batchId}/rows/${rowId}/`,
      { body: { resolved_data: resolvedData } },
    );
  }
  rejectImportRow(batchId: string, rowId: string) {
    return this.create<ArtworkImportRow>(`/import/batches/${batchId}/rows/${rowId}/reject/`);
  }
}

/** `/api/sales/admin/` — the deals ledger (backend Phase 7): CRUD with the
 * R7 draft-only commercial lock, the linear status chain via `/transition/`,
 * and the two plain setters. */
export class SalesAdminService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/sales/admin');
  }

  sales(query: SaleQuery = {}) {
    return this.list<SaleAdmin>('/sales/', query as RequestOptions['query']);
  }
  sale(id: string) {
    return this.retrieve<SaleAdmin>(`/sales/${id}/`);
  }
  /** `responsible` is required by the serializer — a standard admin (who
   * cannot list team users, that endpoint is owner-only) records the deal
   * under their own principal id. */
  createSale(body: Partial<SaleAdmin>) {
    return this.create<SaleAdmin>('/sales/', body);
  }
  /** Draft-only (R7) — the service refuses once confirmed; the desk disables
   * the form first. */
  updateSale(id: string, body: Partial<SaleAdmin> & { expected_version: number }) {
    return this.client.send<SaleAdmin>('PATCH', `${this.basePath}/sales/${id}/`, { body });
  }
  /** The linear chain draft→confirmed→invoiced→paid→delivered→completed→
   * archived, `lost` from every non-terminal state — `SALE_TRANSITIONS`,
   * ported in `saleForm.ts` so the desk only offers legal moves. */
  transitionSale(id: string, toStatus: string) {
    return this.create<SaleAdmin>(`/sales/${id}/transition/`, { to_status: toStatus });
  }
  setPaymentStatus(id: string, paymentStatus: string) {
    return this.create<SaleAdmin>(`/sales/${id}/payment-status/`, {
      payment_status: paymentStatus,
    });
  }
  setDeliveryStatus(id: string, deliveryStatus: string) {
    return this.create<SaleAdmin>(`/sales/${id}/delivery-status/`, {
      delivery_status: deliveryStatus,
    });
  }
}

/** `/api/documents/admin/` — the documents desk (backend Phase 11): CRUD on
 * the freeform-kind records, the client-renders-server-stores PDF contract,
 * and the draft → confirm (locks, needs a PDF) → sign lifecycle. */
export class DocumentsAdminService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/documents/admin');
  }

  documents(query: DocumentQuery = {}) {
    return this.list<DocumentAdmin>('/documents/', query as RequestOptions['query']);
  }
  document(id: string) {
    return this.retrieve<DocumentAdmin>(`/documents/${id}/`);
  }
  createDocument(body: {
    kind: string;
    title: string;
    ref?: string;
    fields?: Record<string, unknown>;
    visibility?: string;
    owner_lock?: boolean;
  }) {
    return this.create<DocumentAdmin>('/documents/', body);
  }
  /** Draft-only ("Only a draft document can be edited") — no lock counter on
   * this serializer, the status machine is the lock. */
  updateDocument(
    id: string,
    body: {
      title?: string;
      ref?: string;
      fields?: Record<string, unknown>;
      visibility?: string;
    },
  ) {
    return this.client.send<DocumentAdmin>('PATCH', `${this.basePath}/documents/${id}/`, {
      body,
    });
  }
  deleteDocument(id: string) {
    return this.client.send<void>('DELETE', `${this.basePath}/documents/${id}/`);
  }
  /** The rendered PDF, client-made — multipart. Snapshots the prior state
   * into a DocumentVersion server-side. */
  uploadPdf(id: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.client.send<DocumentAdmin>(
      'POST',
      `${this.basePath}/documents/${id}/upload/`,
      {
        body: form,
      },
    );
  }
  confirmDocument(id: string) {
    return this.create<DocumentAdmin>(`/documents/${id}/confirm/`);
  }
  signDocument(id: string) {
    return this.create<DocumentAdmin>(`/documents/${id}/sign/`);
  }
  archiveDocument(id: string) {
    return this.create<DocumentAdmin>(`/documents/${id}/archive/`);
  }
  versions(id: string, query: { page?: number; per_page?: number } = {}) {
    return this.list<DocumentVersionAdmin>(
      `/documents/${id}/versions/`,
      query as RequestOptions['query'],
    );
  }
}

/** `/api/app-theme/` + `/api/admin/app-theme/` (backend Phase 32) — the live
 * theme: a freeform JSON singleton, public-read (pre-login) and admin-write,
 * with named version checkpoints. The Market App's owner-controlled switches
 * ride in `theme.features` (`docs/ADMIN_ARCHITECTURE.md` §4). */
export class ThemeService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '');
  }

  /** The public read — `AllowAny`, safe before sign-in. */
  publicTheme() {
    return this.retrieve<AppTheme>('/app-theme/');
  }
  adminTheme() {
    return this.retrieve<AppTheme>('/admin/app-theme/');
  }
  /** "Save" — publishes immediately, overwriting the theme object entirely
   * (the server's own wording), so callers merge before calling. */
  publish(theme: Record<string, unknown>) {
    return this.client.send<AppTheme>('PUT', '/admin/app-theme/', { body: { theme } });
  }
  reset() {
    return this.create<AppTheme>('/admin/app-theme/reset/');
  }
  versions(query: { per_page?: number; page?: number } = {}) {
    return this.list<AppThemeVersion>(
      '/admin/app-theme/versions/',
      query as RequestOptions['query'],
    );
  }
  /** "Save version" — the explicit named checkpoint. */
  saveVersion(name: string) {
    return this.create<AppThemeVersion>('/admin/app-theme/versions/', { name });
  }
  activateVersion(id: string) {
    return this.create<AppTheme>(`/admin/app-theme/versions/${id}/activate/`);
  }
  deleteVersion(id: string) {
    return this.remove(`/admin/app-theme/versions/${id}/`);
  }
}

/** `/api/dashboard/` — the admin desk's opening numbers (backend Phase 29). */
export class DashboardService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/dashboard');
  }

  /** One read, no writes. Every number is computed server-side from the same
   * querysets the desks list from, which is what lets a tile link straight to
   * the desk that shows its rows (see `DashboardPage`). */
  summary() {
    return this.retrieve<DashboardSummary>('/admin/summary/');
  }
}

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

  /**
   * The gate's "Request access" form (backend Phase 34) — public, no session.
   * Lands in the admin review queue, where a human issues a key or declines;
   * it mints no credential by itself.
   *
   * `client_req_id` is sent because the old app sends one (app.html:2559) and
   * the day the backend honours it the client already complies. Today it is
   * **ignored** — `AccessRequestService.create` is a plain `objects.create`
   * with no uniqueness, so a double-tap still makes two pending rows
   * (docs/PHASE_24_35_API_GAPS.md G-P34-1, owner decision D3).
   */
  requestAccess(body: AccessRequestInput) {
    return this.create<AccessRequest>('/access-requests/', body);
  }
}
