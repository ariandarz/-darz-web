# Darz API adoption matrix

Backend `darz-backend-api@development` (224 paths, 323 method+path operations) vs frontend `-darz-web@claude/darz-v1-api-integration-plan-gaiw9v` (= development).

Method: every FE binding parsed from `src/api/services.ts` (base path + relative path, HTTP verb from `list/retrieve/create/remove/client.send`) plus `AuthSession.ts`; every FE method matched a backend operation (no dangling bindings). UI callers: grep of `.method(` across `src/` (excl. `src/api`, tests), with receivers resolved to the right service where names collide (e.g. `artworks`, `lots`, `records`, `exhibitions`). Paths listed as feature-relative (`admin/X.tsx` = `src/features/admin/X.tsx`). No feature file calls the HTTP client directly. "Unsent params" = backend query params from `schema.json` (plus a few hand-parsed ones checked in the views) not present in the FE query type, so the FE cannot send them.

## accounts / auth

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| POST | /api/auth/access-requests/ | `AuthService.requestAccess` | `auth/LoginPage.tsx` | Integrated |  |
| GET | /api/auth/admin/access-keys/ | none | — | Not bound | Global access-key desk list (`collector, expiring_soon, search, status`) — no binding; FE only lists keys per collector. |
| GET | /api/auth/admin/access-keys/summary/ | none | — | Not bound | Access desk KPI summary — no binding. |
| POST | /api/auth/admin/access-keys/{id}/extend/ | `AdminAccountsService.extendAccessKey` | `admin/CollectorDetailPage.tsx` | Integrated |  |
| POST | /api/auth/admin/access-keys/{id}/revoke/ | `AdminAccountsService.revokeAccessKey` | `admin/CollectorDetailPage.tsx` | Integrated |  |
| GET | /api/auth/admin/access-requests/ | `AdminAccountsService.accessRequests` | `admin/AccessRequestsController.ts` | Integrated | FE also sends `?search` (supported by AccessRequestFilterSet though not in schema). |
| POST | /api/auth/admin/access-requests/{id}/approve/ | `AdminAccountsService.approveAccessRequest` | `admin/AccessRequestsPage.tsx` | Integrated |  |
| POST | /api/auth/admin/access-requests/{id}/decline/ | `AdminAccountsService.declineAccessRequest` | `admin/AccessRequestsPage.tsx` | Integrated |  |
| GET | /api/auth/admin/collectors/ | `AdminAccountsService.collectors` | `admin/ArtworkEditorPage.tsx`, `admin/AuctionAdminDetailPage.tsx`, `admin/ClubPage.tsx`, `admin/CollectorsController.ts`, `admin/CollectorsPage.tsx`, `admin/SalesPage.tsx` | Integrated | All schema filters in CollectorAdminQuery. |
| POST | /api/auth/admin/collectors/ | `AdminAccountsService.createCollector` | `admin/CollectorForm.tsx` | Integrated |  |
| GET | /api/auth/admin/collectors/summary/ | none | — | Not bound | Collectors KPI summary — no binding; CollectorsPage/ClubPage compute counts with repeated `per_page=1` list calls. |
| GET | /api/auth/admin/collectors/{collector_pk}/access-keys/ | `AdminAccountsService.accessKeys` | `admin/CollectorDetailPage.tsx` | Integrated |  |
| POST | /api/auth/admin/collectors/{collector_pk}/access-keys/ | `AdminAccountsService.issueAccessKey` | `admin/CollectorDetailPage.tsx` | Integrated |  |
| GET | /api/auth/admin/collectors/{collector_pk}/login-events/ | `AdminAccountsService.loginEvents` | `admin/CollectorDetailPage.tsx` | Integrated |  |
| GET | /api/auth/admin/collectors/{id}/ | `AdminAccountsService.collector` | `admin/AccessRequestsPage.tsx`, `admin/CollectorDetailPage.tsx`, `admin/RegistrationsPage.tsx`, `admin/useSaleRefs.ts` | Integrated |  |
| PATCH | /api/auth/admin/collectors/{id}/ | `AdminAccountsService.updateCollector` | `admin/AccessRequestsPage.tsx`, `admin/CollectorForm.tsx` | Integrated |  |
| DELETE | /api/auth/admin/collectors/{id}/ | `AdminAccountsService.deleteCollector` | `admin/CollectorDetailPage.tsx` | Integrated |  |
| GET | /api/auth/admin/membership-codes/ | `AdminAccountsService.membershipCodes` | `admin/MembershipsPage.tsx` | Integrated |  |
| POST | /api/auth/admin/membership-codes/ | `AdminAccountsService.createMembershipCode` | `admin/MembershipsPage.tsx` | Integrated |  |
| GET | /api/auth/admin/membership-codes/{id}/ | none | — | Not bound | Single read unbound; list rows suffice. |
| PATCH | /api/auth/admin/membership-codes/{id}/ | `AdminAccountsService.updateMembershipCode` | `admin/MembershipsPage.tsx` | Integrated |  |
| DELETE | /api/auth/admin/membership-codes/{id}/ | `AdminAccountsService.deleteMembershipCode` | `admin/MembershipsPage.tsx` | Integrated |  |
| POST | /api/auth/admin/membership-codes/{id}/renew/ | `AdminAccountsService.renewMembershipCode` | `admin/MembershipsPage.tsx` | Integrated |  |
| GET | /api/auth/admin/team-users/ | `AdminAccountsService.teamUsers` | `admin/SalesPage.tsx`, `admin/TeamPage.tsx`, `admin/useSaleRefs.ts` | Integrated |  |
| POST | /api/auth/admin/team-users/ | `AdminAccountsService.createTeamUser` | `admin/TeamPage.tsx` | Integrated |  |
| GET | /api/auth/admin/team-users/{id}/ | none | — | Not bound | Single read unbound; list rows suffice. |
| PATCH | /api/auth/admin/team-users/{id}/ | `AdminAccountsService.updateTeamUser` | `admin/TeamPage.tsx` | Integrated |  |
| DELETE | /api/auth/admin/team-users/{id}/ | `AdminAccountsService.deleteTeamUser` | `admin/TeamPage.tsx` | Integrated |  |
| POST | /api/auth/collector/login/ | `AuthService.loginCollector` | `App.tsx`, `auth/LoginPage.tsx` | Integrated |  |
| POST | /api/auth/logout/ | `AuthService.logout` | `App.tsx`, `admin/AdminShell.tsx`, `profile/ProfilePage.tsx`, `settings/SettingsPage.tsx`, `shell/AppShell.tsx` | Integrated |  |
| GET | /api/auth/me/ | `AuthService.me`, `AuthSession.loadMe` | `after login (AuthSession.completeLogin)`, `api/ApiProvider.tsx (resume)`, `membership/MembershipSheet.tsx` | Integrated | Via AuthSession.loadMe (resume + after login) and AuthService.me. |
| PATCH | /api/auth/me/ | `AuthService.updateMe` | `profile/AccountForm.tsx`, `questionnaire/QuestionnaireController.ts` | Integrated | Phase 1 (2026-09-25): Profile › Account edit + questionnaire contact write (G-Q-1); the response replaces the session's `me` (`AuthSession.adoptMe`). |
| POST | /api/auth/membership/redeem/ | `AuthService.redeemMembership` | `membership/MembershipSheet.tsx` | Integrated | MembershipSheet redeem flow. |
| GET | /api/auth/my-membership/ | `AuthService.myMembership` | `membership/useMyMembership.ts` (Settings row + `MembershipSheet`) | Integrated | Phase 1 (2026-09-25): row sub-line + ACTIVE/EXPIRED pill, the sheet's active/ended block; re-read after a redeem. |
| POST | /api/auth/team/login/ | `AuthService.loginTeam` | `auth/TeamLoginPage.tsx` | Integrated |  |
| POST | /api/auth/token/refresh/ | `AuthSession.refresh` | `api/ApiClient.ts (401 retry)`, `api/ApiProvider.tsx (resume)`, `auctions/LotSocket.ts` | Integrated | AuthSession.refresh — 401 retry in ApiClient, LotSocket reconnect, resume on boot. |

## catalog

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| GET | /api/catalog/admin/artists/ | `CatalogAdminService.artists` | `admin/ArtistsPage.tsx`, `admin/ArtworkEditorPage.tsx`, `admin/ArtworksPage.tsx`, `admin/RecordEditorPage.tsx` | Integrated | `?search`, `?ordering` unsent — desks fetch `per_page=500` and search client-side; service comment ("backend list takes NO filters, G-CAT-3") is stale. |
| POST | /api/catalog/admin/artists/ | `CatalogAdminService.createArtist` | `admin/ArtistsPage.tsx` | Integrated |  |
| GET | /api/catalog/admin/artists/{id}/ | none | — | Not bound | Single read unbound (PATCH/DELETE bound). |
| PATCH | /api/catalog/admin/artists/{id}/ | `CatalogAdminService.updateArtist` | `admin/ArtistsPage.tsx` | Integrated |  |
| DELETE | /api/catalog/admin/artists/{id}/ | `CatalogAdminService.deleteArtist` | `admin/ArtistsPage.tsx` | Integrated |  |
| GET | /api/catalog/admin/artworks/ | `CatalogAdminService.artworks` | `admin/ArtworksController.ts`, `admin/AuctionAdminDetailPage.tsx`, `admin/ClubPage.tsx`, `admin/DataHealthPage.tsx`, `admin/SalesPage.tsx`, `admin/SourceDetailPage.tsx` | Integrated | Unsent (not in ArtworkAdminQuery): `complete, created_after, duplicate_images, gallery_portal, price_min, price_max, size, source_type, tag, refine_*`. |
| POST | /api/catalog/admin/artworks/ | `CatalogAdminService.createArtwork` | `admin/ArtworkEditorPage.tsx` | Integrated |  |
| GET | /api/catalog/admin/artworks/facets/ | `CatalogAdminService.artworkFacets` | `admin/ArtworksPage.tsx` | Integrated | Same unsent set as the artworks list. |
| GET | /api/catalog/admin/artworks/{artwork_pk}/images/ | `CatalogAdminService.artworkImages` | `admin/ArtworkEditorPage.tsx` | Integrated |  |
| POST | /api/catalog/admin/artworks/{artwork_pk}/images/ | `CatalogAdminService.uploadArtworkImage` | `admin/ArtworkEditorPage.tsx` | Integrated |  |
| DELETE | /api/catalog/admin/artworks/{artwork_pk}/images/{image_pk}/ | `CatalogAdminService.deleteArtworkImage` | `admin/ArtworkEditorPage.tsx` | Integrated |  |
| GET | /api/catalog/admin/artworks/{artwork_pk}/selection-grants/ | `CatalogAdminService.selectionGrants` | `admin/ArtworkEditorPage.tsx` | Integrated |  |
| POST | /api/catalog/admin/artworks/{artwork_pk}/selection-grants/ | `CatalogAdminService.grantSelection` | `admin/ArtworkEditorPage.tsx` | Integrated |  |
| DELETE | /api/catalog/admin/artworks/{artwork_pk}/selection-grants/{grant_pk}/ | `CatalogAdminService.revokeSelectionGrant` | `admin/ArtworkEditorPage.tsx` | Integrated |  |
| GET | /api/catalog/admin/artworks/{id}/ | `CatalogAdminService.artwork` | `admin/ArtworkEditorPage.tsx`, `admin/AuctionAdminDetailPage.tsx`, `admin/useSaleRefs.ts (SalesPage, SaleDetailPage)` | Integrated |  |
| PATCH | /api/catalog/admin/artworks/{id}/ | `CatalogAdminService.updateArtwork` | `admin/ArtworkEditorPage.tsx` | Integrated |  |
| DELETE | /api/catalog/admin/artworks/{id}/ | `CatalogAdminService.deleteArtwork` | `admin/ArtworksPage.tsx` | Integrated |  |
| POST | /api/catalog/admin/artworks/{id}/publish/ | `CatalogAdminService.publishArtwork` | `admin/ArtworkEditorPage.tsx`, `admin/ArtworksPage.tsx` | Integrated |  |
| POST | /api/catalog/admin/artworks/{id}/transition/ | `CatalogAdminService.transitionArtwork` | `admin/ArtworkEditorPage.tsx` | Integrated |  |
| POST | /api/catalog/admin/artworks/{id}/unpublish/ | `CatalogAdminService.unpublishArtwork` | `admin/ArtworkEditorPage.tsx`, `admin/ArtworksPage.tsx`, `admin/PublishedPage.tsx` | Integrated |  |
| GET | /api/catalog/admin/data-health/ | `CatalogAdminService.dataHealth` | `admin/DataHealthPage.tsx`, `admin/PublishedPage.tsx` | Integrated |  |
| GET | /api/catalog/admin/import/batches/ | `CatalogAdminService.importBatches` | `admin/ImportPage.tsx` | Integrated |  |
| POST | /api/catalog/admin/import/batches/ | `CatalogAdminService.stageImportBatch` | `admin/ImportPage.tsx` | Integrated |  |
| PATCH | /api/catalog/admin/import/batches/{batch_pk}/rows/{id}/ | `CatalogAdminService.updateImportRow` | `admin/ImportBatchPage.tsx` | Integrated |  |
| POST | /api/catalog/admin/import/batches/{batch_pk}/rows/{id}/reject/ | `CatalogAdminService.rejectImportRow` | `admin/ImportBatchPage.tsx` | Integrated |  |
| GET | /api/catalog/admin/import/batches/{id}/ | `CatalogAdminService.importBatch` | `admin/ImportBatchPage.tsx` | Integrated |  |
| POST | /api/catalog/admin/import/batches/{id}/confirm/ | `CatalogAdminService.confirmImportBatch` | `admin/ImportBatchPage.tsx` | Integrated |  |
| POST | /api/catalog/admin/import/batches/{id}/discard/ | `CatalogAdminService.discardImportBatch` | `admin/ImportBatchPage.tsx` | Integrated |  |
| GET | /api/catalog/artists/ | `CatalogService.artists` | `catalogue/ArtistListController.ts` | Integrated |  |
| GET | /api/catalog/artists/{id}/ | `CatalogService.artist` | `catalogue/ArtistDetailPage.tsx` | Integrated |  |
| GET | /api/catalog/artworks/ | `CatalogService.artworks` | `admin/PublishedPage.tsx`, `catalogue/CatalogueController.ts` | Integrated | All schema filters present in CatalogueQuery. |
| GET | /api/catalog/artworks/change-stamp/ | none | — | Not bound | Catalogue change-stamp (Phase 19) — no binding. |
| GET | /api/catalog/artworks/selections/ | `CatalogService.artworkSelections` | `catalogue/CatalogueController.ts`, `catalogue/useCuratedCount.ts` | Integrated | Phase 1: `selection_name` read for the chip label (G-P24-1). |
| GET | /api/catalog/artworks/{id}/ | `CatalogService.artwork` | `catalogue/ArtworkCache.ts`, `catalogue/ArtworkDetailPage.tsx` | Integrated |  |
| GET | /api/catalog/legacy-lookup/ | none | — | Not bound | Legacy id → UUID (`?legacy_id`) — no binding. |
| GET | /api/catalog/selections/ | none | — | Not bound | Collector's named curated selections + change signal — no binding (FE uses `/catalog/artworks/selections/`). |
| POST | /api/catalog/selections/{id}/seen/ | none | — | Not bound | Mark selection seen — no binding. |

## crm

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| GET | /api/crm/activity/ | none | — | Not bound | Collector's own activity list — no binding (POST is bound). |
| POST | /api/crm/activity/ | `CrmService.logActivity` | `activity/ActivityLogger.ts` | Integrated |  |
| GET | /api/crm/admin/activity/ | `CrmService.adminActivity` | `admin/ActivityFeedController.ts` | Integrated | All schema filters sent-capable. |
| POST | /api/crm/admin/messages/{id}/archive/ | none | — | Not bound | Archive a thread message — no binding. |
| GET | /api/crm/admin/requests/ | `CrmService.adminRequests` | `admin/AdminRequestsController.ts` | Integrated | All schema filters in AdminRequestQuery. |
| GET | /api/crm/admin/requests/{id}/messages/ | `CrmService.adminMessages` | `admin/AdminThreadController.ts` | Integrated | `?include_archived` unsent. |
| POST | /api/crm/admin/requests/{id}/messages/ | `CrmService.adminPostMessage` | `admin/AdminThreadController.ts` | Partial | FE sends `body` + `artwork_refs` only; `document_refs` never sent. |
| POST | /api/crm/admin/requests/{id}/messages/mark-seen/ | `CrmService.adminMarkSeen` | `admin/AdminThreadController.ts` | Integrated |  |
| POST | /api/crm/admin/requests/{id}/transition/ | `CrmService.transitionRequest` | `admin/AdminRequestsController.ts`, `admin/AdminRequestsPage.tsx` | Integrated |  |
| GET | /api/crm/admin/selections/ | `CrmService.adminSelections` | `admin/ClubPage.tsx` | Integrated |  |
| POST | /api/crm/admin/selections/ | `CrmService.createSelection` | `admin/ClubPage.tsx` | Integrated |  |
| GET | /api/crm/admin/selections/{id}/ | none | — | Not bound | Single read unbound; list rows suffice. |
| PATCH | /api/crm/admin/selections/{id}/ | `CrmService.updateSelection` | `admin/ClubPage.tsx` | Integrated |  |
| DELETE | /api/crm/admin/selections/{id}/ | `CrmService.deleteSelection` | `admin/ClubPage.tsx` | Integrated |  |
| GET | /api/crm/requests/ | `CrmService.requests` | `conversations/ConversationsController.ts` | Integrated | `?archived` unsent (CollectorRequestQuery lacks it). |
| POST | /api/crm/requests/ | `CrmService.createRequest` | `conversations/ConversationsController.ts`, `requests/RequestController.ts` | Integrated |  |
| GET | /api/crm/requests/{id}/ | `CrmService.request` | `conversations/ConversationsController.ts` | Integrated |  |
| POST | /api/crm/requests/{id}/archive/ | none | — | Not bound | Collector archive request — no binding. |
| GET | /api/crm/requests/{id}/messages/ | `CrmService.messages` | `conversations/ThreadController.ts` | Integrated |  |
| POST | /api/crm/requests/{id}/messages/ | `CrmService.postMessage` | `conversations/ThreadController.ts` | Partial | FE sends `body` + `artwork_refs` only; `document_refs` (supported) never sent. |
| POST | /api/crm/requests/{id}/messages/mark-seen/ | `CrmService.markSeen` | `conversations/ThreadController.ts` | Integrated |  |
| POST | /api/crm/requests/{id}/transition/ | none | — | Not bound | Collector-side transition — no binding. |
| GET | /api/crm/saved/ | `CrmService.saved` | `saved/SavedListController.ts` | Integrated | All schema filters in SavedArtworkQuery. |
| POST | /api/crm/saved/ | `CrmService.save` | `saved/SavedController.ts` | Integrated |  |
| DELETE | /api/crm/saved/{artwork_id}/ | `CrmService.unsave` | `saved/SavedController.ts` | Integrated |  |

## auctions

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| GET | /api/auctions/ | `AuctionService.auctions` | `auctions/AuctionListController.ts` | Integrated |  |
| GET | /api/auctions/admin/auctions/ | `AuctionsAdminService.auctions` | `admin/AuctionsAdminPage.tsx`, `admin/RegistrationsPage.tsx` | Integrated | Phase 3 (2026-09-25): `?archived=true` is the "Show archived" view; both desks walk every page. |
| POST | /api/auctions/admin/auctions/ | `AuctionsAdminService.createAuction` | `admin/AuctionsAdminPage.tsx` | Integrated | Phase 3 (2026-09-25): `terms` / `terms_required` sent (old terms block, blank = the Darz default). |
| GET | /api/auctions/admin/auctions/{auction_pk}/lots/ | `AuctionsAdminService.lots` | `admin/AuctionAdminDetailPage.tsx` | Integrated |  |
| POST | /api/auctions/admin/auctions/{auction_pk}/lots/ | `AuctionsAdminService.createLot` | `admin/AuctionAdminDetailPage.tsx` | Integrated |  |
| GET | /api/auctions/admin/auctions/{id}/ | `AuctionsAdminService.auction` | `admin/AuctionAdminDetailPage.tsx` | Integrated |  |
| PATCH | /api/auctions/admin/auctions/{id}/ | `AuctionsAdminService.updateAuction` | `admin/AuctionAdminDetailPage.tsx` | Integrated | Phase 3 (2026-09-25): `Locked<>` body, changed fields only; 409 → ConflictBanner; read-only past scheduled. |
| DELETE | /api/auctions/admin/auctions/{id}/ | `AuctionsAdminService.deleteAuction` | `admin/AuctionsAdminPage.tsx` | Integrated |  |
| POST | /api/auctions/admin/auctions/{id}/archive/ | `AuctionsAdminService.archiveAuction` | `admin/AuctionsAdminPage.tsx`, `admin/AuctionAdminDetailPage.tsx` | Integrated | Phase 3 (2026-09-25): Archive / ↩ Restore (`{archived:false}`). |
| POST | /api/auctions/admin/auctions/{id}/cover-image/ | `AuctionsAdminService.uploadCover` | `admin/AuctionAdminDetailPage.tsx` | Integrated | Phase 3 (2026-09-25): "↑ Upload poster" (multipart `file`). |
| DELETE | /api/auctions/admin/auctions/{id}/cover-image/ | `AuctionsAdminService.removeCover` | `admin/AuctionAdminDetailPage.tsx` | Integrated | Phase 3 (2026-09-25): "Remove uploaded poster". |
| GET | /api/auctions/admin/auctions/{id}/invite-only/ | `AuctionsAdminService.inviteList` | `admin/AuctionAdminDetailPage.tsx` | Integrated |  |
| POST | /api/auctions/admin/auctions/{id}/invite-only/ | `AuctionsAdminService.setInviteOnly` | `admin/AuctionAdminDetailPage.tsx` | Integrated |  |
| GET | /api/auctions/admin/lots/{id}/ | `AuctionsAdminService.lot` | `admin/AuctionAdminDetailPage.tsx`, `admin/useSaleRefs.ts` | Integrated | Phase 2: also resolves an auction sale's `lot` to its auction + number (the Lot link). |
| PATCH | /api/auctions/admin/lots/{id}/ | `AuctionsAdminService.updateLot` | `admin/AuctionAdminDetailPage.tsx` | Integrated | Phase 3 (2026-09-25): Edit on scheduled lots, `Locked<>` body, 409 → ConflictBanner. |
| POST | /api/auctions/admin/lots/{id}/close/ | `AuctionsAdminService.closeLot` | `admin/AuctionAdminDetailPage.tsx` | Integrated | `?force` sent when closing early. |
| POST | /api/auctions/admin/lots/{id}/go-live/ | `AuctionsAdminService.goLive` | `admin/AuctionAdminDetailPage.tsx` | Integrated |  |
| GET | /api/auctions/admin/records/ | `AuctionsAdminService.records` | `admin/RecordsAdminPage.tsx` | Integrated | Phase 3 (2026-09-25): `?house=` from the "All auction houses" select (options from a walk). |
| POST | /api/auctions/admin/records/ | `AuctionsAdminService.createRecord` | `admin/RecordEditorPage.tsx` | Integrated |  |
| GET | /api/auctions/admin/records/{id}/ | `AuctionsAdminService.record` | `admin/RecordEditorPage.tsx` | Integrated |  |
| PATCH | /api/auctions/admin/records/{id}/ | `AuctionsAdminService.updateRecord` | `admin/RecordEditorPage.tsx` | Integrated |  |
| DELETE | /api/auctions/admin/records/{id}/ | `AuctionsAdminService.deleteRecord` | `admin/RecordsAdminPage.tsx` | Integrated |  |
| GET | /api/auctions/admin/registrations/ | `AuctionsAdminService.registrations` | `admin/RegistrationsPage.tsx` | Integrated |  |
| POST | /api/auctions/admin/registrations/{id}/approve/ | `AuctionsAdminService.approveRegistration` | `admin/RegistrationsPage.tsx` | Integrated |  |
| POST | /api/auctions/admin/registrations/{id}/reject/ | `AuctionsAdminService.rejectRegistration` | `admin/RegistrationsPage.tsx` | Integrated |  |
| POST | /api/auctions/admin/registrations/{id}/reset/ | `AuctionsAdminService.resetRegistration` | `admin/RegistrationsPage.tsx` | Integrated | Phase 3 (2026-09-25): ↺ Reset on rejected rows. |
| GET | /api/auctions/lots/{id}/ | `AuctionService.lot` | `auctions/LotController.ts` | Integrated |  |
| GET | /api/auctions/lots/{id}/bids/ | `AuctionService.bidHistory` | `auctions/useAuctions.ts` | Integrated |  |
| POST | /api/auctions/lots/{id}/bids/ | `AuctionService.placeBid` | `auctions/LotController.ts` | Integrated |  |
| GET | /api/auctions/notifications/ | `AuctionService.notifications` | `auctions/AuctionNotificationsController.ts` | Integrated |  |
| POST | /api/auctions/notifications/{id}/read/ | `AuctionService.markRead` | `auctions/AuctionNotificationsController.ts` | Integrated |  |
| GET | /api/auctions/records/ | `AuctionService.records` | `auctions/RecordsController.ts`, `records/RecordsArchiveController.ts` | Integrated | `?house` now typed (Phase 3) but unsent by decision: the collector page is the Artist view, where the old app hid the house filter (`app.html:5082`). |
| GET | /api/auctions/records/highlights/ | none | — | Not bound | "Auction highlights" strip — no binding (only the admin Records desk uses `?is_highlight=True` on the list). |
| GET | /api/auctions/records/{id}/ | `AuctionService.record` | `auctions/useAuctions.ts` | Integrated |  |
| GET | /api/auctions/registrations/ | `AuctionService.registrations` | `auctions/RegistrationController.ts` | Integrated |  |
| POST | /api/auctions/registrations/ | `AuctionService.register` | `auctions/RegistrationController.ts` | Integrated |  |
| GET | /api/auctions/{auction_pk}/lots/ | `AuctionService.lots` | `auctions/useAuctions.ts` | Integrated |  |
| GET | /api/auctions/{id}/ | `AuctionService.auction` | `auctions/useAuctions.ts` | Integrated |  |

## accounting

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| GET | /api/accounting/admin/deals/ | `AccountingAdminService.deals` | `admin/AccountingDeals.tsx` | Integrated | Filters (status, pay_status, artist_label, buyer_name, seller_name, month) are hand-parsed in the view and absent from schema; DealQuery covers all. |
| POST | /api/accounting/admin/deals/ | `AccountingAdminService.createDeal` | `admin/DealEditorPage.tsx` | Integrated |  |
| GET | /api/accounting/admin/deals/summary/ | `AccountingAdminService.dealsSummary` | `admin/AccountingDeals.tsx` | Integrated |  |
| GET | /api/accounting/admin/deals/{id}/ | `AccountingAdminService.deal` | `admin/DealEditorPage.tsx` | Integrated |  |
| PATCH | /api/accounting/admin/deals/{id}/ | `AccountingAdminService.updateDeal` | `admin/DealEditorPage.tsx` | Integrated |  |
| DELETE | /api/accounting/admin/deals/{id}/ | `AccountingAdminService.deleteDeal` | `admin/AccountingDeals.tsx` | Integrated |  |
| GET | /api/accounting/admin/deals/{id}/attachments/ | `AccountingAdminService.dealAttachments` | bound-unused | Bound, no UI | `dealAttachments()` has no caller; DealEditorPage reads attachments off the deal payload. |
| POST | /api/accounting/admin/deals/{id}/attachments/ | `AccountingAdminService.uploadDealAttachment` | `admin/DealEditorPage.tsx` | Integrated |  |
| DELETE | /api/accounting/admin/deals/{id}/attachments/{attachment_id}/ | `AccountingAdminService.deleteDealAttachment` | `admin/DealEditorPage.tsx` | Integrated |  |
| GET | /api/accounting/admin/ledger/ | `AccountingAdminService.ledger` | `admin/AccountingPage.tsx` | Integrated | Filters (book, entry_type, status, category, person, position, month) hand-parsed, absent from schema; LedgerQuery covers all. |
| POST | /api/accounting/admin/ledger/ | `AccountingAdminService.createEntry` | `admin/AccountingPage.tsx` | Integrated |  |
| GET | /api/accounting/admin/ledger/arian/duplicates/ | `AccountingAdminService.arianDuplicates` | `admin/AccountingDuplicates.tsx` | Integrated |  |
| GET | /api/accounting/admin/ledger/summary/ | `AccountingAdminService.ledgerSummary` | `admin/AccountingPage.tsx` | Integrated |  |
| GET | /api/accounting/admin/ledger/{id}/ | `AccountingAdminService.entry` | `admin/AccountingPage.tsx`, `admin/LedgerEntryPage.tsx` | Integrated |  |
| PATCH | /api/accounting/admin/ledger/{id}/ | `AccountingAdminService.updateEntry` | `admin/AccountingPage.tsx` | Integrated |  |
| DELETE | /api/accounting/admin/ledger/{id}/ | `AccountingAdminService.deleteEntry` | `admin/AccountingPage.tsx` | Integrated |  |
| GET | /api/accounting/admin/ledger/{id}/attachments/ | `AccountingAdminService.entryAttachments` | `admin/LedgerEntryPage.tsx` | Integrated |  |
| POST | /api/accounting/admin/ledger/{id}/attachments/ | `AccountingAdminService.uploadEntryAttachment` | `admin/LedgerEntryPage.tsx` | Integrated |  |
| DELETE | /api/accounting/admin/ledger/{id}/attachments/{attachment_id}/ | `AccountingAdminService.deleteEntryAttachment` | `admin/LedgerEntryPage.tsx` | Integrated |  |
| POST | /api/accounting/admin/ledger/{id}/review/ | `AccountingAdminService.saveArianReview` | `admin/LedgerEntryPage.tsx` | Integrated |  |
| POST | /api/accounting/admin/ledger/{id}/status/ | `AccountingAdminService.setEntryStatus` | `admin/LedgerEntryPage.tsx` | Integrated |  |
| GET | /api/accounting/admin/settlement/ | `AccountingAdminService.settlement` | `admin/AccountingSettlement.tsx` | Integrated |  |
| PUT | /api/accounting/admin/settlement/ | `AccountingAdminService.saveSettlement` | `admin/AccountingSettlement.tsx` | Integrated |  |
| GET | /api/accounting/admin/settlement/versions/ | `AccountingAdminService.settlementVersions` | `admin/AccountingSettlement.tsx` | Integrated |  |

## sales

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| GET | /api/sales/admin/sales/ | `SalesAdminService.sales` | `admin/SalesController.ts`, `admin/SalesPage.tsx` | Integrated | Phase 2 (2026-09-25): every filter sent (`search, status, payment_status, delivery_status, source, ordering`); Auction Sales = fixed `source=auction`; the strip walks the tab's rows for the overdue count. The `per_page=1` counts are gone. |
| POST | /api/sales/admin/sales/ | `SalesAdminService.createSale` | `admin/SalesPage.tsx` | Integrated |  |
| GET | /api/sales/admin/sales/summary/ | `SalesAdminService.summary` | `admin/SalesController.ts` (`readStrip`) | Integrated | Phase 2: Market Sales tiles + "N total" + the Source filter's values (`by_source`). Ledger-wide (no `source`), so Auction Sales counts its own rows. |
| GET | /api/sales/admin/sales/{id}/ | `SalesAdminService.sale` | `admin/SaleDetailPage.tsx` | Integrated |  |
| PATCH | /api/sales/admin/sales/{id}/ | `SalesAdminService.updateSale` | `admin/SaleDetailPage.tsx` | Integrated |  |
| DELETE | /api/sales/admin/sales/{id}/ | `SalesAdminService.deleteSale` | `admin/SaleDetailPage.tsx` | Integrated | Phase 2: "Delete deal" (old deal card `:12664`) behind the old confirm. |
| POST | /api/sales/admin/sales/{id}/delivery-status/ | `SalesAdminService.setDeliveryStatus` | `admin/SaleDetailPage.tsx` | Integrated |  |
| POST | /api/sales/admin/sales/{id}/follow-up/ | `SalesAdminService.followUp` | `admin/SaleDetailPage.tsx` | Integrated | Phase 2: presets / date / Clear (`null`); the row's and card's "due" read `follow_up_overdue`. |
| GET | /api/sales/admin/sales/{id}/notes/ | `SalesAdminService.notes` | `admin/SaleDetailPage.tsx` | Integrated | Phase 2: whole thread walked, newest first. |
| POST | /api/sales/admin/sales/{id}/notes/ | `SalesAdminService.addNote` | `admin/SaleDetailPage.tsx` | Integrated | Phase 2: appended from the 201 without a reload. |
| POST | /api/sales/admin/sales/{id}/payment-status/ | `SalesAdminService.setPaymentStatus` | `admin/SaleDetailPage.tsx` | Integrated |  |
| POST | /api/sales/admin/sales/{id}/transition/ | `SalesAdminService.transitionSale` | `admin/SaleDetailPage.tsx` | Integrated |  |

## documents

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| GET | /api/documents/ | `DocumentsService.mine` | `profile/Documents.tsx` | Integrated | Phase 1 (2026-09-25): Profile › Account › "Your documents" (G-DOC-1). |
| GET | /api/documents/admin/documents/ | `DocumentsAdminService.documents` | `admin/DocumentsPage.tsx`, `admin/exhibitions/IssueDocumentPage.tsx`, `admin/projects/ProjectProposal.tsx` | Integrated | `?kind` is hand-parsed (not in schema); DocumentQuery sends it. |
| POST | /api/documents/admin/documents/ | `DocumentsAdminService.createDocument` | `admin/DocumentsPage.tsx`, `admin/projects/ProjectProposal.tsx` | Integrated |  |
| GET | /api/documents/admin/documents/{id}/ | `DocumentsAdminService.document` | `admin/DocumentDetailPage.tsx` | Integrated |  |
| PATCH | /api/documents/admin/documents/{id}/ | `DocumentsAdminService.updateDocument` | `admin/DocumentDetailPage.tsx` | Integrated |  |
| DELETE | /api/documents/admin/documents/{id}/ | `DocumentsAdminService.deleteDocument` | `admin/DocumentDetailPage.tsx` | Integrated |  |
| GET | /api/documents/admin/documents/{id}/activity/ | none | — | Not bound | **NEW (not in FE schema.d.ts).** Document activity feed (G-DOC-2) — no binding. |
| POST | /api/documents/admin/documents/{id}/archive/ | `DocumentsAdminService.archiveDocument` | `admin/DocumentDetailPage.tsx` | Integrated |  |
| POST | /api/documents/admin/documents/{id}/confirm/ | `DocumentsAdminService.confirmDocument` | `admin/DocumentDetailPage.tsx`, `admin/projects/ProjectProposal.tsx` | Integrated |  |
| POST | /api/documents/admin/documents/{id}/share/ | none | — | Not bound | Share document — no binding. |
| DELETE | /api/documents/admin/documents/{id}/share/ | none | — | Not bound | Unshare document — no binding. |
| POST | /api/documents/admin/documents/{id}/sign/ | `DocumentsAdminService.signDocument` | `admin/DocumentDetailPage.tsx` | Integrated |  |
| POST | /api/documents/admin/documents/{id}/upload/ | `DocumentsAdminService.uploadPdf` | `admin/DocumentDetailPage.tsx`, `admin/projects/ProjectProposal.tsx` | Integrated |  |
| GET | /api/documents/admin/documents/{id}/versions/ | `DocumentsAdminService.versions` | `admin/DocumentDetailPage.tsx` | Integrated |  |
| GET | /api/documents/public/{kind}/ | `PublicDocumentsService.byKind` | `settings/useLegalLinks.ts` | Integrated | Phase 1 (2026-09-25): Settings › LEGAL links use the PDF of `legal_terms` / `legal_privacy` / `legal_auction` when published, else the public-site URL (only `legal_terms` is a backend-documented kind). |

## gallery

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| GET | /api/gallery/admin/exhibition-catalogue/ | none | — | Not bound | **NEW (not in FE schema.d.ts).** Exhibition-services catalogue CRUD — no binding (FE ExhibitionServicesPage uses projects service-catalog/packages instead). |
| POST | /api/gallery/admin/exhibition-catalogue/ | none | — | Not bound | **NEW (not in FE schema.d.ts).** Exhibition-services catalogue CRUD — no binding (FE ExhibitionServicesPage uses projects service-catalog/packages instead). |
| GET | /api/gallery/admin/exhibition-catalogue/{id}/ | none | — | Not bound | **NEW (not in FE schema.d.ts).** Exhibition-services catalogue CRUD — no binding (FE ExhibitionServicesPage uses projects service-catalog/packages instead). |
| PATCH | /api/gallery/admin/exhibition-catalogue/{id}/ | none | — | Not bound | **NEW (not in FE schema.d.ts).** Exhibition-services catalogue CRUD — no binding (FE ExhibitionServicesPage uses projects service-catalog/packages instead). |
| DELETE | /api/gallery/admin/exhibition-catalogue/{id}/ | none | — | Not bound | **NEW (not in FE schema.d.ts).** Exhibition-services catalogue CRUD — no binding (FE ExhibitionServicesPage uses projects service-catalog/packages instead). |
| GET | /api/gallery/admin/exhibitions/ | `GalleryAdminService.exhibitions` | `admin/ExhibitionsQueue.tsx`, `admin/SourceExhibitions.tsx`, `admin/exhibitions/IssueDocumentPage.tsx` | Integrated | All schema filters (`link, published, request_status`) in ExhibitionQuery. |
| GET | /api/gallery/admin/exhibitions/{id}/ | `GalleryAdminService.exhibition` | `admin/ExhibitionComposePage.tsx` | Integrated |  |
| PATCH | /api/gallery/admin/exhibitions/{id}/ | `GalleryAdminService.updateExhibition` | bound-unused | Bound, no UI | `GalleryAdminService.updateExhibition` exists but nothing calls it. |
| DELETE | /api/gallery/admin/exhibitions/{id}/ | `GalleryAdminService.deleteExhibition` | bound-unused | Bound, no UI | `deleteExhibition` deliberately unbound in UI (no delete in old panel, per service comment). |
| POST | /api/gallery/admin/exhibitions/{id}/compose/ | `GalleryAdminService.composeExhibition` | `admin/ExhibitionComposePage.tsx`, `admin/exhibitions/IssueDocumentPage.tsx` | Integrated |  |
| GET | /api/gallery/admin/exhibitions/{id}/documents/ | `GalleryAdminService.exhibitionDocuments` | `admin/ExhibitionComposePage.tsx`, `admin/SourceDocuments.tsx` | Integrated |  |
| POST | /api/gallery/admin/exhibitions/{id}/documents/ | `GalleryAdminService.createExhibitionDocument` | `admin/exhibitions/IssueDocumentPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/exhibitions/{id}/documents/{document_id}/confirm/ | `GalleryAdminService.confirmExhibitionDocument` | `admin/exhibitions/IssueDocumentPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/exhibitions/{id}/documents/{document_id}/sign/ | `GalleryAdminService.signExhibitionDocument` | `admin/ExhibitionComposePage.tsx` | Integrated |  |
| POST | /api/gallery/admin/exhibitions/{id}/documents/{document_id}/upload/ | `GalleryAdminService.uploadExhibitionDocumentPdf` | `admin/exhibitions/IssueDocumentPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/exhibitions/{id}/publish/ | `GalleryAdminService.publishExhibition` | `admin/ExhibitionComposePage.tsx` | Integrated |  |
| GET | /api/gallery/admin/links/ | `GalleryAdminService.links` | `admin/SourcesPage.tsx`, `admin/exhibitions/IssueDocumentPage.tsx` | Integrated | `?search` unsent (query type has source_type/page/per_page only). |
| POST | /api/gallery/admin/links/ | `GalleryAdminService.issueLink` | `admin/SourcesPage.tsx` | Integrated |  |
| GET | /api/gallery/admin/links/{id}/ | `GalleryAdminService.link` | `admin/ExhibitionComposePage.tsx`, `admin/SourceDetailPage.tsx` | Integrated |  |
| DELETE | /api/gallery/admin/links/{id}/ | none | — | Not bound | Delete link — no binding. |
| POST | /api/gallery/admin/links/{id}/disable/ | `GalleryAdminService.disableLink` | `admin/SourceDetailPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/links/{id}/enable/ | `GalleryAdminService.enableLink` | `admin/SourceDetailPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/links/{id}/features/ | `GalleryAdminService.setLinkFeatures` | `admin/SourceDetailPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/links/{id}/reissue/ | none | — | Not bound | Reissue token/PIN — no binding. |
| GET | /api/gallery/admin/links/{link_pk}/artworks/ | `GalleryAdminService.linkArtworks` | `admin/SourceDetailPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/links/{link_pk}/artworks/ | `GalleryAdminService.assignArtwork` | `admin/SourceDetailPage.tsx` | Integrated |  |
| DELETE | /api/gallery/admin/links/{link_pk}/artworks/{id}/ | `GalleryAdminService.removeArtwork` | `admin/SourceDetailPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/links/{link_pk}/artworks/{id}/funnel/ | `GalleryAdminService.setFunnelOverride` | `admin/SourceDetailPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/links/{link_pk}/exhibitions/ | `GalleryAdminService.createExhibitionForLink` | `admin/SourceExhibitions.tsx` | Integrated |  |
| GET | /api/gallery/admin/links/{link_pk}/messages/ | `GalleryAdminService.linkMessages` | `admin/SourceExhibitions.tsx` | Integrated |  |
| POST | /api/gallery/admin/links/{link_pk}/messages/ | `GalleryAdminService.sendLinkMessage` | `admin/SourceExhibitions.tsx` | Integrated |  |
| GET | /api/gallery/admin/links/{link_pk}/pricelists/ | `GalleryAdminService.linkPricelists` | `admin/SourceDocuments.tsx` | Integrated |  |
| GET | /api/gallery/admin/links/{link_pk}/pricelists/cap/ | none | — | Not bound | **NEW (not in FE schema.d.ts).** Pricelist soft-cap snapshot (G-PORT-3) — no binding. |
| POST | /api/gallery/admin/pricelists/{id}/status/ | none | — | Not bound | **NEW (not in FE schema.d.ts).** Set pricelist status — no binding. |
| GET | /api/gallery/admin/updates/ | `GalleryAdminService.updates` | `admin/SourcesPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/updates/{id}/approve/ | `GalleryAdminService.approveUpdate` | `admin/SourcesPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/updates/{id}/reject/ | `GalleryAdminService.rejectUpdate` | `admin/SourcesPage.tsx` | Integrated |  |
| GET | /api/gallery/portal/{token}/ | `GalleryPortalService.state` | `portal/PortalSession.ts` | Integrated | `?pin` sent. Called by PortalSession.enter/reload (PortalPage, PortalWorks, PortalMessages, PortalPricelists). |
| POST | /api/gallery/portal/{token}/artworks/{artwork_pk}/image/ | none | — | Not bound | **NEW (not in FE schema.d.ts).** Portal artwork image upload — no binding. |
| GET | /api/gallery/portal/{token}/exhibitions/ | `GalleryPortalService.exhibitions` | `portal/PortalSession.ts` | Integrated | Called by PortalSession.loadExhibitions. |
| POST | /api/gallery/portal/{token}/exhibitions/ | `GalleryPortalService.createExhibition` | `portal/PortalExhibitions.tsx`, `portal/PortalSession.ts` | Integrated |  |
| GET | /api/gallery/portal/{token}/exhibitions/catalogue/ | `GalleryPortalService.exhibitionCatalogue` | `portal/PortalSession.ts` | Integrated | Called by PortalSession.loadExhibitions. |
| GET | /api/gallery/portal/{token}/exhibitions/{event_id}/ | none | — | Not bound | Single exhibition read — no binding (list is used). |
| PATCH | /api/gallery/portal/{token}/exhibitions/{event_id}/ | `GalleryPortalService.updateExhibition` | bound-unused (`portal/PortalSession.ts` wrapper only) | Bound, no UI | Only the PortalSession.updateExhibition wrapper calls it; no portal component calls that wrapper. |
| POST | /api/gallery/portal/{token}/exhibitions/{event_id}/documents/{document_id}/sign/ | `GalleryPortalService.signExhibitionDocument` | `portal/PortalExhibitions.tsx`, `portal/PortalSession.ts` | Integrated |  |
| POST | /api/gallery/portal/{token}/exhibitions/{event_id}/submit/ | `GalleryPortalService.submitExhibition` | `portal/PortalExhibitions.tsx`, `portal/PortalSession.ts` | Integrated |  |
| GET | /api/gallery/portal/{token}/messages/ | none | — | Not bound | No binding; thread arrives inside the `GET portal/{token}/` state payload. |
| POST | /api/gallery/portal/{token}/messages/ | `GalleryPortalService.sendMessage` | `portal/PortalMessages.tsx`, `portal/PortalSession.ts` | Integrated |  |
| POST | /api/gallery/portal/{token}/pricelists/ | `GalleryPortalService.uploadPricelist` | `portal/PortalPricelists.tsx`, `portal/PortalSession.ts` | Integrated |  |
| POST | /api/gallery/portal/{token}/pricelists/build/ | none | — | Not bound | **NEW (not in FE schema.d.ts).** Build pricelist from lines — no binding (FE only uploads a file). |
| GET | /api/gallery/portal/{token}/status/ | none | — | Not bound | No binding; funnel status arrives inside the state payload. |
| POST | /api/gallery/portal/{token}/updates/ | `GalleryPortalService.submitUpdate` | `portal/PortalSession.ts`, `portal/PortalWorks.tsx` | Integrated |  |

## projects

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| GET | /api/projects/admin/checklists/ | `ProjectsAdminService.checklists` | `admin/projects/PackagesPage.tsx`, `admin/projects/ProjectsReportsPage.tsx` | Integrated |  |
| POST | /api/projects/admin/checklists/ | `ProjectsAdminService.createChecklist` | `admin/projects/PackagesPage.tsx`, `admin/projects/ProjectsReportsPage.tsx` | Integrated |  |
| GET | /api/projects/admin/checklists/{id}/ | `ProjectsAdminService.checklist` | bound-unused | Bound, no UI | `checklist()` has no caller. |
| PATCH | /api/projects/admin/checklists/{id}/ | `ProjectsAdminService.updateChecklist` | `admin/projects/ProjectsReportsPage.tsx` | Integrated |  |
| DELETE | /api/projects/admin/checklists/{id}/ | `ProjectsAdminService.deleteChecklist` | `admin/projects/ProjectsReportsPage.tsx` | Integrated |  |
| GET | /api/projects/admin/packages/ | `ProjectsAdminService.packages` | `admin/exhibitions/ExhibitionServicesPage.tsx`, `admin/exhibitions/IssueDocumentPage.tsx`, `admin/projects/PackagesPage.tsx` | Integrated |  |
| POST | /api/projects/admin/packages/ | `ProjectsAdminService.createPackage` | `admin/projects/PackageEditorPage.tsx`, `admin/projects/PackagesPage.tsx` | Integrated |  |
| GET | /api/projects/admin/packages/{id}/ | `ProjectsAdminService.packageTemplate` | `admin/projects/PackageEditorPage.tsx`, `admin/projects/ProjectProposal.tsx`, `admin/projects/ProjectReportPage.tsx` | Integrated |  |
| PATCH | /api/projects/admin/packages/{id}/ | `ProjectsAdminService.updatePackage` | `admin/projects/PackageEditorPage.tsx`, `admin/projects/PackagesPage.tsx` | Integrated |  |
| DELETE | /api/projects/admin/packages/{id}/ | `ProjectsAdminService.deletePackage` | `admin/projects/PackagesPage.tsx` | Integrated |  |
| GET | /api/projects/admin/partners/ | `ProjectsAdminService.partners` | `admin/projects/NewProjectPage.tsx`, `admin/projects/ProjectPage.tsx`, `admin/projects/ProjectPartnersPage.tsx`, `admin/projects/ProjectReportPage.tsx` | Integrated |  |
| POST | /api/projects/admin/partners/ | `ProjectsAdminService.createPartner` | `admin/projects/ProjectPartnersPage.tsx` | Integrated |  |
| GET | /api/projects/admin/partners/{id}/ | `ProjectsAdminService.partner` | bound-unused | Bound, no UI | `partner()` has no caller (marked unbound in service comment). |
| PATCH | /api/projects/admin/partners/{id}/ | `ProjectsAdminService.updatePartner` | `admin/projects/ProjectPartnersPage.tsx` | Integrated |  |
| DELETE | /api/projects/admin/partners/{id}/ | `ProjectsAdminService.deletePartner` | `admin/projects/ProjectPartnersPage.tsx` | Integrated |  |
| GET | /api/projects/admin/projects/ | `ProjectsAdminService.projects` | `admin/projects/ProjectsDashboardPage.tsx`, `admin/projects/ProjectsListPage.tsx`, `admin/projects/ProjectsReportsPage.tsx`, `admin/projects/projectForm.ts` | Integrated | `?partner`, `?quick` unsent (ProjectQuery lacks them); `archived` sent as True/False. |
| POST | /api/projects/admin/projects/ | `ProjectsAdminService.createProject` | `admin/projects/NewProjectPage.tsx` | Integrated |  |
| GET | /api/projects/admin/projects/dashboard/ | `ProjectsAdminService.dashboard` | `admin/projects/ProjectsDashboardPage.tsx` | Integrated |  |
| GET | /api/projects/admin/projects/reports/ | `ProjectsAdminService.reports` | `admin/projects/ProjectsReportsPage.tsx` | Integrated |  |
| GET | /api/projects/admin/projects/{id}/ | `ProjectsAdminService.project` | `admin/projects/ProjectPage.tsx`, `admin/projects/ProjectReportPage.tsx` | Integrated |  |
| PATCH | /api/projects/admin/projects/{id}/ | `ProjectsAdminService.updateProject` | `admin/projects/PackageEditorPage.tsx`, `admin/projects/PackagesPage.tsx`, `admin/projects/ProjectPage.tsx`, `admin/projects/ProjectsCalculatorPage.tsx` | Integrated |  |
| DELETE | /api/projects/admin/projects/{id}/ | `ProjectsAdminService.deleteProject` | `admin/projects/ProjectPage.tsx` | Integrated |  |
| POST | /api/projects/admin/projects/{id}/stage/ | `ProjectsAdminService.setStage` | `admin/projects/ProjectPage.tsx`, `admin/projects/ProjectPipelinePage.tsx` | Integrated |  |
| GET | /api/projects/admin/projects/{id}/totals/ | none | — | Not bound | **NEW (not in FE schema.d.ts).** Money totals (G-PROJ-9) — no binding; FE computes totals client-side (projectForm.ts projMoneyCalc). |
| GET | /api/projects/admin/projects/{project_pk}/attachments/ | `ProjectsAdminService.attachments` | `admin/projects/ProjectPage.tsx` | Integrated |  |
| POST | /api/projects/admin/projects/{project_pk}/attachments/ | `ProjectsAdminService.uploadAttachment` | `admin/projects/ProjectPage.tsx` | Integrated |  |
| DELETE | /api/projects/admin/projects/{project_pk}/attachments/{id}/ | `ProjectsAdminService.deleteAttachment` | `admin/projects/ProjectPage.tsx` | Integrated |  |
| GET | /api/projects/admin/service-catalog/ | `ProjectsAdminService.services` | `admin/ExhibitionComposePage.tsx`, `admin/exhibitions/ExhibitionServicesPage.tsx`, `admin/exhibitions/IssueDocumentPage.tsx`, `admin/projects/ProjectProposal.tsx`, `admin/projects/ProjectReportPage.tsx`, `admin/projects/projectForm.ts` | Integrated |  |
| POST | /api/projects/admin/service-catalog/ | `ProjectsAdminService.createService` | `admin/exhibitions/ExhibitionServicesPage.tsx`, `admin/projects/PackagesPage.tsx` | Integrated |  |
| GET | /api/projects/admin/service-catalog/{id}/ | `ProjectsAdminService.service` | bound-unused | Bound, no UI | `service()` has no caller. |
| PATCH | /api/projects/admin/service-catalog/{id}/ | `ProjectsAdminService.updateService` | `admin/exhibitions/ExhibitionServicesPage.tsx`, `admin/projects/PackagesPage.tsx` | Integrated |  |
| DELETE | /api/projects/admin/service-catalog/{id}/ | `ProjectsAdminService.deleteService` | `admin/exhibitions/ExhibitionServicesPage.tsx`, `admin/projects/PackagesPage.tsx` | Integrated |  |

## recommendations

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| GET | /api/recommendations/admin/artworks/{artwork_pk}/tags/ | none | — | Not bound | Recommendations admin — no FE binding. |
| POST | /api/recommendations/admin/artworks/{artwork_pk}/tags/ai/ | none | — | Not bound | Recommendations admin — no FE binding. |
| POST | /api/recommendations/admin/artworks/{artwork_pk}/tags/auto/ | none | — | Not bound | Recommendations admin — no FE binding. |
| POST | /api/recommendations/admin/batches/{id}/publish/ | none | — | Not bound | Recommendations admin — no FE binding. |
| POST | /api/recommendations/admin/batches/{id}/unpublish/ | none | — | Not bound | Recommendations admin — no FE binding. |
| GET | /api/recommendations/admin/collectors/{collector_pk}/batches/ | none | — | Not bound | Recommendations admin — no FE binding. |
| POST | /api/recommendations/admin/collectors/{collector_pk}/batches/ | none | — | Not bound | Recommendations admin — no FE binding. |
| GET | /api/recommendations/admin/collectors/{collector_pk}/preferences/ | none | — | Not bound | Recommendations admin — no FE binding. |
| POST | /api/recommendations/admin/collectors/{collector_pk}/preferences/rebuild/ | none | — | Not bound | Recommendations admin — no FE binding. |
| GET | /api/recommendations/admin/collectors/{collector_pk}/recommendations/ | none | — | Not bound | Recommendations admin — no FE binding. |
| POST | /api/recommendations/admin/collectors/{collector_pk}/recommendations/generate/ | none | — | Not bound | Recommendations admin — no FE binding. |
| GET | /api/recommendations/admin/feature-settings/ | none | — | Not bound | Recommendations admin — no FE binding. |
| POST | /api/recommendations/admin/feature-settings/ | none | — | Not bound | Recommendations admin — no FE binding. |
| GET | /api/recommendations/admin/question-sets/ | none | — | Not bound | Recommendations admin — no FE binding. |
| POST | /api/recommendations/admin/question-sets/ | none | — | Not bound | Recommendations admin — no FE binding. |
| GET | /api/recommendations/admin/question-sets/{id}/ | none | — | Not bound | Recommendations admin — no FE binding. |
| PATCH | /api/recommendations/admin/question-sets/{id}/ | none | — | Not bound | Recommendations admin — no FE binding. |
| DELETE | /api/recommendations/admin/question-sets/{id}/ | none | — | Not bound | Recommendations admin — no FE binding. |
| POST | /api/recommendations/admin/question-sets/{id}/activate/ | none | — | Not bound | Recommendations admin — no FE binding. |
| PATCH | /api/recommendations/admin/recommendations/{id}/ | none | — | Not bound | Recommendations admin — no FE binding. |
| DELETE | /api/recommendations/admin/recommendations/{id}/ | none | — | Not bound | Recommendations admin — no FE binding. |
| POST | /api/recommendations/admin/tags/{id}/approve/ | none | — | Not bound | Recommendations admin — no FE binding. |
| POST | /api/recommendations/admin/tags/{id}/lock/ | none | — | Not bound | Recommendations admin — no FE binding. |
| GET | /api/recommendations/published/ | `RecommendationService.published` | bound-unused | Bound, no UI | `published()` has no caller (TD-6, whole surface unbuilt). |
| POST | /api/recommendations/published/{id}/dismiss/ | `RecommendationService.dismiss` | bound-unused | Bound, no UI | `dismiss()` has no caller. |
| GET | /api/recommendations/question-set/ | none | — | Not bound | Active question set — no binding; questionnaire questions are defined client-side. |
| GET | /api/recommendations/questionnaire/ | `RecommendationService.questionnaire` | `profile/ProfilePage.tsx`, `questionnaire/QuestionnaireController.ts` | Integrated |  |
| POST | /api/recommendations/questionnaire/ | `RecommendationService.submitQuestionnaire` | `questionnaire/QuestionnaireController.ts` | Integrated |  |

## notifications

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| POST | /api/notifications/push/subscribe/ | none | — | Not bound | Web-push subscribe — no binding, no service worker in FE. |
| POST | /api/notifications/push/unsubscribe/ | none | — | Not bound | Web-push unsubscribe — no binding. |
| GET | /api/notifications/vapid-public-key/ | none | — | Not bound | VAPID key for web-push — no binding. |

## marketing

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| GET | /api/marketing/admin/campaigns/ | none | — | Not bound | Marketing app — no FE service at all (supports `?status`). |
| POST | /api/marketing/admin/campaigns/ | none | — | Not bound | Marketing app — no FE service at all. |
| POST | /api/marketing/admin/campaigns/generate-copy/ | none | — | Not bound | Marketing app — no FE service at all. |
| GET | /api/marketing/admin/campaigns/{campaign_pk}/analytics/ | none | — | Not bound | Marketing app — no FE service at all. |
| POST | /api/marketing/admin/campaigns/{campaign_pk}/analytics/ | none | — | Not bound | Marketing app — no FE service at all. |
| DELETE | /api/marketing/admin/campaigns/{campaign_pk}/analytics/{id}/ | none | — | Not bound | Marketing app — no FE service at all. |
| GET | /api/marketing/admin/campaigns/{id}/ | none | — | Not bound | Marketing app — no FE service at all. |
| PATCH | /api/marketing/admin/campaigns/{id}/ | none | — | Not bound | Marketing app — no FE service at all. |
| DELETE | /api/marketing/admin/campaigns/{id}/ | none | — | Not bound | Marketing app — no FE service at all. |

## dashboard

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| GET | /api/dashboard/admin/summary/ | `DashboardService.summary` | `admin/useDashboard.ts` | Integrated |  |

## core / options / theme / audit

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| GET | /api/admin/app-theme/ | `ThemeService.adminTheme` | `admin/DesignPage.tsx` | Integrated |  |
| PUT | /api/admin/app-theme/ | `ThemeService.publish` | `admin/DesignPage.tsx` | Integrated |  |
| POST | /api/admin/app-theme/reset/ | `ThemeService.reset` | `admin/DesignPage.tsx` | Integrated |  |
| GET | /api/admin/app-theme/versions/ | `ThemeService.versions` | `admin/DesignPage.tsx` | Integrated |  |
| POST | /api/admin/app-theme/versions/ | `ThemeService.saveVersion` | `admin/DesignPage.tsx` | Integrated |  |
| DELETE | /api/admin/app-theme/versions/{id}/ | `ThemeService.deleteVersion` | `admin/DesignPage.tsx` | Integrated |  |
| POST | /api/admin/app-theme/versions/{id}/activate/ | `ThemeService.activateVersion` | `admin/DesignPage.tsx` | Integrated |  |
| GET | /api/admin/audit-log/ | `CoreAdminService.auditLog` | `admin/SettingsPage.tsx` | Integrated | `action`, `entity_type` both sent. |
| GET | /api/app-theme/ | `ThemeService.publicTheme` | `api/ApiProvider.tsx (app boot)` | Integrated |  |
| GET | /api/options/ | `OptionsService.all`, `OptionsService.reload` | `App.tsx`, `admin/AdminRequestsPage.tsx`, `catalogue/CataloguePage.tsx` | Integrated |  |

## other

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| GET | /api/health/ | none | — | Backend-only | Liveness probe for infra/load balancer; no browser use. |

## Summary

Counts updated by V1 Phase 1 (2026-09-25): four operations moved from Not bound to Integrated —
`PATCH /api/auth/me/`, `GET /api/auth/my-membership/`, `GET /api/documents/`,
`GET /api/documents/public/{kind}/`. V1 Phase 2 (2026-09-25) moved five more — the sales
`summary/`, `DELETE …/sales/{id}/`, `…/follow-up/`, and `…/notes/` GET + POST. V1 Phase 3 (2026-09-25)
moved six Not bound (auction PATCH, archive, cover POST/DELETE, lot PATCH, registration reset) and one
Partial (auction create, now with terms) to Integrated. Status cells elsewhere
are the 2026-09-25 baseline unless a row says otherwise.

| Status | Count |
|---|---|
| Integrated | 241 |
| Partial | 2 |
| Bound, no UI | 9 |
| Not bound | 70 |
| Backend-only | 1 |
| **Total** | **323** |

### Partial

- `POST /api/crm/admin/requests/{id}/messages/` — FE sends `body` + `artwork_refs` only; `document_refs` never sent.
- `POST /api/crm/requests/{id}/messages/` — FE sends `body` + `artwork_refs` only; `document_refs` (supported) never sent.

### Bound, no UI

- `GET /api/accounting/admin/deals/{id}/attachments/`
- `PATCH /api/gallery/admin/exhibitions/{id}/`
- `DELETE /api/gallery/admin/exhibitions/{id}/`
- `PATCH /api/gallery/portal/{token}/exhibitions/{event_id}/`
- `GET /api/projects/admin/checklists/{id}/`
- `GET /api/projects/admin/partners/{id}/`
- `GET /api/projects/admin/service-catalog/{id}/`
- `GET /api/recommendations/published/`
- `POST /api/recommendations/published/{id}/dismiss/`

### Not bound

- `GET /api/auctions/records/highlights/`
- `GET /api/auth/admin/access-keys/`
- `GET /api/auth/admin/access-keys/summary/`
- `GET /api/auth/admin/collectors/summary/`
- `GET /api/auth/admin/membership-codes/{id}/`
- `GET /api/auth/admin/team-users/{id}/`
- `GET /api/catalog/admin/artists/{id}/`
- `GET /api/catalog/artworks/change-stamp/`
- `GET /api/catalog/legacy-lookup/`
- `GET /api/catalog/selections/`
- `POST /api/catalog/selections/{id}/seen/`
- `GET /api/crm/activity/`
- `POST /api/crm/admin/messages/{id}/archive/`
- `GET /api/crm/admin/selections/{id}/`
- `POST /api/crm/requests/{id}/archive/`
- `POST /api/crm/requests/{id}/transition/`
- `GET /api/documents/admin/documents/{id}/activity/`
- `POST /api/documents/admin/documents/{id}/share/`
- `DELETE /api/documents/admin/documents/{id}/share/`
- `GET /api/gallery/admin/exhibition-catalogue/`
- `POST /api/gallery/admin/exhibition-catalogue/`
- `GET /api/gallery/admin/exhibition-catalogue/{id}/`
- `PATCH /api/gallery/admin/exhibition-catalogue/{id}/`
- `DELETE /api/gallery/admin/exhibition-catalogue/{id}/`
- `DELETE /api/gallery/admin/links/{id}/`
- `POST /api/gallery/admin/links/{id}/reissue/`
- `GET /api/gallery/admin/links/{link_pk}/pricelists/cap/`
- `POST /api/gallery/admin/pricelists/{id}/status/`
- `POST /api/gallery/portal/{token}/artworks/{artwork_pk}/image/`
- `GET /api/gallery/portal/{token}/exhibitions/{event_id}/`
- `GET /api/gallery/portal/{token}/messages/`
- `POST /api/gallery/portal/{token}/pricelists/build/`
- `GET /api/gallery/portal/{token}/status/`
- `GET /api/marketing/admin/campaigns/`
- `POST /api/marketing/admin/campaigns/`
- `POST /api/marketing/admin/campaigns/generate-copy/`
- `GET /api/marketing/admin/campaigns/{campaign_pk}/analytics/`
- `POST /api/marketing/admin/campaigns/{campaign_pk}/analytics/`
- `DELETE /api/marketing/admin/campaigns/{campaign_pk}/analytics/{id}/`
- `GET /api/marketing/admin/campaigns/{id}/`
- `PATCH /api/marketing/admin/campaigns/{id}/`
- `DELETE /api/marketing/admin/campaigns/{id}/`
- `POST /api/notifications/push/subscribe/`
- `POST /api/notifications/push/unsubscribe/`
- `GET /api/notifications/vapid-public-key/`
- `GET /api/projects/admin/projects/{id}/totals/`
- `GET /api/recommendations/admin/artworks/{artwork_pk}/tags/`
- `POST /api/recommendations/admin/artworks/{artwork_pk}/tags/ai/`
- `POST /api/recommendations/admin/artworks/{artwork_pk}/tags/auto/`
- `POST /api/recommendations/admin/batches/{id}/publish/`
- `POST /api/recommendations/admin/batches/{id}/unpublish/`
- `GET /api/recommendations/admin/collectors/{collector_pk}/batches/`
- `POST /api/recommendations/admin/collectors/{collector_pk}/batches/`
- `GET /api/recommendations/admin/collectors/{collector_pk}/preferences/`
- `POST /api/recommendations/admin/collectors/{collector_pk}/preferences/rebuild/`
- `GET /api/recommendations/admin/collectors/{collector_pk}/recommendations/`
- `POST /api/recommendations/admin/collectors/{collector_pk}/recommendations/generate/`
- `GET /api/recommendations/admin/feature-settings/`
- `POST /api/recommendations/admin/feature-settings/`
- `GET /api/recommendations/admin/question-sets/`
- `POST /api/recommendations/admin/question-sets/`
- `GET /api/recommendations/admin/question-sets/{id}/`
- `PATCH /api/recommendations/admin/question-sets/{id}/`
- `DELETE /api/recommendations/admin/question-sets/{id}/`
- `POST /api/recommendations/admin/question-sets/{id}/activate/`
- `PATCH /api/recommendations/admin/recommendations/{id}/`
- `DELETE /api/recommendations/admin/recommendations/{id}/`
- `POST /api/recommendations/admin/tags/{id}/approve/`
- `POST /api/recommendations/admin/tags/{id}/lock/`
- `GET /api/recommendations/question-set/`

### Backend-only

- `GET /api/health/` — Liveness probe for infra/load balancer; no browser use.

### Notable unsent query params on integrated endpoints

- `GET /api/catalog/admin/artists/` — `?search`, `?ordering` unsent — desks fetch `per_page=500` and search client-side; service comment ("backend list takes NO filters, G-CAT-3") is stale.
- `GET /api/catalog/admin/artworks/` — Unsent (not in ArtworkAdminQuery): `complete, created_after, duplicate_images, gallery_portal, price_min, price_max, size, source_type, tag, refine_*`.
- `GET /api/projects/admin/projects/` — `?partner`, `?quick` unsent (ProjectQuery lacks them); `archived` sent as True/False.
- `GET /api/auctions/records/` — `?house` typed but unsent by decision (Phase 3: the collector Records page is the Artist view).
- `GET /api/gallery/admin/links/` — `?search` unsent (query type has source_type/page/per_page only).
- `GET /api/crm/requests/` — `?archived` unsent (CollectorRequestQuery lacks it).
- `GET /api/crm/admin/requests/{id}/messages/` — `?include_archived` unsent.
