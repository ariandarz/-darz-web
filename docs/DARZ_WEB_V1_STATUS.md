# Darz Web V1: status

> **Edition: FINAL, 2026-09-26 — V1 complete (Phases 0–10 of `V1_IMPLEMENTATION_PLAN.md`).** Measured on
> `-darz-web` `v1/phase-10-final` (= `development` after PRs #102–#111, plus the Phase 10 commits) against the
> final V1 backend, `darz-backend-api` `development` @ `df0421f` (224 paths / 323 operations). Every claim
> below was checked in code in Phase 10; nothing is marked Complete that is not in the code. The baseline
> edition (2026-09-25, before the phases) is in git history.

## Executive summary

darz-web V1 is done. The collector Market App, the no-login gallery portal and the admin panel are built,
bound to the V1 API and merged into `development` (every `v1/phase-*` branch, #102–#111, is merged; Phase 10
is this branch). The site is still **visual-only in production** until the owner sets a real
`VITE_API_BASE_URL` (Q-9).

**API adoption, re-verified against the code (not the docs)** — of the backend's 323 V1 operations:

| Integrated | Bound, no UI | Not bound | Excluded (owner-deferred, API ready) | Excluded (not V1) | Not needed | Backend-only |
| --- | --- | --- | --- | --- | --- | --- |
| **261** | **1** | **0** | **14** | **31** | **15** | **1** |

(Baseline 2026-09-25: 225 integrated · 3 partial · 9 bound-no-UI · 85 not bound · 1 backend-only.) Every
non-integrated operation carries a one-line reason in `docs/audit/2026-09-25/API_ADOPTION_MATRIX.md`.

**Final gate (Phase 10, run on this branch):** typecheck ✅ · oxlint **0** warnings/errors ✅ · prettier ✅ ·
**838/838 unit tests** (76 files) ✅ · production build ✅ (`VITE_API_BASE_URL=https://api.invalid/api`) ·
**155/155 Playwright E2E** (collector 40 · desks 105 · portal 6 · smoke 4) against `e2e/stub-server.mjs` ✅.

What remains is not frontend V1 work: **backend defects** (C-6…C-25 in `V1_CONTRACT_ISSUES.md`, the
security set C-13 first), **owner decisions** (Q-2, Q-4, the Q-5 remainder, Q-8, Q-9), and **post-V1
features** with no backend (Logistics, Library, Insights & Stories, the Social suite, …).

## V1 architecture

### Frontend architecture
- **React 19 + TypeScript + Vite**, `react-router-dom` with real URLs (collector `/`, `/artwork/:id`, …;
  admin `/admin/*`; portal `/portal/:token`). **56 admin routes**, every admin page `React.lazy` inside
  `AdminShell`'s `<Suspense>`.
- **Styling:** plain CSS + custom properties, the old app's class names (`src/design/*.css` global, one
  stylesheet per feature). Tokens are the design package's `tokens.css` verbatim.
- **Domain layer is OOP with inheritance** (`CLAUDE.md`): `ListController` → per-screen controllers;
  `ResourceService` → one service per backend app; views are function components.
- **Feature flags:** `features.ts` (`v0.1` in production, `full` in E2E) merged at boot with the owner's
  runtime switches from `GET /api/app-theme/` (`theme.features`); a hidden feature's routes redirect to Market.
- **Owner settings:** `ownerSettings.ts` reads the rest of the public theme (request wait hours, question
  bank/intro, WhatsApp number, the Market hero copy since Phase 10).

### API integration pattern
- `HttpClient` → `ApiClient` (unwraps the `{success, data, message, timestamp}` envelope once; maps failures
  to `NetworkError` / `HttpError` / `UnauthorizedError` / `ValidationError` / `ConflictError`) →
  **20 `ResourceService` subclasses** in `src/api/services.ts` (Catalog, Crm, Auction, Recommendation,
  AdminAccounts, CatalogAdmin, SalesAdmin, Documents, PublicDocuments, DocumentsAdmin, GalleryAdmin,
  AuctionsAdmin, AccountingAdmin, CoreAdmin, Theme, Dashboard, Options, Auth, ProjectsAdmin, GalleryPortal).
  No feature file calls the HTTP client directly.
- `GalleryPortalService` runs on **`PortalClient`**: no bearer, the token in the path, the PIN in the query
  on reads and in the body/form on every write (C-9, wire-pinned in `galleryPortalService.test.ts`).
- **Types** come from `src/api/schema.d.ts` (regenerated from the V1 backend in Phase 0) and are aliased in
  `src/api/types.ts`; a few are hand-typed where the schema is wrong (`HoldDetail` C-7, `PortalState` C-8).
- **`Locked<T>`** (`types.ts`) makes `expected_version: number` required on a locked PATCH body — the
  schema's `Patched*` bodies mark it optional, and a missing lock is a backend 500 (C-6). Twelve locking
  calls are pinned on the wire in `optimisticLock.test.ts`; a 409 renders the shared `ConflictBanner`.
- **`walkPages`** (`src/api/paging.ts`, `MAX_PER_PAGE = 100`) walks `has_next` wherever a screen needs a
  whole list (pickers, rosters, Live Auctions, selections); the backend clamps `per_page` at 100 (C-5).
- **`ValidationError.fields`** carries the error's `details`: inline field errors on forms, and the publish
  gate's `fields.missing` rendered as the old refusal popup (C-10).
- **Choice labels** come from `GET /api/options/` (`useOptions`, cached once); the raw value is the fallback.
  Hardcoded words remain only where the old copy differs from the served label (see Remaining gaps).
- **Shape guards:** `asArray` / `normalise*` (`shapes.ts`) on every embedded list, so an unexpected shape
  renders empty instead of blanking a screen.

### Authentication and roles
- `AuthSession` holds one of two principals: a **collector** (first name + access key →
  `POST /auth/collector/login/`) or a **team user** (email + password → `POST /auth/team/login/`). JWT
  access + refresh; `ApiClient` retries once after a 401 through `AuthSession.refresh`; `resume()` on boot.
- **Team roles:** `owner` and `standard` admin. `RequireTeam` guards `/admin/*`; **`RequireOwner`** guards the
  owner desks — Team, Settings, Memberships, Accounting (4 routes), **Access** and **Access Requests** — and
  `adminNav.OWNER_ONLY` hides their tabs. Access and Access Requests are stricter in the UI than in the
  backend (Q-1: owner-only by the owner's choice; the API allows any admin).
- **UI-only gates** (the API does not enforce them): project `money` / `internal_notes` (Q-2), document
  delete, the sale "responsible" picker (team users are `IsOwner`). Document `owner_lock` is enforced in the
  UI and by the backend.
- **Portal:** token in the URL + a 6-digit PIN, no login (`PortalSession`); the backend throttles only writes
  (C-13).

### State and data fetching
- Controllers own fetch, pagination, stale-response guards and their state machine, exposed through
  `useSyncExternalStore` hooks: `ListController` → `CatalogueController`, `ArtistListController`,
  `AuctionListController`, `RecordsController`, the admin desk controllers (via `useListController`);
  `ConversationsController`, `MessageThreadController` → `AdminThreadController`, `QuestionnaireController`,
  `LotController` (+ `LotSocket`, falling back to REST polling), `RegistrationController`, `PortalSession`,
  `AccessDeskController`.
- Optimistic locking everywhere a desk edits a versioned row; list-only rollups are never overwritten by a
  detail/PATCH response (C-16).

### Major shared components
- `src/components/`: Logo, Wordmark, Chroma, Eyebrow, Button, Input, Card, Pill, Avatar, Toast, Sheet.
- Admin kit (`src/features/admin/kit/`): `DeskPage`, `DeskList` (loading / error / empty / pager in one),
  `DataTable`, `FilterChips` and filters, `Picker`, `ConfirmDialog`, `ShownOnceSecret`, feedback banners;
  plus `ConflictBanner`, `PublishRefusal`, `ExpiryCell`.
- Error floors: `DeskBoundary` (admin) and `ScreenBoundary` (collector) catch render throws; `.dz-state`
  is the shared loading/error line.

## V1 sections

Status words: **Complete** (built and bound, nothing V1 left) · **Partial** (V1 done, a named gap remains).

### Collector app (Market App)

| Section | Purpose | Screens (routes) | Implemented | APIs used | Actions | Roles | V1 status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Market | Browse the collection | `/` | Hero (owner copy from `/app-theme/`), grid / single view, search, sort, currency, pager, curated chip (`selection_name`) | `catalog/artworks/`, `artworks/selections/`, `options/`, `app-theme/` | browse, filter, save | collector | Complete |
| Artwork | One work | `/artwork/:id` | Images, status word (served label), price or "Request price", View in Room, Share, previous/next, "More by artist", request buttons | `catalog/artworks/{id}/`, `crm/requests/` (POST), `crm/saved/`, `crm/activity/` (POST) | save, enquire, hold, viewing, offer (hidden without a currency, Q-6), buy | collector | Complete |
| Artists | Artist index and page | `/artists`, `/artists/:id` | Search, list, artist page with available works, "Enquire about this artist" (sends `artist`, G-P5-11) | `catalog/artists/`, `catalog/artists/{id}/`, `catalog/artworks/?artist=` | enquire | collector | Complete (nothing links to `/artists`, as in the old app) |
| Saved | Favourites | `/saved` | List, remove, empty state | `crm/saved/` GET/POST/DELETE | save / unsave | collector | Complete |
| Records | Auction records archive | `/records`, `/records/artist/:id`, `/records/:id` | Artist view, insights, record detail | `auctions/records/`, `records/{id}/` | browse | collector | Complete (Highlights excluded — hidden in the old app) |
| Chat & requests | Conversations with Darz | `/chat`, `/chat/:id` | Inquiry list, thread, replies, reply notice, document chips (open from "Your documents") | `crm/requests/` (+ `{id}/`), `…/messages/`, `…/mark-seen/`, `documents/` | reply, mark seen | collector | Partial — withdraw/cancel (G-P5-5), archive (G-P5-4), counter-offer display (G-P5-9) owner-deferred |
| Profile | The collector's own area | `/profile` | Overview tiles (loading state), acquisitions, Account edit (full name, phone, city, language), "Your documents", questionnaire card, auctions anchor | `auth/me/` GET/PATCH, `crm/requests/`, `documents/`, `recommendations/questionnaire/`, `auctions/registrations/` | edit profile, open documents, sign out | collector | Complete (no Email field — the API neither returns nor accepts it) |
| Settings / Membership | Preferences, membership, legal | `/settings`, membership sheet | Membership row + sheet (status, active until), redeem, legal links (public docs), edit profile | `auth/my-membership/`, `auth/membership/redeem/`, `documents/public/{kind}/` | redeem, open legal | collector | Partial — push opt-in (G-P13-1) owner-deferred |
| Questionnaire | Taste profile | `/questionnaire` | Runs on the served question set (fallback: the built-in bank), draft, review, submit, contact write-back | `recommendations/question-set/`, `…/questionnaire/` GET/POST, `auth/me/` PATCH | answer, submit | collector | Complete |
| Auctions (flag) | Live bidding | `/auctions`, `/auctions/:id`, `/auctions/lots/:lotId`, `/auctions/notifications` | Event cards with cover, event page + lots (loading/empty), lot page with live price (WebSocket → polling), registration + terms, bid sheet, notifications | `auctions/*` (list, detail, lots, bids, registrations, notifications) | register, bid, mark notifications read | collector | Complete |
| Login | Both principals + access request | `/login`, `/admin/login` | Landing, collector key sign-in, request access (dedupe, 429 copy), team sign-in | `auth/collector/login/`, `auth/team/login/`, `auth/access-requests/`, `auth/token/refresh/`, `auth/logout/` | sign in / out, request access | public | Complete |

### Gallery portal

| Section | Purpose | Screens | Implemented | APIs used | Actions | Roles | V1 status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Gallery portal | A source updates its works with Darz | `/portal/:token` (gate, dead, unreachable, Works, Pricelists, History, Messages, Exhibitions) | PIN gate with retry card (C-4), cover, work cards with `image_url`, availability/price/correction updates, **replace image**, **ask**, **withdraw**, Sent pills + Pending review, History, pricelist upload **and builder** with status, messages, exhibition services (create, pick services, send, sign documents by name) | `gallery/portal/{token}/…` (11 of 15 operations integrated; `messages/`, `status/` and `exhibitions/{id}/` GET are embedded in the state read; the exhibition PATCH is bound with no UI) | submit updates, upload, build, message, create/submit exhibition, sign | token + PIN | Partial — the old "Save draft" of a services selection (portal exhibition PATCH) is not built; referral, drawn signature, offer engine, formatted pricelist download have no backend |

### Admin panel

| Section | Purpose | Screens | Implemented | APIs used | Actions | Roles | V1 status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard | Operations overview | `/admin` | Summary tiles, catalogue tiles linking to the filtered Database | `dashboard/admin/summary/`, `sales/admin/sales/summary/` | navigate | team | Complete |
| Requests | Every collector request | `/admin/requests` | Unified feed, filters, transitions, urgency | `crm/admin/requests/`, `…/transition/` | transition | team | Complete |
| Chat | Admin threads | `/admin/chat`, `/admin/chat/:id` | Thread, reply, mark seen, **attach document** (share on send), **archive/restore message** + "Include archived" | `crm/admin/requests/{id}/messages/` (+ `document_refs`, `?include_archived`), `crm/admin/messages/{id}/archive/`, `documents/admin/documents/` | reply, attach, archive | team | Complete |
| Catalogue | Database, editor, artists, import, published, health | `/admin/artworks(/new, /:id)`, `/admin/artists`, `/admin/import(/:id)`, `/admin/published`, `/admin/data-health` | Thumb + artist rows, the Phase 5b filters + source/recent chips, facets, publish refusal (`details.missing`), editor with images and selection grants, artists search/sort/pager/works count, CSV import staging, Published cards, Data Health counts + checks | `catalog/admin/*` (27 of 28; the single artist read is not needed) | full CRUD, publish/unpublish, transitions, import confirm/discard | team | Complete |
| Collectors / Club | CRM roster | `/admin/collectors(/:id)`, `/admin/club` | Summary strip, activity/purchases sorts, collector detail with keys + login events, Club selections with thumbs | `auth/admin/collectors/*`, `…/access-keys/`, `…/login-events/`, `crm/admin/selections/`, `crm/admin/activity/` | CRUD, issue/extend/revoke keys, selections | team | Partial — the Club "Auction access" section (G-CLUB-3) is owner-deferred; invite-only is managed on the auction page |
| Access (owner) | Roster-wide access keys | `/admin/access` | Four of the old five tiles, the review banner, search / computed status / "Expiring ≤ 7d", extend and revoke | `auth/admin/access-keys/` (+ `summary/`, `extend/`, `revoke/`) | extend, revoke | **owner** (UI gate) | Complete |
| Access Requests / Memberships / Team / Settings (owner) | Owner desks | `/admin/access-requests`, `/admin/memberships`, `/admin/team`, `/admin/settings` | Approve/decline, membership codes (CRUD, renew), team users, audit log | `auth/admin/*`, `admin/audit-log/` | full | **owner** | Complete |
| Sales | Market and auction deals | `/admin/sales`, `/admin/sales?source=auction`, `/admin/sales/:id` | Summary tiles, search + Stage/Payment/Delivery/Source/Sort, Auction Sales with lot links, deal card with follow-up, notes, delete | `sales/admin/*` (all 12) | CRUD, transitions, follow-up, notes | team (owner: responsible) | Complete |
| Auctions | Live, records, registrations | `/admin/auctions(/:id)`, `/admin/auction-records(/new, /:id)`, `/admin/auction-registrations` | Create/edit (locked, read-only past scheduled), archive + "Show archived", cover upload, lots add/edit/go-live/close, invite-only, records with house filter + highlight, registrations approve/reject/reset | `auctions/admin/*` (all integrated) | full | team | Complete |
| Sources / Exhibitions | Gallery desk | `/admin/sources(/:id)`, `/admin/sources/:id/exhibitions/:eventId`, `/admin/exhibition-services`, `/admin/exhibition-catalogue`, `/admin/issue(/:eventId)` | Server partner search, issue/reissue credentials (shown once), updates review incl. ask/withdraw/image, pricelists (file, lines, status, soft cap), compose with quantity, publish, sign, Service checklist editor, Exhibition Services with descriptions, Issue document | `gallery/admin/*` (44 of 52 integrated; the rest not needed / excluded) | full | team | Complete (admin image preview blocked by C-12) |
| Documents | Issued documents | `/admin/documents(/:id)`, `/admin/issue` | Library, detail with versions, History section, share/unshare with a collector, `owner_lock` enforced for standard admins, delete (owner) | `documents/admin/*` (all integrated) | CRUD, confirm, sign, archive, share | team (owner: delete, locked docs) | Complete |
| Projects | Projects suite | `/admin/projects(/list, /pipeline, /partners, /packages, /calculator, /reports, /new, /:id, /:id/report)` | Dashboard, quick cards on `?quick=`, pipeline board, Status select, stage moves with the old seeding, FX block + server totals, packages with descriptions, partners, reports | `projects/admin/*` (29 of 32; three single reads not needed) | full CRUD, stage moves | team (money: owner, UI-only Q-2) | Complete |
| Accounting (owner) | Books, deals, settlement | `/admin/accounting(…)` (4 routes) | Ledger, deals, duplicates, settlement | `accounting/admin/*` (23 of 24) | full | **owner** | Complete |
| App Design | Theme / switches | `/admin/design` | Theme versions, publish, reset, feature switches | `admin/app-theme/*`, `app-theme/` | publish, reset, versions | team | Complete |

## API adoption matrix

Operation-level detail (one row per method + path, with the UI caller or the reason) is
`docs/audit/2026-09-25/API_ADOPTION_MATRIX.md`. By group:

| Endpoint group | Frontend section | Integration status | UI status | Notes |
| --- | --- | --- | --- | --- |
| `auth/*` collector + team + `me` + access requests | Login, Profile, Settings | 9 of 9 | Complete | |
| `auth/admin/*` | Collectors, Access, Team, Memberships, Access Requests | 25 of 27 | Complete | 2 single reads not needed; Access desk Phase 8 |
| `catalog/*` collector | Market, Artwork, Artists | 5 of 9 (32 of 37 with admin) | Complete | `selections/` + `seen` owner-deferred (G-P24-2); legacy lookup excluded; change-stamp not needed |
| `catalog/admin/*` | Catalogue desks | 27 of 28 (artist single read not needed) | Complete | `price_min/max`, `tag`, `refine_*` unsent (no old control) |
| `crm/*` collector | Chat, Profile, Saved | 10 of 13 (21 of 25 with admin) | Complete (V1) | archive / transition / activity read owner-deferred |
| `crm/admin/*` | Requests, Chat, Club | 11 of 12 | Complete | admin selection read not needed |
| `auctions/*` + `auctions/admin/*` | Auctions, Records, admin Auctions | 12 of 13 + 25 of 25 | Complete | `records/highlights/` excluded (old app hides it) |
| `accounting/admin/*` | Accounting | 23 of 24 | Complete | deal attachments list embedded in the deal |
| `sales/admin/*` | Sales | 12 of 12 | Complete | |
| `documents/*` | Profile documents, Documents desk, legal links | 15 of 15 | Complete | |
| `gallery/portal/*` | Portal | 11 of 15 integrated, 1 bound-no-UI | Partial | 3 state-embedded reads not needed; "Save draft" missing |
| `gallery/admin/*` | Sources, Exhibitions, Service checklist | 33 of 37 | Complete | exhibition DELETE excluded (no old delete); exhibition PATCH, link DELETE, catalogue-item read not needed |
| `projects/admin/*` | Projects | 29 of 32 | Complete | 3 single reads not needed |
| `recommendations/*` collector | Questionnaire | 3 of 5 | Complete | `published/` + `dismiss/` excluded (G-6) |
| `recommendations/admin/*` | Intelligence, question-set editor | 0 of 23 | Missing (by decision) | 17 G-6 (Q-8); 6 question-set editor owner-deferred (G-P25-2(b)) |
| `notifications/*` | Settings push | 0 of 3 | Missing (by decision) | owner-deferred (G-P13-1) |
| `marketing/admin/*` | Marketing Hub | 0 of 9 | Missing (by decision) | G-6 (Q-8) |
| `dashboard`, `options`, `app-theme`, `admin/app-theme`, `admin/audit-log` | Dashboard, all screens, App Design, Settings | 11 of 11 | Complete | |
| `health` | — | Backend-only | n/a | liveness probe |

**Final counts:** 261 Integrated · 1 Bound, no UI · 0 Not bound · 14 Excluded (owner-deferred, API ready) ·
31 Excluded (not V1) · 15 Not needed · 1 Backend-only = **323**.

## Panel / Admin

- **Implemented:** 56 admin routes, all lazy, all behind `RequireTeam` + `DeskBoundary`; 39 of the 59 nav tabs
  are routed (the other 20 are old desks with no backend or deliberately not ported — `adminNav.ts` states
  why for each). Every list desk renders loading / error / empty through `DeskList`; the non-list desks
  (Dashboard, Data Health, Design, Issue, Projects dashboard/calculator, the editors) each have their own
  loading and error lines (checked in Phase 10).
- **Partial:** Collector Club (the "Auction access" section, owner-deferred); Sources/Exhibitions image review
  (C-12 blocks the preview).
- **APIs available with no desk:** Intelligence ×5 tabs and Marketing Hub (G-6, not V1, Q-8); the
  question-set editor (G-P25-2(b), owner-deferred).
- **Bindings:** every admin desk goes through its `…AdminService`; no admin page calls the client directly.
  Unused-but-kept bindings (documented in the matrix): `dealAttachments`, `updateExhibition`,
  `deleteExhibition`, `checklist`, `partner`, `service`.
- **Missing UI for existing APIs:** none inside V1 scope on the admin side.
- **Missing integrations:** none inside V1 scope; params left unsent on purpose are listed in the matrix
  ("Notable unsent query params").
- **Known limitations:**
  - **UI-only role gates:** project money / internal notes (Q-2), document delete, the sale "responsible"
    picker; **Access and Access Requests** are owner-only in the UI while the API allows any admin (Q-1 —
    the owner chose owner-only). A standard admin with API access can reach all of these.
  - **Access desk:** a key the backend lazily stored as `expired` and then extended reads **Active** but is
    still refused at sign-in (C-25); "Admin keys" (the old fifth tile) has no counterpart.
  - **Projects:** "Awaiting approval" counts nearly every moved project (C-24); "Delayed" needs a stage
    `due` no control sets.
  - **Chat attach** never offers another collector's document, because attaching re-homes it (C-23).
  - Admin portal-image review shows "Image submitted" only (C-12).
  - Validation copy for the auction/lot window check is a placeholder (C-18, owner to confirm).

## Remaining gaps

### Frontend / UI gaps
- **Portal "Save draft"** of a ticked services selection (gallery-update.html:1551 `exhSaveDraft`) — not built;
  the one Bound-no-UI operation (`PATCH gallery/portal/{token}/exhibitions/{event_id}/`).
- **Old-copy labels kept on purpose** (the served label differs from the old words): collector lot words
  (scheduled → "Upcoming", cancelled → "Withdrawn"), record results ("Sold" only with a price, "Final price
  pending", "Estimate only"), the time-derived auction state. **Request-kind wording** (Chat, Profile,
  buttons) is the old copy and an owner call.
- **Flagged deviations recorded per phase** (§3a–3k of the plan), e.g. no Email field on the Account card,
  documents "New" per device, Market hero `heroCompact` not ported, Phase 9a served questions have no
  section name or multi-select.
- **Loading/empty/error walk (Phase 10):** collector screens — Market, Artwork, Artists (+ page), Saved,
  Records (+ artist, detail), Chat, Thread, Profile, Auctions (list, event, lot, notifications), Portal — all
  have the three states where they apply. **One miss fixed:** the artist page's works list read a failed
  request as "No available works". **By design:** the questionnaire treats a failed read as "not yet
  answered" and a failed question-set read as the built-in bank (no error line); Settings is static apart
  from the membership row; Profile › "Your documents" hides on loading/failure, as the old app did.

### API-binding gaps
- None inside V1. **Owner-deferred (API ready):** G-P24-2 selection-ready notice, G-P25-2(b) question-set
  editor, G-P5-4 archive, G-P5-5 withdraw/cancel, G-P5-12 activity read-back, G-P13-1 push, G-CLUB-3 club
  section, G-P5-9 counter-offer display. **Excluded:** G-6 Intelligence / Marketing / Curated-for-you, legacy
  lookup, records highlights, exhibition delete.

### Backend limitations (open on `darz-backend-api`, detail in `V1_CONTRACT_ISSUES.md` § B)

**Update 2026-09-26:** each row below except C-16 and C-21 now has a draft fix PR on `darz-backend-api`, #71–#77. None of them is merged yet; they wait on the backend owner. See `V1_CONTRACT_ISSUES.md` § "Backend fix PRs" for which PR fixes which row. The FE work-arounds stay until the PRs merge.

- **C-6** PATCH without `expected_version` → 500 (not 400) on 18 endpoints; FE always sends it.
- **C-7** no hold member in the request-detail union; FE hand-types `HoldDetail`.
- **C-8** portal state schema undeclared; FE hand-types `PortalState`.
- **C-9** portal `pin` documented as a query param on writes (it is read from the body).
- **C-10** error `details` untyped; publish does not declare its 400.
- **C-11** ordinary 4xx refusals coded `INTERNAL_ERROR`; FE branches on HTTP status.
- **C-12** no URL for a portal replacement image; the admin cannot preview it.
- **C-13 (security)** portal PIN brute force (no read throttle, no `anon` rate), unthrottled team/collector
  login, unvalidated anonymous uploads, builder accepts unassigned artworks — **raise before any real portal
  link is issued.**
- **C-14** options missing sale `source`, pricelist `status`, `source_type`, `preferred_language`, …
- **C-16** list-only rollups null on detail/PATCH.
- **C-18** no `starts_at < ends_at` check; moving an auction window does not move its lots.
- **C-19** prod Dockerfile is gunicorn/WSGI, so auction WebSockets do not run; the room polls REST every 8 s.
- **C-21** no pricelist status guard; `accepted` silently supersedes.
- **C-23** attaching a document in chat re-homes it to the thread's collector.
- **C-24** "Awaiting approval" counts every moved project (the predicate reads every stage).
- **C-25** extend does not reset a stored `expired` status, so an extended key still cannot sign in.
- Also: C-2 unstable enum names (FE aliases by schema path); backend candidates noted per phase (collector
  `email` on `Me`, `artist_name` on sale artworks, an overdue count on sales `summary/`, a house facet,
  archived auctions hidden from the collector list).

### Panel / Admin gaps
- The Club "Auction access" section (owner-deferred), the question-set editor (owner-deferred), the
  Intelligence and Marketing desks (G-6), and the no-backend desks (Logistics, Analytics, Social ×4,
  Strategy, Automations, Languages, Library, Document Builder, Proposal builder).

### Technical debt
- `adminNav.isPathAllowed` is still unused (the route guards are `RequireTeam` / `RequireOwner`).
- Hand types that the backend schema should own (`HoldDetail`, `PortalState`).
- Unused bindings kept to mirror the served routes (listed above).
- `schema.d.ts` must be regenerated whenever the backend moves past `df0421f`.
- The E2E stub mirrors backend shapes by hand; it has to move in the same PR as any shape change.

### Future / post-V1
- See "Deferred / V2 candidates" below.

## V1 section status

| Section | UI | API Binding | V1 Status | Notes |
| --- | --- | --- | --- | --- |
| Market / artwork / artists / saved | Complete | Complete | Complete | G-P24-2 notice owner-deferred |
| Records | Complete | Complete | Complete | Highlights excluded (hidden in the old app) |
| Chat & requests (collector) | Complete | Complete | Partial | G-P5-4 / G-P5-5 / G-P5-9 owner-deferred |
| Profile | Complete | Complete | Complete | |
| Settings / Membership | Complete | Complete | Partial | push (G-P13-1) owner-deferred |
| Questionnaire | Complete | Complete | Complete | served set + fallback bank |
| Auctions (collector) | Complete | Complete | Complete | WebSocket blocked in prod by C-19; polling fallback |
| Login | Complete | Complete | Complete | |
| Gallery portal | Partial | Complete | Partial | "Save draft" missing (bound, no UI); C-13 before go-live |
| Admin Dashboard / Requests / Chat | Complete | Complete | Complete | |
| Admin Catalogue / Data Health / Published / Import | Complete | Complete | Complete | |
| Admin Collectors / Club | Partial | Complete | Partial | Club "Auction access" owner-deferred |
| Admin Access desk | Complete | Complete | Complete | UI-only owner gate; C-25 |
| Admin Access Requests / Memberships / Team / Settings | Complete | Complete | Complete | |
| Admin Sales (+ Auction Sales) | Complete | Complete | Complete | |
| Admin Auctions (Live, Records, Registrations) | Complete | Complete | Complete | |
| Admin Sources / Exhibitions / Service checklist / Issue | Complete | Complete | Complete | image preview blocked by C-12 |
| Admin Documents | Complete | Complete | Complete | |
| Admin Projects | Complete | Complete | Complete | C-24 skews one tile; Q-2 |
| Admin Accounting | Complete | Complete | Complete | |
| Admin App Design | Complete | Complete | Complete | |
| Question-set editor | Missing | Missing | Deferred post-V1 | owner-deferred G-P25-2(b) |
| Intelligence / Marketing Hub / Document Builder | Missing | Missing | Deferred post-V1 | G-6 (Q-8) |
| Logistics / Analytics / Social / Strategy / Automations / Languages / Library / Insights & Stories | Missing | Not applicable | Deferred post-V1 | no backend |

## Deferred / V2 candidates

- **Owner-deferred, API ready:** the selection-ready notice (G-P24-2), the question-set editor (G-P25-2(b)),
  collector archive / withdraw / cancel / activity read-back (G-P5-4/5/12), push opt-in with a service worker
  (G-P13-1), the Club "Auction access" section (G-CLUB-3), counter-offer display (G-P5-9, needs wording — Q-4).
- **G-6 (Q-8):** Intelligence (AI tagging, filters, recommendations, history, "Curated for you"), Marketing
  Hub, Document Builder / Studio (D18).
- **No backend yet:** Logistics & Payment (Phase 20), Library / saved items (Phase 21), Insights & Stories
  (Phase 22 — the nav tab stays hidden until a story can be published), i18n/RTL (G-I18N-1), the Social
  suite, Strategy, Automations, Languages, Analytics, Team Workspace (G-TEAM-1), "Notify collectors" (needs
  a push-send endpoint), the source-freshness loop (G-CAT-9), PDF/image import intake (D15), the settlement
  calculator, theme editors (D17), the proposal builder.
- **Gallery portal:** referral / Introduce (G-PORT-5), drawn signature (G-PORT-7), offer floor / auto-decline
  engine (G-PORT-8), formatted pricelist download (P3c), the "Save draft" of a services selection.
- **Small post-V1 candidates:** legacy-id deep-link redirect (`catalog/legacy-lookup/`), a background
  catalogue poller on `change-stamp/`, the Refine filters on the Database desk.
