# darz-web V1: implementation plan (phase by phase)

**Written 2026-09-25.** This file defines the target **darz-web V1** and the order in which to reach it. It
**supersedes `API_ADOPTION_PLAN.md` from its Batch 4 onward**; Batches 1–3 are done (#99) and are the base here.

Inputs, all measured on 2026-09-25 rather than copied from older docs:

| Input | Where |
| --- | --- |
| Backend V1 = `darz-backend-api` `development` @ `df0421f` (PR #70): **224 paths / 323 operations** | `docs/audit/2026-09-25/backend-v1-endpoints.txt` |
| Per-operation adoption state (225 integrated · 3 partial · 9 bound-no-UI · 85 not bound · 1 backend-only) | `docs/audit/2026-09-25/API_ADOPTION_MATRIX.md` |
| Panel/Admin desk-by-desk audit | `docs/audit/2026-09-25/ADMIN_AUDIT.md` |
| Collector app + gallery portal audit | `docs/audit/2026-09-25/COLLECTOR_AUDIT.md` |
| Backend contract review | `docs/audit/2026-09-25/BACKEND_CONTRACT_REVIEW.md` → summarised as `C-…` in **`V1_CONTRACT_ISSUES.md`** |
| Gap index | `API_GAPS.md` (state) · `API_GAPS_FRONTEND_ADOPTION.md` (per-gap adoption detail) |

Baseline gate on `development` @ `d987910`: typecheck ✅ · lint 0 ✅ · format ✅ · **636/636 unit** ✅ · build ✅.

---

## 1 · The rules for every phase

1. **Branch from the latest `development`.** Name it `v1/phase-N-<slug>` and open one PR per phase against
   `development`.
2. **Merging.** The 2026-09-25 brief asks for every phase to be merged into `development` before the next one
   starts. `CLAUDE.md` still requires the owner's per-request "merge it". So the PR is opened and the phase is
   *ready to merge*, and the merge happens on that instruction. Each phase is written to be mergeable on its
   own, and the next phase branches from `development` only after the merge. No long-lived branch holds
   several phases.
3. **Faithful port (`CLAUDE.md`).** Every new control is traced to `app.html` or the design package
   (`design/market-app/`). If the old app has no UI for a new API field, **flag it (owner question) instead of
   inventing it.** The IDs are in `V1_CONTRACT_ISSUES.md` § C.
4. **Reuse, don't duplicate.** Use `ResourceService` subclasses in `services.ts`, `useListController` +
   `DeskList` (`admin/kit`), `ConflictBanner`, `asArray`/`normalise*` (`shapes.ts`), `DeskBoundary`/`ScreenBoundary`,
   and labels from `/api/options/` via `useOptions`.
5. **The gate, run before every push:**
   `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build && npm run e2e`.
6. **Stub.** `e2e/stub-server.mjs` is updated **in the same PR** to the new shape, so E2E exercises the new API
   and not the old one (see the `HANDOFF.md` §4 "the stub was lying" trap).
7. **Render check.** Screenshot every touched screen in dark and light, at mobile and desktop widths, and
   compare with the design package capture or the `app.html` reading (`HANDOFF.md` §5). A behaviour change on a
   shipped screen still gets one.
8. **Docs in the same PR.** Flip the rows in `API_GAPS.md` and in `docs/audit/2026-09-25/API_ADOPTION_MATRIX.md`
   (status column), add one 3-line `CHANGELOG.md` entry, tick the phase in §5 below, and delete every stale
   on-screen "backend gap G-…" note the phase makes false.
9. **Locking.** Every PATCH to a locked endpoint sends `expected_version` (C-6), and every new locking call gets a
   wire-format case in `src/api/optimisticLock.test.ts`.

---

## 2 · V1 scope

For each module, **V1 = the old app's approved surface, bound to every backend V1 endpoint that serves it.**
The "Not V1" rows are excluded on purpose, with the reason recorded; they are not forgotten.

| Module | In V1 | Not V1 (reason) |
| --- | --- | --- |
| Collector: Market, artwork, artists, saved, records | ✅ | Insights & Stories (no backend, Phase 22) |
| Collector: Chat, requests, conversations | ✅ | Counter-offer display (Q-4, until the owner answers) |
| Collector: Profile, Settings, Membership, Questionnaire | ✅ incl. profile edit, documents and my-membership | Push opt-in (Q-5) |
| Collector: Auctions | ✅ (behind the `features.auctions` flag) | — |
| Gallery portal (`/portal/:token`) | ✅ incl. P1/P3a/P3b/P4 | Referral/Introduce (G-PORT-5), drawn signature (G-PORT-7), offer engine (G-PORT-8), formatted pricelist download (P3c): **no backend** |
| Admin: Requests, Chat, Dashboard | ✅ | AI Monitor, conversation assignee (no backend) |
| Admin: Catalogue (Database, editor, Artists, Import, Published, Data Health) | ✅ | PDF/image import intake (D15), bulk actions |
| Admin: Collectors, Club, Access Requests, Memberships | ✅ | "Notify collectors" (no admin push-send endpoint) |
| Admin: **Access desk** (G-KEY-1) | ✅ (Q-1 decides the role gate) | — |
| Admin: Sales (Market + **Auction Sales**) | ✅ | — |
| Admin: Auctions (Live, Records, Registrations) | ✅ | — |
| Admin: Sources/Galleries, Exhibitions, Issue document, Exhibition Services | ✅ incl. the **exhibition-catalogue editor** | — |
| Admin: Documents (list, detail, **History**) | ✅ | Pricelists & saved items library (Phase 21), Document Builder/Studio (D18, G-6) |
| Admin: Projects suite | ✅ incl. FX + totals | Proposal builder composition (backend not built) |
| Admin: Accounting, Team, Settings, App Design | ✅ (complete today) | Settlement calculator, theme editors (D17) |
| Admin: **Intelligence** (5 tabs), **Marketing Hub** | ❌ | G-6: owner-deferred, although the API is ready (Q-8) |
| Admin: Logistics, Analytics, Social ×4, Strategy, Automations, Languages, Team Workspace | ❌ | No backend |

---

## 3 · Phases

Dependency order: **0 → 1…8 in any order (each needs only 0) → 9 (owner-gated) → 10 (final).** The numbering
below is the recommended order, by risk and size: live bugs first, then the busiest desks.

### Phase 0: Foundation, schema regen, and live bugs
- **Objective:** make `development` correct against backend V1 before any feature work.
- **Sections:** Sales desk (C-1), Projects types (C-2), Questionnaire and Profile (C-3), Gallery portal entry (C-4),
  Artists/Database/editors/Issue document (C-5), the shared API layer.
- **APIs:** all of them, through the schema regen. In particular `GET /sales/admin/sales/` (nested rows),
  `GET /recommendations/questionnaire/`, `GET /gallery/portal/{token}/`, and every list over 100 rows.
- **UI work:**
  - Sales list and detail read the nested `artwork.title`, `collector.display_name` and `responsible.name`.
  - The questionnaire opens on the intro when `answered:false`, and the Profile card follows the same rule.
  - Portal: any unexpected entry error shows the retry card; add `ScreenBoundary` on `/portal/:token`.
- **API-binding work:**
  - Regenerate `src/api/schema.d.ts` with the recipe in `API_ADOPTION_PLAN.md` "Step 0" (drf-spectacular,
    no DB needed).
  - `ProjectStatus = Schemas['Project']['status']`.
  - Add `Locked<T>`, a type that makes `expected_version: number` required, and apply it to every existing PATCH
    type.
  - Type `HttpError.details` (C-10).
  - Add a `fetchAllPages(list, query)` helper on `ResourceService` that walks `has_next`, and use it at the five
    capped call sites (C-5).
  - Delete the per-row retrieves in `useSaleRefs.ts`. The team-user roster stays for the owner-only
    "responsible" picker.
  - Hand-type `PortalState` from `gallery/views.py:95-114` (C-8). This phase adds the type only; Phase 5 uses it.
- **Files:** `src/api/schema.d.ts`, `types.ts`, `services.ts`, `HttpClient.ts`/`errors.ts`, `shapes.ts`,
  `features/admin/{SalesPage,SaleDetailPage,useSaleRefs,ArtistsPage,ArtworksPage,ArtworkEditorPage,RecordEditorPage}.tsx`,
  `admin/exhibitions/IssueDocumentPage.tsx`, `questionnaire/QuestionnaireController.ts`, `profile/ProfilePage.tsx`,
  `portal/PortalSession.ts`, `routes.tsx`, `e2e/stub-server.mjs` (nested sale rows, questionnaire 200, a portal
  500 case, 150 artists across 2 pages).
- **Dependencies:** none.
- **Acceptance:**
  - Typecheck is clean on the regenerated schema.
  - The Sales desk shows titles and names with **no** per-row catalogue/collector requests (check the network
    panel).
  - A first-run collector sees the questionnaire intro.
  - A portal 500 shows the retry card.
  - The Artists desk shows all 150 stub artists.
- **Validation:** full gate; new unit tests for `fetchAllPages`, the questionnaire `answered` branch and
  `PortalSession` error mapping; E2E desk walk for Sales and Artists; render check of Sales, Artists,
  Questionnaire and the portal gate.

### Phase 1: Collector account and small reads (old Batch 4, plus documents from old Batch 5)
- **Objective:** close the collector-side adoption with no owner decision needed.
- **Sections:** Profile (Account, Documents), Settings, Membership sheet, Questionnaire contact step, Market
  curated chip, Settings legal links.
- **APIs:** `PATCH /auth/me/`, `GET /auth/my-membership/`, `GET /documents/`, `selection_name` on
  `GET /catalog/artworks/selections/`, `GET /documents/public/{kind}/`.
- **UI work:**
  - Profile → Account edit form (`full_name`, `phone`, `city`, `preferred_language`; Q-3), ported from the old
    edit form in `app.html`, with inline validation errors from `details`.
  - Settings "Edit profile" opens that form.
  - Membership sheet shows status and "Active until …" (`null` → no end date).
  - "Your documents: invoices, certificates & provenance" list, with loading, empty and error states. Opening a
    row uses `pdf_url`, plus the old app's "New" badge from `shared_at`.
  - The chip text is `selection_name ?? 'Curated for You'`.
  - The Terms/Privacy links resolve through `/documents/public/{kind}/` when a confirmed public doc exists, and
    fall back to today's URLs otherwise.
  - Hide "Make an Offer" when the work has no currency (Q-6, if the owner agrees).
- **API-binding work:**
  - `AuthService.updateMe`, `AuthService.myMembership`, a collector `DocumentsService` (kept separate from
    `/documents/admin`) and `PublicDocumentsService.byKind`.
  - `AuthSession` refreshes the cached `me` after a PATCH.
  - The questionnaire contact step writes through `updateMe` (G-Q-1).
- **Files:** `profile/ProfilePage.tsx` + new `profile/AccountForm.tsx` and `profile/Documents.tsx`,
  `settings/SettingsPage.tsx`, `membership/MembershipSheet.tsx`, `catalogue/CuratedChip.tsx`,
  `useCuratedCount.ts`, `questionnaire/QuestionnaireController.ts`, `services.ts`, `AuthSession.ts`, the stub.
- **Dependencies:** Phase 0. Q-3 and Q-6 (non-blocking; default to the recommendation).
- **Acceptance:**
  - A profile edit round-trips and survives a reload.
  - A 400 shows the error under the field.
  - Documents render 2 stub rows plus the empty variant.
  - Membership shows its end date.
  - The chip shows the selection name.
- **Validation:** gate; unit tests for `updateMe` payload shaping and the questionnaire contact write; collector
  E2E walk extended; render check of Profile, Settings and Membership.

### Phase 2: Sales desk and Auction Sales (G-SALE-1…5, G-SALE-4)
- **Objective:** the biggest admin adoption backlog. Bring the Sales desk to the old deal-card parity and add
  the Auction Sales tab.
- **Sections:** Sales → Market Sales (list and detail); Sales → Auction Sales (new route).
- **APIs:**
  - `GET /sales/admin/sales/summary/`
  - `GET /sales/admin/sales/?search&status&payment_status&delivery_status&source&ordering`
  - `POST …/{id}/follow-up/`
  - `GET/POST …/{id}/notes/`
  - `DELETE /sales/admin/sales/{id}/` (bind it only if the old desk has a delete)
  - `lot` on the row
- **UI work:**
  - Header tiles from `summary`, including the old "Need attention" tile (follow-up overdue), replacing the 4
    `per_page=1` counts.
  - Search box plus payment, delivery and source filter chips, and a sort.
  - Detail page: follow-up date setter (set/clear), the overdue flag, and an append-only notes thread.
  - The **Auction Sales** tab (`/admin/sales?source=auction`, or a dedicated route matching `adminNav`) lists the
    auto-created drafts, each linking to its lot. Columns are ported from the old tab in `app.html`.
  - Remove the stale G-SALE notes on screen and in the nav.
- **API-binding work:** `SalesService.summary/followUp/notes/addNote`; `SaleQuery` gets the new params;
  `source` labels fall back to the raw value until C-14 is fixed.
- **Files:** `admin/SalesPage.tsx`, `SaleDetailPage.tsx`, `SalesController.ts`, `saleForm.ts`, `adminNav.ts`,
  `routes.tsx`, `services.ts`, `types.ts`, the stub.
- **Dependencies:** Phase 0 (nested rows).
- **Acceptance:**
  - The tiles match the summary counts.
  - Each filter changes the request's query string (unit test on the controller).
  - A follow-up in the past shows as overdue.
  - A note appears without a reload.
  - An auction sale links to its lot.
- **Validation:** gate; controller unit tests; the desk E2E walk covers both tabs; render check.

### Phase 3: Auctions admin, plus the collector auction cover (G-AUC-1…4, G-REC-1, poster)
- **Objective:** make auctions editable and archivable, and replace the per-card lot read.
- **Sections:** Live Auctions list and detail, Register to Bid, Auction Records (admin), collector Auctions list.
- **APIs:**
  - `PATCH /auctions/admin/auctions/{id}/` (lock; draft or scheduled only) and `terms`/`terms_required` on create
  - `PATCH /auctions/admin/lots/{id}/` (lock; scheduled lots only)
  - `POST /auctions/admin/auctions/{id}/archive/` and `?archived=`
  - `POST/DELETE …/{id}/cover-image/` (multipart)
  - `POST /auctions/admin/registrations/{id}/reset/`
  - `?house=` on both records lists
  - `cover_image_url` on the collector side
- **UI work:**
  - An auction edit form (title, description, currency, window, terms) with `ConflictBanner`, disabled with the
    reason once the auction is live, closed or cancelled.
  - A lot edit form with the same pattern.
  - An archive/restore action and a "Show archived" toggle.
  - Cover upload/remove on the detail page.
  - ↺ Reset on rejected registrations.
  - An "All auction houses" dropdown on Records.
  - Collector cards read `cover_image_url`, and the first-lot read is deleted (`useAuctions.ts:57-70`).
  - Client-side `starts_at < ends_at` validation (C-18).
  - Verify that the room degrades when the WebSocket fails (C-19).
- **API-binding work:** `AuctionsAdminService.update/updateLot/archive/uploadCover/removeCover/resetRegistration`;
  `AuctionQuery.archived`; `AuctionRecordQuery.house`; `Locked<>` bodies; 400 refusals branch on status (C-11).
- **Files:** `admin/AuctionsAdminPage.tsx`, `AuctionAdminDetailPage.tsx`, `RegistrationsPage.tsx`,
  `RecordsAdminPage.tsx`, `auctions/useAuctions.ts`, `auctions/AuctionListPage.tsx`, `records/RecordsPage.tsx`
  (only if the old app had the house filter there), `services.ts`, `types.ts`, `optimisticLock.test.ts`, the stub.
- **Dependencies:** Phase 0.
- **Acceptance:**
  - Editing a scheduled auction saves, and a stale save shows the banner.
  - A live auction's edit is disabled with the reason.
  - Archive hides the auction by default.
  - The cover shows on the collector card with one request per page (network panel).
  - Reset returns a registration to pending.
- **Validation:** gate; wire-format tests for the auction and lot locks; desk E2E; render check (admin and
  collector auctions).

### Phase 4: Catalogue, Collectors, Club and Data Health desks
- **Objective:** use the 09-25 catalogue and collector work.
- **Sections:** Database (artworks list), Artwork editor, Artists, Published works, Collectors, Collector Club,
  Data Health, Dashboard tiles.
- **APIs:**
  - `thumb`/`artist_name` on admin artworks
  - `?gallery_portal&complete&duplicate_images&size&source_type&created_after` (list + facets)
  - the publish 400 `details.missing`
  - admin artists `?search&ordering` and `works_count`
  - `GET /auth/admin/collectors/summary/`, `last_activity_at`, `purchase_count`, `?ordering=activity|purchases`
  - club selection `thumb`
  - data-health `deleted_records`
  - admin `?published=` for the Published desk
- **UI work:**
  - The Database row leads with the thumbnail and resolved artist name.
  - The four Phase 5b filter chips, plus source-type and "recently added" chips (the same chip pattern as #66).
  - Publish failure lists the missing essentials (worded from the old desk's copy).
  - Artists desk: server search, sort (name/created/works) and a pager, with a works count.
  - Collectors strip: Collectors · VIP · Active-30d · Engaged, plus "Recently active" and "Most purchases" sorts.
  - Club card cover from `thumb`.
  - Data Health: Gallery-, Dealer- and Artist-sourced tiles, "Deleted (permanent)" and "Recently added".
  - Published desk lists every published work through the admin list.
  - Dashboard catalogue tiles link to the filtered Database.
  - The editor gets `source_type` only if the old editor had it; otherwise flag it.
- **API-binding work:** extend `ArtworkAdminQuery`, the `artists()` query, `CollectorAdminQuery.ordering`,
  `AdminAccountsService.collectorsSummary`; merge rules for list-only rollups (C-16).
- **Files:** `admin/ArtworksPage.tsx`, `ArtworksController.ts`, `ArtworkEditorPage.tsx`, `ArtistsPage.tsx`,
  `PublishedPage.tsx`, `CollectorsPage.tsx`, `collectorTiles.ts`, `ClubPage.tsx`, `DataHealthPage.tsx`,
  `healthCounts.ts`, `DashboardPage.tsx`, `services.ts`, `types.ts`, the stub.
- **Dependencies:** Phase 0 (`fetchAllPages` and error details).
- **Acceptance:**
  - Each filter maps to its query param (unit test).
  - A publish of an incomplete work lists exactly the missing items.
  - The Artists desk pages past 100.
  - The collector tiles equal the summary.
- **Validation:** gate; desk E2E; `diff-desks.mjs` against a baseline for layout regressions; render check.

### Phase 5: Gallery portal and Sources desk (G-PORT-1…4, 6, 9, 11–16)
- **Objective:** bring the portal and its admin desk up to backend P1/P3a/P3b/P4.
- **Sections:** `/portal/:token` (Works, Pricelists, History, header); admin Sources list, Source detail,
  Exhibition compose, Exhibition Services, and the new exhibition-catalogue editor.
- **APIs:**
  - Portal: `GET portal/{token}/` (typed per C-8), `POST …/artworks/{id}/image/` (multipart, `pin` in the form),
    `POST …/updates/` with kinds `ask` and `withdraw`, `POST …/pricelists/build/`
  - Admin: `POST links/{id}/reissue/`, `?search=` on links, `POST pricelists/{id}/status/`,
    `GET links/{id}/pricelists/cap/`, `file_url`, exhibition-catalogue CRUD, `quantity` on compose lines, and
    `description` on service-catalog (G-PROJ-8)
- **UI work:**
  - **Portal:**
    - Work cards show `image_url`, and the header shows `cover`.
    - A "Replace image" file picker replaces the checkbox-only flag.
    - Per-work **Ask** and **Withdraw** actions.
    - "Sent" pills and a Pending-review count from the server `updates[]`, plus a History list.
    - Pricelist rows show `status`.
    - An in-portal pricelist **builder** (lines: work or title, price, currency, availability, note). File
      upload stays as the alternative.
  - **Admin:**
    - Reissue credentials (shown once).
    - Server-side partner search.
    - Open a pricelist file (`file_url`), render structured lines, set status, and show the soft-cap notice.
    - Fix the **withdraw** confirm copy (the backend now unassigns the work).
    - Render `ask` updates with an answer path through the thread.
    - Image updates show a "submitted" state until C-12 lands.
    - Exhibition-catalogue editor desk (add/edit/deactivate items; key read-only on edit; lock).
    - Compose sends and shows `quantity`.
    - Service descriptions come from the API; delete the `DESCRIPTIONS` map.
- **API-binding work:**
  - `GalleryPortalService.replaceImage/buildPricelist`.
  - The update kinds come from options (`gallery.update_kind`).
  - `GalleryAdminService.reissue/setPricelistStatus/pricelistCap/exhibitionCatalogue*`.
  - `ExhibitionLineInput.quantity`.
  - A wire test pins `pin` in the body/form on every portal write (C-9).
- **Files:** `portal/*` (`PortalPage`, `PortalSession`, `PortalWorks`, `PortalPricelists`, `portalForm.ts`, new
  `PortalHistory.tsx`), `admin/SourcesPage.tsx`, `SourceDetailPage.tsx`, `SourceDocuments.tsx`,
  `ExhibitionComposePage.tsx`, `exhibitions/{issueForm,servicesLibrary,ExhibitionServicesPage}.ts(x)`, new
  `admin/ExhibitionCatalogPage.tsx`, `adminNav.ts`, `routes.tsx`, `services.ts`, `types.ts`, the stub (full portal
  state).
- **Dependencies:** Phase 0 (`PortalState` type and entry fix). Q-7 (non-blocking). C-12 limits the admin image
  preview; C-13 must be raised before any real link is issued.
- **Acceptance:**
  - The portal shows images and cover.
  - A replacement image appears as a pending update in History after a reload.
  - Ask and withdraw are sent with the right `kind`.
  - A built pricelist appears as "Submitted".
  - Admin reissue gives new credentials and the old ones get 401 (stub).
  - An accepted pricelist supersedes the previous one after a re-fetch.
  - A catalogue edit shows in the portal's exhibition menu.
- **Validation:** gate; portal unit tests (form → payload per kind); a new portal E2E beyond the gate screen
  (the stub now serves state); desk E2E; render check of every portal tab.

### Phase 6: Documents and Chat (G-DOC-1 share, G-DOC-2, D19 `document_refs`, G-CHAT-2)
- **Objective:** document history and sharing, attaching documents in chat, and archiving chat messages.
- **Sections:** Documents list and detail, Documents → History tab, admin Chat thread, collector Chat thread
  (rendering attached docs).
- **APIs:**
  - `GET /documents/admin/documents/{id}/activity/`
  - `POST/DELETE …/{id}/share/`
  - `document_refs` on `POST /crm/admin/requests/{id}/messages/`, and its enriched read on both threads
  - `POST /crm/admin/messages/{id}/archive/` and `?include_archived=`
- **UI work:**
  - A History tab per document (action, who, when, changes).
  - Share/unshare with the collector.
  - Enforce `owner_lock` in the UI: disable Save/Upload/Confirm/Sign/Archive for a standard admin and state the
    reason.
  - A document picker in the admin composer (collector-visible kinds only).
  - Documents render as chips on messages in both threads and open through the collector documents list.
  - Per-message archive/restore plus an "Include archived" toggle, admin-only.
  - Remove the stale G-CHAT-2 and G-DOC-2 copy.
- **API-binding work:** `AdminDocumentsService.activity/share/unshare`; `adminPostMessage` accepts
  `document_refs`; `AdminThreadController` gets the archive and include-archived query.
- **Files:** `admin/DocumentsPage.tsx`, `DocumentDetailPage.tsx`, new `admin/DocumentHistory.tsx`, `adminNav.ts`,
  `AdminThreadPage.tsx`, `AdminThreadController.ts`, `AdminChatPage.tsx`, `chat/ThreadPage.tsx`, `services.ts`,
  `types.ts`, the stub.
- **Dependencies:** Phase 1 (the collector documents list is the open target for a shared doc).
- **Acceptance:**
  - An attached doc shows on both threads and in the collector's Documents list.
  - An archived message disappears from the admin thread unless the toggle is on, and is never hidden from the
    collector.
  - A locked doc's actions are disabled for a standard admin.
- **Validation:** gate; unit test for the composer payload; desk and collector E2E; render check.

### Phase 7: Projects suite (G-PROJ-1, 2, 3, 8, 9)
- **Objective:** replace the client-side walks and read-only fields with the served API.
- **Sections:** Projects Dashboard, List, Pipeline, Partners, Project record, Packages.
- **APIs:**
  - `?quick=active|delayed|awaiting_approval|unpaid` and `?partner=`
  - `status` and `stages` on PATCH (lock)
  - the FX fields (`deal_currency`, `deal_fx_target_currency`, `deal_fx_rate`, `deal_fx_rate_date`)
  - `GET …/projects/{id}/totals/`
  - service `description`
- **UI work:**
  - Quick cards and the Partners count come from server filters.
  - The Overview Status `<select>` (as in the old app).
  - The stage sub-state (delayed/awaiting-approval, checklist seeding on a stage move) is written, so the
    dashboard tiles stop reading 0.
  - A manual FX block on the record, plus a totals panel (per currency, and the converted total only when a
    rate is set; string decimals, C-22).
  - Package descriptions come from the API.
  - Remove the stale G-PROJ notes.
- **API-binding work:** `ProjectQuery.quick/partner`, `ProjectsService.totals`, and the `ProjectPatch` fields.
- **Files:** `admin/projects/*`, `services.ts`, `types.ts`, the stub.
- **Dependencies:** Phase 0 (C-2 alias). Q-2 is a flag only.
- **Acceptance:**
  - "Delayed" shows the server count.
  - A status set on the record persists until the next stage move.
  - The totals match the backend for a mixed-currency stub project.
- **Validation:** gate; unit test for the stage/sub-state payload; desk E2E; render check.

### Phase 8: Owner Access desk (G-KEY-1)
- **Objective:** build the old owner "Access" desk over the roster-wide key list.
- **Sections:** Owner → Access (new route; the nav tab is currently `path: null`).
- **APIs:** `GET /auth/admin/access-keys/?status&collector&expiring_soon&search` and `GET …/access-keys/summary/`,
  reusing the existing extend and revoke actions.
- **UI work:**
  - KPI tiles from the summary.
  - A filterable table (collector, computed status per C-17, issued, expires, last used, activity tallies).
  - Extend and revoke per row.
  - An "Expiring soon" chip.
  - A link to the collector.
  - The copy and columns come from the old desk in `app.html`.
- **API-binding work:** `AdminAccountsService.accessKeysRoster/accessKeysSummary`, `AccessKeyRosterQuery`.
- **Files:** new `admin/AccessDeskPage.tsx` (+ controller), `adminNav.ts`, `routes.tsx` (`RequireOwner` per Q-1),
  `services.ts`, `types.ts`, the stub.
- **Dependencies:** Phase 0; **Q-1** (role gate).
- **Acceptance:**
  - The tiles equal the summary.
  - A lapsed key with a stored status of `active` shows "Expired".
  - Extend refreshes the row.
- **Validation:** gate; desk E2E; render check.

### Phase 9: Owner-decision items (only the ones the owner says yes to)
- **Objective:** build the answered items from `V1_CONTRACT_ISSUES.md` § C.
- **Candidates:**
  - **G-P5-11:** send `artist` on an artist enquiry. No visible change.
  - **G-P25-2(a):** the collector questionnaire is driven by `GET /recommendations/question-set/`, and the
    `questions.ts` bank is deleted. (b) An admin question-set editor desk.
  - **G-P24-2:** the "selection ready" notice (`/catalog/selections/` + `seen`).
  - **G-P5-4:** durable activity archive.
  - **G-P5-5:** collector withdraw offer / cancel viewing.
  - **G-P5-12:** an activity read-back surface.
  - **G-P13-1:** push opt-in (`vapid-public-key`, `push/subscribe|unsubscribe`, a service worker).
  - **G-CLUB-3:** the Club "Auction access" section.
  - **G-P5-9:** counter-offer display.
  - `RecommendationService.published/dismiss`: "Curated for you" (part of G-6 unless the owner says otherwise).
- **Each answered item** gets its own sub-branch `v1/phase-9x-<slug>`, with the same gate, stub, render and docs
  rules.
- **Dependencies:** owner answers.

### Phase 10: Final verification and V1 status
- **Objective:** prove the result and write it down.
- **Work:**
  - Re-run the matrix method (see the header of `docs/audit/2026-09-25/API_ADOPTION_MATRIX.md`) against the
    then-current backend.
  - Every operation ends as Integrated, Backend-only, Excluded (not V1, with a reason) or Blocked (with a
    reason). No "Not bound" row may remain unexplained.
  - Re-review `API_GAPS.md` and `API_GAPS_FRONTEND_ADOPTION.md`.
  - Finalise `DARZ_WEB_V1_STATUS.md`.
  - Confirm that no `v1/phase-*` branch is unmerged, and that `development` builds and passes the full gate
    including E2E.
  - Walk every screen for loading, empty and error states (the audits list the current misses: Profile
    loading, auction event lots loading/empty).
- **Acceptance:** the final gate output is recorded in `DARZ_WEB_V1_STATUS.md`; `HANDOFF.md` and `TASKLIST.md`
  point to it.

---

## 3a · What Phase 0 did differently from the plan (recorded 2026-09-25)

- **`fetchAllPages` → `walkPages`.** The walker already existed three times (`projectForm.ts` plus two
  private `walkAll` copies in the exhibitions desks). It moved to `src/api/paging.ts` (with `MAX_PER_PAGE`)
  and all three copies use it, rather than adding a fourth on `ResourceService`. The collector's own
  auction registrations (`per_page: 200`) had the same cap and were walked too.
- **`Locked<T>`** is applied to the Sales PATCH, the only locked body typed straight from a `Patched*`
  schema. Every other locked call already required `expected_version: number` by hand.
- **Error `details` (C-10)** needed no new type: `ValidationError.fields` already carries
  `error.details`, so the publish gate's list arrives as `fields.missing`. Phase 4 renders it.
- **Sales artist line.** The nested artwork is `{id,title}` with no artist. The title, collector and
  responsible now read straight off the row. The artist line under the title is still one cached
  retrieve per distinct work (backend candidate: `artist_name` on `_SaleArtworkBrief`).
- **No `ScreenBoundary` on `/portal/:token`.** Its copy tells the reader to "use the bar", which the
  portal does not have, and inventing portal copy is off-limits (`CLAUDE.md`). The known crash path is
  closed at its source instead: `PortalSession.enter` now maps every failure to a phase (C-4).
- **`PortalState` hand-typing moves to Phase 5**, which is its only consumer.

## 3b · What Phase 1 did differently from the plan (recorded 2026-09-25)

- **No Email field on the Account card.** The old card has one (app.html:9783); `PATCH /auth/me/` does not
  accept it and `/auth/me/` does not return a collector's email, so a read-only field would always be empty.
  Flagged in `profile/account.ts`; backend candidate: return it read-only on `Me`.
- **Save behaviour.** The old card saved on every keystroke to `localStorage`. Here a text field saves on
  blur/Enter when changed, the language on pick, each with the old `Lib.toast('Saved')`. No Save button
  (none in the old card or the design capture).
- **Language labels.** `preferred_language` is not in `/api/options/` (C-14): values are the schema enum
  (`en`/`fa`), labels are the old `COMM_LANGS` words ("English", "Farsi") unless options ever serves
  `accounts.preferred_language`. French has no backend value and is not offered.
- **"New" on documents is per device** (`darz_docs_seen`, as the old app), not derived from `shared_at` —
  `shared_at` says when Darz shared it, not whether the collector opened it. Rows open `pdf_url` in a new tab
  (the old in-app DarzDocs viewer is not rebuilt). Loading and a failed read hide the section, like empty.
- **Membership.** The sheet's "Code …" line is not shown (the summary does not return the code). The
  earlier invented "Membership activated / Darz holds your renewal date" block is gone; after a redeem the
  sheet re-reads `/auth/my-membership/` and shows the old toast `✓ <Plan> activated`.
- **Legal links** point at the published PDF of `legal_terms` / `legal_privacy` / `legal_auction`, else the
  public-site URL. Only `legal_terms` is a backend-documented kind; the other two are a naming convention the
  owner must publish under. The old long-form in-app sheet is not rebuilt.
- **Chip label**: the old shipped chip printed the literal "Curated for You" either way (:8590); the name
  (`curatedTitle()`, :3458) is used as the plan asks — flagged for the owner.
- **The Account card no longer shows the read-only "Membership" line** (it was a v0.1 stand-in with no
  old-app source); membership lives in Settings as in the old app.
- **E2E stub**: now reads request bodies; this exposed that a cold-load token refresh (body, no bearer)
  always answered the *team* pair, so collector walks silently became team sessions after their first
  navigation. Fixed in the stub.

## 3c · What Phase 2 did differently from the plan (recorded 2026-09-25)

- **The old admin is `darz-studio.html`, not `app.html`.** Every Sales citation is to `DZSales`
  (`darz-studio.html:12511-12770`); the captures are `design/admin-panel/…/15-market-sales` and
  `16-auction-sales` (`darzstudio.art`). The old desk has no deal-card capture; the detail page was
  compared against the `_detail` markup (`:12599-12667`).
- **Auction Sales is `/admin/sales?source=auction`** (the Galleries `?type=gallery` shape): one route,
  two nav tabs; the page is keyed on the tab so switching tabs remounts the controller. The tab's
  `source=auction` is a fixed scope the filters cannot clear.
- **Market Sales is the whole ledger**, with a Source filter, where the old Market tab held market deals
  only. Reason: `summary/` is ledger-wide and takes no `source`, so its tiles only match an unscoped
  list. Auction Sales counts its own rows for its strip.
- **Need attention is narrower than the old tile.** The old count was `salesFlag` attn/block: follow-up
  due, stalled ≥10 days, or payment overdue ≥7 days. Only the first has a field (`follow_up_overdue`),
  and it has no aggregate or filter, so it is counted over a walk of the tab's rows. Backend
  candidate: an overdue count on `summary/` (or `?follow_up_overdue=`).
- **Five tiles, not four:** Open deals · Need attention · Payment pending · Completed · Lost (the old
  "Sent to Accounting" has no stage here, as before).
- **Two filter controls have no old control, flagged:** Delivery (the old desk filtered on `fDeliv`,
  `:12523`, but rendered no select) and Source (the old source axis was the tab pair). The sort menu is
  cut to the four server orderings (Recent first · Oldest · Highest value · Lowest value); the search
  placeholder is cut to what the server searches ("Search collector, artwork…").
- **Copy adapted, flagged:** the Auction Sales sub-line and empty state. The old "Every registration,
  bid and winning bid" is false here — only a won lot makes a sale — so it reads "Every winning bid — one
  deal, followed to the ledger. A lot that closes won opens its draft sale here — or add one by hand
  with ＋ New deal. N total."
- **The Lot link is an addition.** The old auction row was the market row and printed no lot (the deal
  carried `lotId`, `:12327`). Auction Sales has a Lot column and the detail a Lot row, each opening the
  lot's auction page (there is no lot route); `lot` is resolved via `GET …/admin/lots/{id}/`, cached.
- **Delete deal is bound** — the old card has it (`:12664`) with the old confirm (`:12770`). The old
  "Deal removed" toast is not shown: the page navigates back to the list.
- **Follow-up toasts** follow the old split: the presets toast "Follow-up set for <date>"; the date field
  and Clear write silently. Notes toast "Note added".

## 3d · What Phase 3 did differently from the plan (recorded 2026-09-25)

- **The edit forms port the old Manage-auction modal** (`editAuc`/`saveAuc`, `darz-studio.html:32027-32172`)
  onto the auction page, in its order: Cover & poster · Auction details · Terms & financial settings ·
  lots. Cut from the modal (no backend): the cover-ARTWORK search, the poster text over the cover, the
  Document Builder poster designer, Type (timed/live), the Status select, cascade stagger and max
  bidders. Buyer's premium and Anti-snipe seconds are per lot here (lot fields). "or PDF" is dropped
  from "↑ Upload poster": the cover is drawn as an image. Terms keep the old rule — opens on the Darz
  default, a save equal to it stores `''`; "No terms gate" is `terms_required: false`.
- **No save toast.** The old "Auction saved → live in the App" is false for a draft; the button's
  `DeskSave` "✓ Saved" flash confirms. The PATCH sends changed fields only (+ `expected_version`).
- **Read-only reason is the server's own sentence** ("Only a draft or scheduled auction can be
  edited."), shown on live/closed/cancelled auctions; C-11 refusals show `error.message`.
- **Validation copy (C-18) is a placeholder** — no old-app source; owner to confirm.
- **Archived = a "Show archived" toggle** (the old Archived sub-tab): `?archived=true` lists only
  archived. Copy cut where it would be false: the backend's collector list does **not** hide archived
  auctions, so "…and the Market App" / "removed from the Market App" are dropped from the sub-line,
  confirm and toast ("Archived — moved to the archived list"; "Restored to Live & upcoming").
  Backend candidate: exclude `archived` from `GET /auctions/`.
- **↺ Reset shows on rejected rows only** (the old desk showed it on every row; the endpoint only
  resets `rejected`). The toast drops the old "— Collector <key>" suffix.
- **House filter:** single select (old was a multi-select popover; the API takes one exact house).
  Options = the old `REC_KNOWN_HOUSES` ∪ houses from one walk of the records (no facet endpoint —
  backend candidate), stored spelling wins so the exact filter matches. **Collector `RecordsPage` gets
  no house filter**: it ports the Artist sub-tab, where the old app hid it (`app.html:5082`).
- **Collector cover:** cards read `cover_image_url` only (no cover-artwork field for the old fallback);
  the event hero falls back to the first lot's artwork from the lots it already reads. Event lots gain
  "Loading…" and an empty state that borrows the old lots-list line "No lots in this view."
  (`app.html:7530`) — the old event page had none (flagged).
- **C-19 needed no change** — see `V1_CONTRACT_ISSUES.md`.
- **Whole lists:** Live Auctions and the Registrations auction titles walk every page (the latter
  archived included); the auction page's lots stay one `per_page=100` read.
- **E2E gotcha:** a `<label>` wrapping a `<textarea>` takes the textarea's text into its own, so
  `getByLabel(…, {exact:true})` cannot find it — use `getByRole('textbox', {name})`.

## 3e · What Phase 4 did differently from the plan (recorded 2026-09-25)

- **Filters are the old selects, not new chips.** The Phase 5b filters sit in "More filters" as the old
  desk's own controls (`darz-studio.html:26668-26685`): Gallery Portal ("In any portal" / "Not in a
  portal"), the Images select's "Duplicates (same image)" pick (one select over `has_images` +
  `duplicate_images`), Details ("Missing required fields" = `complete=false`) and Size. Not offered (no
  server filter): the per-portal entries, four of the five Details picks, Oversized / Bigger / Smaller /
  custom W×H, Chosen by Darz, Categories. **Size buckets are the backend's** (≤ 50 · 50–120 · > 120 cm,
  owner decision 2026-09-24), labelled with those numbers, not the old 40/100/200.
- **`source_type` and `created_after` are link chips only.** The old desk had no select for either (it
  reached "recently added" only from the Data Health tile, as the "Latest 50 added" chip, `:26717`). The
  desk now opens pre-filtered from the URL (`artworkQueryFromParams`, the Requests-desk pattern), and the
  chip reads "Added since <date>" (the filter is a date, not a count of 50).
- **"More filters" keeps the user's open intent** (old v582 `_dbMoreOpen`, `:26676`). Found by the E2E:
  clearing the last active select used to collapse the panel under the pointer.
- **Publish refusal** is the old `togglePub` popup verbatim (`:41959`: "This artwork isn’t ready for the
  Market App yet. / Please complete: … / Collectors only ever see complete listings…", Complete it now /
  Not now) with the backend tokens in the old `_appMissing` words and order (`:23971`: image, size,
  artist name, title, medium, price (or turn on “Price on request”)). Shared as `PublishRefusal`.
- **The editor gets no `source_type` field — flagged (owner question).** The old editor's source block was
  four partner pickers (Gallery / Dealer / Artist / Collector source, linked to Sources & Partners,
  `:34127-34137`); the backend field is a bare enum with no partner link. Until decided, the sourced
  counts only see works typed elsewhere (import / Django admin).
- **Artists sorts:** "Sort: Most works" (the old default, `:33359`) and "Name A–Z"; the old "Recently
  updated" became **"Recently added"** (`-created`) — there is no updated ordering, and a client sort
  would order one page only (flagged). Paged by the kit (100 per page); "Showing n of m" = the search's
  `total_count` of the roster's `total_count` (one `per_page=1` read). The Database/editor/record
  pickers still walk the roster (they need every name).
- **Collectors** open on "Recently active" (`-activity`, the old default `:32633`); "Tier" sort has no
  server ordering; the earlier Oldest first / Name Z–A stay. Rows gain Purchases + "Last active" (old card
  `:32649`, `:32654`) as table columns (G-4 kept the table). "Notify collectors" note corrected: VAPID is
  served, the blocker is the missing admin push-send endpoint.
- **Club:** cover = first work's thumb (old `works[0]`, `:33740`) with the old `gc-top` scrim. **The
  "Auction access" section and "Private auctions" tile stay out — Phase 9 (Q-5)**; invite-only is managed
  on the auction page. The header's G-CLUB-3 "blocked" claim is corrected. Selections are walked.
- **Data Health:** all nine catalogue boxes, with the three old band headings back. Deleted's line is
  **"Removed from the Database"**, not the old "Tombstoned — can’t come back" (a soft delete can be restored
  server-side; flagged). **Deviation, flagged:** the three Sourced boxes open the Database filtered to the
  works counted, where the old ones opened the Sources & Partners sections (partners, not works) — the
  `:21349` "counter equals the list" rule. Archived and Deleted are not links.
- **Published** reads the admin list `?published=true` (the Database's own controller); the tile is the old
  "Live for collectors". A non-public card names its visibility (addition, flagged).
- **Dashboard:** Available / On hold / Reserved / Sold open the Database filtered to that status (the old
  tiles opened the unfiltered Database, `:21483-21486`). Today's tiles stay plain numbers (no list equals
  them).
- **Stub:** the Database now has rows, so `smoke.spec`'s empty-state walk opens `?source_type=other`.
  Visibility labels were added to the stub's options.
- Pre-existing, not changed: the Published card's "Remove from Market App" button overruns its card at
  1280 (seen in the render check).

## 3f · What Phase 5 did differently from the plan (recorded 2026-09-25)

- **Sources of the old code.** Portal: `gallery-update.html` (card :1303-1370, v1146 replace-image
  :1283-1300, §79 remove :1185-1224, pricelists + builder :1034-1128, dashboard :1136-1143, cover
  :852-856) and the History panel in `packages/domain/collaboration-agreement.js:203-523`. Desk:
  `darz-studio.html` (Regenerate :28165/:38605-38614, pricelist card `_galPLCard` :27266-27281,
  update card `_galUpdCard` :28246-28297, the per-gallery "Service checklist" `galExhSection`
  :27843-27920).
- **"Replace image" sits beside the "image needs updating" check, not instead of it** — the old card
  has both (:1344-1348). The photo attaches to the card and goes on Send update to its own multipart
  endpoint; an image-only edit sends no text update. No canvas downscale (old `downscale`, :1474):
  a 6 MB / image-type guard instead; the type line has no old copy (flagged).
- **Ask has no old source (flagged).** The old per-work asks ran Darz → gallery (§90 "Darz asked");
  the backend's `ask` runs gallery → Darz. The control is "Ask Darz about this work" with the Messages
  box's words ("Write a message to Darz…", "Write a message first.", "Sent to Darz."). On the desk it
  is answered through the review note ("Mark handled", the old label for note-like kinds), which the
  partner reads in History.
- **Withdraw is the old single-work "Remove from portal"**; the confirm now says it is a request Darz
  approves (the old one promised an immediate hide); toast "Removal request sent to Darz." The old
  multi-select "Select" mode is **not** ported (flagged).
- **History** shows kind/status words from `/api/options/` (`gallery.update_kind` /
  `update_status`), not the old `HISTORY_KIND`/`HISTORY_STATE` maps — "Pending" where the old pill
  read "With Darz" (flagged). Darz's `review_note` shows in the drawer; there is no review date (the
  portal tier trims it). The tab appears once the portal has sent something (old non-V1 rule).
- **Sent pills** read the server's pending rows plus an optimistic mark cleared by the next reload; a
  card's draft is cleared after a successful send, and "Send update" beats "Send again" when a card is
  edited while an older update is still pending.
- **Pricelists.** No weekly-quota line (the cap is the desk's advisory soft cap) and no formatted
  download (P3c). Built rows read "LIST" / "Pricelist (built in portal)" as the old card; uploads get
  "Open file ↗". Builder rows are the new line shape — Work (assigned or "Another work") · Title ·
  Price · Currency · Availability (Q-7) · Note; the old Artist / Year / Size inputs have no field
  (flagged). The desk's status buttons are "Mark submitted / accepted / superseded" over the
  backend's three states (the old ones were formatting / formatted / Reject); labels are raw (C-14).
- **Reissue** keeps the old confirm and "Replace link" label; the backend leaves status alone, so a
  non-active link's confirm adds "The portal stays <status> — enable it too before sending the new
  link." The shown-once panel + invitation moved to `SourceCredentials.tsx`, shared with issue.
- **The exhibition-catalogue editor is a new nav tab, "Service checklist"** (`/admin/exhibition-catalogue`,
  59 tabs now) — the old editor was a per-gallery passport section; the backend menu is global, so the
  standard/custom banner, "Reset to Darz default", the per-gallery currency and the portal-text fields
  do not port. Rows save individually (locked PATCH); "Turn off/on" is `is_active`; prices are shown
  in T (the item has no currency). Link DELETE stays unbound — the old passport had no delete.
- **Compose** reads the admin catalogue (active rows, by position) — `priceList.ts` and its test are
  deleted. Quantity is a small "Qty" input (the issue page's own column); Issue document splits a
  composed line's amount back into qty × unit, and the portal prints "3 × …".
- **G-PROJ-8.** Descriptions read/write through the API and the row's own text always wins. A row
  seeded before the column (empty description) falls back to Darz's menu text for that service name,
  so existing proposals do not go blank (lead review). The standard-set seed now writes `about` into it.
- **Found on the way:** the backend now serves the portal menu's `default_price` as a decimal
  STRING; the portal totals added it with `+` (string concatenation) — now `num()`. The desk's
  assigned-works list read `snapshot.artist_name`, which the snapshot never had (it is `artist`).
- **E2E:** Chromium hides a multipart body carrying a file from `request.postData()`, so the stub
  reports the last upload's form (`/__stub/portal/last-image/`). The stub keeps two links so the
  portal walk and the desk walk (parallel files) never share state.

## 3g · What Phase 6 did differently from the plan (recorded 2026-09-25)

- **Sources of the old code.** Documents: `workspaces-runtime.js` (`_docTab` :522 maps 'history' to the
  Library; "Library & history" body :698-731 — History heading, "Activity" rows, "No document activity
  recorded yet."), `darz-studio.html` (group tabs :11731-11736, `_spAgo` :27024, the deal's share
  toggle "Sharing" / "Not shared" and "only shared documents appear in their Market App" :12906-12912,
  the share dialog heading "Share with collector" :6608, the legal-docs owner gate :30965). Chat:
  `_chatDetail` :40452-40476, `_chatBubble` :40330-40342 (the quiet Edit/Delete row, " · edited"),
  the renewal cutoff `_chatCutoff` / `chatArchiveNow` :40246-40258. Collector: `dzThreadBubbleHTML`
  app.html:7277-7285 (cards after `.tm`), `.dz-chatart` :923-931, `dzDocsSectionHTML` :7909-7925.
- **History is a section on each document, and the nav tab stays hidden.** The old group had no History
  tab (its fourth tab is "Library & history"), and the backend serves the trail per document (owner
  call), so a History tab would only repeat the Library. `docHistory` keeps `path: null` with that
  reason, and the Library tab's label is the old "Library & history" again. Rows read like the
  Settings audit log (When · What · From → to · Who); "When" is the old `_spAgo`. The action is the
  server verb capitalised ("Transition", "Share") — the old log was free text, so there was no
  wording to port (flagged).
- **Share needs a collector picker.** The old share toggle lived on a deal whose collector was known; a
  document here may have none, so the kit `Picker` (the Sales desk's collector search) is under the
  pill, prefilled with the document's own collector. "Stop sharing" and the not-shareable-kind line
  ("A “proposal” document never reaches a collector. Only these kinds can be shared: …") are new copy
  (flagged). Share is **not** owner-lock-guarded (the backend's `share_with_collector` has no guard),
  so it stays live for a standard admin on a locked document.
- **owner_lock** disables Save draft · Upload PDF · Confirm · Sign · Archive and the draft inputs for a
  standard admin, with "Owner-locked — only the owner can edit, upload, confirm, sign or archive this
  document." — the old legal-docs note's shape (:30965) naming the backend's guarded moves; the old
  panel had no per-document lock (flagged). Delete stays owner-only (G-DEL-1).
- **Attach document has no old counterpart (flagged).** The old composer was a textarea and Send; the
  control is a single ghost button → a search box over a short list → one removable chip ("shared with
  the collector when you send"). The admin list has no collector filter or search, so it is walked
  whole once and narrowed client-side. **It never offers a document issued to another collector:**
  attaching re-runs the share path, which **rewrites the document's `collector`** — a backend behaviour
  worth an owner/BE look (attaching someone else's invoice would move it). With no collector known
  (a cold deep link, G-CHAT-1) only unissued documents are offered. A message still needs text (the
  backend requires `body`).
- **Message archive** is per message with an "Include archived" switch (both new copy, flagged; the
  old equivalent was the panel-wide renewal cutoff). Archive/Restore sits in the old bubble's quiet
  action row; a shown archived bubble is dimmed and reads " · archived" beside its time, as " · edited"
  did. The collector thread is untouched (the backend's collector list ignores the flag). The
  renewal cadence (Keep/daily/weekly, "Archive all & start fresh") stays unported — no sweep endpoint.
- **Document chips.** Admin: kind · title, linking to the document's page. Collector: the "Your
  documents" row boxed as an attached card (old label via `docLabel`, title, "View →"), opening the
  signed `pdf_url` from `GET /api/documents/` (read once, only when a thread has an attachment) and
  marking it seen; if the document is not in that list, the old "Document not available" toast.
- **Found on the way:** the admin thread only showed a load error when the thread was empty; it now
  shows any error (an archive refusal included) above the bubbles. `MessageThreadController.send`
  takes the attachments, so the shared machine stays one class.
- **E2E:** the stub gained a standard-admin login (an email starting "standard"), a documents set,
  per-document activity, share/unshare, the admin thread (one archived message, stateful archive),
  and a collector message carrying `document_refs`. The Chat desk list now serves that one
  conversation, so the thread walk opens it from the list (router state names the collector).

## 4 · Cross-cutting fixes, and which phase takes them

| Item | Phase |
| --- | --- |
| Profile has no loading state (tiles read 0 while loading) | 1 |
| Auction event lots have no loading or empty state | 3 |
| Hardcoded labels that `/options/` serves (availability, record, lot/auction status, request kind) | Take each one in the phase that touches its screen (1 → catalogue/requests, 3 → auctions/records); the request-kind wording is an owner call |
| Market hero copy not read from `/app-theme/` | 1 (only if the old theme keys exist; otherwise flag) |
| Nav "Insights" → `/stories` with no route | Not V1: hide the tab or leave it as the old app did (flag) |
| Stale on-screen "backend gap" notes (≈20, listed in `ADMIN_AUDIT.md`) | Removed by whichever phase makes each one false |
| `docs/ADMIN_SCREENS.md:118` lists the Settings route as missing | 10 |
| Collector auction cards run past the right edge at 390px (pre-existing layout, seen in the Phase 3 captures; may be the old horizontal peek — check against `app.html` before changing) | 10 |

## 5 · Progress

| Phase | Scope | Branch | State | PR |
| --- | --- | --- | --- | --- |
| 0 | Schema regen · C-1…C-5 live bugs · `Locked<>` · `walkPages` | `v1/phase-0-foundation` | `[x]` 2026-09-25 | see CHANGELOG |
| 1 | Profile edit · my-membership · documents · chip · G-Q-1 · public docs | `v1/phase-1-collector-account` | `[x]` 2026-09-25 | see CHANGELOG |
| 2 | Sales summary/filters/follow-up/notes · Auction Sales | `v1/phase-2-sales` | `[x]` 2026-09-25 | see CHANGELOG |
| 3 | Auction/lot edit · archive · cover · reset · house | `v1/phase-3-auctions-admin` | `[x]` 2026-09-25 | see CHANGELOG |
| 4 | Database/Artists/Collectors/Club/Data Health | `v1/phase-4-catalogue-collectors` | `[x]` 2026-09-25 | see CHANGELOG |
| 5 | Gallery portal P1/P3/P4 · Sources desk · exhibition catalogue | `v1/phase-5-gallery-portal` | `[x]` 2026-09-25 | see CHANGELOG |
| 6 | Document history/share · chat document_refs · message archive | `v1/phase-6-documents-chat` | `[x]` 2026-09-25 | see CHANGELOG |
| 7 | Projects quick/partner · status/stages · FX · totals | `v1/phase-7-projects` | `[ ]` | |
| 8 | Owner Access desk | `v1/phase-8-access-desk` | `[ ]` (Q-1) | |
| 9 | Owner-decision items | `v1/phase-9x-*` | waiting on owner | |
| 10 | Final verification + `DARZ_WEB_V1_STATUS.md` | `v1/phase-10-final` | `[ ]` | |
