# Darz Web V1: status

> **Edition: BASELINE, 2026-09-25, before the V1 implementation phases.** This records the measured state
> of `-darz-web` `development` @ `d987910` against the final V1 backend (`darz-backend-api` `development` @
> `df0421f`). **Phase 10 of `V1_IMPLEMENTATION_PLAN.md` rewrites this file** as the completed-V1 edition.
> Nothing here is marked Complete unless it exists in code and was checked (audit evidence:
> `docs/audit/2026-09-25/`).

## Executive summary

The collector app, gallery portal and admin panel are built and deployed (visual-only until a real
`VITE_API_BASE_URL`: Q-9). Of the backend's **323 V1 operations**:
- **225** are integrated.
- **3** are partially integrated.
- **9** are bound in the service layer with no UI.
- **85** are not bound.
- **1** is backend-only.

Most of the unbound operations are the backend's 2026-09-25 work (PRs #54–#70) plus the owner-deferred
Intelligence and Marketing groups (33 operations).

Four live defects exist against the current backend: the Sales desk (nested rows), the first-run
questionnaire, the portal entry hang, and lists capped at 100. Phase 0 fixes them. The gate is green on the
committed (stale) schema.

## V1 architecture

- **Frontend:** React 19 + TypeScript + Vite; `react-router-dom` with real URLs; admin pages are `React.lazy`
  inside `AdminShell`. Plain CSS with custom properties and the old app's class names (`src/design/*.css`
  plus per-feature CSS). Views are function components.
- **API integration pattern:** an OOP layer: `HttpClient` → `ApiClient` (the `{success,data,…}` envelope
  unwrapped once) → `ResourceService` subclasses in `src/api/services.ts` (`list/retrieve/create/update/remove`).
  Types come from `src/api/schema.d.ts`, generated from the backend OpenAPI and aliased in `src/api/types.ts`.
  `PortalClient` has no bearer and carries the token + PIN for the gallery portal.
- **Authentication:** `AuthSession` holds two principals: a collector (first name + access key) and a team
  user (email + password). JWT access plus refresh-on-401. `RequireTeam` guards `/admin/*`, and `RequireOwner`
  plus `adminNav.OWNER_ONLY` enforce the owner role. The portal uses a token in the URL plus a 6-digit PIN.
- **State and data fetching:** domain controllers (`ListController` base → per-desk controllers,
  `ConversationsController`, `QuestionnaireController`, `PortalSession`, `SavedController`) exposed through
  hooks. Optimistic locking (`expected_version` → 409 → `ConflictBanner`) on 8 wire-pinned calls. Choice labels
  come from `GET /api/options/`, and owner copy and switches from `GET /api/app-theme/`.
- **Shared components:** `src/components/` (Logo, Wordmark, Chroma, Eyebrow, Button, Input, Card, Pill,
  Avatar, Toast, Sheet); admin kit (`DeskList`, `ConflictBanner`, filter chips, tiles); the
  `DeskBoundary`/`ScreenBoundary` error floors; `asArray`/`normalise*` shape guards.
- **Gate:** typecheck · oxlint · prettier · vitest (636 tests: `logic` in node, `components` in jsdom) · build ·
  Playwright E2E against `e2e/stub-server.mjs`.

## V1 sections

| Section | Purpose | Screens | APIs used | Actions | Roles | Status now | V1 work |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Market / catalogue | Browse the collection | `/`, `/artwork/:id`, `/artists(/:id)` | catalog artworks/artists/facets, saved, crm requests | browse, filter, save, enquire/hold/offer/view/buy | collector | Partial | Ph 1 chip name; Ph 9 selection notice, artist link |
| Saved | Favourites | `/saved` | catalog saved | save/unsave | collector | Complete | — |
| Chat & requests | Conversations with Darz | `/chat(/:id)` | crm requests, messages, single request | reply, mark seen | collector | Complete | Ph 9 withdraw/cancel, counter (owner) |
| Profile | Collector's own area | `/profile` | me, crm requests, activity | view | collector | Partial | Ph 1 edit, documents, loading state |
| Settings / Membership | Preferences, membership | `/settings`, sheet | me, redeem | redeem code | collector | Partial | Ph 1 my-membership, edit link; Ph 9 push |
| Questionnaire | Taste profile | `/questionnaire` | recommendations questionnaire | submit | collector | **Partial (bug C-3)** | Ph 0 fix; Ph 1 contact; Ph 9 question-set |
| Auctions (flag) | Live bidding | `/auctions/**` | auctions, lots, bids, registrations, notifications | register, bid | collector | Partial | Ph 3 cover, lot states |
| Records | Auction records | `/records/**` | auction records | browse | collector | Complete | — |
| Login | Both principals + access request | `/login`, `/admin/login` | auth | sign in, request access | public | Complete | — |
| Gallery portal | External source updates | `/portal/:token` | gallery portal (9 of 14 ops) | update works, upload pricelist, message, exhibitions | token + PIN | **Partial (bug C-4)** | Ph 0 fix; Ph 5 P1/P3/P4 |
| Admin: Dashboard / Requests / Chat | Operations | `/admin`, `/admin/requests`, `/admin/chat` | dashboard, crm admin | transition, reply | team | Complete / Partial (chat) | Ph 6 attach, archive |
| Admin: Catalogue | Database, editor, artists, import, published, health | 8 routes | catalog admin | full CRUD, publish, import | team | Partial (C-5) | Ph 0, Ph 4 |
| Admin: Collectors / Club | CRM roster | 3 routes | auth admin, crm selections | CRUD, keys | team | Partial | Ph 4 |
| Admin: Sales | Deals | `/admin/sales(/:id)` | sales admin | CRUD, transitions | team | **Partial (bug C-1)** | Ph 0, Ph 2 (+ Auction Sales) |
| Admin: Auctions | Live, records, registrations | 5 routes | auctions admin | create, go-live, close, approve | team | Partial | Ph 3 |
| Admin: Sources / Exhibitions | Gallery desk | 5 routes | gallery admin, projects service-catalog | issue link, review updates, compose, sign | team | Partial | Ph 5 |
| Admin: Documents | Issued docs | `/admin/documents(/:id)`, `/admin/issue` | documents admin | CRUD, confirm, sign, archive | team (owner delete) | Partial | Ph 6 |
| Admin: Projects | Projects suite | 10 routes | projects admin | full CRUD, stage | team (owner money) | Partial | Ph 7 |
| Admin: Accounting | Books, deals, settlement | 6 routes | accounting admin | full | **owner** | Complete | — |
| Admin: Team / Settings / Memberships / Access Requests / App Design | Owner desks | 5 routes | auth admin, audit log, app-theme | full | owner (Design: team) | Complete | Ph 8 Access desk |

## API adoption matrix (by group)

The operation-level matrix is `docs/audit/2026-09-25/API_ADOPTION_MATRIX.md`.

| API group | Frontend section | Integration | UI | Notes |
| --- | --- | --- | --- | --- |
| `auth/*` (collector, team, me, access requests) | Login, Profile, Settings | Integrated, except `PATCH me`, `my-membership` | Partial | Ph 1 |
| `auth/admin/*` | Collectors, Team, Memberships, Access Requests | Integrated, except collectors summary and access-keys roster | Partial | Ph 4, Ph 8 |
| `catalog/*` collector | Market, Saved, Artists | Integrated, except `selections/` + `seen` | Complete | Ph 9 |
| `catalog/admin/*` | Database, editor, Artists, Import, Health | Integrated; new params unsent | Partial | Ph 0, Ph 4 |
| `crm/*` collector | Chat, Profile | Integrated, except archive/transition/activity read | Complete (v0.1) | Ph 9 |
| `crm/admin/*` | Requests, Chat, Club | Integrated, except message archive and `document_refs` | Partial | Ph 6 |
| `auctions/*` | Auctions, Records | Integrated; `cover_image_url` unused | Partial | Ph 3 |
| `auctions/admin/*` | Auctions desks | Integrated, except edit/archive/cover/reset | Partial | Ph 3 |
| `accounting/admin/*` | Accounting | Integrated | Complete | — |
| `sales/admin/*` | Sales | Integrated, **broken read shape** | Partial | Ph 0, Ph 2 |
| `documents/*` | Profile documents, Documents desk | Collector list, share and activity not bound | Partial | Ph 1, Ph 6 |
| `gallery/portal/*` | Portal | 9 of 14 bound | Partial | Ph 5 |
| `gallery/admin/*` | Sources, Exhibitions | Integrated, except reissue/pricelist status+cap/catalogue | Partial | Ph 5 |
| `projects/admin/*` | Projects | Integrated, except totals; new params unsent | Partial | Ph 7 |
| `recommendations/*` collector | Questionnaire | Integrated (with bug C-3); question-set unbound | Partial | Ph 0, Ph 9 |
| `recommendations/admin/*` | Intelligence | Not bound | Missing | **Not V1** (G-6) |
| `marketing/admin/*` | Marketing Hub | Not bound | Missing | **Not V1** (G-6) |
| `notifications/*` | Settings push | Not bound | Missing | Ph 9 (owner) |
| `dashboard`, `options`, `app-theme`, `admin/app-theme`, `admin/audit-log` | Dashboard, all, Design, Settings | Integrated | Complete | — |
| `health` | — | Backend-only | n/a | — |

## Panel / Admin

- **Implemented:** every routed desk (52 routes) renders behind `RequireTeam` + `DeskBoundary`. List desks
  share `DeskList` (loading, error, empty). Owner desks sit behind `RequireOwner`, matching the backend's
  `IsOwner` set.
- **Complete desks:** Dashboard, Requests, Import, App Design, Team, Accounting, Settings (audit log),
  Memberships, Access Requests.
- **Partial desks:** Chat, Database, editor, Artists, Sources, Source detail, Exhibition compose, Exhibition
  Services, Issue document, Published, Documents, Live Auctions, Records, Registrations, Collectors, Club,
  Sales, Projects, Data Health.
- **API available, no desk:**
  - Documents › History
  - Auction Sales
  - Owner Access (G-KEY-1)
  - Exhibition-catalogue editor
  - Question-set editor (owner)
  - Intelligence ×5 and Marketing (G-6, not V1)
- **Missing integrations:** see "Missing UI for existing APIs" in `API_GAPS_FRONTEND_ADOPTION.md`.
- **Known limitations:**
  - UI-only gates on project money, document delete and sale "responsible" (Q-2).
  - Document `owner_lock` is not reflected in the UI (Ph 6).
  - Lists capped at 100 (Ph 0).
  - Stale on-screen "backend gap" notes (about 20).

## Remaining gaps (at baseline)

- **Frontend/UI:** everything assigned to Phases 0–8 in `V1_IMPLEMENTATION_PLAN.md`.
- **API-binding:** the 85 not-bound and 3 partial operations, each with a disposition in
  `API_GAPS_FRONTEND_ADOPTION.md` § re-baseline.
- **Backend limitations:** C-6…C-22 in `V1_CONTRACT_ISSUES.md`, notably the lock 500s, the security items
  (C-13) and the WSGI Dockerfile (C-19).
- **Panel/Admin:** see above.
- **Technical debt:**
  - The schema regen is overdue.
  - Hand types (`HoldDetail`, `PortalState`, error `details`).
  - Hardcoded labels that `/options/` serves.
  - `isPathAllowed` is unused.
  - The E2E stub is behind the backend shapes.
- **Owner decisions:** Q-1…Q-9 in `V1_CONTRACT_ISSUES.md`.

## V1 section status

| Section | UI | API binding | V1 status | Notes |
| --- | --- | --- | --- | --- |
| Market / artwork / artists / saved / records | Complete | Complete | Partial | chip name (Ph 1) |
| Chat & requests | Complete | Complete | Complete | owner items deferred |
| Profile / Settings / Membership | Partial | Partial | Partial | Ph 1 |
| Questionnaire | Complete | Partial | Partial | bug C-3 (Ph 0) |
| Auctions (collector) | Complete | Partial | Partial | Ph 3 |
| Gallery portal | Partial | Partial | Partial | Ph 0, Ph 5 |
| Admin Sales | Partial | Partial | Partial | bug C-1; Ph 2 |
| Admin Auctions | Partial | Partial | Partial | Ph 3 |
| Admin Catalogue / Collectors / Club / Health | Partial | Partial | Partial | Ph 0, Ph 4 |
| Admin Sources / Exhibitions | Partial | Partial | Partial | Ph 5 |
| Admin Documents / Chat | Partial | Partial | Partial | Ph 6 |
| Admin Projects | Partial | Partial | Partial | Ph 7 |
| Admin Access desk | Missing | Missing | Missing | Ph 8 (Q-1) |
| Admin Accounting / Team / Settings / Memberships / Access Requests / Design / Dashboard / Requests / Import | Complete | Complete | Complete | — |
| Intelligence / Marketing / Document Builder | Missing | Missing | Deferred post-V1 | G-6 |
| Logistics / Analytics / Social / Strategy / Automations / Languages / Library / Insights & Stories | Missing | Not applicable | Deferred post-V1 | no backend |

## Deferred / V2 candidates

- **Intelligence** (AI tagging, smart filters, recommendations, history) and **Marketing Hub**: the API is
  ready (33 operations).
- **Document Builder / Studio** (D18).
- **Logistics & Payment** (backend Phase 20), **Library / saved items** (Phase 21), **Insights & Stories**
  (Phase 22), **i18n/RTL** (G-I18N-1).
- **Gallery portal:** referral/Introduce (G-PORT-5), drawn signature (G-PORT-7), offer floor/auto-decline
  engine (G-PORT-8), formatted pricelist download (P3c).
- **Admin:** Team Workspace (G-TEAM-1), Strategy, Automations, Languages, Analytics, the Social suite,
  "Notify collectors" (needs a push-send endpoint), the source-freshness loop (G-CAT-9), PDF/image import
  intake (D15), the settlement calculator, theme editors (D17), the proposal builder.
