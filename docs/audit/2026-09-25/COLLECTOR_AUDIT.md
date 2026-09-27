# Collector-side API integration audit — `-darz-web`

Frontend at `d987910` (main = PR #100 merged; Batches 1-3 done). Backend `darz-backend-api`
`development` @ `df0421f` (PR #70, pricelist builder P3b). The generated `src/api/schema.d.ts` is
current for every collector path, but **stale for the portal**: it has no
`/portal/{token}/artworks/{artwork_pk}/image/` and no `/portal/{token}/pricelists/build/`. It also
lacks the admin pricelist status/cap, the exhibition-catalogue admin, sales summary/notes/follow-up
and projects totals. So Batch 1's regen predates backend PRs #67-#70.

All file:line references are to `/home/user/-darz-web` unless they say `BE:`.

---

## 1. Auth model (applies to every screen)

- **Public routes:** `/login` (`routes.tsx:307`), `/portal/:token` (`routes.tsx:606-613`, token+PIN
  only, gated by `features.galleryPortal`), `/_design` (`routes.tsx:614`), `/admin/login` (flag-gated).
  Everything else sits under `CollectorLayout` → `RequireAuth` (`routes.tsx:268-286`).
- **`RequireAuth`** (`features/auth/RequireAuth.tsx:9-16`) only checks that *a* session exists. It does
  not check the principal, so a **team** session can open collector routes. Profile shows "You are
  signed in with a team account" (`ProfilePage.tsx:501-505`). The curated count swallows the 403
  (`useCuratedCount.ts:13-14`). Other collector reads (for example `/crm/requests/`) will show their
  error state.
- **401 / expired access token:** `ApiClient.onResponse` (`api/ApiClient.ts:48-57`) refreshes once and
  retries. `AuthSession.refresh` (`api/AuthSession.ts:100-124`) shares one in-flight refresh and
  **clears the session on failure**. The snapshot flips `isAuthenticated=false`, and `RequireAuth` then
  redirects to `/login` with `state.from`. `LoginPage` sends the user back there after sign-in
  (`LoginPage.tsx:97-100`).
- **Boot:** `ApiProvider.tsx:28-56` awaits `session.resume()` (refresh + `/auth/me/`) together with
  `GET /api/app-theme/` (feature flags + owner settings + i18n) before first paint. A failed theme
  fetch leaves the build-time flags in place.
- **Logout:** `AuthSession.logout` (`AuthSession.ts:127-137`) blacklists the token best-effort, then
  clears. It is called from the header pill (`AppShell.tsx:155`), Profile › Account
  (`ProfilePage.tsx:123`) and Settings (`SettingsPage.tsx:132`), and each navigates to `/login`.
  Session-scoped providers reset on identity change (`ActivityProvider.tsx:19-23`,
  `ConversationsProvider`, `RecordsArchiveProvider`).
- **Access token** is held in memory only. The refresh token is stored in `localStorage` under
  `dz-refresh` (`AuthSession.ts:18`).
- **Crash containment:** collector screens sit under `ScreenBoundary` (`routes.tsx:263-265`).
  **`/portal/:token` and `/login` have no error boundary.**

---

## 2. Per-screen

### Market / catalogue `/` — `CataloguePage`
- Endpoints: `GET /catalog/artworks/` (`CatalogueController.ts:31`),
  `GET /catalog/artworks/selections/` (curated filter, same line, and the chip count at
  `useCuratedCount.ts:26`), `GET /options/` for currencies (`CataloguePage.tsx:43`).
- States: loading, error and empty are all present (`CataloguePage.tsx:88-90`).
- Gaps:
  - **G-P24-1 open.** The chip label is hardcoded "Curated for You" (`CuratedChip.tsx:76`).
    `selection_name` is in the schema (`schema.d.ts:6828`) but never read, and `useCuratedCount`
    fetches `per_page=1` for the count only.
  - **G-P24-2 open.** Nothing calls `GET /catalog/selections/` or `POST …/{id}/seen/`; no "selection
    ready" notice exists.
  - Hero copy is hardcoded at `CataloguePage.tsx:67-70`. It is marked "owner copy, THEME_DEFAULT", but
    `ownerSettings` does not read it from `/app-theme/`.
  - `GET /catalog/artworks/change-stamp/` is unused.

### Artwork detail `/artwork/:id` — `ArtworkDetailPage`
- Endpoints: `GET /catalog/artworks/{id}/` (`ArtworkDetailPage.tsx:127`). Actions go through
  `RequestController` to `POST /crm/requests/` with `client_req_id`
  (`RequestController.ts:302`). Save/unsave uses `POST /crm/saved/` and `DELETE /crm/saved/{id}/`
  (`SavedController.ts:113,129`).
- States: loading and error at `:169-170` (there is no empty state for a single object, which is
  fine).
- Share uses `navigator.share` and View in Room is client-side; both are genuinely wired.
- Commerce actions are hidden in v0.1 (`features.commerceActions=false`, `features.ts:84`).

### Artists `/artists`, `/artists/:id` — `ArtistListPage`, `ArtistDetailPage`
- Endpoints: `GET /catalog/artists/` (`ArtistListController.ts:18`) and `/catalog/artists/{id}/`
  (`ArtistDetailPage.tsx:96`).
- States: list loading/error/empty at `ArtistListPage.tsx:64-72`; detail loading/error at `:107-108`
  and empty works at `:168`.
- Gap **G-P5-11 open.** "Enquire about artist" files `kind=information` with the artist only named in
  the message text (`RequestController.ts:272-280`). `file()` never sends `artist`
  (`RequestController.ts:302-307`).

### Saved `/saved` — `SavedItemsPage`
- `GET /crm/saved/` (`SavedListController.ts:29`). Loading, error and empty at
  `SavedItemsPage.tsx:63-79`. Complete. The route is not behind the `save` flag.

### Records `/records`, `/records/artist/:id`, `/records/:id`
- Endpoints: `GET /auctions/records/`, paged through every page (`RecordsArchiveController.ts:114-120`),
  and `GET /auctions/records/{id}/` (`useAuctions.ts:44`).
- States: loading, error and empty everywhere (`RecordsPage.tsx:61-67`,
  `ArtistRecordsPage.tsx:39-40,69`, `RecordDetailPage.tsx:34-36`).
- `GET /auctions/records/highlights/` is unused. The Highlights sub-tab is deliberately not in v0.1
  (`RecordsPage.tsx:8-9`).
- The record status label map is hardcoded (`recordFormat.ts:46-50`); `auctions.record_status` exists
  in `/options/`.

### Chat `/chat`, `/chat/:id` — `ChatPage`, `ThreadPage`, `RequestDetail`
- Endpoints:
  - `GET /crm/requests/` (polled; `ConversationsController.ts:112`)
  - `GET /crm/requests/{id}/` for a cold deep link (`:173`, Batch 3)
  - `POST /crm/requests/` for the general thread (`:251`)
  - `GET`/`POST /crm/requests/{id}/messages/` and `POST …/mark-seen/` (`ThreadController.ts:31-37`)
- States: `ChatPage.tsx:72-73` (loading/error), `:90-94` (empty); `ThreadPage.tsx:87-88`
  (loading / not available), `:175-176` (thread error).
- Gaps:
  - **G-P5-5 open (owner decision).** There is no withdraw-offer / cancel-viewing control. No caller of
    `POST /crm/requests/{id}/transition/` exists (collector `CrmService` has only the admin transition,
    `services.ts:318-320`).
  - **G-P5-9 is with the owner.** The counter figure is not rendered.
  - `KIND_LABEL` is hardcoded (`conversations/rows.ts:13-23`). This is old-app copy that differs from
    `crm.request_kind` in `/options/`, so treat it as a copy decision rather than a bug.

### Profile `/profile` — `ProfilePage`, `Acquisitions`
- Endpoints: it reuses the conversations list and `GET /crm/saved/` (`ProfilePage.tsx:~517-530`), plus
  `GET /recommendations/questionnaire/` for the "Get to know you" card (`ProfilePage.tsx:238`, behind
  `features.questionnaire`).
- States:
  - Error is shown only as a line (`:129-130`).
  - **There is no loading state.** Overview tiles render `0` and "No requests yet" while the
    conversation poll is in flight (`:173-201`).
  - Market has an empty state (`:285-318`, "Nothing here yet" `:304`).
  - `Acquisitions` has no loading or error rendering of its own; it is derived from the requests.
- Gaps:
  - **Profile edit (PATCH `/auth/me/`) open.** Account is read-only. It says "To change your name or
    contact details, write to Darz in Chat" (`ProfilePage.tsx:452`), the header still says "the
    backend has no profile-update endpoint" (`:19-20`), and there is no `AuthService.updateMe`
    (`services.ts:1456-1498`). `Me` already carries
    `full_name/phone/city/preferred_language` (`schema.d.ts:8730-8733`), but only
    `display_name/name/tier/access_status` are displayed.
  - **G-DOC-1 open.** There is no "Your documents" section, no collector `DocumentsService`, and no
    call to `GET /api/documents/` (only `DocumentsAdminService`, `services.ts:803`).
  - **G-P5-4 open (owner decision).** "Clear activity" is session-only
    (`ConversationsController.ts:215-235`). The sheet copy says the list returns on reload
    (`ProfilePage.tsx:413-416`). `POST /crm/requests/{id}/archive/` is unused.
  - **G-P5-12 open (owner decision).** `GET /crm/activity/` is never read; `ActivityLogger` only writes
    (`ActivityLogger.ts:97`).
  - **G-P25-1 regression-in-waiting (see Questionnaire).** `GetToKnowYou` treats *any* 200 as "sent"
    (`ProfilePage.tsx:238-241`). Against the current backend, which answers 200 with `answered:false`,
    a first-time collector sees "Your taste, on file." and "Review your profile →". It is hidden in
    v0.1 only because `features.questionnaire=false`.
  - The "Curated for you" card named in the header (`:13`, behind `features.recommendations`) is
    **not built**. `RecommendationService.published/dismiss` are unbound (`services.ts:409-427`).

### Questionnaire `/questionnaire` — `QuestionnairePage`, `QuestionnaireController`
- Endpoints: `GET`/`POST /recommendations/questionnaire/` (`QuestionnaireController.ts:154,318`).
- States: loading at `QuestionnairePage.tsx:79`, submit error at `:349`. A failed load is
  deliberately treated as a fresh start (`QuestionnaireController.ts:135-139`).
- Gaps:
  - **G-P25-1 open, and now a live bug in code.** `load()` sets `submitted:true, stage:'review'` on any
    200 (`QuestionnaireController.ts:154-160`). The backend returns 200
    `{answers:null, submitted_at:null, answered:false}` for a never-answered collector
    (BE: `apps/recommendations/views.py:293-317`), so a new collector lands on an empty review. The
    header comment still documents the 404 (`:36`, `services.ts:429-431`). The generated type has
    `answered` (`schema.d.ts:7628`) but nothing reads it.
  - **G-Q-1 open.** The contact step is only sent as `{q,a}` rows and is never PATCHed to
    `/auth/me/` (`QuestionnaireController.ts:25-32`, `:341-360`).
  - **G-P25-2 open.** Questions are hardcoded in `QB_DEFAULT` / `INTRO_DEFAULT`
    (`questions.ts:46,166`) with a `theme.qbQuestions` override (`questions.ts:224-225`).
    `GET /recommendations/question-set/` is never called. `COMM_LANGS` is hardcoded too
    (`questions.ts:196`).

### Settings `/settings` — `SettingsPage`, `MembershipSheet`
- Endpoints: `POST /auth/membership/redeem/` then `/auth/me/` (`MembershipSheet.tsx:125,129`, behind
  `features.membership=false`), and logout.
- States: none are needed (static). The sheet handles redeem busy/error itself.
- Looks wired but isn't:
  - "Edit profile" (`SettingsPage.tsx:235`) links to the read-only Account view.
  - The `features.push` card "Push to this device" (`:182-195`) has a label and **no control**.
    **G-P13-1 open:** there is no `vapid-public-key` read and no `push/subscribe`.
- **G-MEMB-3/6/7 open.** There is no `GET /auth/my-membership/` call anywhere. The sheet header still
  states "There is no 'my membership' read" (`MembershipSheet.tsx:17-30`). There is no status pill or
  "Active until".
- Hardcoded:
  - Tier prices and inclusions (`membership/tiers.ts:29-60`, G-MEMB-4, faithful to the old app).
  - Legal links to `https://darzmarket.art/terms|privacy|auction-terms` (`SettingsPage.tsx:256,268,281`).
    `GET /api/documents/public/{kind}/` exists and is unused, so this is an owner question.

### Auctions `/auctions`, `/auctions/:id`, `/auctions/lots/:lotId`, `/auctions/notifications` (hidden in v0.1)
- Endpoints:
  - `GET /auctions/` (`AuctionListController.ts:25`)
  - `GET /auctions/{id}/` and `GET /auctions/{id}/lots/` (`useAuctions.ts:49,54`)
  - `GET /auctions/lots/{id}/` plus the socket, and `POST …/bids/` (`LotController.ts:105,123`)
  - `GET …/bids/` (`useAuctions.ts:74`)
  - `GET`/`POST /auctions/registrations/` (`RegistrationController.ts:53,73`)
  - notifications and read (`AuctionNotificationsController.ts:38,85`)
- States: list at `AuctionListPage.tsx:77-81`, event at `AuctionEventPage.tsx:91-92`, lot at
  `LotDetailPage.tsx:124-131`, notifications at `:36-39`. **The event's lots have no loading or empty
  state; only an error is rendered** (`AuctionEventPage.tsx:167`).
- **Auction cover open.** `useAuctionPoster` still reads the first lot per card
  (`useAuctions.ts:57-70`, used at `AuctionListPage.tsx:33` and `AuctionEventPage.tsx:66`).
  `cover_image_url` is in the schema (`schema.d.ts:7008`) but never read.
- Hardcoded lot/auction state labels (`auctions/format.ts:28-40`) and terms (`auctions/terms.ts`).

### Login `/login` — `LoginPage` (and team login `/admin/login`)
- Endpoints:
  - `POST /auth/collector/login/`, then `/auth/me/` (`AuthSession.ts:88-94`, `LoginPage.tsx:158`)
  - `POST /auth/access-requests/` with `client_req_id`; 200 and 201 are both success
    (`LoginPage.tsx:135`); 429 maps to "Too many attempts — try again shortly."
    (`accessRequest.ts:109-110`)
  - Team: `POST /auth/team/login/` (`AuthSession.ts:82-86`)
- The first name is captured but not sent (documented, `LoginPage.tsx:13-16`).
- States: pending and error line. Complete.

### Shell — `AppShell`
- Nav tabs are flag-driven. **The "Insights" tab points to `/stories`, which has no route**
  (`AppShell.tsx:114-121`). With `features.stories` on (FULL set) it falls through the catch-all to
  Market. Not V1.

---

## 3. Classification

| Screen | Status | Key gaps |
| --- | --- | --- |
| Market `/` | Partial | G-P24-1 chip name hardcoded (`CuratedChip.tsx:76`); G-P24-2 `/catalog/selections/`+`seen` unused; hero copy not from `/app-theme/` |
| Artwork detail | Complete | (commerce actions hidden by flag) |
| Artists list/detail | Partial | G-P5-11: `artist` not sent on artist enquiry (`RequestController.ts:272-307`) |
| Saved | Complete | — |
| Records (3 routes) | Complete (v0.1 scope) | highlights endpoint unused (by design); record labels hardcoded vs `auctions.record_status` |
| Chat list / thread | Complete (v0.1) | G-P5-5 withdraw/cancel: API exists, UI missing (owner); G-P5-9 counter (owner) |
| Profile — Overview/Market | Partial | no loading state; G-P5-4 archive and G-P5-12 activity read: API exists, UI missing (owner); "Curated for you" card missing; G-P25-1 misread in `GetToKnowYou` |
| Profile — Account edit | API exists, UI missing | PATCH `/auth/me/` unused; copy says "write to Darz in Chat" |
| Profile — Your documents (G-DOC-1) | API exists, UI missing | `GET /api/documents/` never called |
| Questionnaire (flag off) | Partial, with a bug | G-P25-1: a 200 `answered:false` is treated as submitted; G-Q-1 contact not PATCHed; G-P25-2 question-set unused (hardcoded `questions.ts`) |
| Settings | Partial | "Edit profile" leads to a read-only view; push row has no control |
| Membership sheet (flag off) | Partial | G-MEMB-3/6/7: `/auth/my-membership/` unused; tiers hardcoded (G-MEMB-4) |
| Push opt-in (flag off) | API exists, UI missing | G-P13-1: `vapid-public-key` and `push/subscribe` unused |
| Recommendations "Curated for you" | UI exists, API binding missing (service only) | `RecommendationService.published/dismiss` unbound, no screen |
| Auctions (flag off) | Partial | cover: per-card first-lot read, `cover_image_url` unused; event lots lack loading/empty states |
| Login / access request / team login | Complete | — |
| Shell | Complete (v0.1) | Insights tab points to a nonexistent `/stories` (Not V1) |
| Gallery portal `/portal/:token` | Partial | see §4: image replacement, structured pricelist, asks/withdraw, updates history/pills, cover, pricelist status all unbound; 5xx on entry hangs the gate |
| Insights & Stories | Not V1 | backend-blocked (Phase 22) |

---

## 4. Gallery portal

Service: `GalleryPortalService` (`api/services.ts:1668-1773`) on `PortalClient` (no bearer, no refresh
retry, `PortalClient.ts:14-19`). State machine: `PortalSession`
(`features/portal/PortalSession.ts`). The PIN rides as `?pin=` on GET, in the JSON body, or as a
multipart part.

### Endpoint coverage

| Backend endpoint | Called? | Where |
| --- | --- | --- |
| `GET /portal/{token}/` | ✅ | `services.ts:1680`, `PortalSession.ts:74,112` (entry and every reload) |
| `POST /portal/{token}/updates/` | ✅ | `services.ts:1689`, `PortalSession.ts:139` |
| `POST /portal/{token}/pricelists/` (file upload) | ✅ | `services.ts:1696-1706` |
| `POST /portal/{token}/pricelists/build/` (structured lines) | ❌ | no binding; not even in `schema.d.ts` |
| `POST /portal/{token}/artworks/{artwork_pk}/image/` (replacement image, G-PORT-1) | ❌ | no binding; not in `schema.d.ts` |
| `GET /portal/{token}/messages/` | ❌ (not needed) | the thread comes embedded in state; the Messages tab re-reads the whole state (`PortalPage.tsx:343`) |
| `POST /portal/{token}/messages/` | ✅ | `services.ts:1708` |
| `GET /portal/{token}/status/` | ❌ (not needed) | Status tab derives from `assigned_artworks[].funnel` in state (`PortalStatus.tsx`) |
| `GET /portal/{token}/exhibitions/catalogue/` | ✅ | `services.ts:1716`, `PortalSession.ts:157` |
| `GET`/`POST /portal/{token}/exhibitions/` | ✅ | `services.ts:1724-1736` |
| `GET /portal/{token}/exhibitions/{event_id}/` | ❌ | the list is used instead; PATCH only |
| `PATCH /portal/{token}/exhibitions/{event_id}/` | ✅ | `services.ts:1738` |
| `POST /portal/{token}/exhibitions/{event_id}/submit/` | ✅ | `services.ts:1752` |
| `POST /portal/{token}/exhibitions/{event_id}/documents/{document_id}/sign/` | ✅ | `services.ts:1762` (name-only, G-PORT-7) |

### What the portal UI supports today
- **Gate:** a 6-digit PIN (`PortalPage.tsx:47`). A wrong code stays on the gate; 401/404 go to the dead
  card; a network failure goes to the retry card.
- **Bug:** any other error (500, 400, a 429 if ever returned) hits `throw err`
  (`PortalSession.ts:98`) with the phase left at `'opening'` (`:72`). The gate stays busy forever, as an
  unhandled rejection from `void session.enter(pin)` (`PortalPage.tsx:62`), and there is no error
  boundary on this route.
- **Your works:** availability/price/correction/image-flag/note per work, submitted as one update
  (`portalForm.ts:118-134`). "New work" is supported (`PortalWorks.tsx:128`). A 401 mid-session goes to
  the dead card (`PortalSession.ts:124-130`).
  - **Image replacement: not supported.** The "image needs updating" checkbox only sends `kind=image`
    with no file (`PortalWorks.tsx:9-10,521-524`).
  - **Work images: none.** Every card shows "No image" (`PortalWorks.tsx:372-374`, `:672`, `:698`),
    although `portal_state` now sends `image_url` on each assigned work
    (BE: `apps/gallery/serializers.py:76`). `PortalWork` has no `image_url` (`api/types.ts:723-732`).
  - **Asks / withdraw (G-PORT-4/6): not supported.** Kinds `ask` and `withdraw` are never sent.
    `updateKind` only yields availability/price/correction/image/note (`portalForm.ts:118-134`).
    "Withdrawn" goes out as an availability update, not the backend's `withdraw` kind, which unassigns
    the work on approval (BE: `services.py:190-193`).
  - **"Sent to Darz" pills are in-memory, per tab** (`PortalSession.ts:34-37`, `markSent` `:132-137`).
    `portal_state.updates` (BE: `views.py:110`) is not typed or read: `PortalState` has no `updates`
    (`types.ts:751-771`). So there is no history tab, no server-backed pending pills, and no "Pending
    review" KPI. The tile was deliberately omitted (`PortalPage.tsx:365-368`).
- **Cover (G-PORT-9): not read.** There is no `cover` in `PortalState`, and the header has no image
  (`PortalPage.tsx:276-300`).
- **Status** (only with `feat_funnel`): complete from state; stage labels come from `gallery.funnel_stage`
  in options.
- **Pricelists:**
  - File upload only (6 MB cap, `PortalPricelists.tsx:15`).
  - Rows always say **"Received"** (`:104`). `status`, `file_url` and `lines` are not typed
    (`PortalPricelist`, `types.ts:734-739`), although the backend now serves status and structured
    lines (`GalleryPricelist` schema).
  - **No in-portal builder**: `pricelists/build/` is unbound. The header comment still says "the new
    backend does not have" these (`PortalPricelists.tsx:6-10`), which is now false.
- **Messages:** Q&A thread from state; the send works; empty state at `PortalMessages.tsx:69`;
  unanswered dot at `PortalPage.tsx:276-278`.
- **Exhibitions:** list, create, edit (draft), tick services with running total, submit, view published
  service lines and documents, sign by name. Loading, failed and empty states are present
  (`PortalExhibitions.tsx:55-71,151`).
- **Stale header claims:** `PortalPage.tsx:17-20` lists G-PORT-2 history, G-PORT-5 asks and G-PORT-3
  as having "no serving endpoint yet". The history and asks endpoints now exist (BE PRs #67-#70).
- **Throttle:** the backend now throttles only writes (BE: `apps/gallery/views.py:70-78`,
  G-PORT-11). The frontend has no special handling and needs none, apart from the enter bug above for
  unexpected statuses.

---

## 5. Hardcoded data that has, or could have, an API source

| Where | What | API source |
| --- | --- | --- |
| `questionnaire/questions.ts:46,166,196` | question bank, intro, languages | `GET /recommendations/question-set/` (G-P25-2) |
| `catalogue/CuratedChip.tsx:76` | "Curated for You" | `selection_name` (G-P24-1) |
| `catalogue/CataloguePage.tsx:67-70` | hero eyebrow/title/lede | `/app-theme/` (old THEME_DEFAULT copy; no reader in `ownerSettings.ts`) |
| `catalogue/format.ts:33-40` | availability labels | `catalog.availability_status` in `/options/` |
| `records/recordFormat.ts:46-50` | record status labels | `auctions.record_status` |
| `auctions/format.ts:28-40` | lot/auction state labels | `auctions.lot_status`, `auctions.auction_status` |
| `conversations/rows.ts:13-23` | request kind labels | `crm.request_kind` (the copy differs from old-app wording; owner call) |
| `membership/tiers.ts:29-60` | tier prices and inclusions | none (G-MEMB-4; theme candidate) |
| `settings/SettingsPage.tsx:256,268,281` | Terms/Privacy/Auction-terms URLs | `GET /documents/public/{kind}/` exists, unused |
| `auctions/terms.ts` | auction conditions text | none (old-app copy) |

---

## 6. Looks wired but isn't

- Settings "Edit profile" leads to a read-only Account view (`SettingsPage.tsx:231-238`,
  `ProfilePage.tsx:452`).
- Settings push card has a label and no toggle (`SettingsPage.tsx:182-195`, flag off).
- Profile "Clear activity" is session-only; the rows return on reload (`ConversationsController.ts:224-235`).
- Portal "The image needs updating" checkbox sends a flag with no file (`PortalWorks.tsx:521-524`).
- Portal "Sent {time}" pills vanish on reload (`PortalSession.ts:34-37`).
- Portal pricelist rows always show "Received" (`PortalPricelists.tsx:104`).
- Nav "Insights" goes to `/stories`, which has no route (`AppShell.tsx:114-121`).
- `RecommendationService.published/dismiss` and `AuthService.redeemMembership` are bound only in the
  service layer: `published` has no screen; redeem has a screen behind the `membership` flag.
- There are no `TODO`/`FIXME` markers in collector features, and no handler that only toasts.

---

## 7. Batch 4-8 item status (all verified in code)

| Item | State | Evidence |
| --- | --- | --- |
| G-P24-1 chip `selection_name` | **Open** | `CuratedChip.tsx:76`, `useCuratedCount.ts:26-29` |
| G-P25-1 `answered` | **Open (now a bug)** | `QuestionnaireController.ts:154-160`, `ProfilePage.tsx:238-241`, stub `:288-295` still 404 |
| Profile edit PATCH `/auth/me/` | **Open** | no `updateMe` in `services.ts:1456-1498`; `ProfilePage.tsx:452` |
| G-Q-1 | **Open** | `QuestionnaireController.ts:25-32` |
| G-MEMB-3/6/7 | **Open** | no `my-membership` call; `MembershipSheet.tsx:17-30` |
| G-DOC-1 | **Open** | no `GET /documents/` caller; no Documents section in `ProfilePage.tsx` |
| Auction cover image | **Open** | `useAuctions.ts:57-70` |
| G-P24-2 (owner) | Open | no `/catalog/selections/` caller |
| G-P25-2 (owner) | Open | `questions.ts:46`; no `question-set` caller |
| G-P5-4 (owner) | Open | `ConversationsController.ts:215-235`; no `archive/` caller |
| G-P5-5 (owner) | Open | no collector `transition/` caller |
| G-P5-11 (owner, rec. yes) | Open | `RequestController.ts:278,302-307` |
| G-P5-12 (owner) | Open | `ActivityLogger.ts:97` write-only |
| G-P13-1 (owner) | Open | no `vapid`/`push` caller; `SettingsPage.tsx:182-195` |
| G-CLUB-1 thumbs (admin ClubPage) | **Open** | `admin/ClubPage.tsx:9-10,171` says no image; `thumb` exists (`schema.d.ts:11233`) |

---

## 8. Stub gaps (`e2e/stub-server.mjs`)

The stub serves only app-theme, the auth trio, `/auth/me/`, options, `/crm/requests/` (+ `{id}`), the
three request artworks, access-requests, membership redeem, the dashboard, facets, data-health and the
questionnaire. Everything else falls to the catch-all: an **empty paginated list** for GET
(`:386-390`) and a **400 `stub_unhandled`** for any other method (`:392-401`).

Missing, or answered with the wrong shape, for the new backend:
- `GET /api/recommendations/questionnaire/` still answers **404** (`:288-295`). The backend now
  answers 200 `{answers:null, submitted_at:null, answered:false}`. The POST (`:299-300`) lacks
  `answered:true`.
- `ME_COLLECTOR` (`:33-40`) lacks `full_name`, `phone`, `city`, `preferred_language`.
- `PATCH /api/auth/me/` gets a 400 from the catch-all.
- `GET /api/auth/my-membership/` gets a paginated list instead of `{tier,status,active_until}`.
- `GET /api/documents/` gets an empty list. That is valid for the empty variant, but there are no
  rows (the plan asks for 2 rows plus an empty variant).
- `GET /api/catalog/artworks/selections/` gets an empty list, so the chip is never exercised and there
  are no `selection_name` rows.
- `GET /api/catalog/selections/` (signal) gets an empty list; `POST …/{id}/seen/` gets a 400.
- `GET /api/recommendations/question-set/` gets a paginated list instead of
  `{title,intro,questions}`.
- `GET /api/notifications/vapid-public-key/` gets a paginated list instead of `{public_key}`.
- `POST /api/crm/requests/{id}/archive/` and `…/transition/` get a 400.
- `GET /api/auctions/` gets an empty list, with no `cover_image_url` rows.
- **Portal:** there is no `GET /api/gallery/portal/{token}/`. The catch-all returns a paginated
  envelope, which `PortalSession` would take as `PortalState`. The spec only renders the gate
  (`e2e/collector.spec.ts:54`), so the portal proper — including `updates`, `cover` and `image_url` —
  has no E2E coverage. There is also no stub for exhibitions, catalogue, `updates/`, `pricelists/`,
  `pricelists/build/`, `artworks/{id}/image/` or `messages/`.
