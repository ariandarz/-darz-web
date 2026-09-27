# Admin panel audit: `-darz-web` vs `darz-backend-api`

- **Frontend:** `-darz-web` @ `d987910` (main merge of #100). Admin code is in `src/features/admin/**`, routes are in `src/routes.tsx:437-600`, the nav is `src/features/admin/adminNav.ts`, and the API layer is `src/api/services.ts`.
- **Backend:** `darz-backend-api` development @ `df0421f` (includes every 2026-09-25 CHANGELOG entry up to pricelist P3b).
- **Method:** I extracted the service calls made by each page, service method by service method, and compared them with `backend-v1-endpoints.txt`. I checked every "gap" below against the code (grep and read) and cite file:line. **Correction (lead review):** the committed `src/api/schema.d.ts` is *not* current. A regen from backend `df0421f` adds 11 paths (sales summary/follow-up/notes, pricelist status/cap/build, portal image, exhibition-catalogue CRUD, project totals, document activity) and 15 type errors (G-SALE-3 nested rows, the `ProjectStatusEnum` → `Status2c3Enum` rename). Regenerating the schema is therefore Phase 0 of `docs/V1_IMPLEMENTATION_PLAN.md`.

## Cross-cutting facts (they apply to every desk)

- **Shell and guard.** Every `/admin/*` route except `/admin/login` renders inside `<Gate flag="adminDesk"><RequireTeam><AdminShell/>` (`routes.tsx:458-470`). `AdminShell` wraps each desk in `<DeskBoundary key={pathname}>` (`AdminShell.tsx:195`), so a desk that throws cannot take down the shell. An unknown `/admin/...` path redirects to `firstVisiblePath` (`routes.tsx:600`, `:297-300`).
- **List desks share one kit.** They use `useListController` plus `DeskList` (`kit/DeskList.tsx:52-60`), which renders loading ("Loading…"), a banner for errors, the desk's own empty sentence, and the rows. Wherever this report says "states: kit", those four states are rendered.
- **Pagination cap bug.** The backend caps `per_page` at 100 (`apps/core/pagination.py:18`), but several callers ask for `per_page: 500` or `200` and never walk `has_next`:
  - `ArtistsPage.tsx:73`
  - `ArtworksPage.tsx:94`
  - `ArtworkEditorPage.tsx:110`
  - `RecordEditorPage.tsx:74`
  - `exhibitions/IssueDocumentPage.tsx:196`
  
  Past 100 rows, artists silently drop out of the roster, the artist filter and the name map. Document reference numbering (`IssueDocumentPage.tsx:191-209`) then works from the newest 100 of a kind only.
- **Structured `missing` list is dropped.** The G-CAT-8 publish gate returns a 400 with `details.missing` (`apps/catalog/services.py:158-164`). The HTTP layer does parse field errors (`HttpClient.ts:203-214`), but no desk reads `missing`. Both publish toggles show only `err.message`, which is the backend's flattened "Validation failed: …; missing: …" string:
  - `ArtworksPage.tsx:117-129`
  - `ArtworkEditorPage.tsx:187-198`
- **Admin endpoints with no service method at all in `services.ts`** (grep confirmed):
  - sales `summary/`, `follow-up/`, `notes/`
  - auction PATCH, `archive/`, `cover-image/`
  - lot PATCH
  - registration `reset/`
  - `access-keys/` roster and `access-keys/summary/`
  - `collectors/summary/`
  - gallery link `reissue/` and link DELETE
  - `pricelists/{id}/status/` and `pricelists/cap/`
  - `exhibition-catalogue/*`
  - document `activity/` and `share/`
  - crm `messages/{id}/archive/`
  - projects `totals/`
  - all of `recommendations/admin/*`
  - all of `marketing/admin/*`

---

## Desks

### Dashboard: `/admin` → `DashboardPage.tsx`
- **Purpose:** the landing desk. Tiles for requests, today, collectors, catalogue, auctions and exhibitions.
- **Endpoints:** `GET /dashboard/admin/summary/` (`useDashboard.ts` → `dashboard.summary`) and `/options/`.
- **What works:**
  - The tiles render.
  - Request tiles deep-link to `/admin/requests?kind=` (`DashboardPage.tsx:99`).
  - Collector, auction, registration and exhibition tiles are links (`:107-140`).
  - Loading and error states are rendered.
- **Gaps:**
  - The Catalogue tiles (Available / On hold / Reserved / Sold) are **not links** (`DashboardPage.tsx:118-123`), even though the Database desk exists and the backend filters on `availability_status`.
  - "New collectors", "Sign-ins" and "Bids" are not links (`:108-110`).
  - There are no analytics charts. That is correct: no API exists for them.
- **Roles:** there is no owner/standard difference, and the backend has none either.

### Chat: `/admin/chat` → `AdminChatPage.tsx`; `/admin/chat/:id` → `AdminThreadPage.tsx`
- **Purpose:** the team's end of every collector conversation. A conversation is a crm Request.
- **Endpoints:**
  - `GET /crm/admin/requests/` with search and pagination (`AdminRequestsController`)
  - `GET/POST /crm/admin/requests/{id}/messages/`
  - `POST …/messages/mark-seen/` (`AdminThreadController.ts`)
- **What works:**
  - The list has search, the unread badge and pagination.
  - The thread supports reading, replying and marking messages seen.
  - The empty copy is ported.
  - Loading and error states are rendered.
- **Gaps:**
  - **`document_refs` (attach = share) is not wired.** `adminPostMessage` sends only `body` and `artwork_refs` (`services.ts:251-255`). The composer has no document picker, and messages do not render the enriched `[{id,kind,title}]`.
  - **Message archive is unused.** Neither `POST /crm/admin/messages/{id}/archive/` nor `?include_archived=` (G-CHAT-2) is called. The header still says "Nothing here archives a message… Backend gap G-CHAT-2" (`AdminChatPage.tsx:55-59`), which is stale.
  - **G-CHAT-1 is still genuinely open.** There is no `GET /crm/admin/requests/{id}/`, so the thread header depends on router state.
- **Not built (no backend):** AI Monitor, per-conversation status/assignee, conversation renewal.

### Requests & Activity: `/admin/requests` → `AdminRequestsPage.tsx` (+ `ActivityFeed.tsx`)
- **Purpose:** the unified CRM request feed, plus the collector activity feed.
- **Endpoints:**
  - `GET /crm/admin/requests/` (search / kind / status / archived / page)
  - `POST /crm/admin/requests/{id}/transition/`
  - `GET /crm/admin/activity/`
  - `/options/`
- **What works:**
  - Search, kind, status and archived filters; pagination.
  - The transition action uses each row's `allowed_transitions`.
  - The unread count links to the thread.
  - States: kit.
- **Gaps:**
  - Admin archive and assignee are not settable anywhere in the backend. That is correct as stated in the header.
  - The G-3 urgency band is an owner decision.
  - Status: effectively complete against the current API.

### Artworks → Database: `/admin/artworks` → `ArtworksPage.tsx` (+ `ArtworksController.ts`)
- **Purpose:** the admin catalogue list.
- **Endpoints:**
  - `GET /catalog/admin/artworks/`
  - `GET …/artworks/facets/`
  - `POST …/{id}/publish|unpublish/`
  - `DELETE …/{id}/`
  - `GET /catalog/admin/artists/` (for the name map)
- **What works:**
  - Search.
  - Filters: artist, availability, currency, price type, medium, year, source, published, has_images, with removable chips.
  - Sort (artist / year / price), pagination.
  - Per-row publish toggle and soft-delete with a confirm.
  - Empty copy; states: kit.
- **Gaps:**
  - **Thumbnails and `artist_name` (G-CAT-1) are not used.** The header still says the row "carries no images (G-CAT-1)" (`ArtworksPage.tsx:23-24`), and artist names are resolved from a capped roster fetch (`:88-96`, `:144`).
  - **The Phase 5b hard filters are served but not wired.** `gallery_portal`, `complete`, `duplicate_images`, `size` (backend `catalog/filters.py:199-203`) are all missing from `ArtworkAdminQuery` (`types.ts:462-484`). The desk says they are absent (`ArtworksPage.tsx:544-547`).
  - **`source_type` and `created_after` filters are not exposed** (`types.ts:462-484`).
  - **The publish gate's `missing` list is not handled** (see cross-cutting).
- **Not built:** bulk selection and bulk actions, and the cards view.

### Artworks → editor: `/admin/artworks/new|:id` → `ArtworkEditorPage.tsx`
- **Endpoints:**
  - `GET/POST/PATCH /catalog/admin/artworks/{id}/`
  - `/transition/`, `/publish/`, `/unpublish/`
  - images: GET / POST / DELETE
  - selection-grants: GET / POST / DELETE
  - artists and collectors for the pickers
- **What works:**
  - Full create/edit.
  - Guarded status transitions.
  - Multi-image upload/delete.
  - Selection grants.
  - Optimistic lock with `ConflictBanner`.
  - Loading and error states.
- **Gaps:**
  - The publish `missing` list is shown only as flattened text (`:187-198`).
  - `source_type` (G-HEALTH-2) is not editable.
  - The artists picker is capped at 100 (`:110`).
  - The recommendations tag endpoints (`/recommendations/admin/artworks/{id}/tags/`, `…/ai/`, `…/auto/`, tag approve/lock) have no UI. This is the Intelligence group.
- **Old fields with no backend:** G-CAT-4/5/6/7 are stated on the page.

### Artworks → Import: `/admin/import`, `/admin/import/:id` → `ImportPage.tsx`, `ImportBatchPage.tsx`
- **Endpoints:**
  - `GET/POST /catalog/admin/import/batches/`
  - `GET …/{id}/`
  - `POST …/confirm|discard/`
  - `PATCH …/rows/{id}/`
  - `POST …/rows/{id}/reject/`
- **What works:**
  - CSV and paste staging with a column mapper.
  - Batch list and pager.
  - Row JSON edit and reject.
  - Confirm and discard.
  - States: kit and inline.
- **Gaps:**
  - PDF and Images intake are not built (D15, stated).
  - Status: **Complete** for V1 scope.

### Artists: `/admin/artists` → `ArtistsPage.tsx`
- **Endpoints:** `GET/POST /catalog/admin/artists/` and `PATCH/DELETE …/{id}/`.
- **What works:**
  - Create, inline intro edit with the lock (`ConflictBanner`), delete.
  - Client-side search and sort.
  - Empty copy.
- **Gaps (G-CAT-3 is now served but unused):**
  - `artists()` accepts only page and per_page (`services.ts:706-711`), so server `search`, `ordering` (name / created / works) and `works_count` go unused.
  - The desk fetches `per_page: 500` once (`ArtistsPage.tsx:73`). The backend clamps that to 100, and there is no pager, so **the roster silently truncates at 100 artists.** Search and "Showing n of m" then run over the truncated set (`:84-94`, `:262`).
  - The header still says there is "no server search" and no aggregates (`:19-21`).
  - Works and in-app counts, and the card view, could now be built from `works_count`.
- **Not built (backend G-ART-1):** the profile status lane.

### Galleries / Sources & Partners: `/admin/sources` (+ `?type=gallery`, `?view=exhibitions`) → `SourcesPage.tsx`, `ExhibitionsQueue.tsx`
- **Endpoints:**
  - `GET/POST /gallery/admin/links/` (issue link)
  - `GET /gallery/admin/updates/`
  - `POST …/updates/{id}/approve|reject/`
  - `GET /gallery/admin/exhibitions/`
- **What works:**
  - The `source_type` segment.
  - Issuing a link shows the token and PIN once.
  - The pending-updates banner and the updates queue (approve/reject with a note).
  - The exhibitions queue.
  - Loading, error and empty states.
- **Gaps:**
  - **Partner search is client-side over one page of 100** (`SourcesPage.tsx:109-120`). G-PORT-15 (`?search=`) is served but unused.
  - **The `withdraw` update kind (G-PORT-6) gets the wrong confirm.** `applies()` covers availability, price and correction only (`SourcesPage.tsx:557-558`). Approving a withdraw *does* unassign the work server-side, yet the confirm tells the admin it "changes nothing automatically" (`:634-635`).
  - The `image` and `ask` kinds (G-PORT-1/4) have no specific rendering: no replacement-image preview, no answer path.
  - Link DELETE is not exposed.

### Source detail: `/admin/sources/:id` → `SourceDetailPage.tsx`, `SourceDocuments.tsx`, `SourceExhibitions.tsx`
- **Endpoints:**
  - `GET /gallery/admin/links/{id}/`
  - `enable/`, `disable/`, `features/`
  - link artworks: GET / POST / DELETE, plus `funnel/`
  - `GET …/links/{id}/pricelists/`
  - `GET/POST …/links/{id}/messages/`
  - `POST …/links/{id}/exhibitions/`
  - `GET …/exhibitions/`
  - `GET …/exhibitions/{id}/documents/`
- **What works:**
  - The record card, enable/disable, funnel switches.
  - Assign, remove and override for works.
  - The pricelist list.
  - Issued documents.
  - The Q&A thread.
  - Creating a show.
- **Gaps:**
  - **Link reissue (G-PORT-13) is served but unused.** The page still says "there is no re-issue in the backend yet" (`SourceDetailPage.tsx:150-159`, `:20`; also `SourcesPage.tsx:316`).
  - **The pricelist P3a/P3b work is unused.** There is no `status` action (`POST /gallery/admin/pricelists/{id}/status/`), no soft-cap read (`…/pricelists/cap/`), and no rendering of structured `lines`. **`file_url` (G-PORT-14) is ignored.** The section says "The file itself is not served to the desk yet (G-PORT-14)" (`SourceDocuments.tsx:11-13`, `:72-73`).

### Exhibition compose: `/admin/sources/:id/exhibitions/:eventId` → `ExhibitionComposePage.tsx`
- **Endpoints:**
  - `GET /gallery/admin/exhibitions/{id}/`
  - `POST …/compose/`, `…/publish/`
  - `GET …/documents/`
  - `POST …/documents/{doc}/sign/`
  - `/projects/admin/service-catalog/` (prices)
- **What works:** read the request, compose lines, approve, publish, sign documents.
- **Gaps:**
  - **The admin exhibition catalogue (G-PORT-12b) is not used.** The menu is still built client-side "(G-PORT-12)" (`ExhibitionComposePage.tsx:104`).
  - **Line `quantity` (G-PORT-16) is never sent.** `ExhibitionLineInput` has no `quantity` (`types.ts:879-888`), and `toWireLines` sends `price` as the line amount (`exhibitions/issueForm.ts:106-115`).
  - Exhibition PATCH and DELETE exist as service methods (`services.ts:1007`, `:1017`) but no admin page calls them.

### Exhibition Services: `/admin/exhibition-services` → `exhibitions/ExhibitionServicesPage.tsx`
- **Endpoints:** `/projects/admin/service-catalog/` (CRUD, with the lock) and `/projects/admin/packages/` (read).
- **What works:** inline edit, add, delete, and a read-only list of programmes.
- **Gaps:**
  - **Service `description` (G-PROJ-8) is served but not read or written.** Descriptions come from a hardcoded client map, `DESCRIPTIONS` (`exhibitions/servicesLibrary.ts:16-19`, `:107`). The desk tells the owner "the backend stores a name, a unit and a price only (G-PROJ-8)" (`ExhibitionServicesPage.tsx:348-351`), which is stale.
  - It also does not use the gallery exhibition-catalogue CRUD, which is the menu the portal actually shows.

### Issue a document / Documents → Create: `/admin/issue`, `/admin/issue/:eventId` → `exhibitions/IssueDocumentPage.tsx`
- **Endpoints:**
  - `GET /documents/admin/documents/?kind=` (reference numbering)
  - `GET /gallery/admin/exhibitions/`, `…/links/`
  - `POST …/exhibitions/{id}/compose/`
  - `POST …/exhibitions/{id}/documents/`, `…/upload/`, `…/confirm/`
  - projects services and packages
- **What works:** one page from choosing a show to the issued PDF (client-rendered, uploaded, confirmed), with a live preview.
- **Gaps:**
  - Quantity is not persisted on compose lines (see above).
  - The reference-number read uses `per_page: 200`, which is capped at 100 (`:196`).

### Market App → Published works: `/admin/published` → `PublishedPage.tsx`
- **Endpoints:**
  - **Collector** `GET /catalog/artworks/` (the public slice)
  - `GET /catalog/admin/data-health/` (published-but-hidden count)
  - `POST …/unpublish/`
- **What works:** stat tiles, search, remove from app, edit link, loading and error states.
- **Gaps:**
  - The header says an every-published-work count waits on "G-CAT-2's `is_published` filter" (`PublishedPage.tsx:29-33`). The admin list already serves `?published=` (backend `catalog/filters.py:196`), and the Database desk uses it. **This is stale; Selected/Private-visibility published works are still missing from this desk.**
  - "Confirm available" (G-CAT-9) is not built.

### App Design: `/admin/design` → `DesignPage.tsx` (Market App and Operations groups)
- **Endpoints:** `GET/PUT /admin/app-theme/`, `POST …/reset/`, versions GET/POST/DELETE and activate.
- **What works:** feature switches, save, save version, activate, delete, reset; other theme keys shown read-only.
- **Gaps:**
  - Fonts, colours and copy editors are deliberately not built (no consumer yet, D17).
  - Status: **Complete** for scope.

### Documents → Proposals / Invoices / Library: `/admin/documents[?kind=]` → `DocumentsPage.tsx`; `/admin/documents/:id` → `DocumentDetailPage.tsx`
- **Endpoints:**
  - `GET/POST /documents/admin/documents/`
  - `GET/PATCH/DELETE …/{id}/`
  - `…/upload/`, `…/confirm/`, `…/sign/`, `…/archive/`
  - `…/versions/`
- **What works:**
  - The list filters by kind only (`DocumentQuery`, `types.ts:524-528`); pagination and create.
  - Detail: edit the JSON fields, upload a PDF, confirm, sign, archive, owner-only delete, versions, copy link.
  - States: kit and inline.
- **Gaps:**
  - **The document activity feed (G-DOC-2, `GET …/{id}/activity/`) is unused.** The nav "History" tab is still `path: null` because it "waits on an audit feed (G-DOC-2)" (`adminNav.ts:257-264`).
  - **`POST/DELETE …/{id}/share/` (G-DOC-1 share with collector) is unused.** The header says "there is no way to attach a document to a collector thread yet" (`DocumentDetailPage.tsx:11-14`), which is stale on two counts: the share endpoint and `document_refs`.
  - **`owner_lock` is displayed but not enforced in the UI.** Save, Upload, Confirm, Sign and Archive stay enabled for a standard admin (`DocumentDetailPage.tsx:222-352`). The backend raises 403 on all of them (`apps/documents/services.py:17-19`, `:31-97`).
  - Pricelists & saved items, and the Document Builder (Studio, D18), have `path: null` (`adminNav.ts:266-281`).

### Auctions → Live Auctions: `/admin/auctions` → `AuctionsAdminPage.tsx`; `/admin/auctions/:id` → `AuctionAdminDetailPage.tsx`
- **Endpoints:**
  - `GET/POST /auctions/admin/auctions/`
  - `GET/DELETE …/{id}/`
  - `GET/POST …/invite-only/`
  - `GET/POST …/{id}/lots/`
  - `GET /auctions/admin/lots/{id}/`
  - `POST …/go-live/`, `…/close/` (force)
- **What works:**
  - The list: client-side search, a status filter, create, delete. It loads `per_page: 100` with no pager (`AuctionsAdminPage.tsx:78`).
  - Detail: the record card, the invite-only switch and collector picker, creating lots, go-live and close/close-early.
- **Gaps (the 2026-09-25 and B2 backend work is unused):**
  - **Auction PATCH (G-AUC-1) and terms/terms_required on create are unused.** `createAuction` has no `terms` (`services.ts:1085-1093`). User-visible copy still says "an auction has no edit endpoint yet (G-AUC-1)" (`AuctionAdminDetailPage.tsx:91-92`).
  - **Lot PATCH (G-AUC-2) is unused.** The copy says lots are "create-only (G-AUC-2)" (`AuctionAdminDetailPage.tsx:410`).
  - **Archive and `?archived=` (G-AUC-4) are unused.** `AuctionQuery` has no `archived` (`types.ts:87-90`). The header says "G-AUC-4… nothing to filter on" (`AuctionsAdminPage.tsx:37-43`).
  - **The cover image (POST/DELETE `…/cover-image/`, `cover_image_url`) is unused.**
  - There is no optimistic-lock or conflict path, because there is no edit at all.

### Auctions → Auction Records: `/admin/auction-records`, `/new`, `/:id` → `RecordsAdminPage.tsx`, `RecordEditorPage.tsx`
- **Endpoints:** `GET/POST /auctions/admin/records/` and `GET/PATCH/DELETE …/{id}/`.
- **What works:**
  - Search, section, status and highlight filters; pagination; delete.
  - The full editor with `expected_version` and `ConflictBanner`.
- **Gaps:**
  - **The `?house=` facet (G-REC-1) is unused.** `AuctionRecordQuery` has no `house` (`types.ts:59-71`), and the header says "Backend gap G-REC-1" (`RecordsAdminPage.tsx:31-34`).
  - The editor's artist picker is capped at 100 (`RecordEditorPage.tsx:74`).

### Auctions → Register to Bid: `/admin/auction-registrations` → `RegistrationsPage.tsx`
- **Endpoints:**
  - `GET /auctions/admin/registrations/`
  - `POST …/{id}/approve|reject/`
  - the auctions list for titles (`per_page: 100`, `:80`)
  - `/auth/admin/collectors/{id}` per row
- **What works:** status and auction filters, approve/reject, the paddle column, states: kit.
- **Gaps:**
  - **Reset (G-AUC-3, `POST …/registrations/{id}/reset/`) is unused.** The header says "no such endpoint (G-AUC-3)" (`RegistrationsPage.tsx:37-40`).
  - Auction titles beyond the first 100 auctions show "…" (`:88`).

### Collectors: `/admin/collectors` → `CollectorsPage.tsx` (+ `CollectorForm.tsx`)
- **Endpoints:** `GET/POST /auth/admin/collectors/`, plus three `per_page: 1` count reads for the tiles (`CollectorsPage.tsx:79-90`).
- **What works:**
  - Search, tier and access-status filters, ordering by name or created, pagination, create.
  - Edit with the lock (409 → message).
  - A three-tile strip.
- **Gaps:**
  - **`GET /auth/admin/collectors/summary/` (G-COL-1) is unused.** It serves the old Collectors · VIP · Active-30d · Engaged strip. The desk substitutes "Active" (access) for Active-30d and Engaged (`collectorTiles.ts:18`).
  - **`last_activity_at`, `purchase_count` and `?ordering=activity|purchases` (G-COL-2) are unused.** `CollectorAdminQuery.ordering` is limited to name and created (`types.ts:269-276`). The header says "Still not ported (G-COL-2)" (`CollectorsPage.tsx:26-29`).
  - "Notify collectors" is not built. The header's stated reason, "no endpoint publishes the VAPID public key (G-P13-1)" (`:31-37`), is stale; the VAPID key is served. There is still no admin *send* endpoint, so the feature remains blocked.

### Collector detail: `/admin/collectors/:id` → `CollectorDetailPage.tsx`
- **Endpoints:**
  - `GET/DELETE /auth/admin/collectors/{id}/`
  - `GET/POST …/{id}/access-keys/`
  - `POST /auth/admin/access-keys/{id}/revoke|extend/`
  - `GET …/{id}/login-events/`
- **What works:** the record, issuing a key (shown once), revoke, extend, the expiry cell, sign-ins, delete. Loading and error states.
- **Gaps:**
  - The per-collector recommendation endpoints (`/recommendations/admin/collectors/{id}/preferences|batches|recommendations/…`) have no UI. This is the Intelligence group.

### Collector Club: `/admin/club` → `ClubPage.tsx`
- **Endpoints:**
  - `GET/POST /crm/admin/selections/`
  - `PATCH/DELETE …/{id}/`
  - collectors and catalog-admin artworks pickers
- **What works:** cards, the editor with pickers, the lock with `ConflictBanner`, a delete confirm with the grant-overlap copy, two tiles.
- **Gaps:**
  - **The selection `thumb` (G-CLUB-1) is unused.** The cover is "always the fallback" (`ClubPage.tsx:171`).
  - **The G-CLUB-3 note is wrong.** The header calls invite-only auctions "blocked… no invited-keys relation" (`ClubPage.tsx:52-59`), but invite-only exists and is wired on `AuctionAdminDetailPage`. The Club's "Auction access" section and its "Private auctions" tile could be built.
  - The list loads `per_page: 100` with no pager (`:78`).

### Sales → Market Sales: `/admin/sales` → `SalesPage.tsx`, `SalesController.ts`, `useSaleRefs.ts`; `/admin/sales/:id` → `SaleDetailPage.tsx`
- **Endpoints:**
  - `GET/POST /sales/admin/sales/` (filter `status` only)
  - `GET/PATCH …/{id}/`
  - `POST …/transition/`, `…/payment-status/`, `…/delivery-status/`
  - four `per_page: 1` status counts (`SalesPage.tsx:94`)
  - per-row collector and artwork retrieves plus the team-users roster (`useSaleRefs.ts`)
- **What works:** the list with a status filter and pagination, create, legal transitions, payment/delivery setters, draft-only money edit with `ConflictBanner`.
- **Gaps (the biggest adoption backlog):**
  - **G-SALE-1: the `summary/` endpoint is unused.** Tiles still come from per-status counts.
  - **G-SALE-2: search and the `payment_status`, `delivery_status`, `source` and `ordering` filters are unused.** `SaleQuery` has `status` only (`types.ts:506-510`), and the on-screen copy says they "wait on the API (G-SALE-2)" (`SalesPage.tsx:201-204`).
  - **G-SALE-3: nested artwork, collector and responsible are ignored.** `useSaleRefs` still issues N retrieves per page, and `types.ts:496-500` still calls them bare uuids.
  - **G-SALE-5: follow-up and notes are unused.** There is no `follow_up_at` / `follow_up_overdue` or `POST …/follow-up/`, and no `GET/POST …/notes/`. The "Need attention" tile is still dropped (`SalesPage.tsx:22-26`, `SaleDetailPage.tsx:15-17`).
  - **`lot` (the auction link) is not rendered.**

### Sales → Auction Sales: nav tab `auctionSales` has `path: null` (`adminNav.ts:343-350`)
- **Gap:**
  - `?source=auction` (G-SALE-4) and the auto-created draft auction sales with a `lot` link are fully served, but there is no route and no desk.
  - The nav note says "Sale has no source axis (G-SALE-4)", which is stale.
- **Status:** API exists, UI missing.

### Projects (eight routes under `/admin/projects…`) → `projects/*.tsx`
- **Routes:** Dashboard, List, New, Pipeline, Packages (+ editor), Calculator, Partners, Reports, Project record (+ report).
- **Endpoints:**
  - projects list/create/detail/PATCH/DELETE
  - `stage/`, `dashboard/`, `reports/`
  - attachments
  - partners CRUD, service-catalog CRUD, packages CRUD, checklists CRUD
  - document create/upload/confirm (the proposal)
- **What works:**
  - Full CRUD across the group.
  - `expected_version` with `ConflictBanner` on Project, Pipeline, Partners, Packages, Package editor and Reports.
  - The owner money gate (UI only; see roles).
  - Loading, error and empty states.
- **Gaps (the 2026-09-25 work is unused):**
  - **G-PROJ-1: `?quick=` and `?partner=` are unused.** `ProjectQuery` lacks both (`types.ts:965-974`). The List walks every project client-side for quick mode (`ProjectsListPage.tsx:41-47`). Partners walks all active projects (`ProjectPartnersPage.tsx:169`). Pipeline says "no server-side partner / quick filters (G-PROJ-1)".
  - **G-PROJ-2: status is shown read-only**, with the note "status is not writable (G-PROJ-2)" (`ProjectPage.tsx:650`, `ProjectsListPage.tsx:358`). It is now PATCHable.
  - **G-PROJ-3: the stage sub-state is not written.** Delayed and Awaiting-approval tiles are "stay at 0" (`ProjectsDashboardPage.tsx:117-122`). There is no checklist seeding on a stage move (`ProjectPipelinePage.tsx:251-255`, `ProjectPage.tsx:412`, `ProjectsReportsPage.tsx:388-392`). `stages` is now PATCHable.
  - **G-PROJ-8: service `description` is not used.** The Packages note says the backend has "nowhere to put" it (`PackagesPage.tsx:1254-1258`).
  - **G-PROJ-9: the FX fields are unused.** `deal_currency`, `deal_fx_target_currency`, `deal_fx_rate` and `deal_fx_rate_date` are not edited on `ProjectPage` (grep shows no `deal_fx` in `projects/`). `GET …/projects/{id}/totals/` has no service method.
- **Nav:** the Proposal tab is `path: null` by design. It issues from the project record (`adminNav.ts:377-386`).

### Intelligence group (Overview, Tagging & Review, Smart Filters, Recommendations, History)
- **Nav:** all five tabs are `path: null` with `api: 'ready'` (`adminNav.ts:403-420`). `visibleTabs` filters null paths (`adminNav.ts:615-617`), so the whole group is hidden.
- **Status:** API exists, UI missing. TASKLIST G-6 says this is deferred by the owner.

### Operations → Data Health: `/admin/data-health` → `DataHealthPage.tsx` (+ `healthCounts.ts`)
- **Endpoints:** `GET /catalog/admin/data-health/` plus admin artwork list counts.
- **What works:** three checks, a counts panel with some tiles built, loading and error states.
- **Gaps:**
  - **G-HEALTH-2: the Gallery-, Dealer- and Artist-Sourced tiles are still "absent"** (`healthCounts.ts:25`). They could come from `?source_type=` counts.
  - **G-HEALTH-3: the "Deleted" tile is still absent** (`healthCounts.ts:26`), although the report now carries `deleted_records`. `deleted_records` is not in the frontend code at all.
  - **G-HEALTH-4: the "Recently added" tile is still absent** (`healthCounts.ts:27`). It could use `?created_after=`, which `ArtworkAdminQuery` does not have.
- **Nav:** Logistics & Payments and Analytics are `path: null` with no backend (`adminNav.ts:430-446`).

### Social group (Instagram, Insights & Stories, Content Calendar, AI Settings)
- **Nav:** all tabs are `path: null` (`adminNav.ts:456-491`), and there is no backend.
- **Status:** Not V1.

### Owner → Team: `/admin/team` → `TeamPage.tsx` (RequireOwner)
- **Endpoints:** `GET/POST /auth/admin/team-users/` and `PATCH/DELETE …/{id}/` (all `IsOwner`).
- **What works:** issue a login (password shown once), search, role filter, edit with the lock (409 message), self-deactivate/remove disabled with a reason.
- **Gaps:**
  - The G-TEAM-1 workspace suite has no backend.
  - Status: **Complete**.

### Owner → Accounting: `/admin/accounting[?view=deals|settlement|duplicates]`, `/deals/new|:id`, `/entries/:id` → `AccountingPage.tsx`, `AccountingDeals.tsx`, `AccountingSettlement.tsx`, `AccountingDuplicates.tsx`, `DealEditorPage.tsx`, `LedgerEntryPage.tsx` (all RequireOwner)
- **Endpoints:** every `/accounting/admin/*` route is bound:
  - ledger CRUD, `summary/`, `status/`, `review/`, attachments
  - `arian/duplicates/`
  - deals CRUD, `summary/`, attachments
  - settlement GET/PUT and versions
- **What works:** four books, the per-currency summary, month/type/status filters, the ledger lock with `ConflictBanner`, deals, the duplicates queue, and the settlement JSON editor with versions.
- **Gaps:**
  - The settlement calculator is deliberately not ported (`AccountingSettlement.tsx`).
  - Deals and documents have no optimistic lock on the backend either, so there is nothing to adopt.
  - Status: **Complete** (calculator not V1).

### Owner → Settings: `/admin/settings` → `SettingsPage.tsx` (RequireOwner)
- **Endpoints:** `GET /admin/audit-log/` (`IsOwner`).
- **What works:** the audit log list with pagination and a CSV export of the current page. The scope statement is shown on screen.
- **Gaps:**
  - The role/tab matrix, force-dark and passkey have no API (stated).
  - Docs inconsistency: `docs/ADMIN_SCREENS.md:118` lists the Settings route as "—", but the route exists (`routes.tsx:528`).

### Owner → Access, Marketing, Market Portal, Strategy, Automations, Languages
- **Access** (`adminNav.ts:500-507`, `path: null`): `GET /auth/admin/access-keys/` and `…/summary/` (G-KEY-1) are served, but there is **no service method, no route and no desk.** Per-collector keys do exist on `CollectorDetailPage`.
- **Marketing** (`:516-523`, `path: null`, `api: 'ready'`): `/marketing/admin/campaigns/*`, `generate-copy/` and analytics have no service or desk.
- **Market Portal** (`:562-569`, `path: null`): its function is covered by the Sources desk. The nav tab itself is dead.
- **Strategy, Automations, Languages:** no backend. Not V1.

### Access Management → Memberships: `/admin/memberships` → `MembershipsPage.tsx` (RequireOwner)
- **Endpoints:** `GET/POST /auth/admin/membership-codes/`, `PATCH/DELETE …/{id}/`, `POST …/renew/` (all `IsOwner`).
- **What works:** search and filters, create, edit with the lock (409), renew, delete, two tiles, WhatsApp link.
- **Gaps:**
  - The "Expiring ≤ 7d" tile needs an `expires_before` filter. The backend `MembershipCodeFilterSet` still has only search, plan and status (`apps/accounts/filters.py:35-42`), so this is a backend gap.
  - Status: Complete otherwise.

### Access Management → Access Request: `/admin/access-requests` → `AccessRequestsPage.tsx` (RequireOwner)
- **Endpoints:**
  - `GET /auth/admin/access-requests/`
  - `POST …/{id}/approve|decline/`
  - follow-up `PATCH /auth/admin/collectors/{id}/` for the D13 note
- **What works:** cards, approve with a tier and the key shown once, decline confirm, the pending badge, and the empty copy verbatim.
- **Gaps:**
  - A referral code cannot be resolved to a name (no lookup endpoint).
  - The page is owner-only in the UI while the backend is `IsStandardAdminOrOwner`; see Roles.

---

## Features referenced in the nav or docs but not implemented (`path: null` tabs)

`visibleTabs` drops every `path: null` tab (`adminNav.ts:615-617`). A group whose tabs are all null disappears.

| Tab (key) | adminNav line | Backend state |
| --- | --- | --- |
| Documents › History (`docHistory`) | 257-264 | **Unblocked:** `GET /documents/admin/documents/{id}/activity/` (G-DOC-2) |
| Documents › Pricelists & saved items (`library`) | 266-272 | Phase 21 not built. Note that G-PORT-3…6 pricelists exist *per link* |
| Documents › Document Builder (`archive`) | 274-281 | D18 (client PDF renderer) owner decision |
| Sales › Auction Sales (`auctionSales`) | 343-350 | **Unblocked:** `?source=auction` + `lot` |
| Projects › Proposal (`projProposal`) | 377-386 | By design: issued from the project record |
| Intelligence × 5 | 403-420 | **API ready:** 17 recommendations admin routes. Owner deferral (G-6) |
| Operations › Logistics, Analytics | 430-446 | No backend |
| Social × 4 | 456-491 | No backend |
| Owner › Access (`access`) | 500-507 | **Unblocked:** G-KEY-1 roster + summary |
| Owner › Strategy / Automations / Languages | 509-560 | No backend |
| Owner › Marketing (`marketing`) | 516-523 | **API ready:** 5 routes. Owner deferral (G-6) |
| Owner › Market Portal (`portal`) | 562-569 | Covered by Sources. Tab itself unused |

Stale nav notes: `adminNav.ts:263` (G-DOC-2 "waits") and `:349` (G-SALE-4 "no source axis"). Both are now served.

---

## Admin endpoint groups with no desk at all

These have no service method in `src/api/services.ts` and no page:

1. **Intelligence / recommendations admin** (`/api/recommendations/admin/…`):
   - artwork tags: list / ai / auto, plus tag approve and lock
   - collector preferences and rebuild
   - collector batches, and batch publish/unpublish
   - collector recommendations and generate; recommendation PATCH/DELETE
   - `feature-settings/`
2. **Question-set editor** (`/recommendations/admin/question-sets/` CRUD + `activate/`, G-P25-2). The collector questionnaire also still uses hardcoded questions (per `API_ADOPTION_PLAN.md` Batch 8 row).
3. **Marketing** (`/api/marketing/admin/campaigns/` CRUD, `generate-copy/`, per-campaign analytics CRUD).
4. **Access-keys roster** (`/auth/admin/access-keys/` + `summary/`, G-KEY-1). The owner "Access" desk.
5. **Exhibition-catalogue editor** (`/gallery/admin/exhibition-catalogue/` CRUD, G-PORT-12b). This is the menu the portal shows before Darz composes.
6. **Collectors overview summary** (`/auth/admin/collectors/summary/`, G-COL-1). Endpoint exists, not consumed.
7. **Sales aggregates / follow-up / notes** (`/sales/admin/sales/summary/`, `…/follow-up/`, `…/notes/`).
8. **Auction edit surface**: auction PATCH, `archive/`, `cover-image/`; lot PATCH; registration `reset/`.
9. **Gallery link lifecycle**: `reissue/`, link DELETE, `pricelists/{id}/status/`, `links/{id}/pricelists/cap/`.
10. **Document side-channels**: `…/{id}/activity/`, `…/{id}/share/` (POST/DELETE), and `document_refs` on crm admin messages.
11. **CRM message archive** (`/crm/admin/messages/{id}/archive/`, G-CHAT-2).
12. **Project totals / FX** (`/projects/admin/projects/{id}/totals/`; FX fields on PATCH).
13. **Document Builder / Studio.** No backend route is needed (the upload exists). It is blocked on the D18 renderer decision, not on the API.

---

## Role/permission findings

### How the gates are built
- **Principal gate:** `RequireTeam` (`src/features/auth/RequireTeam.tsx`) redirects anything that is not a `team` session to `/admin/login`. It wraps the whole `/admin` prefix (`routes.tsx:465-467`).
- **Role gate:** there are two layers.
  - `adminNav.OWNER_ONLY` (`adminNav.ts:78-92`) hides tabs from the navbar, and owner groups are dropped wholesale (`:622-626`).
  - `RequireOwner` (`RequireOwner.tsx:23-34`) renders a refusal card for a typed URL.
- **Routes wrapped in `RequireOwner`:** memberships, team, settings, accounting (×4) and access-requests (`routes.tsx:511-595`). Every owner-only tab that has a path is covered.
- **`isPathAllowed`** (`adminNav.ts:658-665`) is defined but not used by any route guard. It is harmless because the only role-restricted pages are wrapped individually.
- **Backend roles:** two exist, `owner` and `standard_admin` (`apps/core/permissions.py:24-25`).
  - `IsOwner` guards all of accounting (15 views), membership codes, team users and the audit log.
  - Everything else admin is `IsStandardAdminOrOwner`; projects uses `ADMIN_PERM`, an alias for it (`apps/projects/views.py:49`).
  - The UI's RequireOwner set matches the backend `IsOwner` set exactly, plus one extra (access requests, below).

### Mismatches
1. **Access requests: the UI is stricter than the API.** `/admin/access-requests` is RequireOwner (`routes.tsx:589-595`, via `OWNER_ONLY 'system'`). The backend list, approve and decline are `IsStandardAdminOrOwner` (`apps/accounts/views.py:718-760`). A standard admin cannot review the queue in the UI. This is a deliberate faithful port of the old panel, but it is a behaviour difference.
2. **Access keys, Marketing and Portal are owner-only in the nav but `IsStandardAdminOrOwner` on the backend.** None of them has a desk today, so there is no current effect. The rule should be settled before the Access desk is built.
3. **Document delete is a UI-only owner gate** (`DocumentDetailPage.tsx:53`, `:264`). The endpoint is `IsStandardAdminOrOwner`, and the header acknowledges this (`:27-37`).
4. **Document `owner_lock` is not reflected in the UI.** The backend refuses a standard admin's update, upload, confirm, sign, archive and delete on a locked document (`apps/documents/services.py:17-19`). The desk only prints "owner-locked" (`DocumentDetailPage.tsx:194`) and leaves every action enabled, so a standard admin gets a 403.
5. **Project money is hidden in the UI only.** Money and internal notes are hidden for standard admins via `projCanMoney` (8 files, for example `ProjectPage.tsx:269` and `ProjectsCalculatorPage.tsx:110`). The backend `ProjectSerializer` still returns `money` and `internal_notes` to any team user (`apps/projects/serializers.py:97-100`), so the gate is cosmetic. A standard admin can read the data from the API or network tab.
6. **Sales "responsible".** Team users are `IsOwner`, so `useSaleRefs` only resolves or offers responsible names for the owner (`useSaleRefs.ts:51-53`, `SalesPage.tsx:281`). A standard admin cannot pick a responsible person. G-SALE-3's nested `responsible {id,name}` now removes the read half of this problem; the picker half remains owner-only.
7. **Deal delete** is correctly owner-only in both layers (`AccountingDeals.tsx:55`; the backend is `IsOwner`).
8. **App Design** is open to a standard admin in both layers (`adminNav.ts:73-77`). That is consistent.

---

## Classification

| Desk | Status | Key gaps |
| --- | --- | --- |
| Dashboard `/admin` | Complete | Catalogue tiles not linked (`DashboardPage.tsx:118-123`) |
| Chat `/admin/chat(/:id)` | Partial | `document_refs` attach (`services.ts:251`); message archive (G-CHAT-2) unused; stale copy `AdminChatPage.tsx:55-59` |
| Requests & Activity | Complete | Only owner-decision items (G-3) |
| Artworks Database | Partial | thumb/artist_name unused (`ArtworksPage.tsx:23`); Phase 5b + source_type/created_after filters (`types.ts:462-484`); `missing` not structured; artists capped at 100 |
| Artwork editor | Partial | `missing` handling (`ArtworkEditorPage.tsx:187-198`); source_type; artists cap (`:110`) |
| Import | Complete | PDF/Images intake (D15) |
| Artists | Partial | Server search/ordering/works_count unused (`services.ts:706-711`); **truncates at 100** (`ArtistsPage.tsx:73`) |
| Sources & Partners / Galleries | Partial | Client-side search (G-PORT-15, `SourcesPage.tsx:109-120`); wrong withdraw confirm (`:557-558`, `:634-635`); image/ask kinds |
| Source detail | Partial | Reissue unused + stale copy (`SourceDetailPage.tsx:150-159`); pricelist status/cap/lines/file_url unused (`SourceDocuments.tsx:72`) |
| Exhibition compose | Partial | Exhibition-catalogue CRUD unused (`ExhibitionComposePage.tsx:104`); quantity not sent (`issueForm.ts:106-115`) |
| Exhibition Services | Partial | Service description hardcoded (`servicesLibrary.ts:107`) though served (G-PROJ-8) |
| Issue a document | Partial | Quantity not persisted; reference lookup capped at 100 (`IssueDocumentPage.tsx:196`) |
| Published works | Partial | Uses the public list; admin `?published=` available (`PublishedPage.tsx:29-33` stale) |
| App Design | Complete | Theme editors not built by design (D17) |
| Documents list/detail | Partial | Activity feed (G-DOC-2) + share unused; `owner_lock` not reflected in UI (`DocumentDetailPage.tsx:222-352`) |
| Documents › History | API exists, UI missing | `adminNav.ts:257-264` |
| Documents › Pricelists & saved items | Missing (backend Phase 21) | — |
| Documents › Document Builder | Not V1 / owner decision (D18) | — |
| Live Auctions list/detail | Partial | PATCH/terms (G-AUC-1), lot PATCH (G-AUC-2), archive (G-AUC-4), cover image unused; stale copy `AuctionAdminDetailPage.tsx:91`, `:410` |
| Auction Records | Partial | `?house=` (G-REC-1) unused (`types.ts:59-71`) |
| Register to Bid | Partial | Reset (G-AUC-3) unused (`RegistrationsPage.tsx:37-40`) |
| Collectors | Partial | `summary/` (G-COL-1) + activity/purchases sort (G-COL-2) unused (`types.ts:269-276`) |
| Collector detail | Complete | Per-collector recommendations (Intelligence) |
| Collector Club | Partial | thumb (G-CLUB-1) unused (`ClubPage.tsx:171`); stale G-CLUB-3 claim (`:52-59`) |
| Market Sales list/detail | Partial | summary, filters/search/ordering, nested rows, follow-up, notes, lot all unused (`types.ts:506-510`, `SalesPage.tsx:201-204`) |
| Auction Sales | API exists, UI missing | `adminNav.ts:343-350`; `?source=auction` + `lot` |
| Projects (8 desks + record) | Partial | quick/partner filters, status/stages PATCH, FX fields, totals, service description all unused (`types.ts:965-974`, `ProjectPage.tsx:650`, `ProjectsDashboardPage.tsx:117-122`) |
| Projects › Proposal tab | Complete (by design, from the record) | — |
| Intelligence (5 tabs) | API exists, UI missing | 17 routes; owner deferral G-6 |
| Data Health | Partial | source_type / deleted_records / created_after tiles (`healthCounts.ts:25-27`) |
| Logistics, Analytics | Missing (no backend) | — |
| Social (4 tabs) | Not V1 | — |
| Team | Complete | — |
| Accounting (all views) | Complete | Settlement calculator not ported (not V1) |
| Settings (audit log) | Complete (for its API) | Docs say route "—" (`ADMIN_SCREENS.md:118`) |
| Owner › Access (keys roster) | API exists, UI missing | G-KEY-1 roster + summary; no service method |
| Owner › Marketing | API exists, UI missing | 5 routes; owner deferral G-6 |
| Owner › Market Portal | Complete via Sources (nav tab dead) | `adminNav.ts:562-569` |
| Strategy / Automations / Languages | Not V1 | — |
| Memberships | Complete | Expiring ≤7d needs backend `expires_before` |
| Access Requests | Complete | UI owner-only vs backend standard-admin |
| Question-set editor | API exists, UI missing | G-P25-2 owner decision |
| Exhibition-catalogue editor | API exists, UI missing | G-PORT-12b |
