# Darz Admin Panel — V1 audit and development plan

**Written 2026-09-21.** Read-only survey plus a plan. No application code was changed to produce it.

**What was inspected, at which commit:**

| Repo | Local path | Branch / commit | Role here |
| --- | --- | --- | --- |
| `ariandarz/-darz-web` | `../darz-web` | `development` @ `15227a9` | The frontend under audit |
| `ariandarz/darz-backend-api` | `../darzmarket-api` | `development` @ `74c9326` | Source of truth for backend capability |
| `ariandarz/darzstudio.art` | `../DarzStudio` | `main` (shallow) | Source of truth for admin UI/UX (`darz-studio.html`, 43,789 lines) |

> **Read this first — a branch correction.** `main` on `-darz-web` is **72 commits behind
> `development`**, and on `main` the admin panel is one page (`/admin/requests`). Everything below
> measures `development`, which is the real working line and carries the whole panel. Any audit run
> against `main` will conclude the panel does not exist. It does.

---

## 1 · Executive summary

**The Darz Admin Panel is built.** It is not a stub, not a prototype, and not a thin CRUD wrapper —
it is a faithful port of the old `darz-studio.html` panel's information architecture, with the old
file's own line numbers cited in the source of nearly every desk.

Measured:

| | |
| --- | --- |
| Frontend source | 287 files · 84,192 lines |
| **Of which the admin panel** | **111 files · 34,312 lines (41% of the app)** |
| Admin routes registered | **52** |
| Nav tabs in the ported map | **57** — 34 built, 23 not |
| Backend admin endpoints | **141** (of 191 total) |
| **Bound in the frontend API layer** | **111 of 141 (79%)** |
| Unused service methods (dead code) | 8 of 217 |
| Tests | **386 passing**, 36 files *(443 in 41 files as of 2026-09-21, plus the `e2e/` stub tier added in #66)* |
| Lint | 0 errors, 3 warnings (all outside admin) |
| Typecheck | **Fails on macOS only** — see TD-1 |

**Completion against V1:** roughly **80–85%** of the panel that V1 needs. The 23 unbuilt tabs split
cleanly:

- **10 have no backend at all** (Logistics, Analytics, Stories, Social ×3, Languages, Strategy,
  Automations, Pricelists) — not V1, not buildable, correctly deferred.
- **4 are partial** (Document History, Auction Sales, Project Proposal, Owner Settings) — each has a
  recorded reason and a design-around already in place.
- **9 have a ready API and no UI** — and *this is the entire remaining V1 surface*:
  Intelligence ×5, Marketing, Document Builder, Owner Settings/Audit, plus the Accounting desk's
  unfinished second half.

Two of the nine are false alarms on closer reading: **Access** (`path: null` in the nav) is in fact
fully built *inside* `CollectorDetailPage`, and **Market Portal** is built inside `SourcesPage`.
They are reachable, just not as their own navbar entries.

**So the honest remaining-V1 list is short:** Intelligence (5 tabs / 14 endpoints), Marketing Hub
(1 tab / 5 endpoints), Accounting completion (7 endpoints), the Audit log (1 endpoint), and two
catalogue leftovers (lot detail, selection grants). Everything else is either shipped or genuinely
backend-blocked.

**The one thing that was *not* in good shape was not code — it was the UI reference.** There was no
design package for the panel, so "pixel-perfect" had nothing to be measured against. **Closed
2026-09-21:** `../DarzStudio/design/admin-panel/` now carries 52 screens of the live old panel in
four device/mode combinations, and [`docs/ADMIN_SCREENS.md`](ADMIN_SCREENS.md) maps every desk to
its reference. See §6.3 — and note the three findings the captures forced, which no amount of
reading the source had produced.

---

## 2 · Current admin panel architecture

### 2.1 Shape

```
/admin/login          TeamLoginPage        — POST /api/auth/team/login/ → JWT, principal=team
   │
RequireTeam           principal === 'team' else → /admin/login
   │
AdminShell            two-tier navbar (ported from darz-studio.html:11086-11110)
   │                  row 1 .ad-tabs    Dashboard · group triggers · More · owner groups (gold)
   │                  row 2 .ad-subtabs the active group's tabs
   ├── RequireOwner   owner-only desks (Memberships, Team, Accounting, Access Requests)
   └── <Outlet/>      52 desk routes
```

**`src/features/admin/adminNav.ts` is the panel's map**, ported as *data* from the old file's
`ADGROUPS` (`:11721-11779`), `AD_FOLDED` (`:11781`) and `_dzAllowedTabs` (`:11794-11803`). Every tab
carries four fields: `path` (route, or `null` when unbuilt — **`path` alone decides rendering**, so
an unbuilt desk is absent from the navbar rather than stubbed), `api` (`ready`/`partial`/`none`),
`phase`, and a `note` explaining any non-`ready` state. Tests assert the counts, so the doc and the
navbar cannot drift apart. This is the single best artefact in the codebase and the plan below
builds on it rather than replacing it.

### 2.2 The desk kit — `src/features/admin/kit/`

A new desk is assembly, not invention:

| Component | Gives you |
| --- | --- |
| `DeskPage` | heading · optional primary action · optional filter toolbar · body |
| `DeskList` | **loading · error · empty · pagination in one place** |
| `DataTable` | the `.ad-card` + `.ad-tbl` shell with horizontal scroll |
| `filters.tsx` | search box, select, the `dz-dsel.act` "active filter" treatment |
| `FilterChips` | removable active-filter chips (old `dz-dchips`) |
| `ConfirmDialog` | destructive-action confirm |
| `Picker` | artwork/collector reference picker |
| `ShownOnceSecret` | the "copy this now, it is never shown again" pattern for access keys, team passwords, membership codes |
| `deskState.ts` | URL-synced desk query state |

This is why the loading/error/empty audit in §3 comes back clean for every desk that uses the kit.

### 2.3 Data layer

`src/api/services.ts` (1,561 lines) — one `ResourceService` subclass per backend app:
`CatalogAdminService`, `AdminAccountsService`, `SalesAdminService`, `DocumentsAdminService`,
`GalleryAdminService`, `AuctionsAdminService`, `AccountingAdminService`, `ProjectsAdminService`,
`DashboardService`, `ThemeService`, plus the collector-side services. 217 methods, 8 unused.

List screens extend `ListController<T, Q>` (`src/features/shared/ListController.ts`) — query state,
pagination, a stale-response token guard — driven by `useListController`. Errors are typed
(`UnauthorizedError`, `ValidationError`, `ConflictError` for the 409 optimistic lock).

### 2.4 Permissions

Two real roles (`owner`, `standard_admin`), read from `GET /api/auth/me/`'s `role`.
`OWNER_ONLY` in `adminNav.ts` is a verbatim port of the old panel's list (`:11800`), and the rule
*"the owner always sees every tab"* is ported with it. `RequireOwner` guards the routes; the backend's
`IsOwner` is still the real gate. Note the deliberate asymmetry, correct on both sides: **App Design
is not owner-only** — the old panel left it open to a standard admin, and backend Phase 32 matched
that with `IsStandardAdminOrOwner` while Memberships/Team got `IsOwner`.

### 2.5 Owner control of the collector app

`features.ts` now merges `theme.features` from the public `GET /api/app-theme/` over the build-time
`VITE_FEATURE_SET`, with the env var as the floor so a dead theme endpoint cannot dark-screen the
app. The owner switches collector features from `/admin/design` rather than from a deploy.

---

## 3 · Page-by-page module audit

Status vocabulary: **Full** = built and bound · **UI-no-API** = UI exists, binding missing ·
**Partial** = built, known holes · **None** = not built · **Elsewhere** = built, but inside another
desk rather than its own navbar entry.

| Module / Page | Route | Old UI exists | Current UI status | API available | API bound | Missing work | V1 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Dashboard** | `/admin` | ✅ | Full | ✅ | ✅ | Old desk's urgency/overdue band (see G-3) | **Yes** |
| **Chat** | `/admin/chat`, `/:id` | ✅ | Full | ✅ | ✅ | — | **Yes** |
| **Artworks › Database** | `/admin/artworks` | ✅ | Partial | ✅ | ✅ | 8 of the old desk's 13 filters have no backend (G-2); no column chooser; no bulk actions | **Yes** |
| **Artworks › Editor** | `/admin/artworks/:id`, `/new` | ✅ | Full | ✅ | ✅ | image **delete** unbound (`images/<id>/` DELETE) | **Yes** |
| **Artworks › Import** | `/admin/import`, `/:id` | ✅ | Full | ✅ | ✅ | CSV+paste only; PDF/image parsing not ported (owner decision D15) | **Yes** |
| **Artists** | `/admin/artists` | ✅ | Full | ✅ | ✅ | — | **Yes** |
| **Galleries / Sources & Partners** | `/admin/sources`, `/:id` | ✅ | Full | ✅ | ✅ | — | **Yes** |
| **Exhibition Services** | `/admin/exhibition-services` | ✅ | Full | ✅ | ✅ | — | **Yes** |
| **Issue a document** | `/admin/issue`, `/:eventId` | ✅ | Full | ✅ | ✅ | bank details live in `localStorage` (TD-3) | **Yes** |
| **Exhibition compose** | `/admin/sources/:id/exhibitions/:eventId` | ✅ | Full | ✅ | ✅ | — | **Yes** |
| **Market App › Published works** | `/admin/published` | ✅ | Full | ✅ | ✅ | — | **Yes** |
| **Market App › App Design** | `/admin/design` | ✅ | Full | ✅ | ✅ | — | **Yes** |
| **Documents › Library/Proposals/Invoices** | `/admin/documents`, `/:id` | ✅ | Full | ✅ | ✅ | — | **Yes** |
| **Documents › History** | — | ✅ | None | ◐ | — | issued half = the Library list; activity half needs an audit feed (G-DOC-2) | No |
| **Documents › Pricelists & saved items** | — | ✅ | None | ✗ | — | backend Phase 21 not built | No |
| **Documents › Document Builder** | — | ✅ | **None** | ✅ | — | **blocked on decision D18 (PDF renderer)** | *Decide* |
| **Auctions › Live Auctions** | `/admin/auctions`, `/:id` | ✅ | Partial | ✅ | ✅ | `admin/lots/<id>/` GET unbound | Hidden in v0.1 |
| **Auctions › Records** | `/admin/auction-records`, `/:id`, `/new` | ✅ | Full | ✅ | ✅ | — | Hidden in v0.1 |
| **Auctions › Register to Bid** | `/admin/auction-registrations` | ✅ | Full | ✅ | ✅ | — | Hidden in v0.1 |
| **Collectors › Collectors** | `/admin/collectors`, `/:id` | ✅ | Full | ✅ | ✅ | old desk's 4-tile overview strip + 2 sorts have no API (G-4) | **Yes** |
| **Collectors › Requests & Activity** | `/admin/requests` | ✅ | Partial | ✅ | ✅ | **no search box** (backend has no `?search=` — G-5); no scope segment; no urgency band | **Yes** |
| **Collectors › Collector Club** | `/admin/club` | ✅ | Full | ✅ | ✅ | `selection-grants/` endpoints unbound (server handles overlap) | **Yes** |
| **Sales › Market Sales** | `/admin/sales`, `/:id` | ✅ | Full | ✅ | ✅ | — | **Yes** |
| **Sales › Auction Sales** | — | ✅ | None | ◐ | — | `Sale` has no source axis (G-SALE-4) | No |
| **Projects › Dashboard** | `/admin/projects` | ✅ | Partial | ✅ | ✅ | Delayed / Awaiting-approval need stage sub-state (G-PROJ-3) | Optional |
| **Projects › List / Pipeline / Packages / Calculator / Partners / Reports** | `/admin/projects/*` | ✅ | Full | ✅ | ✅ | — | Optional |
| **Projects › Record** | `/admin/projects/:id`, `/report` | ✅ | Full | ✅ | ✅ | — | Optional |
| **Projects › Proposal** | in the record | ✅ | Partial | ◐ | ✅ | old free-form Proposal Builder not ported (deliberate) | Optional |
| **Intelligence › Overview** | — | ✅ | **None** | ✅ | ✗ | **whole desk** | *Decide* |
| **Intelligence › Tagging & Review** | — | ✅ | **None** | ✅ | ✗ | **whole desk** — 5 tag endpoints | *Decide* |
| **Intelligence › Smart Filters** | — | ✅ | **None** | ✅ | ✗ | **whole desk** — `feature-settings` | *Decide* |
| **Intelligence › Recommendations** | — | ✅ | **None** | ✅ | ✗ | **whole desk** — 6 endpoints | *Decide* |
| **Intelligence › History** | — | ✅ | **None** | ✅ | ✗ | **whole desk** | *Decide* |
| **Operations › App Design** | `/admin/design` | ✅ | Full (2nd entry point) | ✅ | ✅ | — | **Yes** |
| **Operations › Logistics & Payments** | — | ✅ | None | ✗ | — | backend Phase 20 not built | No |
| **Operations › Analytics** | — | ✅ | None | ✗ | — | no analytics API | No |
| **Operations › Data Health** | `/admin/data-health` | ✅ | Partial | ◐ | ✅ | 3 of ~8 old checks port; rest diagnosed the old sync architecture | **Yes** |
| **Social › Instagram / Calendar / AI Settings** | — | ✅ | None | ✗ | — | backend deliberately unscoped | No |
| **Social › Insights & Stories** | — | ✅ | None | ✗ | — | backend Phase 22 not built | No |
| **Owner › Access** | — | ✅ | **Elsewhere** (`CollectorDetailPage`) | ✅ | ✅ | issue/revoke/extend + login events all bound; only the standalone desk is absent | **Yes** |
| **Owner › Team** | `/admin/team` | ✅ | Full | ✅ | ✅ | — | **Yes** |
| **Owner › Marketing** | — | ✅ | **None** | ✅ | ✗ | **whole desk** — 5 endpoints incl. `generate-copy` | *Decide* |
| **Owner › Accounting** | `/admin/accounting`, `/deals/*` | ✅ | **Partial** | ✅ | ◐ | **7 unbound**: ledger status/review/attachments, Arian duplicates, settlement + versions | **Yes** |
| **Owner › Settings** | — | ✅ | **None** | ◐ | ✗ | **audit log** (`GET /api/admin/audit-log/`) is served and unbound; rest is prefs with no API | *Decide* |
| **Owner › Strategy / Automations / Languages** | — | ✅ | None | ✗ | — | no backend | No |
| **Owner › Market Portal** | — | ✅ | **Elsewhere** (`SourcesPage`) | ✅ | ✅ | links list/enable/disable/features all bound | **Yes** |
| **Access Mgmt › Memberships** | `/admin/memberships` | ✅ | Full | ✅ | ✅ | — | **Yes** |
| **Access Mgmt › Access Request** | `/admin/access-requests` | ✅ | Full | ✅ | ✅ | — | **Yes** |

---

## 4 · Backend API inventory (admin-relevant)

**191 endpoints total · 141 under an `admin/` segment.** Every response is the envelope
`{success, data, message, timestamp}`; list responses nest
`data.results` + `data.pagination {page, per_page, total_pages, total_count, has_next, has_previous}`.
Pagination is `?page=` + `?per_page=` (default 20, max 100). Auth is a JWT with `principal=team`.
Writes to versioned records take `expected_version` and answer **409** on a stale write
(`apps/core/concurrency.py`). Soft delete everywhere (`is_deleted`).

| App | Admin routes | Permission | Filtering / search / ordering |
| --- | ---: | --- | --- |
| `catalog` | 18 | `IsStandardAdminOrOwner` | `ArtworkFilterSet`: `artist`, `availability_status`, `price_min/max`, `medium` (icontains), `currency`, `price_type`, `tag` (repeatable, AND), `search` (artist/title/medium/dimensions), `ordering` (year/artist/price ±), plus 12 `refine_*` tag dimensions. `ArtistFilterSet`: `search`, `ordering` (name ±, works) |
| `accounts` | 14 | `IsStandardAdminOrOwner` (collectors, access keys, access requests) · **`IsOwner`** (membership codes, team users) | `CollectorFilterSet`: `search` (display_name/full_name/email/phone), `tier`, `access_status`, `ordering` (name/created ±). `MembershipCodeFilterSet`: `search`, `plan`, `status`. `TeamUserFilterSet`: `search`, `role`. `AccessRequestFilterSet`: `status` (defaults pending), `search` |
| `crm` | 7 | `IsStandardAdminOrOwner` | `AdminRequestFilterSet`: `kind`, `status`, `assignee`, `archived`. **No `search`, no `ordering`.** `CollectorActivityFilterSet`: `collector`, `kind`, `artwork` |
| `auctions` | 12 | `IsStandardAdminOrOwner` | records: `artist`, `section`, `is_highlight`, `status`, `search`, `ordering`; registrations: `auction`, `status` |
| `gallery` | 22 | `IsStandardAdminOrOwner` | links: `source_type`; updates: `link`, `kind`, `status`; exhibitions: `link`, `request_status`, `published` |
| `projects` | 15 | `ADMIN_PERM` | `ProjectFilterSet`: `search` (name/no/client_name/venue), `status`, `stage`, `category`, `archived`, `ordering`. Partners/service-catalog: `search`, `category` |
| `accounting` | 15 | **`IsOwner`** | `book`, `month` (`YYYY-MM`), type, status |
| `recommendations` | 14 | `IsStandardAdminOrOwner` | per-artwork / per-collector paths |
| `documents` | 7 | `IsStandardAdminOrOwner` | `kind` |
| `sales` | 5 | `IsStandardAdminOrOwner` | `status` |
| `marketing` | 5 | `IsStandardAdminOrOwner` | `status` |
| `core` | 6 | `IsStandardAdminOrOwner` (app-theme) · **`IsOwner`** (audit log) | audit log: `action`, `entity_type` |
| `dashboard` | 1 | `IsStandardAdminOrOwner` | — |

**Request state machine** (`apps/crm/lifecycle.py`) — per-kind, guarded. The frontend must never
hardcode these; `GET /api/options/` serves `crm.request_status_by_kind` derived from this table, and
every row carries its own `allowed_transitions`:

| Kind | Statuses |
| --- | --- |
| `hold` | requested → active → {expired, released, converted} |
| `offer` | submitted → {countered↺, accepted, declined, withdrawn} |
| `viewing` | requested → {scheduled → {completed, cancelled}, cancelled} |
| `purchase` | intent → qualified → negotiation → confirmed |
| `information` / `price` / `availability` / `message` | new → assigned → answered → closed |

**`GET /api/dashboard/admin/summary/`** returns `requests.new_by_kind` + `new_total` +
`resolved_total`, `today.{requests_created, collectors_created, bids_placed, collector_logins}`,
`collectors.{total, active}`, `catalogue.{total, available, on_hold, reserved, sold}`,
`auctions.{live_now, scheduled, registrations_pending}`, `exhibitions.pending_review`.

---

## 5 · UI ↔ API binding matrix

**111 of 141 admin endpoints are bound.** The 30 that are not, grouped:

| UI page (where it would live) | User action | API | Method | Current binding | Required work |
| --- | --- | --- | --- | --- | --- |
| Intelligence › Tagging | Load an artwork's tags | `/recommendations/admin/artworks/{id}/tags/` | GET | **none** | Service method + desk |
| Intelligence › Tagging | Auto-tag / AI-tag | `.../tags/auto/`, `.../tags/ai/` | POST | **none** | Service + action buttons |
| Intelligence › Tagging | Lock / approve a tag | `/recommendations/admin/tags/{id}/{lock,approve}/` | POST | **none** | Service + row actions |
| Intelligence › Smart Filters | Read / set dimension flags | `/recommendations/admin/feature-settings/` | GET, POST | **none** | Service + toggles desk |
| Intelligence › Recommendations | Collector preferences + rebuild | `/recommendations/admin/collectors/{id}/preferences/[rebuild/]` | GET, POST | **none** | Service + panel |
| Intelligence › Recommendations | List / generate per collector | `/recommendations/admin/collectors/{id}/recommendations/[generate/]` | GET, POST | **none** | Service + desk |
| Intelligence › Recommendations | Edit / drop one | `/recommendations/admin/recommendations/{id}/` | PATCH, DELETE | **none** | Service + row actions |
| Intelligence › History | Batches list / create | `/recommendations/admin/collectors/{id}/batches/` | GET, POST | **none** | Service + ledger |
| Intelligence › History | Publish / unpublish a batch | `/recommendations/admin/batches/{id}/{publish,unpublish}/` | POST | **none** | Service + confirm |
| Marketing Hub | Campaign list / create | `/marketing/admin/campaigns/` | GET, POST | **none** | Service + desk |
| Marketing Hub | Campaign read / edit / delete | `/marketing/admin/campaigns/{id}/` | GET, PATCH, DELETE | **none** | Service + editor |
| Marketing Hub | Generate copy | `/marketing/admin/campaigns/generate-copy/` | POST | **none** | Service + action |
| Marketing Hub | Analytics rows | `/marketing/admin/campaigns/{id}/analytics/[{id}/]` | GET, POST, DELETE | **none** | Service + sub-table |
| Accounting › entry | Change status | `/accounting/admin/ledger/{id}/status/` | POST | **none** | Row action |
| Accounting › entry | Read / edit / delete one | `/accounting/admin/ledger/{id}/` | GET, PATCH, DELETE | **none** | Detail route |
| Accounting › entry | Mark reviewed | `/accounting/admin/ledger/{id}/review/` | POST | **none** | Row action |
| Accounting › entry | Receipts | `/accounting/admin/ledger/{id}/attachments/[{id}/]` | GET, POST, DELETE | **none** | Upload control |
| Accounting › deals | Deal attachments | `/accounting/admin/deals/{id}/attachments/[{id}/]` | GET, POST, DELETE | ◐ (detail bound) | Upload control |
| Accounting › Arian | Duplicate review | `/accounting/admin/ledger/arian/duplicates/` | GET | **none** | Review screen |
| Accounting › Settlement | Read / save worksheet | `/accounting/admin/settlement/` | GET, PUT | **none** | Worksheet screen |
| Accounting › Settlement | Version history | `/accounting/admin/settlement/versions/` | GET | **none** | Version list |
| Owner › Settings | Audit log | `/admin/audit-log/` | GET | **none** | Read-only desk (`IsOwner`) |
| Auctions › lot | Read one lot (admin view) | `/auctions/admin/lots/{id}/` | GET | **none** | Detail panel |
| Club / Artwork editor | Selection grants | `/catalog/admin/artworks/{id}/selection-grants/[{id}/]` | GET, POST, DELETE | **none** | Grant inspector (server already handles overlap) |
| Artwork editor | Delete one image | `/catalog/admin/artworks/{id}/images/{id}/` | DELETE | **none** | Image row delete |

**Bound and working** — every remaining endpoint. Spot-checked flows: Dashboard summary, request
feed + transition + thread + mark-seen, collector CRUD + access-key issue/revoke/extend + login
events, membership issue/renew, team-user issue, artwork CRUD + transition + publish/unpublish +
image upload, artist CRUD, import batch + row edit/reject/confirm/discard, sales CRUD + transition +
payment/delivery status, documents CRUD + upload/confirm/sign/archive/versions, gallery links +
updates approve/reject + exhibitions compose/publish/documents, auctions + lots + registrations +
records, app-theme read/write/reset/versions, projects (all 15), club selections, access requests
approve/decline, data health.

**Frontend functionality with no backend API:** see G-2…G-5 in §8. There is no case of the frontend
inventing an endpoint — where an old-panel control has no API, the control was left out and recorded.

---

## 6 · Old vs new UI comparison

### 6.1 What was ported faithfully

- **The two-tier navbar** (`AdminShell`) — `.ad-tabs` / `.ad-subtabs`, the More row for folded
  groups, the gold `.ad-gtab--owner`, and four easy-to-miss rules from `_dzRenderSubnav` (folded
  group prefixed by the More row; a single-tab group shows no second row; a group-less page hides
  the row; the group label leads the row). All cited to line numbers.
- **The IA itself** — all 14 groups, 57 tabs, `OWNER_ONLY`, the `/admin` clamp
  (`if(!set[page])page=set.dashboard?'dashboard':'database';`, `:11815`).
- **The surfaces** — `.ad-h`, `.ad-toolbar`, `.ad-card`, `.ad-tbl`, `.dz-dsel.act`, the chip row,
  the shown-once-secret pattern, "LEAVE THE ROOM" sign-out copy.
- **The palette, correctly re-based.** The old admin hardcodes a light palette
  (`#FFFFFF`/`#EBEBEB`/`#9A9A9A`) with an `html.dz-admindark` override layered on top; `admin.css`
  (3,389 lines) maps those onto this app's tokens, so one rule set is right in both Paper and Black
  and there is no second theme toggle. **This is a deliberate, recorded deviation and it is the
  right one** — but it does mean "pixel-perfect against the old screenshots" is not literally the
  goal in dark mode.

### 6.2 Where the new panel differs

| # | Old | New | Why |
| --- | --- | --- | --- |
| 1 | Full-width workspace (`#adBody` spans the viewport) | **`.ad-page { max-width: 1040px }` — every desk is a centred column** | Inherited from the collector app's page shell. **This is the biggest visual divergence** and it hurts most on the data-dense desks (Artworks Database, Accounting, Requests). See G-1. |
| 2 | Global header carries `＋ New`, `✓ Confirmed & Saved`, dark-mode toggle | Not ported | `＋ New` is now per-desk (`DeskAction`) — a mechanics change, same action/copy. "Confirmed & Saved" was the old client-sync push, which does not exist here. Dark mode follows the app skin. |
| 3 | Build-version tag `· v1235` in the brand block | Omitted | No build-version concept in this repo; faking one would be invention. |
| 4 | Cloud-disconnected / thin-device banners | Omitted | Diagnosed the old localStorage-sync architecture. Correctly dead. |
| 5 | Collectors desk = **cards** with a 4-tile overview strip and a freshness dot | Table | The card face and the overview strip did not port. See G-4. |
| 6 | Database desk: 13 filters + column chooser + bulk actions + grid/table toggle + 48/page | 5 filters, fixed columns, no bulk actions, 20/page | Most missing filters have no backend. See G-2. |
| 7 | Requests desk: search box + All/Market/Auctions scope segment + urgency ("overdue") colouring | kind · status · archived only | No `?search=` on the endpoint; no urgency field. See G-5, G-3. |

### 6.3 The reference problem — read this

**There is no approved design package for the admin panel.** `DarzStudio/design/market-app/` — the
tokens, `COMPONENTS.md`, `SCREENS.md`, `VOICE.md` and 160 screenshots — covers the **collector Market
App only**. `CLAUDE.md`'s rule that every feature needs *two* sources (approved spec **and** real old
code) can only be half-satisfied for the panel: the sole reference is `darz-studio.html` itself, a
4.8 MB single file that needs a Supabase session to render.

So "pixel-perfect" currently has **nothing to be measured against**. Every fidelity claim in this
repo is a line citation, not a picture. That is good discipline and it is not sufficient.

**Recommendation (Phase 0 below):** re-run the old package's own capture harness
(`design/market-app/capture-screens.mjs`, Playwright, offline, reproducible) against
`darz-studio.html` to produce `design/admin-panel/screenshots/` + a tokens sheet. One day of work
that makes every later fidelity claim checkable instead of assertable.

> ### ✅ Closed, 2026-09-21 — `../DarzStudio/design/admin-panel/`
>
> The package now exists: **52 screens × desktop/mobile × dark/light**, captured offline from the
> live panel by a re-runnable Playwright harness, with a seeded review device so no desk renders an
> empty state. `docs/ADMIN_SCREENS.md` maps every tab in `adminNav.ts` to its capture.
>
> **Three things the captures changed about the sections above** — each found by looking, which is
> the whole point:
>
> 1. **§6.2 row 7 understates the Requests desk.** The old desk is not "the new toolbar plus a
>    search box". It is *card*-based, with a search box, a **STATUS** segment carrying live counts
>    (All 27 · Needs reply 10 · In progress 5 · Completed 12), a **SCOPE** segment
>    (All · Auctions · Market), a **FILTER BY TYPE** panel of per-kind cards each showing
>    `needs-reply / total`, and a red urgency banner — *"10 requests need your reply · 7 have been
>    waiting too long — shown first, in red"*. The new desk is a seven-column table with three
>    selects. The gap is wider than recorded, which strengthens **G-3** and **G-5**.
>    Reference: `13-requests`, `13-requests-full`.
> 2. **§6.2 row 1's dark-mode note was too hard on the port.** `platformSettings.theme
>    .forceDarkAdmin` defaults **ON** (`:16750`), which pins the old panel to charcoal *and removes
>    the Light/Dark toggle from its header*. So the shipped panel is dark-only unless the owner
>    changes a setting — and `admin.css` mapping onto this app's Paper/Black tokens with no second
>    toggle is **closer** to shipped behaviour than the audit implied, not further from it.
> 3. **G-4 is confirmed in detail.** The old Collectors desk shows the 4-tile strip
>    (Collectors · VIP · Active 30d · Engaged), then search + tier + sort, then a *card* per
>    collector with a serif name, a tier pill, a 3-metric strip (Purchases · Activity · Pricelists),
>    a green freshness dot with "Last active …", and a "＋ Generate password" row.
>    Reference: `11-collectors`, `12-collector-detail`.

---

## 7 · Missing V1 work

Ordered. "V1" = what the available APIs and the existing Darz flows need.

**Required for V1**

1. **Accounting completion** — 7 unbound endpoints: ledger detail route, status change, mark-reviewed, receipt attachments, deal attachments, Arian duplicate review, settlement worksheet + versions. The desk already states these as "later steps".
2. **Audit log desk** (`GET /api/admin/audit-log/`, `IsOwner`) — the only served half of Owner › Settings.
3. **Requests desk parity** — search (needs backend, G-5), scope segment, assignee filter (API exists, unused), per-row archive.
4. **Artwork image delete** — `DELETE .../images/{id}/`.
5. **Auction lot admin detail** — `GET /auctions/admin/lots/{id}/`.
6. **Selection-grant inspector** — 2 endpoints, so an admin can see *why* a work is curated for a collector.
7. **TD-1** — the macOS build break (below). Blocks local development outright.

**Exists but incomplete**

8. Data Health — 3 of ~8 checks (the rest have no backend; correctly scoped).
9. Projects Dashboard — Delayed / Awaiting-approval tiles need stage sub-state (G-PROJ-3).
10. Document History — the issued half is the Library list; the activity half needs an audit feed.

**Decide before building (API ready, no UI)**

11. **Intelligence** — 5 tabs, 14 endpoints. The largest single remaining surface.
12. **Marketing Hub** — 1 tab, 5 endpoints.
13. **Document Builder** — ready API, blocked on decision D18 (PDF renderer choice).

**Not V1** — Logistics, Analytics, Insights & Stories, Social ×3, Languages, Strategy, Automations,
Pricelists, Auction Sales. All backend-blocked; leave them as `path: null`.

---

## 8 · UI / product gaps requiring approval

**Nothing below has been built. Each needs a decision.**

### G-1 · The 1040px column (recommend: change for tables only)

- **Missing:** the old admin is a full-width workspace; every new desk is a 1040px centred column.
- **Why it may be required:** the Artworks Database has 13 columns plus a column chooser; Accounting has a per-currency summary strip plus entries; both currently scroll horizontally inside a card on a 1440px screen that has room to spare.
- **Requires:** no API.
- **Suggested solution:** keep 1040px for form/editor desks; add a `wide` variant on `DeskPage` (e.g. `max-width: 1600px`) for table desks. ~20 lines of CSS.
- **V1?** Required if "matches the old panel" is the bar; optional if the column is acceptable.
- **If we don't:** dense desks stay cramped and diverge most visibly from the old panel.

### G-2 · The Artworks Database's missing filters (recommend: backend work, then UI)

- **Missing:** 8 of the old desk's 13 filters — Year, Source, Market-App membership (in/not in the app), Gallery Portal, Chosen-by-Darz, Images (with/without/**duplicates**), Completeness (missing required/size/price/source), Size (presets, bigger/smaller than, custom W×H range). Also the sorts: Most-complete-first, Size, Width, Height. Also the column chooser (incl. custom columns) and bulk actions.
- **Why:** these are how the catalogue is actually curated. "Missing required fields" and "duplicate images" are the Data Health desk's job done inline.
- **Requires:** `ArtworkFilterSet` additions in `darzmarket-api` — each is one line in an existing declarative filter set. Size filters need dimension parsing (the old desk parses the `dimensions` text client-side).
- **Suggested solution:** add the cheap exact filters first (`year`, `source_name`, `is_published`, `has_images`); treat completeness/size/duplicates as a second round.
- **V1?** Recommended, not required — the desk works without them.
- **If we don't:** admins fall back to search and manual scanning on a large catalogue.

### G-3 · Request urgency / "overdue" (recommend: defer)

- **Missing:** the old Dashboard and Requests desk colour an un-answered request red past a threshold (`actUrgency`), and the Dashboard counts "messages waiting too long".
- **Requires:** either a backend `?older_than=` / an `age` field, or a client-side rule over `created_at` + status.
- **Suggested solution:** client-side, derived from `created_at` and the kind's initial status — no backend change, and the threshold becomes a `theme.*` key the owner can set.
- **V1?** Optional. It is a real operational signal, not decoration.
- **If we don't:** nothing surfaces a request that has been sitting.

### G-4 · Collectors overview strip + card face (recommend: partial)

- **Missing:** the 4-tile strip (Collectors · VIP · Active 30d · Engaged), the card layout, the freshness dot, and the "Recently active" / "Most purchases" sorts.
- **Requires:** `Active 30d` and `Engaged` need an aggregate the API does not serve; `Most purchases` needs a purchase count on the collector row; `Recently active` needs last-activity.
- **Suggested solution:** build the strip with the two tiles that *are* answerable today (total, active) and raise the other two with the backend; keep the table (it scales better than cards) unless you want the card face back.
- **V1?** Optional.
- **If we don't:** the desk lists collectors without a sense of the roster.

### G-5 · Search on the admin request feed (recommend: yes, backend one-liner)

- **Missing:** the old desk searches collector name, artwork title, auction title, note, message and reply. `AdminRequestFilterSet` has no `search`.
- **Requires:** one `SearchFilter` line in `apps/crm/filters.py` over `collector__display_name`, `artwork__title`, `artwork__artist__display_name`.
- **Suggested solution:** add it backend-side, then the existing `filters.tsx` search box drops straight in.
- **V1?** **Required** — it is the busiest desk in the panel and the only one with no way to find a row.
- **If we don't:** finding one collector's request means paging.

### G-6 · Intelligence, Marketing, Document Builder — build or defer?

- Three complete desks with ready APIs (14 + 5 + n endpoints) and no UI. They are the bulk of the remaining work and none of them is needed to run the v0.1 collector app.
- **Decision needed:** build them in V1, or mark them post-V1 and close the panel at the operational desks?
- **Recommendation:** **defer all three past V1.** Finish Accounting, the audit log, and the Requests-desk parity instead. Document Builder additionally needs D18 decided first.
- **Decided 2026-09-21: defer all three.**

### G-DEL-1 · Three deletes the old panel has and this port does not (found 2026-09-21)

- **How it surfaced:** resolving TD-6 ("8 unused service methods — delete or wire"). Before
  deleting a binding, each was checked against the old panel — and three of them are not
  dead code at all, they are **buttons the old panel ships and this port never built**:

  | Old panel | Its confirm | API here |
  | --- | --- | --- |
  | "Delete deal" (`:12664`) | "Delete this deal? The collector's request/activity is not affected." | `DELETE /accounting/admin/deals/{id}/` · `IsOwner` |
  | `×` "Delete auction permanently" (`:31815`) | "Delete this auction?" | `DELETE /auctions/admin/auctions/{id}/` · `IsStandardAdminOrOwner` |
  | `dlDelDoc` (`:17913`), **owner only** | "Delete this document and all N versions? A version a gallery already holds cannot be un-sent." | `DELETE /documents/admin/documents/{id}/` · `IsStandardAdminOrOwner` |

- **Note the third row's mismatch:** the old panel gates document delete on the owner
  ("Only the owner can delete an issued document"); the API here lets any standard admin
  do it. The faithful port is the **stricter** gate — flagged rather than silently taking
  the looser one.
- **Decision needed:** build all three (Phase 6b), or leave the panel without them?
- **Recommendation:** **build them**, with the old confirm copy verbatim and the owner
  gate on documents. They are row actions over endpoints already bound, and their absence
  means the only way to delete these records today is Django admin.
- **Not in scope either way:** exhibitions. The old panel has no delete for them, so
  adding one would be inventing a destructive action, not porting one.

### G-LOCK-1 · Accounting and Auction Records are last-write-wins (found 2026-09-21)

- **What:** `expected_version` is enforced in the `catalog`, `accounts`, `projects`, `crm`
  and `sales` serializers only. The ledger entry editor and the auction-record editor send
  no version and the server checks none, so two admins editing the same row silently
  overwrite one another — the second save wins and the first person is never told.
- **Frontend cannot fix this.** There is no 409 to catch; the write succeeds.
- **Suggested solution:** backend — add the lock to `accounting` and `auctions` writes, the
  way `sales` already does it. The UI change afterwards is one `expected_version` field and
  the kit's `ConflictBanner`, both of which now exist.
- **V1?** Judgement call: the ledger is the place where a silent overwrite costs real money.

---

## 9 · Technical debt and risks

### Must fix for V1

| # | Finding | Detail |
| --- | --- | --- |
| **TD-1** | **`npm run build` and `npm run typecheck` fail on macOS and Windows** | `src/features/profile/Acquisitions.tsx` (component) and `src/features/profile/acquisitions.ts` (helpers) differ only in case. On a case-insensitive filesystem TS resolves `import { Acquisitions } from './Acquisitions'` to the *helper* module: `TS2724` + `TS1261`. CI runs Ubuntu, so it is **green in CI and red on every Mac** — the exact failure mode the repo's own CI comment warns about. Fix: rename one module (e.g. `acquisitions.ts` → `acquisitionRows.ts`). ~3 lines. |
| **TD-2** | **`main` is 72 commits behind `development`** | Anyone auditing, branching from, or deploying `main` gets a one-page admin panel. Release or document the gap. |
| **TD-3** | **Bank details in `localStorage`** | `IssueDocumentPage.tsx` `readBank`/`saveBank` keep the payee account holder, bank, card and IBAN per-device. A second admin issuing an invoice gets blanks; a cleared browser loses them. Belongs under `theme.*` (App Design) or its own endpoint. |

### Recommended cleanup

| # | Finding |
| --- | --- |
| ~~**TD-4**~~ | ~~Success feedback is inconsistent.~~ **Closed 2026-09-21** — `DeskToast` + `DeskSave` in the kit, ported from the old panel's `toast()` and its v510/v631 "✓ Saved" flash. |
| ~~**TD-5**~~ | ~~Optimistic-lock handling is uneven.~~ **Closed 2026-09-21** — `ConflictBanner` in the kit; the six Projects desks share it and five more desks gained it. Two corrections: the backend does **not** 409 on every versioned write (only `catalog`/`accounts`/`projects`/`crm`/`sales` enforce it), so Accounting and Records were mis-listed here — see **G-LOCK-1**. |
| ~~**TD-6**~~ | ~~8 unused service methods … delete or wire.~~ **Resolved 2026-09-21 — none were dead code.** Three are unbuilt old-panel buttons (**G-DEL-1**), one is a destructive action the old panel never had, one waits on a hidden v0.1 screen, and `RecommendationService` is a whole unbuilt surface. All eight now say in a comment why they have no caller. |
| ~~**TD-7**~~ | ~~3 lint warnings.~~ **Closed 2026-09-21** — and one was a real bug: `AuctionEventPage` had no countdown timer at all, so its "2d 23h" froze at mount. Both auction pages now take the time from `useNow`. Lint: **0 warnings**. |
| **TD-8** | **`admin.css` is 3,389 lines in one file.** It is well-commented and cited, but it is now the second-largest file in the repo. Consider splitting per desk group as the kit did for components. |
| **TD-9** | ~~**No admin E2E coverage.**~~ **Partly closed 2026-09-21** (#66, after this audit was written): `e2e/` now boots the production build against a stub server in CI, and one of its three tests *does* open a desk — "a desk renders its empty state against an empty backend". What remains is **breadth, not existence**: 3 smoke tests across 52 admin routes, with the real-backend walks still local and manual. |

### Can safely postpone

| # | Finding |
| --- | --- |
| **TD-10** | `standardSet.ts` (1,042 lines) ships Darz's service catalogue as frontend data. It is a *seeder* that writes through the API, and it is documented as such — but the prices now live in two places. |
| **TD-11** | App Design appears in two nav groups (Market App and Operations). Ported faithfully from the old panel (`:11730`, `:11764`); `findTab` returns the first match. A fact, not a bug. |
| **TD-12** | `PackagesPage.tsx` (1,499) and `ProjectPage.tsx` (1,563) are large. Projects is optional for V1, so leave them. |

### Risks

- **R-1 — no visual reference.** §6.3. "Pixel-perfect" cannot currently be verified. Highest risk to the stated goal.
- **R-2 — the deploy is blocked.** Frontend Phase 14 records the deploy waiting on a Vercel team role. The panel cannot be reviewed on a real device until that clears.
- **R-3 — schema drift.** `src/api/schema.d.ts` is generated from a locally-running backend, never committed as a snapshot from elsewhere. If the generating backend is stale, types silently lie. **Confirmed stale, 2026-09-21:** the committed schema declares **no 409** on `/sales/admin/sales/{id}/`, `/catalog/admin/artworks/{id}/`, `/catalog/admin/artists/{id}/` or `/crm/admin/selections/{id}/`, yet all four call `enforce_version` and the sales view's own `@extend_schema` lists `409: ERROR_RESPONSE`. Anyone reading the generated types to decide whether a write can conflict would conclude — wrongly — that none of them can. Regenerate against a current backend.

---

## 10 · Development plan

Dependency-ordered. The desk kit exists, so each phase is assembly.

### Phase 0 — Foundations (½–1 day) · no approval needed · ✅ **done 2026-09-21**

- **Goal:** unblock local development and make fidelity measurable.
- **Work:** fix TD-1 (rename the case-colliding module); capture the admin reference package — run the old `capture-screens.mjs` harness against `darz-studio.html` into `design/admin-panel/screenshots/{desktop,mobile}/{light,dark}/`; add a short `ADMIN_SCREENS.md` indexing which capture each desk is compared against.
- **Reuse:** the harness and package layout already exist for the Market App.
- **API:** none. **Backend dep:** none. **Permissions:** none.
- **DoD:** `npm run build` green on macOS; every built desk has a named reference capture.
- **Complexity:** Low. **Depends on:** nothing.
- **Outcome:** TD-1 fixed (#61). `../DarzStudio/design/admin-panel/` carries the harness, the seed
  and 52 screens × 4 combinations; [`docs/ADMIN_SCREENS.md`](ADMIN_SCREENS.md) is the map. Nine
  rows have no capture and each says why — seven are backend-blocked desks, two
  (Exhibition Services, Issue a document) have no old-panel page because they are new routes over
  old content. The three corrections the captures forced are in §6.3.

### Phase 1 — Requests desk parity (1–2 days) · **needs G-5 approved**

- **Goal:** the busiest desk gets the old desk's find-and-triage behaviour.
- **Pages:** `/admin/requests`, `/admin/chat/:id`.
- **Reuse:** `filters.tsx` search box, `FilterChips`, `AdminRequestsController`, `DeskList`.
- **New:** scope segment (All / Market / Auctions), assignee select, per-row archive action, optional urgency treatment (G-3).
- **API:** `GET /api/crm/admin/requests/` (+ **new `?search=`**), `POST .../transition/`, `.../messages/`, `.../mark-seen/`.
- **Backend dep:** one `SearchFilter` line in `apps/crm/filters.py`.
- **Validation:** none (read + transition). **States:** DeskList covers all three.
- **Permissions:** `IsStandardAdminOrOwner`.
- **DoD:** search returns rows by collector name and artwork title; scope segment matches the old counts; archive round-trips; 409 on transition shows a distinct message.
- **Complexity:** Low. **Depends on:** Phase 0.

### Phase 2 — Accounting completion (3–4 days)

- **Goal:** close the 7 unbound endpoints; finish the desk the code itself lists as unfinished.
- **Pages:** `/admin/accounting` (+ entry detail route), `/admin/accounting/settlement`, Arian duplicates.
- **Reuse:** `AccountingPage`, `AccountingDeals`, `DeskList`, `ConfirmDialog`, `Segment`, the document-upload control from `DocumentDetailPage`.
- **New:** ledger entry detail, status/review row actions, receipt attachment upload+delete, duplicate-review screen, settlement worksheet + version list.
- **API:** `/accounting/admin/ledger/{id}/[status|review|attachments]`, `.../arian/duplicates/`, `.../settlement/[versions/]`, `/accounting/admin/deals/{id}/attachments/`.
- **Backend dep:** none — all served.
- **Validation:** write serializer's fields; `book` immutable on PATCH; **never sum across currencies** (the service's own rule).
- **Permissions:** **`IsOwner` on every route** — guard with `RequireOwner`.
- **DoD:** an entry can be created → edited → status-changed → receipted → reviewed; settlement saves and lists versions; no cross-currency total appears anywhere.
- **Complexity:** Medium-high (largest remaining bound surface). **Depends on:** Phase 0.

### Phase 3 — Owner Settings + Audit log (1 day)

- **Goal:** give Owner › Settings its one served half and a navbar entry.
- **Pages:** new `/admin/settings`.
- **Reuse:** `DeskPage`, `DeskList`, `filters.tsx`.
- **API:** `GET /api/admin/audit-log/` (`?action=`, `?entity_type=`), `IsOwner`.
- **DoD:** the log lists, filters by action and entity type, paginates; tab appears for the owner only.
- **Complexity:** Low. **Depends on:** Phase 0.

### Phase 4 — Catalogue leftovers (1 day)

- **Goal:** finish the three small unbound edges.
- **Work:** image delete in `ArtworkEditorPage`; selection-grant inspector (read + revoke) surfaced from `ClubPage` and the artwork editor, **stating the overlap rule on screen** (removing a pair only revokes the grant when no other selection still wants it); admin lot detail panel in `AuctionAdminDetailPage`.
- **API:** `DELETE .../images/{id}/`, `GET/POST/DELETE .../selection-grants/`, `GET /auctions/admin/lots/{id}/`.
- **DoD:** each action round-trips; the grant panel never claims a revoke it did not perform.
- **Complexity:** Low. **Depends on:** Phase 0.

### Phase 5 — Database desk filters (2–4 days) · **needs G-2 approved**

- **Goal:** restore the old curation filters.
- **Split:** 5a = the cheap exact filters (`year`, `source_name`, published, has-images) — one line each in `ArtworkFilterSet`, then the UI. 5b = completeness / duplicates / size ranges — real backend work.
- **Reuse:** `filters.tsx`, `FilterChips`, `deskState.ts`.
- **Backend dep:** `darzmarket-api` `apps/catalog/filters.py`.
- **DoD:** every added filter is server-side, chips render and clear individually, the URL round-trips.
- **Complexity:** 5a Low · 5b Medium. **Depends on:** Phase 0, and the backend change landing first.

### Phase 6 — UI polish pass (2–3 days) · **needs G-1 approved** · ◐ **mostly done 2026-09-21**

- **Goal:** the fidelity pass, against the Phase 0 captures.
- **Work:** the `wide` `DeskPage` variant for table desks; one success-feedback pattern in the kit (TD-4); consistent 409 handling (TD-5); delete the 8 dead service methods (TD-6); clear the 3 lint warnings (TD-7); Collectors overview strip if G-4 is approved.
- **DoD:** every desk is compared side-by-side against its capture and each remaining difference is either fixed or recorded with a reason.
- **Complexity:** Medium. **Depends on:** Phases 0–4.
- **Outcome so far:** `wide` shipped with G-1 and the Collectors strip with G-4 (both 2026-09-21).
  **TD-4 / TD-5 / TD-7 closed** in the same pass — the kit gained `DeskToast`,
  `DeskSave` and `ConflictBanner` (`kit/feedback.tsx`, `kit/feedbackState.ts`), the old
  panel's `.dz-toast` (`:370-372`) and v510/v631 `.dz-saved` (`:196-202`) ported with them,
  and lint is back to **0 warnings**. Three things the work changed about this document:

  1. **TD-5's list was wrong about two of its three desks.** Accounting and Records
     **cannot 409 at all** — `expected_version` is enforced only in the `catalog`,
     `accounts`, `projects`, `crm` and `sales` serializers, and `accounting` and
     `auctions` are not among them. Their editors are **last-write-wins**: two admins on
     the same ledger entry or auction record silently overwrite each other, with no
     error to surface. That is a backend gap, recorded as **G-LOCK-1** in §8, and it is
     why those two desks got the success half of this pass and not the conflict half.
     The desks that really did lack it were Sales detail, the artwork editor, the artist
     roster and its form, and the private-selection editor — all five now have it.
  2. **TD-6 was not dead code.** See **G-DEL-1** in §8.
  3. The audit said "8 unused service methods … delete or wire"; none were deleted. Each
     now carries a comment saying why it has no caller, so the next reader does not
     re-flag it.
- **Still open in this phase:** the desk-by-desk comparison against the Phase 0 captures
  (the DoD proper), TD-8 (`admin.css` is one 3,700-line file) and TD-9 (no admin E2E).

### Phase 6b — the deletes the old panel has (½ day) · **needs G-DEL-1 approved**

- **Goal:** build the three destructive row actions the old panel ships and this port
  skipped — found by resolving TD-6, not by the original survey.
- **Work:** delete a deal (`:12664`), delete an auction (`:31815`), delete an issued
  document (`:17913`, owner-only there). Each is a row action over an endpoint the API
  layer **already binds**, with `ConfirmDialog` already in the kit, and each has the old
  panel's own confirm copy to port verbatim.
- **Why it is its own step:** adding permanent-delete buttons to three desks is not a
  polish pass, and the document one needs a ruling (below).
- **Complexity:** Low. **Depends on:** Phase 6.

### Phase 7 — Deferred, on approval only

- **7a Intelligence** (5 tabs, 14 endpoints) — the largest remaining desk group. 4–6 days.
- **7b Marketing Hub** (5 endpoints). 1–2 days.
- **7c Document Builder** — **blocked on decision D18** (`@react-pdf/renderer` is the standing recommendation; confirm the ~0.5 MB bundle cost first).

### Not planned

Logistics · Analytics · Insights & Stories · Social ×3 · Languages · Strategy · Automations ·
Pricelists · Auction Sales — all backend-blocked. Leave `path: null`; the navbar already hides them.

---

## 11 · Recommended starting point

**Start with Phase 0, then Phase 1.** Concretely, in order:

1. **`src/features/profile/acquisitions.ts` → `acquisitionRows.ts`** and update the two importers. Three lines; restores `npm run build` on macOS. *(Prepared — see the PR linked from this branch.)*
2. **Capture the admin reference package.** `design/admin-panel/screenshots/` via the existing Playwright harness. Without it, §6's fidelity question stays unanswerable and Phase 6 has no acceptance criterion.
3. **`apps/crm/filters.py`: add `SearchFilter(fields=["collector__display_name", "artwork__title", "artwork__artist__display_name"])` to `AdminRequestFilterSet`.** One line, one test, unblocks the highest-value UI gap.
4. **`AdminRequestsPage`** — drop in `filters.tsx`'s search box, add the scope segment and the assignee select, add the per-row archive action. All four reuse existing kit components; no new CSS.

**Files that change in the first pass:**
`src/features/profile/{Acquisitions.tsx,acquisitions.ts,ProfilePage.tsx}` ·
`src/features/admin/AdminRequestsPage.tsx` · `src/features/admin/AdminRequestsController.ts` ·
`darzmarket-api/apps/crm/filters.py` + its test · `design/admin-panel/**` (new).

**Do not start** Intelligence, Marketing or the Document Builder until G-6 and D18 are decided —
they are more work than everything else in this plan combined.

---

## Decisions waiting on the owner

| Ref | Question | Recommendation |
| --- | --- | --- |
| **G-1** | Widen table desks past the 1040px column? | Yes — a `wide` variant, table desks only |
| **G-2** | Restore the Database desk's 8 missing filters? | Yes for the 4 cheap ones; scope completeness/size/duplicates separately |
| **G-3** | Request urgency / overdue colouring? | Yes, client-side, threshold as a `theme.*` key |
| **G-4** | Collectors overview strip and card face? | Strip with the 2 answerable tiles; keep the table |
| **G-5** | Search on the admin request feed? | **Yes — required for V1** |
| **G-6** | Build Intelligence / Marketing / Document Builder in V1? | **No — defer all three** ✅ *decided 2026-09-21: deferred* |
| **G-DEL-1** | Build the three deletes the old panel has (deal · auction · document)? | **Yes**, old confirm copy verbatim, owner-gated on documents |
| **G-LOCK-1** | Backend: put the optimistic lock on Accounting and Auction Records? | Yes for the ledger at least — a silent overwrite there costs money |
| **D18** | Document Builder's PDF renderer | `@react-pdf/renderer`, after checking bundle cost |
