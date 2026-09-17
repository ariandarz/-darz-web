# Changelog — Darz Market Web

Format rule: **one entry per task/step, at most 3 lines.** Line 1 = date + what was done.
Newest first. Add an entry whenever a task in `docs/TASKLIST.md` moves to done (`[x]`).

---

## 2026-09-11 — v0.1 launch scope (branch `claude/darz-market-v0-1-hpy1xy`)

- **Feature controls** — `src/features/shell/features.ts` (`VITE_FEATURE_SET`): v0.1 shows Market ·
  Records · Chat · Profile · Settings and Send Inquiry; auctions, bidding, offers, holds, viewings,
  the questionnaire, AI chat and stories stay in the codebase, hidden; hidden routes redirect.
- **App shell + nav** — `AppShell` with the old `<nav id="nav">` (bottom bar / desktop top bar),
  `LayoutController` (the `html.dz-desktop` switch at 900px), desktop two-column artwork detail.
- **Inquiry loop** — `InquiryAction` / `InquirySheet`; `RequestController` idempotency keys;
  `ConversationsController` + `ThreadController`; `/chat`, `/chat/:id`; admin feed shows names,
  the message and a `New` chip.
- **Profile** (`/profile`) and **Settings** (`/settings`) — Phase 9's first cut, read-only account.
- **Records** — `RecordsArchiveController` (five houses), Cards / List, artist page with
  evidence-gated insights (`insights.ts`, tested), full record detail; artist page links to it.
- **Images** — one fit-not-crop rule on every artwork image (`catalogue.css` `.card .img img`).
- Schema regenerated from backend Phase 19.3; 17 test files / 98 tests. Details and owner flags:
  `docs/V0_1_SCOPE.md`.
## 2026-09-11 — Design pass: the Market App shell + every screen re-skinned to the design package

Source of truth is now the Market App design-system handoff package (`darzstudio.art`
`design/market-app/`, PR #846, build 1229): tokens ported verbatim (`src/design/tokens.css`), the
charcoal skin is the collector default, and every screen was captured with Playwright at 390×844 and
1440×900 against the package's own captures (fonts served from the package's `inline.css`). New:
`features/shell` (`.frame` · glass header + **Leave the Room** · chroma line · bottom nav / desktop
top nav, `LayoutController` for `html.dz-desktop`), `Dropdown` (`dzSel`) and `Segment` (`.viewseg`)
components, catalogue single view (`ViewPreference`), previous/next arrows on the detail
(`BrowseSet`), View in Room, share, the "More works by this artist" card, the artist page's
`dzUniCard` tiles + enquiry, auction posters (first lot), the event page's countdown/register card/
lot rows, the records tab (sub-sections · sort · Cards|List · empty state), **Profile** (Overview ·
Market · Auctions · Account, `ProfileController`), **Settings** (`DevicePreferences`), and the
`#dzGate` black-world login. Typecheck / lint (3 pre-existing-style warnings) / 82 tests / format /
build clean. Owner-facing scope flags are listed in `docs/API_INTEGRATION_GAPS.md` § Still open.
**Merged onto v0.1 (2026-09-12):** v0.1's feature controls, nav order (Market → Records → Chat →
Profile → Settings), Send Inquiry, Chat, Records archive, Profile and Settings pages are the
behaviour; the design pass supplies the tokens, the shell chrome (header · chroma · 430px frame), the
catalogue / detail / artist / auction styling and the `#dzGate` login on top of them.

## 2026-09-11 — API integration: wire Saved/Requests/Admin to the merged backend gaps

New `docs/API_INTEGRATION_GAPS.md` — the live map of what four merged `darzmarket-api` PRs now
serve and where this frontend uses each one; supersedes `API_GAP_ANALYSIS.md`/
`FLOW_1_API_GAPS.md`/`PHASE_6_API_GAPS.md`/`PHASE_8_API_GAPS.md` as the current reference (each
kept as historical record, pointer added). `SavedController` rewritten around `artwork.is_saved`
(no more full-list walk); `SavedItemsPage` is a real paginated list (`SavedListController`).
`ActionButtons` filters by `artwork.allowed_actions`; `RequestController` sends `client_req_id`.
`AdminRequestsPage` shows real collector/artwork names, a live per-kind status vocabulary, and
per-row `allowed_transitions`. `OptionsMap` widened for the new nested/dynamic option shapes.
`schema.d.ts` regenerated. 82/82 tests green (rewrote `SavedController.test.ts`,
`RequestController.test.ts`'s idempotency assertions), typecheck + build clean, verified live
against the local backend (screenshots + network trace).

## 2026-09-10 — Phase 8 step 4: auctions — the external auction-house Records archive

Backend `darzmarket-api` `phase-11.4` adds a read-only collector view of `AuctionRecord`:
`GET /api/auctions/records/` + `/{id}/` (`IsCollectorPrincipal`), `?search=` (artist / house / lot
title), `?ordering=` (`sale_date` / `price_amount` +/-), `?artist=<uuid>`, plus a computed
`artist_display_name` (linked Artist's name, else `artist_name_raw`). Frontend:
`AuctionService.records()/record()`; `RecordsController extends ListController` (debounced 300ms
`setSearch` + `setOrdering`, like the catalogue toolbar); `useRecords()` / `useRecord()`. `/records`
(RecordsPage) + `/records/:id` (RecordDetailPage) ported from `app.html` `recordsView()` (~4760+):
the `.rec2-hd` header + chroma seam, the `.rec2-tools` search/sort row, a `.rec2-grid` of `.rec2-c`
cards (house + sale-month, artist, lot title, price realised); the detail reuses the shared
`.detail` shell + `.fields` with the source link + notes. "Records" link in the auctions hero — the
old `showRecordsTab: 'Hidden'` flag is not reproduced, it is a plain always-on route now.
`auctions.css` ports the `.rec2-*` chrome (source lines cited). **`docs/PHASE_8_API_GAPS.md` G-P8-1**
records the field-parity gap: the backend `AuctionRecord` is much leaner than the old Records tab
(no image / year / medium / dimensions / estimates / hammer-vs-realized / sale_name / provenance /
Past-Upcoming-Live section / highlights) — the widened model + the admin Records desk that maintains
it are deferred to Phase 11 (`docs/PHASE_8_PLAN.md` § Deferred). 4 new tests (84 total); typecheck /
lint / format / build clean. Verified end-to-end in-browser (seeded records): the list renders
`artist_display_name` (FK name + `artist_name_raw` fallback both), newest-first, a debounced
server-side search filters to one house, and the detail shows all fields + the source link.
Frontend PR `phase-8-auctions-records`; backend PR `phase-11.4-auctions-records`.
**On merge, Phase 8 (auctions) is complete.**

## 2026-09-10 — Phase 8 step 3: auctions — notifications feed + live banner + unified status pills

Backend `darzmarket-api` `phase-11.3` adds read-only `lot_artwork_title` / `lot_number` to the
collector notification serializer + documents the `payload` shape per kind. Frontend:
`AuctionService.notifications() / markRead()`; `AuctionNotificationsController extends ListController`
— the feed with a boot + ~45s poll + on-focus refresh (no WS for notifications, matching the Phase 5
thread decision), optimistic `markRead` / `markAllRead`, and `unread` / `unreadCount` / `latestUnread`.
`AuctionNotificationsProvider` puts one on context inside `RequireAuth` (mirrors `SavedProvider`) and
renders `AuctionBanner` — the live "Darz auction" banner ported from `app.html` `.dz-anotif` (~793):
fixed bottom-centre, independent of any reply banner, kind-coloured status word + a matching left
seam bar, count chip, tap → the related lot (marks read). `/auctions/notifications` page — newest
first, unread emphasised, per-row + "Mark all read", tap → the lot; "Notifications (N)" link in the
auctions hero. `status.ts` — the one vocabulary (`lotPills` / `notificationPill` / `notificationLine`,
ported from `aucPill`, app.html ~6258) wired into the lot rows + lot detail; `auctions.css` ports
`.aucpill*` + `.dz-anotif*` + the feed rows (source lines cited). 12 new tests (80 total);
typecheck / lint / format / build clean. Verified end-to-end in-browser (two notifications for a real
collector): the banner shows the newest unread with the right accent, the feed lists both with pills
+ "Lot N" (proves BE-7), and marking one read updates the hero count, the mark-all count and swaps
the banner to the next unread — all off one shared polled controller. Frontend PR
`phase-8-auctions-notifications`; backend PR `phase-11.3-auctions-notifications`.

## 2026-09-10 — Phase 8 step 2: auctions — Conditions of Sale + paddle registration + place/raise bid

Backend `darzmarket-api` `phase-11.2` adds `Auction.terms`/`terms_required`,
`BidderRegistration.terms_accepted_at` + `agree_terms`, and `opening_amount`/`min_next_amount` on the
collector lot. Frontend: `AuctionService.registrations()/register()/placeBid()`; `RegistrationController`
(Observable) loads the collector's paddles, `forAuction(id)`, `register()` with an in-flight guard and
the server's terms-required 400 surfaced verbatim; `LotController.placeBid()` — double-tap guard,
merges the returned lot like a live frame (price / count / `is_leading` before the WS echo), surfaces
the floor / must-increase / not-approved / not-live rejections verbatim. `ConditionsSheet` renders
`auction.terms` or the ported `DARZ_AUC_TERMS` (app.html ~8177-8195) + the "I have read and agree"
checkbox; `RegistrationBand` is the event-page `bidRegState` slot (`.auc-reg` CTA / `.auc-msg`
pending|approved|rejected, app.html ~8300); `BidSheet` is a grouped max-amount field (reuses
`requests/amount`) pre-filled with `min_next_amount`, label by `is_leading`, `Toast` on accept /
rejection. `auctions.css` ports `.auc-msg*` / `.auc-reg` / `.dz-trm*` / `.actions .act-primary.bid`
(source lines cited). 13 new tests (68 total); typecheck / lint / format / build clean. Verified
end-to-end in-browser against a seeded local backend (real collector + admin approval): terms gate →
register (`terms_accepted_at` stamped) → approve → place bid ("Your bid is leading" + "Your bid is
in." toast) → a below-your-max raise is rejected with the server's message in the sheet + toast.
Frontend PR `phase-8-auctions-bidding`; backend PR `phase-11.2-auctions-bidding`.

## 2026-09-10 — Phase 8 step 1: collector auctions browse (list / event / lot) + live WebSocket

Read-only browse; bidding/registration is step 2. New `src/features/auctions/`: `AuctionListController`
(extends the shared `ListController`), `LotSocket` (the `ws/auctions/lots/{id}/?token=` live socket —
backoff reconnect, one token-refresh-and-retry on close 4003, quiet REST-poll fallback past the retry
cap) and `LotController` (REST `Lot` snapshot + `LotSocket`; merges live frames, re-fetches on
reconnect/focus, recomputes `is_leading` from the frame's `leading_bidder_id`). API layer:
`AuctionService`, `resolveWsUrl()` + `VITE_API_WS_URL` (mirrors `resolveBaseUrl()` — throws if unset,
no hardcoded fallback), `schema.d.ts` regenerated against `darzmarket-api` `phase-11.1`. Screens
`/auctions`, `/auctions/:id`, `/auctions/lots/:lotId` ported from `app.html` (`auctionsList` /
`aucDetail` / lot view; CSS class names + source lines cited). "Auctions" link added to the catalogue
hero. 13 new tests (60 total), typecheck/lint/format/build clean. Verified in-browser against a
seeded local backend: a bid placed via the admin path pushed a live WS frame that updated the lot
page (current bid / bid count / "Your bid is leading") with no reload. Depends on backend
`phase-11.1-auctions-lot-browse` (merged): nested `artwork` + `is_leading` on the collector lot
serializer, `lots_count` on `Auction`, WS close-code 4003 for an expired token, `seed_auction`
command. Plan + step breakdown: `docs/PHASE_8_PLAN.md`. Frontend PR `phase-8-auctions-browse`.

## 2026-09-07 — Phase 14: Vercel deploy config (deploy itself blocked)

Owner opened Phase 14 ("deploy it") and chose a **UI-only deploy** — publish the interface for visual
review now, wire the real API later. Two files, no application code touched. `vercel.json`: static
hosting on Vercel (`framework: vite`, `outputDirectory: dist`) plus the rewrite that does the real
work — every route but `/` is client-side, so `/artwork/:id`, `/saved`, `/artists`, `/login` and
`/admin/requests` would 404 on a static host without a fallback to `index.html`. `.env.production`:
`VITE_API_BASE_URL=https://api.invalid/api`, a deliberate placeholder — `darzmarket-api` has no
deployed URL, and `resolveBaseUrl()` throws when the var is unset with `api` built at module load, so
unset is a blank page rather than a degraded one; `.invalid` is RFC 2606 reserved and can never
resolve, so calls fail fast instead of reaching an unintended host. This does not weaken the
no-hardcoded-fallbacks rule — the code still has no fallback and still throws. Verified against the
real production build with `.env.local` moved aside: placeholder baked into the bundle, no `localhost`
leaked in, `/` → 200 and `/saved` → 200, and the app boots and renders the gate rather than
white-screening. **The deploy did not run:** `create_git_project` returns `403 forbidden — "You don't
have permission to create the project"` on team `Darz Market Studio's projects`; retried with the
default name, same result. Not worked around by deploying into the existing `darzstudio-art` or
`koocheh-web` projects — that would overwrite unrelated live projects. PR #4 → `main`, PR #5 →
`development`.

## 2026-09-07 — Merged and published Phase 6 + Flow 1 to `development` and `main`

Owner call: merge and publish. PR #1 (Phase 6 saved/favorites) → `development` (`5f65f4b`), PR #2
(Flow 1 request/offer → admin inbox) → `development` (`8ded1fc`), PR #3 synced `main` (`5b7ac9c`).
Both branches then had identical trees. Full suite re-run on the merge result before each step:
typecheck clean, 47/47 tests across 6 files, `format:check` clean, build clean; `lint` clean apart
from the one pre-existing `useCatalogue.ts` exhaustive-deps warning. Nothing was committed — both
branches were already fully pushed, so this was merge and sync only. `main` could not be pushed
directly from this session, so the sync went through PR #3 rather than a direct push; the identical
local merge commit was discarded to keep one merge in history instead of two. Carried forward
unresolved, unchanged by the merge: the offer `detail` shape (G-F1-1, a reading of the API rather
than a documented contract — a wrong shape still returns 201) and the missing principal-aware guard
on `/admin/requests`.

## 2026-09-05 — Flow 1: collector request/offer → admin inbox

`src/features/requests/`: `RequestController` (OOP, extends the shared `Observable`) files the four
artwork-detail actions through `POST /api/crm/requests/` — Buy now→`purchase`, 24h hold→`hold`,
Request viewing→`viewing`, Make an offer→`offer`, plus `price` as the primary on a price-on-request
work. `ActionButtons` (`.act-primary` + `.act-row`/`.act-box`, ported from app.html:9236-9243 with
the v458 column rule), `OfferSheet` (the Make an Offer sheet incl. live thousands-grouping and both
validation messages verbatim), `ConfirmSheet` (`dzActConfirm`). The `dzGuard` double-tap guard is
ported and proven at the server: three synchronous taps → one POST. `src/features/admin/`:
`AdminRequestsPage` at `/admin/requests` over `AdminRequestsController extends ListController` —
kind/status filters and per-row transition, statuses from `GET /api/options/`. Old frontend attached
read-only as `ariandarz/darzstudio.art` @ main (c46d96d); nothing copied from it — not the inline
Supabase credentials, not the OTP gate, not the localStorage model. 12 new tests (47 total);
typecheck/test/lint/format/build green; flow verified end-to-end in a browser. Maps and gaps in
`docs/FRONTEND_PORT_MAP.md` and `docs/FLOW_1_API_GAPS.md`. **No API-contract or `schema.d.ts`
change.** Branch `claude/flow-1-requests-offers-admin`.

## 2026-09-04 — Phase 6: collector saved / favorites

`src/features/saved/`: `SavedController` (OOP) is the one **server-derived** source of truth for the
saved set — reads `GET /api/crm/saved/`, wraps `crm.save()`/`crm.unsave()`, refuses a second write
for an artwork while one is in flight, and holds nothing in `localStorage` (owner call: offline =
NO), so the state is still right after a refresh. `SaveButton` (icon on `ArtworkCard`, `.actions`
row on `ArtworkDetailPage`), `/saved` + `SavedItemsPage` reusing the catalogue's card/grid chrome,
and one `Toast` for every confirmation and failure. New shared `Observable` base — `ListController`
and `SavedController` extend it rather than duplicating snapshot/listener plumbing. 14 new tests
(31 total); typecheck/test/lint/format/build green; every screen screenshot-verified, including the
pending, error and after-refresh states. **No backend, API-contract or `schema.d.ts` change** — the
four gaps found (`is_saved`, `saved/` query params, created-vs-restored, ordering) are written up in
`docs/PHASE_6_API_GAPS.md`, and none of them blocked the flow. Flagged: `app.html` was unreachable
from this session, so the control reuses already-ported chrome instead of a fresh line-by-line diff.
Branch `claude/phase-6-saved-favorites-gy70nd`.

Follow-up (2026-09-05): the detail-page Save control lost its magenta in Black mode —
`html.dz-bw .btn.outline` (components.css:83-88, a faithful port of app.html:48) resets every
outline button's colour with `!important` and flattened the saved state with it. Fixed with a
feature-scoped `html.dz-bw .btn.dz-save-action.on` override rather than narrowing the ported
block. The card heart was never affected (it is not a `.btn`) — verified in both themes.

## 2026-09-04 — Phase 4b/c: artist pages + login-gate design fidelity

Artist list/detail (`ArtistListPage`/`ArtistDetailPage`) over the backend's `ArtistFilterSet` — no
backend change needed. New `src/features/shared/ListController` abstract base; `CatalogueController`
and `ArtistListController` both extend it instead of duplicating the pagination/stale-response state
machine. `.dz-page`/`.dz-state` promoted to `src/design/components.css` (shared across features).

Login gate rebuilt across three screenshot-compared passes into an exact copy of `app.html`'s
`#dzGate`: landing (wordmark/chroma/eyebrow/"Enter the Room"/beta caption) then "Private Access"
form in the existing `Sheet`, with every field the old modal has (First name, access key w/
show-hide eye + `.code` styling, "Request access"). `Input` gained `trailing`/`inputClassName`
props. New CLAUDE.md rule: verify every new screen against a real screenshot before calling it
done — the first two passes missed the logo/chroma, then missed fields/links, because that
never happened.

## 2026-09-04 — Phase 4: collector catalogue + artwork detail

`src/features/catalogue/`: `CatalogueController` (OOP, same shape as `AuthSession`) + `useCatalogue`
— query state, fetch, pagination, stale-response guard. `CataloguePage` (hero/toolbar/grid/pager),
`ArtworkCard`, `CatalogueToolbar` (debounced search + sort + currency-gated price sort),
`ArtworkDetailPage` (Template A port: hero/status/fields/price/about — no action buttons yet, those
need Phase 5/6). Added `react-router-dom`: `/login`, `/` (catalogue), `/artwork/:id`, `/_design`
(Phase 2 showcase moved off root); `RequireAuth` guard + a minimal collector `LoginPage` (the API's
default permission is `IsAuthenticated`). Found + fixed live: `Artwork.artist` is nullable
(`on_delete=SET_NULL`) though the generated type omits it. Verified end-to-end against real seeded
data. 6 new tests. Backend companion: `darzmarket-api` `phase-19.2-catalogue-query` (merged) added
`?search=`/`?ordering=` + `ArtistFilterSet` + `CollectorRequestFilterSet`. Branch
`phase-4-catalogue` (based on unmerged `phase-3-api-client`).

## 2026-09-04 — Phase 3: typed API client + auth

`src/api/`: OOP client (hard rule) — `HttpError` hierarchy → `HttpClient` (fetch + `{success,data}`
envelope unwrap) → `ApiClient` (auth header + one 401→refresh→retry). `AuthSession` holds the
access token in memory + the refresh token in `localStorage['dz-refresh']` (owner call);
`abstract ResourceService` → `Auth`/`Catalog`/`Crm`/`Recommendation`/`Options` services; `DarzApi`
facade + `api` singleton; `ApiProvider` + `useApi`/`useSession`. `schema.d.ts` generated from the
live backend. `VITE_API_BASE_URL` from `.env` only (no hardcoded fallback). `vitest` + 9 client
tests; verified live against the running backend. Backend half: `darzmarket-api` branch
`phase-19-auth-session` (token refresh / logout / me + `currency`/`price_type`/multi-tag +
`core.filters`). Gap analysis + decisions in `docs/API_GAP_ANALYSIS.md`. Branch `phase-3-api-client`.

## 2026-09-04 — Phase 2: design system

Ported the shipped collector app's tokens + base components to React/TS (owner call: match
`app.html` `:root` over the stale guideline — warm palette, Cormorant body). `src/design/`:
`tokens.css`/`tokens/` (verbatim, line-cited), `Theme` + `ThemeController` classes (OOP core,
Paper⇄Black, `dz-theme` persist). `src/components/`: Logo/Wordmark, Chroma, Eyebrow, Button, Input,
Textarea, Card, Pill, Avatar, Toast, Sheet. Prettier added; `src/App.tsx` is now the showcase.
See `docs/adr/0001-styling-and-oop.md`. Branch `phase-2-design-system`; build + typecheck + lint green.

## 2026-08-28 — Phase 1: project scaffold

Vite + React + TypeScript scaffold in a new, separate git repo (local only, no GitHub remote yet).
Design/planning groundwork: confirmed the design-reference approach (DarzStudio `main`, not copied
in), the API-client strategy (live OpenAPI fetch), and wrote the full cross-repo phase breakdown.
