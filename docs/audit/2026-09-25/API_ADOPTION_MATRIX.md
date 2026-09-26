# Darz API adoption matrix

Backend `darz-backend-api@development` @ `df0421f` (224 paths, 323 method+path operations) vs frontend `-darz-web@v1/phase-10-final` (= `development` after PRs #102–#111). **Final V1 state, re-verified 2026-09-26 (V1 Phase 10).**

Method: every FE binding parsed from `src/api/services.ts` (base path + relative path, HTTP verb from `list/retrieve/create/remove/client.send`) plus `AuthSession.ts`; every FE method matched a backend operation (no dangling bindings). UI callers: grep of `.method(` across `src/` (excl. `src/api`, tests), with receivers resolved to the right service where names collide (e.g. `artworks`, `lots`, `records`, `exhibitions`). Paths listed as feature-relative (`admin/X.tsx` = `src/features/admin/X.tsx`). No feature file calls the HTTP client directly. "Unsent params" = backend query params from `schema.json` (plus a few hand-parsed ones checked in the views) not present in the FE query type, so the FE cannot send them.

## accounts / auth

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| POST | /api/auth/access-requests/ | `AuthService.requestAccess` | `auth/LoginPage.tsx` | Integrated |  |
| GET | /api/auth/admin/access-keys/ | `AdminAccountsService.accessKeysRoster` | `admin/AccessDeskController.ts`, `admin/AccessDeskPage.tsx` | Integrated | V1 Phase 8 (G-KEY-1): the owner Access desk. `search`, `status` (computed) and `expiring_soon` sent; the review banner reads `?status=expired` + `?expiring_soon=true`. `?collector` typed in `AccessKeyRosterQuery`, unsent (the collector page reads its own keys). Rows displayed per C-17. |
| GET | /api/auth/admin/access-keys/summary/ | `AdminAccountsService.accessKeysSummary` | `admin/AccessDeskPage.tsx` | Integrated | V1 Phase 8: the old stat row, four of five (Total Collectors · Active Collectors · Expiring ≤ 7d · Logins today); the per-state key counts are not shown (no old tile). |
| POST | /api/auth/admin/access-keys/{id}/extend/ | `AdminAccountsService.extendAccessKey` | `admin/AccessDeskPage.tsx`, `admin/CollectorDetailPage.tsx` | Integrated |  |
| POST | /api/auth/admin/access-keys/{id}/revoke/ | `AdminAccountsService.revokeAccessKey` | `admin/AccessDeskPage.tsx`, `admin/CollectorDetailPage.tsx` | Integrated |  |
| GET | /api/auth/admin/access-requests/ | `AdminAccountsService.accessRequests` | `admin/AccessRequestsController.ts` | Integrated | FE also sends `?search` (supported by AccessRequestFilterSet though not in schema). |
| POST | /api/auth/admin/access-requests/{id}/approve/ | `AdminAccountsService.approveAccessRequest` | `admin/AccessRequestsPage.tsx` | Integrated |  |
| POST | /api/auth/admin/access-requests/{id}/decline/ | `AdminAccountsService.declineAccessRequest` | `admin/AccessRequestsPage.tsx` | Integrated |  |
| GET | /api/auth/admin/collectors/ | `AdminAccountsService.collectors` | `admin/ArtworkEditorPage.tsx`, `admin/AuctionAdminDetailPage.tsx`, `admin/ClubPage.tsx`, `admin/CollectorsController.ts`, `admin/CollectorsPage.tsx`, `admin/SalesPage.tsx` | Integrated | All schema filters in CollectorAdminQuery. V1 Phase 4: `?ordering=-activity` (the default) and `-purchases` sent; `last_activity_at`/`purchase_count` shown (list-only, C-16). |
| POST | /api/auth/admin/collectors/ | `AdminAccountsService.createCollector` | `admin/CollectorForm.tsx` | Integrated |  |
| GET | /api/auth/admin/collectors/summary/ | `AdminAccountsService.collectorsSummary` | `admin/CollectorsPage.tsx` | Integrated | V1 Phase 4 (2026-09-25): the Collectors strip (Collectors · VIP · Active 30d · Engaged). ClubPage's "Collector keys" tile still reads the roster's `total_count`. |
| GET | /api/auth/admin/collectors/{collector_pk}/access-keys/ | `AdminAccountsService.accessKeys` | `admin/CollectorDetailPage.tsx` | Integrated |  |
| POST | /api/auth/admin/collectors/{collector_pk}/access-keys/ | `AdminAccountsService.issueAccessKey` | `admin/CollectorDetailPage.tsx` | Integrated |  |
| GET | /api/auth/admin/collectors/{collector_pk}/login-events/ | `AdminAccountsService.loginEvents` | `admin/CollectorDetailPage.tsx` | Integrated |  |
| GET | /api/auth/admin/collectors/{id}/ | `AdminAccountsService.collector` | `admin/AccessRequestsPage.tsx`, `admin/CollectorDetailPage.tsx`, `admin/RegistrationsPage.tsx`, `admin/useSaleRefs.ts` | Integrated |  |
| PATCH | /api/auth/admin/collectors/{id}/ | `AdminAccountsService.updateCollector` | `admin/AccessRequestsPage.tsx`, `admin/CollectorForm.tsx` | Integrated |  |
| DELETE | /api/auth/admin/collectors/{id}/ | `AdminAccountsService.deleteCollector` | `admin/CollectorDetailPage.tsx` | Integrated |  |
| GET | /api/auth/admin/membership-codes/ | `AdminAccountsService.membershipCodes` | `admin/MembershipsPage.tsx` | Integrated |  |
| POST | /api/auth/admin/membership-codes/ | `AdminAccountsService.createMembershipCode` | `admin/MembershipsPage.tsx` | Integrated |  |
| GET | /api/auth/admin/membership-codes/{id}/ | none | — | Not needed (list rows suffice) | The Memberships desk edits from the list row. |
| PATCH | /api/auth/admin/membership-codes/{id}/ | `AdminAccountsService.updateMembershipCode` | `admin/MembershipsPage.tsx` | Integrated |  |
| DELETE | /api/auth/admin/membership-codes/{id}/ | `AdminAccountsService.deleteMembershipCode` | `admin/MembershipsPage.tsx` | Integrated |  |
| POST | /api/auth/admin/membership-codes/{id}/renew/ | `AdminAccountsService.renewMembershipCode` | `admin/MembershipsPage.tsx` | Integrated |  |
| GET | /api/auth/admin/team-users/ | `AdminAccountsService.teamUsers` | `admin/SalesPage.tsx`, `admin/TeamPage.tsx`, `admin/useSaleRefs.ts` | Integrated |  |
| POST | /api/auth/admin/team-users/ | `AdminAccountsService.createTeamUser` | `admin/TeamPage.tsx` | Integrated |  |
| GET | /api/auth/admin/team-users/{id}/ | none | — | Not needed (list rows suffice) | The Team desk edits from the list row. |
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
| GET | /api/catalog/admin/artists/ | `CatalogAdminService.artists` | `admin/ArtistsPage.tsx`, `admin/ArtworkEditorPage.tsx`, `admin/ArtworksPage.tsx`, `admin/RecordEditorPage.tsx` | Integrated | V1 Phase 4: the Artists desk sends `?search`, `?ordering` (works · name · -created) and pages with the kit; `works_count` shown. The editor/Database/record pickers still walk every page. |
| POST | /api/catalog/admin/artists/ | `CatalogAdminService.createArtist` | `admin/ArtistsPage.tsx` | Integrated |  |
| GET | /api/catalog/admin/artists/{id}/ | none | — | Not needed (list rows suffice) | The Artists desk edits from the list row (PATCH/DELETE bound). |
| PATCH | /api/catalog/admin/artists/{id}/ | `CatalogAdminService.updateArtist` | `admin/ArtistsPage.tsx` | Integrated |  |
| DELETE | /api/catalog/admin/artists/{id}/ | `CatalogAdminService.deleteArtist` | `admin/ArtistsPage.tsx` | Integrated |  |
| GET | /api/catalog/admin/artworks/ | `CatalogAdminService.artworks` | `admin/ArtworksController.ts`, `admin/AuctionAdminDetailPage.tsx`, `admin/ClubPage.tsx`, `admin/DataHealthPage.tsx`, `admin/SalesPage.tsx`, `admin/SourceDetailPage.tsx` | Integrated | V1 Phase 4: `gallery_portal, complete, duplicate_images, size, source_type, created_after` sent (Database filters + link chips, Data Health counts, `?published=true` on the Published desk). Still unsent: `price_min, price_max, tag, refine_*`. |
| POST | /api/catalog/admin/artworks/ | `CatalogAdminService.createArtwork` | `admin/ArtworkEditorPage.tsx` | Integrated |  |
| GET | /api/catalog/admin/artworks/facets/ | `CatalogAdminService.artworkFacets` | `admin/ArtworksPage.tsx` | Integrated | Takes the Database's live query, the Phase 4 filters included. |
| GET | /api/catalog/admin/artworks/{artwork_pk}/images/ | `CatalogAdminService.artworkImages` | `admin/ArtworkEditorPage.tsx` | Integrated |  |
| POST | /api/catalog/admin/artworks/{artwork_pk}/images/ | `CatalogAdminService.uploadArtworkImage` | `admin/ArtworkEditorPage.tsx` | Integrated |  |
| DELETE | /api/catalog/admin/artworks/{artwork_pk}/images/{image_pk}/ | `CatalogAdminService.deleteArtworkImage` | `admin/ArtworkEditorPage.tsx` | Integrated |  |
| GET | /api/catalog/admin/artworks/{artwork_pk}/selection-grants/ | `CatalogAdminService.selectionGrants` | `admin/ArtworkEditorPage.tsx` | Integrated |  |
| POST | /api/catalog/admin/artworks/{artwork_pk}/selection-grants/ | `CatalogAdminService.grantSelection` | `admin/ArtworkEditorPage.tsx` | Integrated |  |
| DELETE | /api/catalog/admin/artworks/{artwork_pk}/selection-grants/{grant_pk}/ | `CatalogAdminService.revokeSelectionGrant` | `admin/ArtworkEditorPage.tsx` | Integrated |  |
| GET | /api/catalog/admin/artworks/{id}/ | `CatalogAdminService.artwork` | `admin/ArtworkEditorPage.tsx`, `admin/AuctionAdminDetailPage.tsx`, `admin/useSaleRefs.ts (SalesPage, SaleDetailPage)` | Integrated |  |
| PATCH | /api/catalog/admin/artworks/{id}/ | `CatalogAdminService.updateArtwork` | `admin/ArtworkEditorPage.tsx` | Integrated |  |
| DELETE | /api/catalog/admin/artworks/{id}/ | `CatalogAdminService.deleteArtwork` | `admin/ArtworksPage.tsx` | Integrated |  |
| POST | /api/catalog/admin/artworks/{id}/publish/ | `CatalogAdminService.publishArtwork` | `admin/ArtworkEditorPage.tsx`, `admin/ArtworksPage.tsx` | Integrated | V1 Phase 4: the 400's `details.missing` renders as the old refusal popup (G-CAT-8). |
| POST | /api/catalog/admin/artworks/{id}/transition/ | `CatalogAdminService.transitionArtwork` | `admin/ArtworkEditorPage.tsx` | Integrated |  |
| POST | /api/catalog/admin/artworks/{id}/unpublish/ | `CatalogAdminService.unpublishArtwork` | `admin/ArtworkEditorPage.tsx`, `admin/ArtworksPage.tsx`, `admin/PublishedPage.tsx` | Integrated |  |
| GET | /api/catalog/admin/data-health/ | `CatalogAdminService.dataHealth` | `admin/DataHealthPage.tsx`, `admin/PublishedPage.tsx` | Integrated | V1 Phase 4: `deleted_records.count` read (Deleted (permanent) box). |
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
| GET | /api/catalog/artworks/change-stamp/ | none | — | Not needed (the catalogue is server-paged) | The stamp guards the old full-list walk + swap; the collector catalogue reads one server page per view and re-reads on navigation, so there is nothing to guard. Post-V1 candidate only if a background poller is added. |
| GET | /api/catalog/artworks/selections/ | `CatalogService.artworkSelections` | `catalogue/CatalogueController.ts`, `catalogue/useCuratedCount.ts` | Integrated | Phase 1: `selection_name` read for the chip label (G-P24-1). |
| GET | /api/catalog/artworks/{id}/ | `CatalogService.artwork` | `catalogue/ArtworkCache.ts`, `catalogue/ArtworkDetailPage.tsx` | Integrated |  |
| GET | /api/catalog/legacy-lookup/ | none | — | Excluded (not V1: no legacy-link route) | Resolving old Darz/Airtable deep links needs a redirect route the approved app does not have; post-V1 candidate if such links are still in circulation (owner call). |
| GET | /api/catalog/selections/ | none | — | Excluded (owner-deferred, API ready) | G-P24-2 (Q-5, V1 Phase 9a), V1 Phase 9a. Collector's named curated selections + change signal — no binding (FE uses `/catalog/artworks/selections/`). |
| POST | /api/catalog/selections/{id}/seen/ | none | — | Excluded (owner-deferred, API ready) | G-P24-2, V1 Phase 9a. Mark selection seen — no binding. |

## crm

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| GET | /api/crm/activity/ | none | — | Excluded (owner-deferred, API ready) | G-P5-12, V1 Phase 9a. Collector's own activity list — no binding (POST is bound). |
| POST | /api/crm/activity/ | `CrmService.logActivity` | `activity/ActivityLogger.ts` | Integrated |  |
| GET | /api/crm/admin/activity/ | `CrmService.adminActivity` | `admin/ActivityFeedController.ts` | Integrated | All schema filters sent-capable. |
| POST | /api/crm/admin/messages/{id}/archive/ | `CrmService.adminArchiveMessage` | `admin/AdminThreadController.ts`, `admin/AdminThreadPage.tsx` | Integrated | Phase 6: Archive/Restore per bubble; sends `{archived}` both ways (G-CHAT-2). |
| GET | /api/crm/admin/requests/ | `CrmService.adminRequests` | `admin/AdminRequestsController.ts` | Integrated | All schema filters in AdminRequestQuery. |
| GET | /api/crm/admin/requests/{id}/messages/ | `CrmService.adminMessages` | `admin/AdminThreadController.ts` | Integrated | Phase 6: `?include_archived=true` sent by the "Include archived" switch. |
| POST | /api/crm/admin/requests/{id}/messages/ | `CrmService.adminPostMessage` | `admin/AdminThreadController.ts`, `admin/DocumentAttach.tsx` | Integrated | Phase 6: `document_refs` sent when a document is attached (D19, `messagePayload`). |
| POST | /api/crm/admin/requests/{id}/messages/mark-seen/ | `CrmService.adminMarkSeen` | `admin/AdminThreadController.ts` | Integrated |  |
| POST | /api/crm/admin/requests/{id}/transition/ | `CrmService.transitionRequest` | `admin/AdminRequestsController.ts`, `admin/AdminRequestsPage.tsx` | Integrated |  |
| GET | /api/crm/admin/selections/ | `CrmService.adminSelections` | `admin/ClubPage.tsx` | Integrated |  |
| POST | /api/crm/admin/selections/ | `CrmService.createSelection` | `admin/ClubPage.tsx` | Integrated |  |
| GET | /api/crm/admin/selections/{id}/ | none | — | Not needed (list rows suffice) | The Club desk edits from the list row. |
| PATCH | /api/crm/admin/selections/{id}/ | `CrmService.updateSelection` | `admin/ClubPage.tsx` | Integrated |  |
| DELETE | /api/crm/admin/selections/{id}/ | `CrmService.deleteSelection` | `admin/ClubPage.tsx` | Integrated |  |
| GET | /api/crm/requests/ | `CrmService.requests` | `conversations/ConversationsController.ts` | Integrated | `?archived` unsent (CollectorRequestQuery lacks it). |
| POST | /api/crm/requests/ | `CrmService.createRequest` | `conversations/ConversationsController.ts`, `requests/RequestController.ts` | Integrated | V1 Phase 9a (G-P5-11): an artist enquiry sends `artist`. |
| GET | /api/crm/requests/{id}/ | `CrmService.request` | `conversations/ConversationsController.ts` | Integrated |  |
| POST | /api/crm/requests/{id}/archive/ | none | — | Excluded (owner-deferred, API ready) | G-P5-4, V1 Phase 9a. Collector archive request — no binding. |
| GET | /api/crm/requests/{id}/messages/ | `CrmService.messages` | `conversations/ThreadController.ts` | Integrated |  |
| POST | /api/crm/requests/{id}/messages/ | `CrmService.postMessage` | `conversations/ThreadController.ts` | Integrated | Phase 6: `document_refs` is team-only (the backend 400s a collector's), so the collector end correctly never sends it; the enriched refs are READ and drawn as chips (`chat/DocChips.tsx`). |
| POST | /api/crm/requests/{id}/messages/mark-seen/ | `CrmService.markSeen` | `conversations/ThreadController.ts` | Integrated |  |
| POST | /api/crm/requests/{id}/transition/ | none | — | Excluded (owner-deferred, API ready) | G-P5-5, V1 Phase 9a. Collector-side transition — no binding. |
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
| GET | /api/auctions/records/highlights/ | none | — | Excluded (not V1: old app hides Highlights) | The old app hard-hides its Highlights tab (app.html:463, :2979); the admin Records desk manages `is_highlight` on the list. |
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
| GET | /api/accounting/admin/deals/{id}/attachments/ | `AccountingAdminService.dealAttachments` | bound-unused | Not needed (embedded in the deal payload) | `dealAttachments()` bound, never called; the deal editor reads `attachments` off the deal read. |
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
| GET | /api/documents/admin/documents/{id}/activity/ | `DocumentsAdminService.activity` | `admin/DocumentHistory.tsx` | Integrated | Phase 6: the document's History section (G-DOC-2, flat actor C-15). |
| POST | /api/documents/admin/documents/{id}/archive/ | `DocumentsAdminService.archiveDocument` | `admin/DocumentDetailPage.tsx` | Integrated |  |
| POST | /api/documents/admin/documents/{id}/confirm/ | `DocumentsAdminService.confirmDocument` | `admin/DocumentDetailPage.tsx`, `admin/projects/ProjectProposal.tsx` | Integrated |  |
| POST | /api/documents/admin/documents/{id}/share/ | `DocumentsAdminService.shareDocument` | `admin/DocumentDetailPage.tsx` | Integrated | Phase 6: "Share with collector" (G-DOC-1). |
| DELETE | /api/documents/admin/documents/{id}/share/ | `DocumentsAdminService.unshareDocument` | `admin/DocumentDetailPage.tsx` | Integrated | Phase 6: "Stop sharing". |
| POST | /api/documents/admin/documents/{id}/sign/ | `DocumentsAdminService.signDocument` | `admin/DocumentDetailPage.tsx` | Integrated |  |
| POST | /api/documents/admin/documents/{id}/upload/ | `DocumentsAdminService.uploadPdf` | `admin/DocumentDetailPage.tsx`, `admin/projects/ProjectProposal.tsx` | Integrated |  |
| GET | /api/documents/admin/documents/{id}/versions/ | `DocumentsAdminService.versions` | `admin/DocumentDetailPage.tsx` | Integrated |  |
| GET | /api/documents/public/{kind}/ | `PublicDocumentsService.byKind` | `settings/useLegalLinks.ts` | Integrated | Phase 1 (2026-09-25): Settings › LEGAL links use the PDF of `legal_terms` / `legal_privacy` / `legal_auction` when published, else the public-site URL (only `legal_terms` is a backend-documented kind). |

## gallery

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| GET | /api/gallery/admin/exhibition-catalogue/ | `GalleryAdminService.exhibitionCatalogue` | `admin/ExhibitionCatalogPage.tsx`, `admin/ExhibitionComposePage.tsx` | Integrated | V1 Phase 5 (2026-09-25): the Service checklist desk (paged) and the compose menu (walked, active rows) — G-PORT-12b. |
| POST | /api/gallery/admin/exhibition-catalogue/ | `GalleryAdminService.createExhibitionCatalogueItem` | `admin/ExhibitionCatalogPage.tsx` | Integrated | V1 Phase 5 (2026-09-25): + Add service (key/title/description/default_price/position/is_active). |
| GET | /api/gallery/admin/exhibition-catalogue/{id}/ | none | — | Not needed (list rows suffice) | The Exhibition Services desk (V1 Phase 5) edits from the list row. |
| PATCH | /api/gallery/admin/exhibition-catalogue/{id}/ | `GalleryAdminService.updateExhibitionCatalogueItem` | `admin/ExhibitionCatalogPage.tsx` | Integrated | V1 Phase 5 (2026-09-25): locked (`expected_version`, `optimisticLock.test.ts`), key never sent; 409 → ConflictBanner; Turn off/on = `is_active`. |
| DELETE | /api/gallery/admin/exhibition-catalogue/{id}/ | `GalleryAdminService.deleteExhibitionCatalogueItem` | `admin/ExhibitionCatalogPage.tsx` | Integrated | V1 Phase 5 (2026-09-25): ✕ with a confirm (the old row's remove). |
| GET | /api/gallery/admin/exhibitions/ | `GalleryAdminService.exhibitions` | `admin/ExhibitionsQueue.tsx`, `admin/SourceExhibitions.tsx`, `admin/exhibitions/IssueDocumentPage.tsx` | Integrated | All schema filters (`link, published, request_status`) in ExhibitionQuery. |
| GET | /api/gallery/admin/exhibitions/{id}/ | `GalleryAdminService.exhibition` | `admin/ExhibitionComposePage.tsx` | Integrated |  |
| PATCH | /api/gallery/admin/exhibitions/{id}/ | `GalleryAdminService.updateExhibition` | bound-unused | Not needed (compose carries the admin fields) | `GalleryAdminService.updateExhibition` bound, never called: `compose/` writes currency, discount, admin note and approval; the show fields are gallery-owned and read-only on the desk (ExhibitionComposePage.tsx "gallery-owned — edited from the portal"). |
| DELETE | /api/gallery/admin/exhibitions/{id}/ | `GalleryAdminService.deleteExhibition` | bound-unused | Excluded (not V1: no delete in the old panel) | `deleteExhibition` bound, deliberately unused — a delete button would invent a destructive action (service comment). |
| POST | /api/gallery/admin/exhibitions/{id}/compose/ | `GalleryAdminService.composeExhibition` | `admin/ExhibitionComposePage.tsx`, `admin/exhibitions/IssueDocumentPage.tsx` | Integrated |  |
| GET | /api/gallery/admin/exhibitions/{id}/documents/ | `GalleryAdminService.exhibitionDocuments` | `admin/ExhibitionComposePage.tsx`, `admin/SourceDocuments.tsx` | Integrated |  |
| POST | /api/gallery/admin/exhibitions/{id}/documents/ | `GalleryAdminService.createExhibitionDocument` | `admin/exhibitions/IssueDocumentPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/exhibitions/{id}/documents/{document_id}/confirm/ | `GalleryAdminService.confirmExhibitionDocument` | `admin/exhibitions/IssueDocumentPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/exhibitions/{id}/documents/{document_id}/sign/ | `GalleryAdminService.signExhibitionDocument` | `admin/ExhibitionComposePage.tsx` | Integrated |  |
| POST | /api/gallery/admin/exhibitions/{id}/documents/{document_id}/upload/ | `GalleryAdminService.uploadExhibitionDocumentPdf` | `admin/exhibitions/IssueDocumentPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/exhibitions/{id}/publish/ | `GalleryAdminService.publishExhibition` | `admin/ExhibitionComposePage.tsx` | Integrated |  |
| GET | /api/gallery/admin/links/ | `GalleryAdminService.links` | `admin/SourcesPage.tsx`, `admin/exhibitions/IssueDocumentPage.tsx` | Integrated | V1 Phase 5: `?search` sent — the partner search is server-side (G-PORT-15). |
| POST | /api/gallery/admin/links/ | `GalleryAdminService.issueLink` | `admin/SourcesPage.tsx` | Integrated |  |
| GET | /api/gallery/admin/links/{id}/ | `GalleryAdminService.link` | `admin/ExhibitionComposePage.tsx`, `admin/SourceDetailPage.tsx` | Integrated |  |
| DELETE | /api/gallery/admin/links/{id}/ | none | — | Not needed (reissue covers the old delete) | The old panel deletes a link only inside "Regenerate" (darz-studio.html:38605-38611), which `links/{id}/reissue/` replaces; there is no standalone delete, and Disable covers "stop this link". |
| POST | /api/gallery/admin/links/{id}/disable/ | `GalleryAdminService.disableLink` | `admin/SourceDetailPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/links/{id}/enable/ | `GalleryAdminService.enableLink` | `admin/SourceDetailPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/links/{id}/features/ | `GalleryAdminService.setLinkFeatures` | `admin/SourceDetailPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/links/{id}/reissue/ | `GalleryAdminService.reissueLink` | `admin/SourceDetailPage.tsx` | Integrated | V1 Phase 5 (2026-09-25): "Regenerate" (old confirm); pair shown once in `SourceCredentials.tsx`; status untouched — G-PORT-13. |
| GET | /api/gallery/admin/links/{link_pk}/artworks/ | `GalleryAdminService.linkArtworks` | `admin/SourceDetailPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/links/{link_pk}/artworks/ | `GalleryAdminService.assignArtwork` | `admin/SourceDetailPage.tsx` | Integrated |  |
| DELETE | /api/gallery/admin/links/{link_pk}/artworks/{id}/ | `GalleryAdminService.removeArtwork` | `admin/SourceDetailPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/links/{link_pk}/artworks/{id}/funnel/ | `GalleryAdminService.setFunnelOverride` | `admin/SourceDetailPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/links/{link_pk}/exhibitions/ | `GalleryAdminService.createExhibitionForLink` | `admin/SourceExhibitions.tsx` | Integrated |  |
| GET | /api/gallery/admin/links/{link_pk}/messages/ | `GalleryAdminService.linkMessages` | `admin/SourceExhibitions.tsx` | Integrated |  |
| POST | /api/gallery/admin/links/{link_pk}/messages/ | `GalleryAdminService.sendLinkMessage` | `admin/SourceExhibitions.tsx` | Integrated |  |
| GET | /api/gallery/admin/links/{link_pk}/pricelists/ | `GalleryAdminService.linkPricelists` | `admin/SourceDocuments.tsx` | Integrated |  |
| GET | /api/gallery/admin/links/{link_pk}/pricelists/cap/ | `GalleryAdminService.pricelistCap` | `admin/SourceDocuments.tsx` | Integrated | V1 Phase 5 (2026-09-25): advisory line + "n of a soft cap of m". |
| POST | /api/gallery/admin/pricelists/{id}/status/ | `GalleryAdminService.setPricelistStatus` | `admin/SourceDocuments.tsx` | Integrated | V1 Phase 5 (2026-09-25): "Mark …" buttons; the list is re-read after each (C-21). |
| GET | /api/gallery/admin/updates/ | `GalleryAdminService.updates` | `admin/SourcesPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/updates/{id}/approve/ | `GalleryAdminService.approveUpdate` | `admin/SourcesPage.tsx` | Integrated |  |
| POST | /api/gallery/admin/updates/{id}/reject/ | `GalleryAdminService.rejectUpdate` | `admin/SourcesPage.tsx` | Integrated |  |
| GET | /api/gallery/portal/{token}/ | `GalleryPortalService.state` | `portal/PortalSession.ts` | Integrated | `?pin` sent. V1 Phase 5: hand-typed `PortalState` (C-8) read through `normalisePortalState`; `image_url`, `cover`, `updates[]` (Sent pills, Pending review, History), pricelist `status`/`file_url`/`lines` all rendered. |
| POST | /api/gallery/portal/{token}/artworks/{artwork_pk}/image/ | `GalleryPortalService.replaceImage` | `portal/PortalWorks.tsx`, `portal/PortalSession.ts` | Integrated | V1 Phase 5 (2026-09-25): multipart, `pin` as a form part (schema says query — C-9, pinned in `galleryPortalService.test.ts`) — G-PORT-1. |
| GET | /api/gallery/portal/{token}/exhibitions/ | `GalleryPortalService.exhibitions` | `portal/PortalSession.ts` | Integrated | Called by PortalSession.loadExhibitions. |
| POST | /api/gallery/portal/{token}/exhibitions/ | `GalleryPortalService.createExhibition` | `portal/PortalExhibitions.tsx`, `portal/PortalSession.ts` | Integrated |  |
| GET | /api/gallery/portal/{token}/exhibitions/catalogue/ | `GalleryPortalService.exhibitionCatalogue` | `portal/PortalSession.ts` | Integrated | Called by PortalSession.loadExhibitions. |
| GET | /api/gallery/portal/{token}/exhibitions/{event_id}/ | none | — | Not needed (embedded in portal state) | The portal exhibitions list carries every show in full. |
| PATCH | /api/gallery/portal/{token}/exhibitions/{event_id}/ | `GalleryPortalService.updateExhibition` | bound-unused (`portal/PortalSession.ts` wrapper only) | Bound, no UI | FE gap: the old portal's "Save draft" of a ticked selection (gallery-update.html:1551 `exhSaveDraft`) is not built — "Send to Darz" writes the selection with the submit. `PortalSession.updateExhibition` exists, no component calls it. |
| POST | /api/gallery/portal/{token}/exhibitions/{event_id}/documents/{document_id}/sign/ | `GalleryPortalService.signExhibitionDocument` | `portal/PortalExhibitions.tsx`, `portal/PortalSession.ts` | Integrated |  |
| POST | /api/gallery/portal/{token}/exhibitions/{event_id}/submit/ | `GalleryPortalService.submitExhibition` | `portal/PortalExhibitions.tsx`, `portal/PortalSession.ts` | Integrated |  |
| GET | /api/gallery/portal/{token}/messages/ | none | — | Not needed (embedded in portal state) | The thread arrives inside `GET portal/{token}/`. |
| POST | /api/gallery/portal/{token}/messages/ | `GalleryPortalService.sendMessage` | `portal/PortalMessages.tsx`, `portal/PortalSession.ts` | Integrated |  |
| POST | /api/gallery/portal/{token}/pricelists/ | `GalleryPortalService.uploadPricelist` | `portal/PortalPricelists.tsx`, `portal/PortalSession.ts` | Integrated |  |
| POST | /api/gallery/portal/{token}/pricelists/build/ | `GalleryPortalService.buildPricelist` | `portal/PortalPricelists.tsx`, `portal/PortalSession.ts` | Integrated | V1 Phase 5 (2026-09-25): the in-portal builder; `pin` in the JSON body (C-9); per-line errors from `details.lines`. |
| GET | /api/gallery/portal/{token}/status/ | none | — | Not needed (embedded in portal state) | Funnel status arrives inside `GET portal/{token}/`. |
| POST | /api/gallery/portal/{token}/updates/ | `GalleryPortalService.submitUpdate` | `portal/PortalSession.ts`, `portal/PortalWorks.tsx` | Integrated |  |

## projects

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| GET | /api/projects/admin/checklists/ | `ProjectsAdminService.checklists` | `admin/projects/PackagesPage.tsx`, `admin/projects/ProjectsReportsPage.tsx` | Integrated |  |
| POST | /api/projects/admin/checklists/ | `ProjectsAdminService.createChecklist` | `admin/projects/PackagesPage.tsx`, `admin/projects/ProjectsReportsPage.tsx` | Integrated |  |
| GET | /api/projects/admin/checklists/{id}/ | `ProjectsAdminService.checklist` | bound-unused | Not needed (list rows suffice) | `ProjectsAdminService.checklist` bound, never called; the checklist desk edits from the list row. |
| PATCH | /api/projects/admin/checklists/{id}/ | `ProjectsAdminService.updateChecklist` | `admin/projects/ProjectsReportsPage.tsx` | Integrated |  |
| DELETE | /api/projects/admin/checklists/{id}/ | `ProjectsAdminService.deleteChecklist` | `admin/projects/ProjectsReportsPage.tsx` | Integrated |  |
| GET | /api/projects/admin/packages/ | `ProjectsAdminService.packages` | `admin/exhibitions/ExhibitionServicesPage.tsx`, `admin/exhibitions/IssueDocumentPage.tsx`, `admin/projects/PackagesPage.tsx` | Integrated |  |
| POST | /api/projects/admin/packages/ | `ProjectsAdminService.createPackage` | `admin/projects/PackageEditorPage.tsx`, `admin/projects/PackagesPage.tsx` | Integrated |  |
| GET | /api/projects/admin/packages/{id}/ | `ProjectsAdminService.packageTemplate` | `admin/projects/PackageEditorPage.tsx`, `admin/projects/ProjectProposal.tsx`, `admin/projects/ProjectReportPage.tsx` | Integrated |  |
| PATCH | /api/projects/admin/packages/{id}/ | `ProjectsAdminService.updatePackage` | `admin/projects/PackageEditorPage.tsx`, `admin/projects/PackagesPage.tsx` | Integrated |  |
| DELETE | /api/projects/admin/packages/{id}/ | `ProjectsAdminService.deletePackage` | `admin/projects/PackagesPage.tsx` | Integrated |  |
| GET | /api/projects/admin/partners/ | `ProjectsAdminService.partners` | `admin/projects/NewProjectPage.tsx`, `admin/projects/ProjectPage.tsx`, `admin/projects/ProjectPartnersPage.tsx`, `admin/projects/ProjectReportPage.tsx` | Integrated |  |
| POST | /api/projects/admin/partners/ | `ProjectsAdminService.createPartner` | `admin/projects/ProjectPartnersPage.tsx` | Integrated |  |
| GET | /api/projects/admin/partners/{id}/ | `ProjectsAdminService.partner` | bound-unused | Not needed (list rows suffice) | `ProjectsAdminService.partner` bound, never called; the Partners desk edits from the list row. |
| PATCH | /api/projects/admin/partners/{id}/ | `ProjectsAdminService.updatePartner` | `admin/projects/ProjectPartnersPage.tsx` | Integrated |  |
| DELETE | /api/projects/admin/partners/{id}/ | `ProjectsAdminService.deletePartner` | `admin/projects/ProjectPartnersPage.tsx` | Integrated |  |
| GET | /api/projects/admin/projects/ | `ProjectsAdminService.projects` | `admin/projects/ProjectsDashboardPage.tsx`, `admin/projects/ProjectsListPage.tsx`, `admin/projects/ProjectsReportsPage.tsx`, `admin/projects/projectForm.ts` | Integrated | V1 Phase 7: `?quick` sent by the List's quick cards (`approval` → `awaiting_approval`; "Deliverables ≤7d" has no server filter and still walks). `?partner` typed in `ProjectQuery`, deliberately unsent (the Partners desk counts off its one walk; the filter skips lane-only orgs). `archived` sent as True/False. |
| POST | /api/projects/admin/projects/ | `ProjectsAdminService.createProject` | `admin/projects/NewProjectPage.tsx` | Integrated |  |
| GET | /api/projects/admin/projects/dashboard/ | `ProjectsAdminService.dashboard` | `admin/projects/ProjectsDashboardPage.tsx` | Integrated |  |
| GET | /api/projects/admin/projects/reports/ | `ProjectsAdminService.reports` | `admin/projects/ProjectsReportsPage.tsx` | Integrated |  |
| GET | /api/projects/admin/projects/{id}/ | `ProjectsAdminService.project` | `admin/projects/ProjectPage.tsx`, `admin/projects/ProjectReportPage.tsx` | Integrated |  |
| PATCH | /api/projects/admin/projects/{id}/ | `ProjectsAdminService.updateProject` | `admin/projects/PackageEditorPage.tsx`, `admin/projects/PackagesPage.tsx`, `admin/projects/ProjectPage.tsx`, `admin/projects/ProjectPipelinePage.tsx`, `admin/projects/ProjectsCalculatorPage.tsx` | Integrated | V1 Phase 7: also `status` (G-PROJ-2), `stages` (the stage-move seeding, G-PROJ-3) and the four `deal_*` FX fields (G-PROJ-9); lock pinned in `optimisticLock.test.ts`. |
| DELETE | /api/projects/admin/projects/{id}/ | `ProjectsAdminService.deleteProject` | `admin/projects/ProjectPage.tsx` | Integrated |  |
| POST | /api/projects/admin/projects/{id}/stage/ | `ProjectsAdminService.setStage` | `admin/projects/ProjectPage.tsx`, `admin/projects/ProjectPipelinePage.tsx` | Integrated |  |
| GET | /api/projects/admin/projects/{id}/totals/ | `ProjectsAdminService.totals` | `admin/projects/ProjectPage.tsx` | Integrated | V1 Phase 7 (G-PROJ-9): the record's Money totals (owner only); decimal strings rendered without float maths, `"unknown"` bucket labelled, converted row only when `fx` is served (C-22). |
| GET | /api/projects/admin/projects/{project_pk}/attachments/ | `ProjectsAdminService.attachments` | `admin/projects/ProjectPage.tsx` | Integrated |  |
| POST | /api/projects/admin/projects/{project_pk}/attachments/ | `ProjectsAdminService.uploadAttachment` | `admin/projects/ProjectPage.tsx` | Integrated |  |
| DELETE | /api/projects/admin/projects/{project_pk}/attachments/{id}/ | `ProjectsAdminService.deleteAttachment` | `admin/projects/ProjectPage.tsx` | Integrated |  |
| GET | /api/projects/admin/service-catalog/ | `ProjectsAdminService.services` | `admin/ExhibitionComposePage.tsx`, `admin/exhibitions/ExhibitionServicesPage.tsx`, `admin/exhibitions/IssueDocumentPage.tsx`, `admin/projects/ProjectProposal.tsx`, `admin/projects/ProjectReportPage.tsx`, `admin/projects/projectForm.ts` | Integrated |  |
| POST | /api/projects/admin/service-catalog/ | `ProjectsAdminService.createService` | `admin/exhibitions/ExhibitionServicesPage.tsx`, `admin/projects/PackagesPage.tsx` | Integrated |  |
| GET | /api/projects/admin/service-catalog/{id}/ | `ProjectsAdminService.service` | bound-unused | Not needed (list rows suffice) | `ProjectsAdminService.service` bound, never called; the Packages/services desk edits from the list row. |
| PATCH | /api/projects/admin/service-catalog/{id}/ | `ProjectsAdminService.updateService` | `admin/exhibitions/ExhibitionServicesPage.tsx`, `admin/projects/PackagesPage.tsx` | Integrated |  |
| DELETE | /api/projects/admin/service-catalog/{id}/ | `ProjectsAdminService.deleteService` | `admin/exhibitions/ExhibitionServicesPage.tsx`, `admin/projects/PackagesPage.tsx` | Integrated |  |

## recommendations

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| GET | /api/recommendations/admin/artworks/{artwork_pk}/tags/ | none | — | Excluded (not V1: G-6 owner-deferred) | Intelligence desk (Q-8) — no FE binding, API ready. |
| POST | /api/recommendations/admin/artworks/{artwork_pk}/tags/ai/ | none | — | Excluded (not V1: G-6 owner-deferred) | Intelligence desk (Q-8) — no FE binding, API ready. |
| POST | /api/recommendations/admin/artworks/{artwork_pk}/tags/auto/ | none | — | Excluded (not V1: G-6 owner-deferred) | Intelligence desk (Q-8) — no FE binding, API ready. |
| POST | /api/recommendations/admin/batches/{id}/publish/ | none | — | Excluded (not V1: G-6 owner-deferred) | Intelligence desk (Q-8) — no FE binding, API ready. |
| POST | /api/recommendations/admin/batches/{id}/unpublish/ | none | — | Excluded (not V1: G-6 owner-deferred) | Intelligence desk (Q-8) — no FE binding, API ready. |
| GET | /api/recommendations/admin/collectors/{collector_pk}/batches/ | none | — | Excluded (not V1: G-6 owner-deferred) | Intelligence desk (Q-8) — no FE binding, API ready. |
| POST | /api/recommendations/admin/collectors/{collector_pk}/batches/ | none | — | Excluded (not V1: G-6 owner-deferred) | Intelligence desk (Q-8) — no FE binding, API ready. |
| GET | /api/recommendations/admin/collectors/{collector_pk}/preferences/ | none | — | Excluded (not V1: G-6 owner-deferred) | Intelligence desk (Q-8) — no FE binding, API ready. |
| POST | /api/recommendations/admin/collectors/{collector_pk}/preferences/rebuild/ | none | — | Excluded (not V1: G-6 owner-deferred) | Intelligence desk (Q-8) — no FE binding, API ready. |
| GET | /api/recommendations/admin/collectors/{collector_pk}/recommendations/ | none | — | Excluded (not V1: G-6 owner-deferred) | Intelligence desk (Q-8) — no FE binding, API ready. |
| POST | /api/recommendations/admin/collectors/{collector_pk}/recommendations/generate/ | none | — | Excluded (not V1: G-6 owner-deferred) | Intelligence desk (Q-8) — no FE binding, API ready. |
| GET | /api/recommendations/admin/feature-settings/ | none | — | Excluded (not V1: G-6 owner-deferred) | Intelligence desk (Q-8) — no FE binding, API ready. |
| POST | /api/recommendations/admin/feature-settings/ | none | — | Excluded (not V1: G-6 owner-deferred) | Intelligence desk (Q-8) — no FE binding, API ready. |
| GET | /api/recommendations/admin/question-sets/ | none | — | Excluded (owner-deferred, API ready) | G-P25-2(b), the admin question-set editor desk; V1 Phase 9a. |
| POST | /api/recommendations/admin/question-sets/ | none | — | Excluded (owner-deferred, API ready) | G-P25-2(b), the admin question-set editor desk; V1 Phase 9a. |
| GET | /api/recommendations/admin/question-sets/{id}/ | none | — | Excluded (owner-deferred, API ready) | G-P25-2(b), the admin question-set editor desk; V1 Phase 9a. |
| PATCH | /api/recommendations/admin/question-sets/{id}/ | none | — | Excluded (owner-deferred, API ready) | G-P25-2(b), the admin question-set editor desk; V1 Phase 9a. |
| DELETE | /api/recommendations/admin/question-sets/{id}/ | none | — | Excluded (owner-deferred, API ready) | G-P25-2(b), the admin question-set editor desk; V1 Phase 9a. |
| POST | /api/recommendations/admin/question-sets/{id}/activate/ | none | — | Excluded (owner-deferred, API ready) | G-P25-2(b), the admin question-set editor desk; V1 Phase 9a. |
| PATCH | /api/recommendations/admin/recommendations/{id}/ | none | — | Excluded (not V1: G-6 owner-deferred) | Intelligence desk (Q-8) — no FE binding, API ready. |
| DELETE | /api/recommendations/admin/recommendations/{id}/ | none | — | Excluded (not V1: G-6 owner-deferred) | Intelligence desk (Q-8) — no FE binding, API ready. |
| POST | /api/recommendations/admin/tags/{id}/approve/ | none | — | Excluded (not V1: G-6 owner-deferred) | Intelligence desk (Q-8) — no FE binding, API ready. |
| POST | /api/recommendations/admin/tags/{id}/lock/ | none | — | Excluded (not V1: G-6 owner-deferred) | Intelligence desk (Q-8) — no FE binding, API ready. |
| GET | /api/recommendations/published/ | `RecommendationService.published` | bound-unused | Excluded (not V1: G-6 owner-deferred) | "Curated for you" feed (Q-8). `RecommendationService.published` bound, never called. |
| POST | /api/recommendations/published/{id}/dismiss/ | `RecommendationService.dismiss` | bound-unused | Excluded (not V1: G-6 owner-deferred) | "Curated for you" dismiss (Q-8). `RecommendationService.dismiss` bound, never called. |
| GET | /api/recommendations/question-set/ | `RecommendationService.questionSet` | `questionnaire/QuestionnaireController.ts` | Integrated | V1 Phase 9a (G-P25-2(a)): the questionnaire runs on the served set; the empty shape (`id: null`) or a failed read falls back to the built-in bank (`questions.ts`). |
| GET | /api/recommendations/questionnaire/ | `RecommendationService.questionnaire` | `profile/ProfilePage.tsx`, `questionnaire/QuestionnaireController.ts` | Integrated |  |
| POST | /api/recommendations/questionnaire/ | `RecommendationService.submitQuestionnaire` | `questionnaire/QuestionnaireController.ts` | Integrated |  |

## notifications

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| POST | /api/notifications/push/subscribe/ | none | — | Excluded (owner-deferred, API ready) | G-P13-1, V1 Phase 9a. Web-push subscribe — no binding, no service worker in FE. |
| POST | /api/notifications/push/unsubscribe/ | none | — | Excluded (owner-deferred, API ready) | G-P13-1, V1 Phase 9a. Web-push unsubscribe — no binding. |
| GET | /api/notifications/vapid-public-key/ | none | — | Excluded (owner-deferred, API ready) | G-P13-1, V1 Phase 9a. VAPID key for web-push — no binding. |

## marketing

| Method | Path | FE binding | UI caller(s) | Status | Unsent params / notes |
|---|---|---|---|---|---|
| GET | /api/marketing/admin/campaigns/ | none | — | Excluded (not V1: G-6 owner-deferred) | Marketing Hub (Q-8) — no FE service, API ready. |
| POST | /api/marketing/admin/campaigns/ | none | — | Excluded (not V1: G-6 owner-deferred) | Marketing Hub (Q-8) — no FE service, API ready. |
| POST | /api/marketing/admin/campaigns/generate-copy/ | none | — | Excluded (not V1: G-6 owner-deferred) | Marketing Hub (Q-8) — no FE service, API ready. |
| GET | /api/marketing/admin/campaigns/{campaign_pk}/analytics/ | none | — | Excluded (not V1: G-6 owner-deferred) | Marketing Hub (Q-8) — no FE service, API ready. |
| POST | /api/marketing/admin/campaigns/{campaign_pk}/analytics/ | none | — | Excluded (not V1: G-6 owner-deferred) | Marketing Hub (Q-8) — no FE service, API ready. |
| DELETE | /api/marketing/admin/campaigns/{campaign_pk}/analytics/{id}/ | none | — | Excluded (not V1: G-6 owner-deferred) | Marketing Hub (Q-8) — no FE service, API ready. |
| GET | /api/marketing/admin/campaigns/{id}/ | none | — | Excluded (not V1: G-6 owner-deferred) | Marketing Hub (Q-8) — no FE service, API ready. |
| PATCH | /api/marketing/admin/campaigns/{id}/ | none | — | Excluded (not V1: G-6 owner-deferred) | Marketing Hub (Q-8) — no FE service, API ready. |
| DELETE | /api/marketing/admin/campaigns/{id}/ | none | — | Excluded (not V1: G-6 owner-deferred) | Marketing Hub (Q-8) — no FE service, API ready. |

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

## Summary — final V1 state (V1 Phase 10, 2026-09-26)

**Re-verified against the code, not the docs.** A script parsed every binding out of `src/api/services.ts`
(each class's `basePath` + the path of every `list/retrieve/create/remove/client.send[Enveloped]` call,
incl. `GalleryPortalService` on `PortalClient`) plus `AuthSession.ts`: **271 bindings, 0 dangling** (every
one matches a backend operation). A UI caller is a `.method(` call in `src/` outside `src/api` and tests
(`ThemeService.publicTheme` is called from `src/api/ApiProvider.tsx`, counted as UI); the 16 method names that
exist on two services (`auctions`, `lots`, `records`, `artists`, `summary`, `exhibitions`, …) were resolved
by receiver type by hand. Result: every one of the 261 **Integrated** rows has a binding and a UI caller; no
Integrated row was wrong. What changed in Phase 10 is the vocabulary of the other 62 rows — every one now
carries a final status and a one-line reason, and **no "Not bound" row remains**:

- 9 **Bound, no UI** → 1 kept (portal exhibition PATCH — a real FE gap, the old "Save draft"), 5 **Not
  needed** (three single reads, deal attachments embedded in the deal, the admin exhibition PATCH that
  `compose/` supersedes), 1 **Excluded** (admin exhibition DELETE — no delete in the old panel), 2
  **Excluded (G-6)** (`recommendations/published/` + `dismiss/`).
- 38 **Not bound** → 26 **Excluded (G-6)** (17 recommendations-admin/Intelligence + 9 Marketing Hub),
  10 **Not needed** (5 single reads where list rows suffice, 3 portal reads embedded in the state, link
  DELETE covered by reissue, the catalogue change-stamp), 2 **Excluded** (legacy-id lookup, records highlights).
- The 14 owner-deferred rows keep their status, now spelled in full.

Count (scripted — `awk -F'|' '/^\| (GET|POST|PATCH|PUT|DELETE) /{gsub(/^ +| +$/,"",$6); print $6}' API_ADOPTION_MATRIX.md | sed 's/ (.*//' | sort | uniq -c`,
with the `Excluded (…)` pair split by hand):

| Status | Count |
|---|---|
| Integrated | 261 |
| Bound, no UI | 1 |
| Not bound | 0 |
| Excluded (owner-deferred, API ready) | 14 |
| Excluded (not V1: …) | 31 |
| Not needed (…) | 15 |
| Backend-only | 1 |
| **Total** | **323** |

Of the 31 "Excluded (not V1)": 28 G-6 owner-deferred (Intelligence 17 · Marketing 9 · Curated-for-you 2),
1 no delete in the old panel, 1 no legacy-link route, 1 old app hides Highlights.

### Bound, no UI (1)

- `PATCH /api/gallery/portal/{token}/exhibitions/{event_id}/` — the old portal's "Save draft" of a ticked
  services selection (gallery-update.html:1551 `exhSaveDraft`) is not built; "Send to Darz" writes the
  selection with the submit.

### Not needed (15)

- List rows suffice (8): `GET` membership-codes/{id}, team-users/{id}, catalog admin artists/{id}, crm admin
  selections/{id}, gallery admin exhibition-catalogue/{id}, projects checklists/{id}, partners/{id},
  service-catalog/{id} (the last three are bound, never called).
- Embedded in portal state (3): portal `GET messages/`, `GET status/`, `GET exhibitions/{event_id}/`.
- Embedded in the deal payload (1): `GET accounting/admin/deals/{id}/attachments/` (bound, never called).
- `compose/` carries the admin fields (1): `PATCH gallery/admin/exhibitions/{id}/` (bound, never called).
- Reissue covers the old delete (1): `DELETE gallery/admin/links/{id}/`.
- Server-paged catalogue (1): `GET catalog/artworks/change-stamp/`.

### Excluded (owner-deferred, API ready) (14)

- `GET /api/catalog/selections/` — G-P24-2
- `POST /api/catalog/selections/{id}/seen/` — G-P24-2
- `GET /api/crm/activity/` — G-P5-12
- `POST /api/crm/requests/{id}/archive/` — G-P5-4
- `POST /api/crm/requests/{id}/transition/` — G-P5-5
- `POST /api/notifications/push/subscribe/` — G-P13-1
- `POST /api/notifications/push/unsubscribe/` — G-P13-1
- `GET /api/notifications/vapid-public-key/` — G-P13-1
- `GET|POST /api/recommendations/admin/question-sets/`, `GET|PATCH|DELETE …/{id}/`, `POST …/{id}/activate/` — G-P25-2(b) (6)

### Excluded (not V1) (31)

- G-6 owner-deferred (Q-8), 28: every `recommendations/admin/*` operation except the question sets (17 —
  tags, batches, preferences, per-collector recommendations, feature settings); every `marketing/admin/*`
  operation (9); `GET recommendations/published/` + `POST …/{id}/dismiss/` (2, bound, never called).
- `DELETE gallery/admin/exhibitions/{id}/` — no delete in the old panel (bound, deliberately unused).
- `GET catalog/legacy-lookup/` — no legacy-link redirect route in the approved app.
- `GET auctions/records/highlights/` — the old app hard-hides its Highlights tab (app.html:463, :2979).

### Backend-only (1)

- `GET /api/health/` — liveness probe for infra/load balancer; no browser use.

### Notable unsent query params on integrated endpoints

- `GET /api/catalog/admin/artworks/` — `price_min, price_max, tag, refine_*` unsent (the old Database desk
  had no control for them).
- `GET /api/projects/admin/projects/` — `?partner` typed but unsent by decision (the Partners desk counts off
  its walk, which also sees lane-only orgs).
- `GET /api/auctions/records/` — `?house` typed but unsent by decision (the collector Records page is the
  Artist view).
- `GET /api/auth/admin/access-keys/` — `?collector` typed, unsent (the collector page reads its own keys).
- `GET /api/crm/requests/` — `?archived` unsent: belongs to G-P5-4 (owner-deferred).
- Sent since V1: admin artists `?search/?ordering` (Phase 4), links `?search` (Phase 5), thread
  `?include_archived` (Phase 6), projects `?quick` (Phase 7).

### History (per-phase moves, kept as the record)

Counts updated by V1 Phase 1 (2026-09-25): four operations moved from Not bound to Integrated —
`PATCH /api/auth/me/`, `GET /api/auth/my-membership/`, `GET /api/documents/`,
`GET /api/documents/public/{kind}/`. V1 Phase 2 (2026-09-25) moved five more — the sales
`summary/`, `DELETE …/sales/{id}/`, `…/follow-up/`, and `…/notes/` GET + POST. V1 Phase 3 (2026-09-25)
moved six Not bound (auction PATCH, archive, cover POST/DELETE, lot PATCH, registration reset) and one
Partial (auction create, now with terms) to Integrated. V1 Phase 4 (2026-09-25) moved one Not bound
(`GET /api/auth/admin/collectors/summary/`) to Integrated and sent the catalogue/collector params listed
below. V1 Phase 5 (2026-09-25) moved nine Not bound to Integrated — the exhibition-catalogue list,
create, PATCH and DELETE, link reissue, pricelist cap and status, the portal image upload and the portal
pricelist build — and sent `?search` on the links list. The portal's `GET messages/`, `GET status/` and
`GET exhibitions/{id}/` stay Not bound on purpose: the same data arrives in the state read (and the
exhibitions list), so a second read would only duplicate it. `GET exhibition-catalogue/{id}/` likewise
(list rows suffice). V1 Phase 6 (2026-09-25) moved four Not bound (document `activity/`, `share/` POST and
DELETE, crm message `archive/`) and both Partial thread POSTs to Integrated, and sent `?include_archived`
on the admin thread. V1 Phase 7 (2026-09-26) moved `GET …/projects/{id}/totals/` to Integrated. V1 Phase 8
(2026-09-26) moved two Not bound (`GET /api/auth/admin/access-keys/` and its `summary/`) to Integrated — the
owner Access desk. V1 Phase 9a (2026-09-26) moved `GET /api/recommendations/question-set/` to Integrated
(G-P25-2(a)) and marked fourteen Not bound operations **Excluded (owner-deferred, API ready)** — the owner's
Q-5 answer built only G-P5-11 and G-P25-2(a): G-P24-2 (`catalog/selections/` + `seen/`), G-P25-2(b) (the six
admin `question-sets` operations), G-P5-4 (`requests/{id}/archive/`), G-P5-5 (`requests/{id}/transition/`),
G-P5-12 (`GET crm/activity/`) and G-P13-1 (push subscribe/unsubscribe, `vapid-public-key`). G-CLUB-3 (the Club
"Auction access" section) and G-P5-9 (counter-offer display) are owner-deferred too, but have no unbound
operation of their own (the invite-only endpoints and the `counter_*` fields are already read). Status cells
elsewhere are the 2026-09-25 baseline unless a row says otherwise.

