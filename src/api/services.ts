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
  GalleryLinkAdmin,
  GalleryLinkArtwork,
  GalleryUpdateAdmin,
  BidderRegistrationAdmin,
  LotAdmin,
  LedgerEntryAdmin,
  LedgerQuery,
  LedgerSummary,
  PrivateDealAdmin,
  DealQuery,
  DealsSummary,
  PortalState,
  PortalUpdateSubmit,
  PortalUpdateRow,
  PortalPricelist,
  PortalMessage,
  PortalExhibition,
  PortalExhibitionInput,
  PortalCatalogueEntry,
  ExhibitionAdmin,
  ExhibitionAdminPatch,
  ExhibitionLineInput,
  ExhibitionQuery,
  ProjectAdmin,
  ProjectCreateInput,
  ProjectPatch,
  ProjectStage,
  ProjectAttachmentAdmin,
  ProjectDashboard,
  ProjectReportRow,
  ProjectQuery,
  PartnerOrgAdmin,
  PartnerOrgInput,
  PartnerOrgPatch,
  PartnerOrgQuery,
  ServiceCatalogItemAdmin,
  ServiceCatalogItemInput,
  ServiceCatalogItemPatch,
  ServiceCatalogQuery,
  PackageTemplateAdmin,
  PackageTemplateInput,
  PackageTemplatePatch,
  ChecklistTemplateAdmin,
  ChecklistTemplateInput,
  ChecklistTemplatePatch,
  PageQuery,
} from './types';
import type { PortalClient } from './PortalClient';

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

/** `/api/gallery/admin/` — the source-link half of the gallery loop
 * (backend Phase 10/12): issue (one-time token+PIN reveal), enable/disable,
 * the per-link funnel toggles, the assigned-works snapshot, and the Source
 * Updates review queue. The portal itself (`/gallery/portal/{token}/`) is a
 * separate surface. */
export class GalleryAdminService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/gallery/admin');
  }

  links(query: { source_type?: string; page?: number; per_page?: number } = {}) {
    return this.list<GalleryLinkAdmin>('/links/', query as RequestOptions['query']);
  }
  link(id: string) {
    return this.retrieve<GalleryLinkAdmin>(`/links/${id}/`);
  }
  /** One-time reveal — the plaintext token/PIN are never retrievable again
   * (the serializer's own words). The ShownOnceSecret contract. */
  issueLink(body: {
    source_type: string;
    name: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    expires_at?: string | null;
  }) {
    return this.create<{ link: GalleryLinkAdmin; token: string; pin: string }>(
      '/links/',
      body,
    );
  }
  enableLink(id: string) {
    return this.create<GalleryLinkAdmin>(`/links/${id}/enable/`);
  }
  disableLink(id: string) {
    return this.create<GalleryLinkAdmin>(`/links/${id}/disable/`);
  }
  setLinkFeatures(
    id: string,
    features: { feat_funnel?: boolean; feat_funnel_activity?: boolean },
  ) {
    return this.client.send<GalleryLinkAdmin>(
      'POST',
      `${this.basePath}/links/${id}/features/`,
      {
        body: features,
      },
    );
  }

  linkArtworks(linkId: string, query: { page?: number; per_page?: number } = {}) {
    return this.list<GalleryLinkArtwork>(
      `/links/${linkId}/artworks/`,
      query as RequestOptions['query'],
    );
  }
  assignArtwork(linkId: string, artworkId: string) {
    return this.create<GalleryLinkArtwork>(`/links/${linkId}/artworks/`, {
      artwork: artworkId,
    });
  }
  removeArtwork(linkId: string, assignmentId: string) {
    return this.client.send<void>(
      'DELETE',
      `${this.basePath}/links/${linkId}/artworks/${assignmentId}/`,
    );
  }
  /** '' clears the override — the portal derives the stage again. */
  setFunnelOverride(linkId: string, assignmentId: string, funnelStatus: string) {
    return this.create<GalleryLinkArtwork>(
      `/links/${linkId}/artworks/${assignmentId}/funnel/`,
      { funnel_status: funnelStatus },
    );
  }

  updates(
    query: {
      link?: string;
      kind?: string;
      status?: string;
      page?: number;
      per_page?: number;
    } = {},
  ) {
    return this.list<GalleryUpdateAdmin>('/updates/', query as RequestOptions['query']);
  }
  approveUpdate(id: string, note = '') {
    return this.create<GalleryUpdateAdmin>(`/updates/${id}/approve/`, { note });
  }
  rejectUpdate(id: string, note = '') {
    return this.create<GalleryUpdateAdmin>(`/updates/${id}/reject/`, { note });
  }

  /** The link's Q&A thread — the admin side of the portal's Messages tab.
   * Chronological (`GalleryMessage.Meta.ordering = created_at`). */
  linkMessages(linkId: string, query: { page?: number; per_page?: number } = {}) {
    return this.list<PortalMessage>(
      `/links/${linkId}/messages/`,
      query as RequestOptions['query'],
    );
  }
  sendLinkMessage(linkId: string, body: string) {
    return this.create<PortalMessage>(`/links/${linkId}/messages/`, { body });
  }

  // --- Exhibition Services (Phase 12-A, the desk half) ----------------------

  exhibitions(query: ExhibitionQuery = {}) {
    return this.list<ExhibitionAdmin>('/exhibitions/', query as RequestOptions['query']);
  }
  exhibition(id: string) {
    return this.retrieve<ExhibitionAdmin>(`/exhibitions/${id}/`);
  }
  createExhibitionForLink(linkId: string, body: PortalExhibitionInput) {
    return this.create<ExhibitionAdmin>(`/links/${linkId}/exhibitions/`, body);
  }
  updateExhibition(id: string, body: ExhibitionAdminPatch) {
    return this.client.send<ExhibitionAdmin>('PATCH', `${this.basePath}/exhibitions/${id}/`, {
      body,
    });
  }
  deleteExhibition(id: string) {
    return this.remove(`/exhibitions/${id}/`);
  }
  /** REPLACES the whole priced package (`ExhibitionEventService.compose` —
   * existing lines are soft-deleted first); `approve: true` also flips
   * request_status to approved, the gate `set_published` requires. */
  composeExhibition(
    id: string,
    body: {
      lines: ExhibitionLineInput[];
      approve?: boolean;
      currency?: string;
      discount?: string;
      admin_note?: string;
    },
  ) {
    return this.create<ExhibitionAdmin>(`/exhibitions/${id}/compose/`, body);
  }
  publishExhibition(id: string, published: boolean) {
    return this.create<ExhibitionAdmin>(`/exhibitions/${id}/publish/`, { published });
  }

  exhibitionDocuments(id: string) {
    return this.list<DocumentAdmin>(`/exhibitions/${id}/documents/`);
  }
  createExhibitionDocument(
    id: string,
    body: {
      doc_type: 'exhibition_proposal' | 'exhibition_invoice';
      title?: string;
      fields?: Record<string, unknown>;
    },
  ) {
    return this.create<DocumentAdmin>(`/exhibitions/${id}/documents/`, body);
  }
  /** The backend NEVER renders document visuals — the client renders the PDF
   * and uploads it here (the Document model's own words). */
  uploadExhibitionDocumentPdf(id: string, documentId: string, file: Blob, filename: string) {
    const form = new FormData();
    form.append('file', file, filename);
    return this.create<DocumentAdmin>(
      `/exhibitions/${id}/documents/${documentId}/upload/`,
      form,
    );
  }
  confirmExhibitionDocument(id: string, documentId: string) {
    return this.create<DocumentAdmin>(`/exhibitions/${id}/documents/${documentId}/confirm/`);
  }
  signExhibitionDocument(id: string, documentId: string) {
    return this.create<DocumentAdmin>(`/exhibitions/${id}/documents/${documentId}/sign/`);
  }
}

/** `/api/auctions/admin/` — the auction house's desks (backend Phase 8/35):
 * auctions (create; detail is GET/DELETE — no edit endpoint, G-AUC-1), the
 * Phase-35 invite-only list, lots (create-only + go-live/close), and the
 * paddle-registration queue. The external results DB (`/records/`) waits for
 * its own desk. */
export class AuctionsAdminService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/auctions/admin');
  }

  auctions(query: { page?: number; per_page?: number } = {}) {
    return this.list<Auction>('/auctions/', query as RequestOptions['query']);
  }
  auction(id: string) {
    return this.retrieve<Auction>(`/auctions/${id}/`);
  }
  createAuction(body: {
    title: string;
    description?: string;
    currency: string;
    starts_at: string;
    ends_at: string;
  }) {
    return this.create<Auction>('/auctions/', body);
  }
  deleteAuction(id: string) {
    return this.client.send<void>('DELETE', `${this.basePath}/auctions/${id}/`);
  }
  /** Phase 35 — "Make an auction private": an uninvited collector never sees
   * it and cannot register a paddle. */
  inviteList(id: string) {
    return this.retrieve<{
      invite_only: boolean;
      invited_collectors: Array<{ id: string; display_name: string }>;
    }>(`/auctions/${id}/invite-only/`);
  }
  setInviteOnly(id: string, inviteOnly: boolean, invitedCollectorIds: string[]) {
    return this.create<{
      invite_only: boolean;
      invited_collectors: Array<{ id: string; display_name: string }>;
    }>(`/auctions/${id}/invite-only/`, {
      invite_only: inviteOnly,
      invited_collector_ids: invitedCollectorIds,
    });
  }

  lots(auctionId: string, query: { page?: number; per_page?: number } = {}) {
    return this.list<LotAdmin>(
      `/auctions/${auctionId}/lots/`,
      query as RequestOptions['query'],
    );
  }
  createLot(body: {
    auction: string;
    artwork: string;
    lot_number: number;
    opening_amount: string;
    reserve_amount?: string | null;
    low_estimate?: string | null;
    high_estimate?: string | null;
    premium_pct?: string;
    currency: string;
    starts_at: string;
    ends_at: string;
    soft_close_sec?: number;
  }) {
    return this.create<LotAdmin>(`/auctions/${body.auction}/lots/`, body);
  }
  /** scheduled → live; the artwork transitions to Reserved server-side. */
  goLive(lotId: string) {
    return this.create<LotAdmin>(`/lots/${lotId}/go-live/`);
  }
  /** Sells or passes by the engine's own rules (a sale needs bids AND the
   * reserve met — force never overrides that); `force` closes EARLY, before
   * the lot's scheduled end ("Lot has not reached its end time yet." is the
   * plain close's refusal, found live). */
  closeLot(lotId: string, force = false) {
    return this.client.send<LotAdmin>('POST', `${this.basePath}/lots/${lotId}/close/`, {
      query: force ? { force: 'true' } : undefined,
    });
  }

  /** The external results DB — `?status=` is admin-only (the collector list
   * reads status only as a field). */
  records(query: AuctionRecordQuery = {}) {
    return this.list<AuctionRecord>('/records/', query as RequestOptions['query']);
  }
  record(id: string) {
    return this.retrieve<AuctionRecord>(`/records/${id}/`);
  }
  createRecord(body: Partial<AuctionRecord>) {
    return this.create<AuctionRecord>('/records/', body);
  }
  updateRecord(id: string, body: Partial<AuctionRecord>) {
    return this.client.send<AuctionRecord>('PATCH', `${this.basePath}/records/${id}/`, {
      body,
    });
  }
  deleteRecord(id: string) {
    return this.client.send<void>('DELETE', `${this.basePath}/records/${id}/`);
  }

  registrations(
    query: { auction?: string; status?: string; page?: number; per_page?: number } = {},
  ) {
    return this.list<BidderRegistrationAdmin>(
      '/registrations/',
      query as RequestOptions['query'],
    );
  }
  /** "Approve — the collector is told they are registered" (the old title);
   * assigns the auction's next sequential paddle number. */
  approveRegistration(id: string) {
    return this.create<BidderRegistrationAdmin>(`/registrations/${id}/approve/`);
  }
  rejectRegistration(id: string) {
    return this.create<BidderRegistrationAdmin>(`/registrations/${id}/reject/`);
  }
}

/** `/api/accounting/admin/` — the owner's books (backend Phase 11,
 * owner-only end to end): the four-ledger entry CRUD, the per-currency
 * summary, and — later steps — private deals, attachments, the Arian
 * review, the settlement. */
export class AccountingAdminService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/accounting/admin');
  }

  ledger(query: LedgerQuery = {}) {
    return this.list<LedgerEntryAdmin>('/ledger/', query as RequestOptions['query']);
  }
  createEntry(body: Record<string, unknown>) {
    return this.create<LedgerEntryAdmin>('/ledger/', body);
  }
  updateEntry(id: string, body: Record<string, unknown>) {
    return this.client.send<LedgerEntryAdmin>('PATCH', `${this.basePath}/ledger/${id}/`, {
      body,
    });
  }
  deleteEntry(id: string) {
    return this.client.send<void>('DELETE', `${this.basePath}/ledger/${id}/`);
  }
  deals(query: DealQuery = {}) {
    return this.list<PrivateDealAdmin>('/deals/', query as RequestOptions['query']);
  }
  deal(id: string) {
    return this.retrieve<PrivateDealAdmin>(`/deals/${id}/`);
  }
  createDeal(body: Record<string, unknown>) {
    return this.create<PrivateDealAdmin>('/deals/', body);
  }
  updateDeal(id: string, body: Record<string, unknown>) {
    return this.client.send<PrivateDealAdmin>('PATCH', `${this.basePath}/deals/${id}/`, {
      body,
    });
  }
  deleteDeal(id: string) {
    return this.client.send<void>('DELETE', `${this.basePath}/deals/${id}/`);
  }
  dealsSummary(query: DealQuery = {}) {
    return this.retrieve<DealsSummary>('/deals/summary/', query as RequestOptions['query']);
  }
  /** Slotted receipt/contract uploads — multipart; the slot vocabulary is
   * `accounting.deal_attachment_slot`. */
  uploadDealAttachment(dealId: string, file: File, slot?: string) {
    const form = new FormData();
    form.append('file', file);
    if (slot) form.append('slot', slot);
    return this.client.send<unknown>('POST', `${this.basePath}/deals/${dealId}/attachments/`, {
      body: form,
    });
  }
  deleteDealAttachment(dealId: string, attachmentId: string) {
    return this.client.send<void>(
      'DELETE',
      `${this.basePath}/deals/${dealId}/attachments/${attachmentId}/`,
    );
  }

  /** Per-currency income/expense/net/pending/salaries — currencies are never
   * summed together (the service's own rule). */
  ledgerSummary(book: string, month?: string) {
    return this.retrieve<LedgerSummary>('/ledger/summary/', {
      book,
      ...(month ? { month } : {}),
    } as RequestOptions['query']);
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

/** `/api/projects/admin/` — the Projects group (backend Phase 31,
 * `apps/projects`): projects CRUD + the stage machine + dashboard/reports
 * aggregates, per-project attachments, and the four reference tables the old
 * panel kept beside them (partner orgs, service catalogue, package templates,
 * checklist templates). Every write except attachments carries the optimistic
 * lock (`expected_version`); a stale one is a 409 → `ConflictError`. All of
 * it is `IsStandardAdminOrOwner` — no `proj*` tab was in the old panel's
 * `OWNER_ONLY` list (`darz-studio.html:11800`). */
export class ProjectsAdminService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/projects/admin');
  }

  // --- projects ------------------------------------------------------------
  projects(query: ProjectQuery = {}) {
    return this.list<ProjectAdmin>('/projects/', query as RequestOptions['query']);
  }
  project(id: string) {
    return this.retrieve<ProjectAdmin>(`/projects/${id}/`);
  }
  createProject(body: ProjectCreateInput) {
    return this.create<ProjectAdmin>('/projects/', body);
  }
  updateProject(id: string, body: ProjectPatch) {
    return this.client.send<ProjectAdmin>('PATCH', `${this.basePath}/projects/${id}/`, {
      body,
    });
  }
  deleteProject(id: string) {
    return this.remove(`/projects/${id}/`);
  }
  /** The old board's `kmove` / rail click: moving a project also re-derives
   * its status label server-side (`Project.STAGE_STATUS_MAP`). */
  setStage(id: string, stage: ProjectStage, expectedVersion: number) {
    return this.create<ProjectAdmin>(`/projects/${id}/stage/`, {
      stage,
      expected_version: expectedVersion,
    });
  }
  dashboard() {
    return this.retrieve<ProjectDashboard>('/projects/dashboard/');
  }
  reports() {
    return this.retrieve<{ deliverables: ProjectReportRow[] }>('/projects/reports/');
  }

  // --- attachments (private S3, `projects/<id>/…`) ---------------------------
  attachments(projectId: string, query: PageQuery = {}) {
    return this.list<ProjectAttachmentAdmin>(
      `/projects/${projectId}/attachments/`,
      query as RequestOptions['query'],
    );
  }
  uploadAttachment(projectId: string, file: File, label = '') {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('label', label);
    return this.create<ProjectAttachmentAdmin>(`/projects/${projectId}/attachments/`, form);
  }
  deleteAttachment(projectId: string, attachmentId: string) {
    return this.remove(`/projects/${projectId}/attachments/${attachmentId}/`);
  }

  // --- partner orgs ----------------------------------------------------------
  partners(query: PartnerOrgQuery = {}) {
    return this.list<PartnerOrgAdmin>('/partners/', query as RequestOptions['query']);
  }
  partner(id: string) {
    return this.retrieve<PartnerOrgAdmin>(`/partners/${id}/`);
  }
  createPartner(body: PartnerOrgInput) {
    return this.create<PartnerOrgAdmin>('/partners/', body);
  }
  updatePartner(id: string, body: PartnerOrgPatch) {
    return this.client.send<PartnerOrgAdmin>('PATCH', `${this.basePath}/partners/${id}/`, {
      body,
    });
  }
  deletePartner(id: string) {
    return this.remove(`/partners/${id}/`);
  }

  // --- service catalogue (the rate card, D21) --------------------------------
  services(query: ServiceCatalogQuery = {}) {
    return this.list<ServiceCatalogItemAdmin>(
      '/service-catalog/',
      query as RequestOptions['query'],
    );
  }
  service(id: string) {
    return this.retrieve<ServiceCatalogItemAdmin>(`/service-catalog/${id}/`);
  }
  createService(body: ServiceCatalogItemInput) {
    return this.create<ServiceCatalogItemAdmin>('/service-catalog/', body);
  }
  updateService(id: string, body: ServiceCatalogItemPatch) {
    return this.client.send<ServiceCatalogItemAdmin>(
      'PATCH',
      `${this.basePath}/service-catalog/${id}/`,
      { body },
    );
  }
  deleteService(id: string) {
    return this.remove(`/service-catalog/${id}/`);
  }

  // --- package templates -----------------------------------------------------
  packages(query: PageQuery = {}) {
    return this.list<PackageTemplateAdmin>('/packages/', query as RequestOptions['query']);
  }
  packageTemplate(id: string) {
    return this.retrieve<PackageTemplateAdmin>(`/packages/${id}/`);
  }
  createPackage(body: PackageTemplateInput) {
    return this.create<PackageTemplateAdmin>('/packages/', body);
  }
  updatePackage(id: string, body: PackageTemplatePatch) {
    return this.client.send<PackageTemplateAdmin>(
      'PATCH',
      `${this.basePath}/packages/${id}/`,
      {
        body,
      },
    );
  }
  deletePackage(id: string) {
    return this.remove(`/packages/${id}/`);
  }

  // --- checklist templates ---------------------------------------------------
  checklists(query: PageQuery = {}) {
    return this.list<ChecklistTemplateAdmin>('/checklists/', query as RequestOptions['query']);
  }
  checklist(id: string) {
    return this.retrieve<ChecklistTemplateAdmin>(`/checklists/${id}/`);
  }
  createChecklist(body: ChecklistTemplateInput) {
    return this.create<ChecklistTemplateAdmin>('/checklists/', body);
  }
  updateChecklist(id: string, body: ChecklistTemplatePatch) {
    return this.client.send<ChecklistTemplateAdmin>(
      'PATCH',
      `${this.basePath}/checklists/${id}/`,
      { body },
    );
  }
  deleteChecklist(id: string) {
    return this.remove(`/checklists/${id}/`);
  }
}

/**
 * `/api/gallery/portal/{token}/…` — the NO-LOGIN partner portal (Phase 14).
 *
 * Not a `ResourceService`: those ride the authenticated `ApiClient`, and this
 * surface must not (see `PortalClient`). Credentials are per-call — the token
 * names the link, the PIN proves it (`PortalAuthService.resolve` gates every
 * request, reads included): `?pin=` on GET, a `pin` field inside JSON bodies,
 * a `pin` part on multipart (`views.py::_portal_pin`).
 */
export class GalleryPortalService {
  private readonly client: PortalClient;

  constructor(client: PortalClient) {
    this.client = client;
  }

  private base(token: string) {
    return `/gallery/portal/${encodeURIComponent(token)}`;
  }

  /** The one big read — link + assigned works (+funnel) + pricelists + messages. */
  state(token: string, pin: string) {
    return this.client.send<PortalState>('GET', `${this.base(token)}/`, { query: { pin } });
  }

  /** One update into the pending-review queue. Payload keys the admin's
   * approval auto-applies: `availability_status` (kind `availability`),
   * `price_amount`/`currency`/`price_type` (kind `price`), and
   * `_CORRECTION_FIELDS` (kind `correction`) — everything else is a record
   * for the reviewer (`GalleryUpdateService.approve`). */
  submitUpdate(token: string, pin: string, body: PortalUpdateSubmit) {
    return this.client.send<PortalUpdateRow>('POST', `${this.base(token)}/updates/`, {
      body: { pin, ...body },
    });
  }

  /** Multipart — a real file lands in the private documents bucket. */
  uploadPricelist(token: string, pin: string, file: File, title: string, notes = '') {
    const form = new FormData();
    form.append('pin', pin);
    form.append('file', file);
    if (title) form.append('title', title);
    if (notes) form.append('notes', notes);
    return this.client.send<PortalPricelist>('POST', `${this.base(token)}/pricelists/`, {
      body: form,
    });
  }

  sendMessage(token: string, pin: string, body: string) {
    return this.client.send<PortalMessage>('POST', `${this.base(token)}/messages/`, {
      body: { pin, body },
    });
  }

  /** The Exhibition Services menu (`gallery.exhibition_service` seeded list,
   * admin-overridable per event). */
  exhibitionCatalogue(token: string, pin: string) {
    return this.client.send<{ services: PortalCatalogueEntry[] }>(
      'GET',
      `${this.base(token)}/exhibitions/catalogue/`,
      { query: { pin } },
    );
  }

  exhibitions(token: string, pin: string) {
    return this.client.send<{ exhibitions: PortalExhibition[] }>(
      'GET',
      `${this.base(token)}/exhibitions/`,
      { query: { pin } },
    );
  }

  createExhibition(token: string, pin: string, body: PortalExhibitionInput) {
    return this.client.send<PortalExhibition>('POST', `${this.base(token)}/exhibitions/`, {
      body: { pin, ...body },
    });
  }

  updateExhibition(token: string, pin: string, id: string, body: PortalExhibitionInput) {
    return this.client.send<PortalExhibition>(
      'PATCH',
      `${this.base(token)}/exhibitions/${id}/`,
      {
        body: { pin, ...body },
      },
    );
  }

  /** Send the show to Darz with the ticked service keys — request_status
   * flips to `requested`; after that the portal can no longer edit it
   * (`ExhibitionEventService._guard_portal_editable`). */
  submitExhibition(token: string, pin: string, id: string, serviceKeys: string[]) {
    return this.client.send<PortalExhibition>(
      'POST',
      `${this.base(token)}/exhibitions/${id}/submit/`,
      { body: { pin, service_keys: serviceKeys } },
    );
  }

  /** Accept a proposal / sign an invoice — name-only (the old canvas pad does
   * not port: the backend takes `signer_name`, G-PORT-7). */
  signExhibitionDocument(
    token: string,
    pin: string,
    eventId: string,
    documentId: string,
    signerName: string,
  ) {
    return this.client.send<DocumentAdmin>(
      'POST',
      `${this.base(token)}/exhibitions/${eventId}/documents/${documentId}/sign/`,
      { body: { pin, signer_name: signerName } },
    );
  }
}
