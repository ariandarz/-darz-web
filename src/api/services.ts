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
  ArtworkSelection,
  Auction,
  AuctionNotification,
  AuctionCreateBody,
  AuctionPatch,
  AuctionQuery,
  AuctionRecord,
  AuctionRecordQuery,
  BidderRegistration,
  BidHistoryItem,
  CatalogueQuery,
  CollectorActivity,
  CollectorDocument,
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
  CollectorDeskSummary,
  CollectorAdminQuery,
  CollectorSelection,
  CollectorLoginEvent,
  CollectorRequestQuery,
  MembershipCodeAdmin,
  MeUpdate,
  MyMembership,
  PublicDocument,
  TeamUserAdmin,
  DashboardSummary,
  CreatedRequest,
  Lot,
  Paginated,
  PublishedRecommendation,
  CollectorQuestionnaire,
  QuestionnaireAnswer,
  RequestDetailInput,
  RequestKind,
  RequestMessage,
  MessageAttachments,
  DocumentActivity,
  RequestMessageQuery,
  SavedArtwork,
  SavedArtworkQuery,
  ArtworkAdmin,
  ArtworkAdminQuery,
  ArtworkImageAdmin,
  ArtistAdmin,
  ArtistAdminQuery,
  SaleAdmin,
  SaleDeskSummary,
  SaleNote,
  SaleCreateInput,
  SalePatch,
  SaleQuery,
  DocumentAdmin,
  DocumentQuery,
  DocumentVersionAdmin,
  GalleryLinkAdmin,
  GalleryPricelistAdmin,
  GalleryLinkArtwork,
  GalleryUpdateAdmin,
  BidderRegistrationAdmin,
  LotAdmin,
  LotPatch,
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
  PortalPricelistBuild,
  PortalUpdate,
  GalleryPricelistCap,
  GalleryPricelistStatus,
  ExhibitionCatalogItem,
  ExhibitionCatalogInput,
  ExhibitionCatalogPatch,
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
  LedgerAttachment,
  DealAttachment,
  ArianReviewWrite,
  SettlementWorksheet,
  SettlementWorksheetVersion,
  AuditLogEntry,
  AuditLogQuery,
  ArtworkFacets,
  ArtworkSelectionGrant,
} from './types';
import type { PortalClient } from './PortalClient';

/** The wire body of a thread reply. `artwork_refs` always goes (the
 * serializer's own default is `[]`, and the thread has always sent it);
 * `document_refs` only when a document is attached, so a plain reply's body
 * is exactly what it was before D19. Exported for the payload test. */
export function messagePayload(
  body: string,
  attach: MessageAttachments = {},
): { body: string; artwork_refs: string[]; document_refs?: string[] } {
  const out: { body: string; artwork_refs: string[]; document_refs?: string[] } = {
    body,
    artwork_refs: attach.artworkRefs ?? [],
  };
  const docs = (attach.documentRefs ?? []).filter(Boolean);
  if (docs.length) out.document_refs = [...new Set(docs)];
  return out;
}

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
    return this.list<ArtworkSelection>(
      '/artworks/selections/',
      query as RequestOptions['query'],
    );
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
  /** One of the collector's own requests (`GET /api/crm/requests/{id}/`,
   * G-P5-3) — what a cold deep link to a thread reads, instead of the list. */
  request(id: string) {
    return this.retrieve<CollectorRequest>(`/requests/${id}/`);
  }
  /** File a request. `client_req_id` is the idempotency key the backend
   * dedupes on per collector: the same key answers 200 with the row it
   * already holds instead of creating a second one (`replayed: true`). */
  async createRequest(body: {
    kind: RequestKind;
    artwork?: string | null;
    detail?: RequestDetailInput;
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
  /** Admin: reply on a request's thread. `documentRefs` (D19) attaches
   * documents by id — the backend SHARES each with the thread's collector
   * (the G-DOC-1 path, collector-visible kinds only, else a 400) and answers
   * the message with the enriched `document_refs: [{id, kind, title}]`. The
   * key is only sent when something is attached. */
  adminPostMessage(requestId: string, body: string, attach: MessageAttachments = {}) {
    return this.create<RequestMessage>(
      `/admin/requests/${requestId}/messages/`,
      messagePayload(body, attach),
    );
  }
  /** Admin: archive (default) or restore one thread message (G-CHAT-2). An
   * admin-desk-only hide — the collector's thread never changes. */
  adminArchiveMessage(messageId: string, archived = true) {
    return this.create<RequestMessage>(`/admin/messages/${messageId}/archive/`, { archived });
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

/** `/api/recommendations/` — the admin-curated "Selected for you" batches.
 *
 * **Wholly unbound (TD-6).** Both methods, not a stray one: this is a whole
 * collector surface with no screen yet, and it is NOT the curated set the
 * catalogue's "Curated for You" chip shows — that one is
 * `/catalog/artworks/selections/` (backend Phase 24). Which of the two the old
 * app's "Selected for you" really was is an open question, so nothing here is
 * deleted on the assumption that it is redundant. */
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

  /** The collector's own questionnaire. Always 200 on the current backend:
   * `answered: false` (empty answers, null `submitted_at`) until they have sent
   * one (G-P25-1) — read it through `isQuestionnaireAnswered`, never the status.
   * An older backend answered that case with a 404; callers still treat any
   * rejection as "not filled in yet" (see `QuestionnaireController.load`). */
  questionnaire() {
    return this.retrieve<CollectorQuestionnaire>('/questionnaire/');
  }
  /** Full-replace: a resubmission overwrites the prior answers, and the server
   * rebuilds the collector's preference rows from them. */
  submitQuestionnaire(answers: QuestionnaireAnswer[]) {
    return this.create<CollectorQuestionnaire>('/questionnaire/', { answers });
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
  /** The Collectors desk strip (G-COL-1) — whole-roster counts. */
  collectorsSummary() {
    return this.retrieve<CollectorDeskSummary>('/collectors/summary/');
  }
  collector(id: string) {
    return this.retrieve<CollectorAdmin>(`/collectors/${id}/`);
  }
  createCollector(body: Partial<CollectorAdmin>) {
    return this.create<CollectorAdmin>('/collectors/', body);
  }
  /** PATCH with the row's own `version` — a stale one 409s (Phase 7 rule). */
  /** **`expected_version`, not `version`** — the optimistic-lock field on
   * `PatchedCollectorUpdate`. This took `version` until 2026-09-22, which the
   * server does not read: the lock was silently OFF and two admins editing the
   * same collector overwrote each other with no 409 and no warning. Same bug
   * was in `updateTeamUser` and `updateMembershipCode`; the catalog and sales
   * services always had it right. */
  updateCollector(id: string, body: Partial<CollectorAdmin> & { expected_version: number }) {
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
  /** `expected_version` — see `updateCollector` for what taking `version`
   * here silently did until 2026-09-22. */
  updateMembershipCode(
    id: string,
    body: Partial<MembershipCodeAdmin> & { expected_version: number },
  ) {
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
  /** `expected_version` — see `updateCollector`. A silent overwrite matters
   * more here than anywhere: this endpoint sets a teammate's ROLE. */
  updateTeamUser(id: string, body: Partial<TeamUserAdmin> & { expected_version: number }) {
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

  /** The Year and Source dropdown vocabularies for the Database desk. Takes
   * the SAME query as `artworks()` so the options narrow with the filters —
   * pass the live query, not an empty object, or the dropdowns will offer
   * values that return nothing. */
  artworkFacets(query: ArtworkAdminQuery = {}) {
    return this.retrieve<ArtworkFacets>('/artworks/facets/', query as RequestOptions['query']);
  }

  /** Who may see this curated work — a plain array, not paginated.
   *
   * A grant is per `(artwork, collector)` and MORE THAN ONE selection can want
   * the same pair, so a collector listed here is not necessarily reachable
   * from any one selection, and removing them from a selection does not
   * necessarily revoke the grant. `ClubPage` says so on screen; this service
   * just reports what the server holds. */
  selectionGrants(artworkId: string) {
    return this.retrieve<ArtworkSelectionGrant[]>(`/artworks/${artworkId}/selection-grants/`);
  }
  grantSelection(artworkId: string, collector: string, note = '') {
    return this.create<ArtworkSelectionGrant>(`/artworks/${artworkId}/selection-grants/`, {
      collector,
      note,
    });
  }
  revokeSelectionGrant(artworkId: string, grantId: string) {
    return this.client.send<void>(
      'DELETE',
      `${this.basePath}/artworks/${artworkId}/selection-grants/${grantId}/`,
    );
  }

  /** The admin artists roster — server `search` and `ordering` and a
   * list-only `works_count` per row (G-CAT-3). */
  artists(query: ArtistAdminQuery = {}) {
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
  createSale(body: SaleCreateInput) {
    return this.create<SaleAdmin>('/sales/', body);
  }
  /** Draft-only (R7) — the service refuses once confirmed; the desk disables
   * the form first. */
  updateSale(id: string, body: SalePatch) {
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
  /** The header counts (G-SALE-1) — ledger-wide, no filter. */
  summary() {
    return this.retrieve<SaleDeskSummary>('/sales/summary/');
  }
  /** Set (a `YYYY-MM-DD` date) or clear (`null`) the follow-up (G-SALE-5).
   * The key is required, so a clear sends `null` explicitly. No lock, and it
   * works after confirm — operational, not a commercial term. */
  followUp(id: string, date: string | null) {
    return this.create<SaleAdmin>(`/sales/${id}/follow-up/`, { follow_up_at: date });
  }
  /** The deal's internal notes, paginated, newest first (G-SALE-5). */
  notes(id: string, query: { page?: number; per_page?: number } = {}) {
    return this.list<SaleNote>(`/sales/${id}/notes/`, query);
  }
  /** Append a note — there is no edit or delete (append-only). */
  addNote(id: string, body: string) {
    return this.create<SaleNote>(`/sales/${id}/notes/`, { body });
  }
  /** Soft delete — the backend keeps the row (`is_deleted`), audit-logged.
   * Bound because the old deal card has "Delete deal" (`darz-studio.html:12664`). */
  deleteSale(id: string) {
    return this.remove(`/sales/${id}/`);
  }
}

/** `GET /api/documents/` — the signed-in collector's own documents (G-DOC-1):
 * the invoices, certificates and provenance Darz has shared with them.
 * Collector-only, read-only, paginated, newest-shared first. Kept apart from
 * `DocumentsAdminService` on purpose — a different principal, a different
 * serializer (no `fields`, no lifecycle), and no write of any kind. */
export class DocumentsService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/documents');
  }

  mine(query: { page?: number; per_page?: number } = {}) {
    return this.list<CollectorDocument>('/', query);
  }
}

/** `GET /api/documents/public/{kind}/` — genuinely public content (the legal
 * briefs: `legal_terms` and its siblings), `AllowAny`. Only ever the latest
 * **confirmed, public-visibility** document of that kind; a kind with nothing
 * published answers 404, which callers treat as "use the fallback". */
export class PublicDocumentsService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/documents/public');
  }

  byKind(kind: string) {
    return this.retrieve<PublicDocument>(`/${encodeURIComponent(kind)}/`);
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
  /** The old panel's `dlDelDoc` (`:17913`). **Built 2026-09-22** (G-DEL-1
   * approved) on `DocumentDetailPage`, with that confirm verbatim — version
   * count and "A version a gallery already holds cannot be un-sent" included.
   * The desk keeps the old panel's OWNER-ONLY gate, which is stricter than
   * this endpoint's `IsStandardAdminOrOwner`: a UI gate over a permissive
   * endpoint, so enforcing it properly is still server-side work. */
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
  /** G-DOC-2 — the document's audit trail, newest first (C-15: flat actor). */
  activity(id: string, query: { page?: number; per_page?: number } = {}) {
    return this.list<DocumentActivity>(
      `/documents/${id}/activity/`,
      query as RequestOptions['query'],
    );
  }
  /** G-DOC-1 — issue the document to a collector (it appears in their
   * `GET /api/documents/`). Collector-visible kinds only; anything else is a
   * 400. Not owner-locked server-side (`share_with_collector` has no guard). */
  shareDocument(id: string, collector: string) {
    return this.create<DocumentAdmin>(`/documents/${id}/share/`, { collector });
  }
  /** Revoke the share: clears `shared_at`, keeps `collector` on record. */
  unshareDocument(id: string) {
    return this.client.send<DocumentAdmin>(
      'DELETE',
      `${this.basePath}/documents/${id}/share/`,
    );
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

  /** `search` is server-side (G-PORT-15): a case-insensitive substring over
   * name / contact_name / contact_email (`views.py::admin_link_list_create`). */
  links(
    query: { source_type?: string; search?: string; page?: number; per_page?: number } = {},
  ) {
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
  /** G-PORT-13 — a fresh token+PIN for the SAME link (works, shows and
   * thread stay); the old pair stops working. Shown once, like an issue.
   * Credentials only — the link's status is untouched, so a disabled or
   * expired link stays that way (`views.py::admin_link_reissue`). */
  reissueLink(id: string) {
    return this.create<{ link: GalleryLinkAdmin; token: string; pin: string }>(
      `/links/${id}/reissue/`,
    );
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

  /** The pricelists this partner sent through the portal — each with its
   * `status`, a presigned `file_url` for an upload (G-PORT-14) and the
   * structured `lines` of one built in-portal (P3b). */
  linkPricelists(linkId: string, query: { page?: number; per_page?: number } = {}) {
    return this.list<GalleryPricelistAdmin>(
      `/links/${linkId}/pricelists/`,
      query as RequestOptions['query'],
    );
  }

  /** P3a — accepting one SUPERSEDES the link's previously accepted list
   * server-side with no transition guard (C-21): re-read the link's
   * pricelists after every call rather than patching one row locally. */
  setPricelistStatus(id: string, status: GalleryPricelistStatus) {
    return this.create<GalleryPricelistAdmin>(`/pricelists/${id}/status/`, { status });
  }
  /** The advisory soft cap (never a block, `GalleryPricelistService.cap_status`). */
  pricelistCap(linkId: string) {
    return this.retrieve<GalleryPricelistCap>(`/links/${linkId}/pricelists/cap/`);
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

  // --- The editable Exhibition Services menu (G-PORT-12b) -----------------
  // The table the portal's `exhibitions/catalogue/` reads (active rows only)
  // and the desk composes from. `key` is fixed once created.

  exhibitionCatalogue(query: PageQuery = {}) {
    return this.list<ExhibitionCatalogItem>(
      '/exhibition-catalogue/',
      query as RequestOptions['query'],
    );
  }
  createExhibitionCatalogueItem(body: ExhibitionCatalogInput) {
    return this.create<ExhibitionCatalogItem>('/exhibition-catalogue/', body);
  }
  /** Locked — a stale `expected_version` is a 409 (`enforce_version`). */
  updateExhibitionCatalogueItem(id: string, body: ExhibitionCatalogPatch) {
    return this.client.send<ExhibitionCatalogItem>(
      'PATCH',
      `${this.basePath}/exhibition-catalogue/${id}/`,
      { body },
    );
  }
  deleteExhibitionCatalogueItem(id: string) {
    return this.remove(`/exhibition-catalogue/${id}/`);
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
  /** **Unbound, and deliberately so.** Unlike the three deletes above, the old
   * panel has no "delete exhibition" anywhere — adding the button would be
   * inventing a destructive action this app was never approved to have. The
   * binding is kept because the route is served and the service mirrors it
   * (TD-6). */
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

  /** The working list hides archived auctions unless `archived` is sent
   * (G-AUC-4); `archived: true` is the old desk's Archived view. */
  auctions(query: AuctionQuery = {}) {
    return this.list<Auction>('/auctions/', query as RequestOptions['query']);
  }
  auction(id: string) {
    return this.retrieve<Auction>(`/auctions/${id}/`);
  }
  /** `terms`/`terms_required` ride the create too (G-AUC-1). */
  createAuction(body: AuctionCreateBody) {
    return this.create<Auction>('/auctions/', body);
  }
  /** Edit title/description/currency/window/terms (G-AUC-1). Draft or
   * scheduled only — anything else is a 400 whose `code` is
   * `INTERNAL_ERROR` (C-11), so callers branch on the status, not the code.
   * `expected_version` is mandatory (C-6); a stale one is a 409. */
  updateAuction(id: string, body: AuctionPatch) {
    return this.client.send<Auction>('PATCH', `${this.basePath}/auctions/${id}/`, { body });
  }
  /** Archive (default) or restore (`restore: true` → `{archived:false}`) —
   * the old card's Archive / ↩ Restore (`darz-studio.html:31814`, `:31813`). */
  archiveAuction(id: string, restore = false) {
    return this.create<Auction>(`/auctions/${id}/archive/`, { archived: !restore });
  }
  /** The uploaded poster (old "↑ Upload poster", `:32064`) — multipart,
   * field `file`; replacing deletes the previous object server-side. */
  uploadCover(id: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    return this.client.send<Auction>('POST', `${this.basePath}/auctions/${id}/cover-image/`, {
      body: form,
    });
  }
  /** "Remove uploaded poster" (`:32065`). */
  removeCover(id: string) {
    return this.client.send<Auction>('DELETE', `${this.basePath}/auctions/${id}/cover-image/`);
  }
  /** The old panel's `×` on an auction card, titled "Delete auction
   * permanently" (`:31815`, confirm "Delete this auction?"). **Built
   * 2026-09-22** (G-DEL-1 approved) as the auctions desk's row action, with
   * that confirm verbatim and no role gate — the endpoint is
   * `IsStandardAdminOrOwner` and the old `×` has no role check either. */
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
  /** Edit a SCHEDULED lot (G-AUC-2) — the old modal's per-lot Est. low /
   * Est. high / Opening bid / Reserve row (`:32019-32024`). Locked (C-6); a
   * non-scheduled lot is a 400 (C-11). */
  updateLot(lotId: string, body: LotPatch) {
    return this.client.send<LotAdmin>('PATCH', `${this.basePath}/lots/${lotId}/`, { body });
  }
  /** scheduled → live; the artwork transitions to Reserved server-side. */
  /** One lot as the desk sees it — the admin tier, which carries the reserve
   * and the internal fields the collector `Lot` omits. The event page lists
   * lots already; this is for reading a single one back after an action. */
  lot(lotId: string) {
    return this.retrieve<LotAdmin>(`/lots/${lotId}/`);
  }

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
  /** `expected_version` is mandatory (G-LOCK-1): a stale one is a 409
   * `ConflictError`, and a PATCH without it fails server-side (today a 500 —
   * the view pops a key its partial serializer never required). */
  updateRecord(id: string, body: Partial<AuctionRecord> & { expected_version: number }) {
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
  /** The old ↺ Reset (`:31887`, G-AUC-3): a REJECTED registration goes back
   * to pending; any other status is a 400 (C-11). */
  resetRegistration(id: string) {
    return this.create<BidderRegistrationAdmin>(`/registrations/${id}/reset/`);
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
  /** `expected_version` is mandatory (G-LOCK-1): a stale one is a 409
   * `ConflictError`, and a PATCH without it fails server-side (today a 500 —
   * the view pops a key its partial serializer never required). */
  updateEntry(id: string, body: Record<string, unknown> & { expected_version: number }) {
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
  /** The old panel's "Delete deal" (`darz-studio.html:12664`). **Built
   * 2026-09-22** (G-DEL-1 approved) as the Private Deals row action, with its
   * confirm verbatim ("Delete this deal? The collector's request/activity is
   * not affected."). Owner-only in the desk because this endpoint is
   * `IsOwner` — the UI agreeing with the server, not gating it. */
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

  entry(id: string) {
    return this.retrieve<LedgerEntryAdmin>(`/ledger/${id}/`);
  }

  /** The payment-status setter, separate from the generic PATCH because the
   * server treats it as its own audited action. */
  setEntryStatus(id: string, status: string) {
    return this.create<LedgerEntryAdmin>(`/ledger/${id}/status/`, { status });
  }

  /** Receipts on one entry. Uploading the first one flips the entry's
   * read-only `has_receipt`, so a caller that shows that flag re-reads the
   * row (or the list) rather than guessing. */
  entryAttachments(id: string, query: { page?: number; per_page?: number } = {}) {
    return this.list<LedgerAttachment>(
      `/ledger/${id}/attachments/`,
      query as RequestOptions['query'],
    );
  }
  uploadEntryAttachment(id: string, file: File, kind?: string) {
    const form = new FormData();
    form.append('file', file);
    if (kind) form.append('kind', kind);
    return this.client.send<LedgerAttachment>(
      'POST',
      `${this.basePath}/ledger/${id}/attachments/`,
      { body: form },
    );
  }
  deleteEntryAttachment(entryId: string, attachmentId: string) {
    return this.client.send<void>(
      'DELETE',
      `${this.basePath}/ledger/${entryId}/attachments/${attachmentId}/`,
    );
  }

  /** The Expenses-Arian receipt review. Valid only for entries in the
   * `arian_expenses` book — the server 400s elsewhere. Saving re-runs the
   * duplicate scan and returns the whole entry back, `dup_status` included,
   * which is why this answers a `LedgerEntryAdmin` and not the review. */
  saveArianReview(id: string, body: ArianReviewWrite) {
    return this.create<LedgerEntryAdmin>(`/ledger/${id}/review/`, body);
  }
  /** Entries the scan flagged as possible or confirmed duplicates. */
  arianDuplicates(query: { page?: number; per_page?: number } = {}) {
    return this.list<LedgerEntryAdmin>(
      '/ledger/arian/duplicates/',
      query as RequestOptions['query'],
    );
  }

  /** The deal's files. Upload/delete are above; this is the read. */
  dealAttachments(dealId: string, query: { page?: number; per_page?: number } = {}) {
    return this.list<DealAttachment>(
      `/deals/${dealId}/attachments/`,
      query as RequestOptions['query'],
    );
  }

  /** The ownership-settlement worksheet — a singleton, created empty on first
   * read, so this never 404s. */
  settlement() {
    return this.retrieve<SettlementWorksheet>('/settlement/');
  }
  /** PUT, not PATCH: the server replaces `state` wholesale and snapshots the
   * prior state as a version on the way, so a caller edits a copy of `state`
   * and sends the whole thing back. */
  saveSettlement(state: Record<string, unknown>, title?: string) {
    return this.client.send<SettlementWorksheet>('PUT', `${this.basePath}/settlement/`, {
      body: { state, ...(title ? { title } : {}) },
    });
  }
  settlementVersions(query: { page?: number; per_page?: number } = {}) {
    return this.list<SettlementWorksheetVersion>(
      '/settlement/versions/',
      query as RequestOptions['query'],
    );
  }
}

/** `/api/admin/` — the handful of admin routes that belong to `apps.core`
 * rather than to a feature app. Today that is the audit log; App Design's
 * routes live on `ThemeService` because they are the write half of a public
 * read it already owns. */
export class CoreAdminService extends ResourceService {
  constructor(client: ApiClient) {
    super(client, '/admin');
  }

  /** `IsOwner`, read-only, newest first. `?action=` and `?entity_type=` are
   * exact matches (`AuditLogFilterSet`, `apps/core/views.py:26`) — there is no
   * search and no date range, so the desk offers exactly those two. */
  auditLog(query: AuditLogQuery = {}) {
    return this.list<AuditLogEntry>('/audit-log/', query as RequestOptions['query']);
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

/** Auth — delegates the token lifecycle to `AuthSession`, and adds the
 * collector's own authenticated account endpoints that aren't part of it:
 * the profile edit, the membership read and the redeem. */
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
  /**
   * The collector's own profile edit (`PATCH /auth/me/`, G-B1) — only
   * `full_name` · `phone` · `city` · `preferred_language` (`MeUpdate`). The
   * response is the whole updated `Me`, and it replaces the session's cached
   * one, so the header, Settings and Profile all read the edit at once.
   * A 400 is a `ValidationError` whose `fields` name the rejected field; a
   * team principal gets a 403.
   */
  async updateMe(body: MeUpdate): Promise<Me> {
    const me = await this.client.send<Me>('PATCH', '/auth/me/', { body });
    this.session.adoptMe(me);
    return me;
  }
  /** The collector's membership summary (G-MEMB-3/6/7) — what the Settings
   * row's pill and the sheet's "Active membership" block read. Collector-only
   * (a team token 403s). */
  myMembership() {
    return this.retrieve<MyMembership>('/my-membership/');
  }
  /** **Unbound — waiting on its screen, not dead.** Membership redeem is a
   * backend-ready collector item that v0.1 hid (`docs/TASKLIST.md`, "What
   * next" item 6); this is the binding it will use (TD-6). */
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
   * `client_req_id` dedupes (G-P34-1): a repeat of a key answers 200 with the
   * row already filed, a new one 201 — both resolve here. The endpoint is
   * rate-limited per IP (G-P34-2), so a burst ends in a 429 `HttpError`.
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
    // Django's BooleanField accepts `True`/`False` (and 1/0), not the
    // lowercase pair the endpoint documents — normalised here so no desk
    // has to know (G-PROJ-6).
    const { archived, ...rest } = query;
    const wire: Record<string, unknown> =
      archived === undefined ? rest : { ...rest, archived: archived ? 'True' : 'False' };
    return this.list<ProjectAdmin>('/projects/', wire as RequestOptions['query']);
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
  /** **Unbound.** The partners list carries every field the desk shows, so
   * nothing needs the single read; kept as the resource's own retrieve (TD-6). */
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

  /** The one big read — link + assigned works (+image, +funnel) + pricelists
   * + messages + the source's own updates + cover (C-8). Raw: the session
   * normalises the embedded arrays (`normalisePortalState`). */
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

  /** G-PORT-1 — a replacement image for an ASSIGNED work, multipart with the
   * PIN as a form part (C-9: the schema documents `?pin=` here, which 401s —
   * `_portal_pin` reads the body on every non-GET). Lands as a pending
   * `image` update; nothing touches the live work until Darz follows through. */
  replaceImage(token: string, pin: string, artworkId: string, file: File) {
    const form = new FormData();
    form.append('pin', pin);
    form.append('file', file);
    return this.client.send<PortalUpdate>(
      'POST',
      `${this.base(token)}/artworks/${encodeURIComponent(artworkId)}/image/`,
      { body: form },
    );
  }

  /** P3b — a structured pricelist built in-portal (≥1 line, each an artwork
   * or a title). JSON body with `pin` inside it (C-9), never `?pin=`. */
  buildPricelist(token: string, pin: string, body: PortalPricelistBuild) {
    return this.client.send<PortalPricelist>('POST', `${this.base(token)}/pricelists/build/`, {
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
