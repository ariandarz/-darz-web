# Darz Market Web — Frontend Task List (source of progress truth)

**Last updated:** 2026-09-04 · **Current focus:** Phase 4 fully complete on branch
`phase-4-catalogue`, on top of `phase-3-api-client` (neither merged yet — merge Phase 3 first, then
Phase 4). Catalogue browse + artwork detail + **Artist list/detail (Phase 4b, no longer deferred)**
+ **the login gate rebuilt as an exact copy of `app.html`'s `#dzGate`** (was a freehand unbranded
form — see the "Reusing the design system" rule now in `CLAUDE.md`). Backend companion:
`darzmarket-api` branch `phase-19.2-catalogue-query` (merged) added `?search=`/`?ordering=` — no
further backend work was needed for 4b. Next up: **Phase 5** (still backend-blocked) or **Phase 6**
(saved/favorites — backend-ready).

**Client V1 API brief (2026-09-04) — build order & blockers.** The client shared a brief (their
`V1_FRONTEND_API_MAP.md`, PR #832 — we only have the rendered PDF, `~/Downloads/DarzV1FrontendAPIBrief.pdf`).
Its verified guidance, now folded into the phases below: **build Login → Artwork list → Save/unsave
first, then STOP** — those 3 collector flows are backend-ready today. **Do NOT jump to Requests /
Offers / Admin-queue (our Phase 5 / 7): they depend on backend work that doesn't exist yet** (backend
Phase 19 — reply-thread, offer-floor, idempotency key, legacy-id). Decisions locked with the owner
2026-09-04: **offline = NO** (online-only; the old app's offline/localStorage model was its main bug —
don't port `localStorage` as source of truth, nor the `saved`/`deleted` pair or `darz_save_edit`);
**reply channel = two-way thread, polling** (backend `RequestMessage`); **legacy-id resolution =
deferred** to when flow 2 is built; **curated set (`in_app`/`selected`) = still open** (backend
deferred its delivery, so the API can't reproduce today's catalogue yet).

> **Status legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked
> **How to use this file:** when you pick a task, set it `[~]` and update _Current focus_ above.
> When you finish it, set `[x]`, add a 3-line entry to `../CHANGELOG.md`, and move focus to the next.
> A blocked task is `[!]` with a one-line reason. This file + `CLAUDE.md` are how any new session
> resumes exactly where we stopped — keep it honest and current.

**Hard constraint (owner, 2026-08-28):** this is a **faithful port** of the old DarzStudio app's
already-approved design and behavior — not a redesign. Every UI/UX decision must trace back to
`../DarzStudio`'s `DARZ_DESIGN_GUIDELINE.md` + `docs/design/DESIGN_SYSTEM.md` (the approved spec)
**and** `app.html`/`darz-studio.html` (the real, already-shipped implementation) — both together,
never one without the other. Do not invent new patterns, copy, or structure. See `CLAUDE.md` for the
full explanation and exact file paths.

**Stack (decided):** React + TypeScript + Vite, component-based. API access via a typed client
generated from `darzmarket-api`'s OpenAPI schema (live-fetch from a locally-running backend — see
`CLAUDE.md`). Component/feature boundaries should mirror the old app's real structure
(`DarzStudio/docs/getting-started/PROJECT_STRUCTURE.md`), not an arbitrary React convention.

**Cross-repo note (updated 2026-09-04):** backend Phases 1-17 are now **ALL merged** to
`darzmarket-api`'s `development` (tip `4132f0a`; remote is `ariandarz/darz-backend-api`) — Saved,
Auctions, Gallery Portal, Memberships, Marketing Hub, AI Tagging, Document Builder and Accounting all
exist server-side now, so the phases below that were blocked on Phases 10-17 are **unblocked**. The
one remaining backend blocker is the **new Phase 19 (collector-loop hardening)** — reply-thread,
offer-floor, idempotency key, legacy-id — which our **Phase 5 (requests) now depends on** (see there).
Backend Phase 18 is deploy-only. Still: don't start a blocked phase's real UI work until its backend
phase lands, and build against the real API (generated from a locally-running backend), not a guessed
shape.

---

## Phase 1 — Project scaffold ✅

- [x] Vite + React + TypeScript scaffold (`npm create vite@latest -- --template react-ts`)
- [x] Separate git repo at `/Users/arya/Work/Projects/darzmarket-web`; GitHub remote now connected
      (`arex75/darz-web`) — same workflow as the backend: owner pushes/merges, never Claude

## Phase 2 — Design system ✅ (branch `phase-2-design-system`)

- [x] Read `DarzStudio/DARZ_DESIGN_GUIDELINE.md` + `docs/design/DESIGN_SYSTEM.md` fully — confirm
      which one is canonical/current vs. supplementary before treating either as final.
      **Conflict found:** the canonical guide says pure ink+paper / Barlow body; the shipped
      `app.html` `:root` ships a warm palette (`#FAF8F3` / `#ECE9E2` / `#1A1714`) + Cormorant
      body. **Owner decision 2026-09-04: match `app.html` exactly** — guide treated as stale.
- [x] Read `docs/design/VOICE_AND_COPY.md` + `DARZ_TRANSLATION_GLOSSARY.md` — copy/tone rules
      captured (calm advisor voice, no hype, factual confirmations); applied to component copy.
- [x] Seed design tokens (palette, type scale, spacing) — `src/design/tokens.css` ported verbatim
      from `app.html:15-28` + the `html.dz-bw` overrides (`:33-59`), each block line-cited.
      `src/design/tokens/index.ts` mirrors them typed (kept in lockstep).
- [x] Base component library — `src/components/`: Logo/Wordmark, Chroma, Eyebrow, Button
      (`.btn` primary/accent/outline/ghost/destructive + `.act-primary`), Input/Textarea, Card
      (+Image/Body, feature chroma bar), Pill, Avatar, Toast, Sheet. Same class names as
      `app.html` so the skin (`src/design/components.css`) diffs 1:1 against the original.
      OOP core: `Theme` (immutable value object) + `ThemeController` (Paper⇄Black, `dz-theme`
      persist, OS fallback, observers). Showcase page at `src/App.tsx`.
- [x] Prettier config (`.prettierrc.json` + `format`/`format:check` scripts; oxlint stays the
      linter), ADR-light conventions (`src/design/README.md`, `docs/adr/0001-styling-and-oop.md`).

## Phase 3 — Typed API client + auth ✅ (branch `phase-3-api-client`)

Backend gaps found during this phase → `docs/API_GAP_ANALYSIS.md`. Owner decisions (2026-09-04):
full auth flow + `currency`/`price_type`/multi-tag done backend-side now (`darzmarket-api` branch
`phase-19-auth-session`); catalogue `search`/`ordering` deferred to Phase 4; the "Refine" smart
filters, curated set, artist search and own-request filters are logged in the backend TASKLIST.

- [x] `src/api/schema.d.ts` — generated from the live `/api/schema/` (`npx openapi-typescript`).
      Regenerate whenever the backend API shape changes.
- [x] **OOP client** (`src/api/`, hard rule: inheritance + component boundaries):
      `HttpError` hierarchy → `HttpClient` (base: fetch, `{success,data,…}` envelope unwrap,
      query building) → `ApiClient extends HttpClient` (auth header + one 401→refresh→retry).
      `AuthSession extends HttpClient` — access token in memory, refresh token in
      `localStorage['dz-refresh']` (owner call), `login/refresh/logout/loadMe/resume`, observers.
      `abstract ResourceService` → `AuthService` / `CatalogService` / `CrmService` /
      `RecommendationService` / `OptionsService`. `DarzApi` facade + `api` singleton.
- [x] Auth for both principals: `AuthSession.loginTeam` / `loginCollector` (the `access_key`
      shape), `principal`-discriminated `/me`, silent `resume()` on app start, `refresh()`
      shared between concurrent 401s.
- [x] `GET /api/options/` via `OptionsService.all()` (cached) — the dropdown source of truth.
- [x] React seam: `ApiProvider` + `useApi()` / `useSession()` (same `useSyncExternalStore`
      pattern as `useTheme`). `App.tsx` has a live wiring panel (options fetch / login / logout).
- [x] `VITE_API_BASE_URL` from `.env` only — no hardcoded fallback (`resolveBaseUrl()` throws if
      unset). `.env.example` lists every var the app reads.
- [x] Tests: `vitest` added; `src/api/client.test.ts` (9) — envelope unwrap, error mapping,
      login/logout storage, 401→refresh→retry. Verified live against the running backend too.

## Phase 4 — Collector: catalogue ✅ (branch `phase-4-catalogue`, on `phase-3-api-client`)

Backend now serves search + sort too (`darzmarket-api` `phase-19.2-catalogue-query`) — "Curated for
You" and the "Refine" smart filters are still not backend-supported; not built (see
`docs/API_GAP_ANALYSIS.md`).

- [x] Catalogue browse — `CataloguePage` + `CatalogueController` (OOP: query state + fetch +
      pagination + stale-response guard, same `getSnapshot`/`subscribe` shape as `AuthSession`) +
      `useCatalogue()` hook. Matches `CustomPagination`'s real response shape.
- [x] Toolbar — free-text search (debounced) + sort (recent/year/artist/price) + a currency picker
      gated to price sorts, porting the old app's "pick a currency to sort by price" rule.
- [x] Filters wired: artist (via routing to `/artwork/:id`), availability_status (status badge),
      price range/medium/tag available on `CatalogueQuery` (not yet exposed as UI controls —
      the old app's "Refine" row needs the deferred smart-filter dimensions, see gap G7).
- [x] Artwork detail page — faithful port of `app.html`'s Template A (`.detail.dtpl-A`): hero,
      eyebrow/status, title, spec rows, one price moment, description. **No action buttons yet**
      (Make an offer/Save) — Phase 5 (backend-blocked) and Phase 6 add those.
- [x] Routing added (`react-router-dom`) — `/login`, `/` (catalogue), `/artwork/:id`, `/artists`,
      `/artists/:id`, `/_design` (the Phase 2 showcase, moved off root). `RequireAuth` guard — the
      API's default permission is `IsAuthenticated`, so a real login gate was in-scope here.
- [x] **Login gate — exact copy of `app.html`'s `#dzGate`**, corrected across three passes after
      screenshot comparison against the real app (see `CLAUDE.md` "Reusing the design system" +
      the new "verify against a screenshot" rule, written from this): a landing screen (plain
      "darzmarket.art" wordmark, `Chroma`, `Eyebrow` "The Iranian Art Market", one "Enter the Room"
      button, "Beta version" caption) opens the "Private Access" form in the existing `Sheet`
      component (not a second bespoke card) — with **every field/link the old modal has**: First
      name, the access-key field (show/hide eye toggle, `.code` masked styling — `Input` gained
      reusable `trailing`/`inputClassName` props for this), and a "Request access" link (shows a
      factual message, since there's no request-access endpoint to submit a real form to — never a
      dead link). **Flagged for the owner, not silently decided:** `firstName` is captured but not
      sent anywhere (`CollectorLoginSerializer` takes only `access_key`) — decide whether it's
      cosmetic-only or the backend should accept it to update `display_name` on login.
- [x] **Artist list/detail pages** (`ArtistListPage`, `ArtistDetailPage`) — search + sort
      (name/-name/works) over `ArtistFilterSet`; detail shows bio + the artist's available works
      (reuses the `?artist=` catalogue filter). No backend change was needed. New shared
      `ListController` abstract base (`src/features/shared/`) — `CatalogueController` and
      `ArtistListController` both extend it instead of duplicating the pagination/stale-response
      state machine; `useListController` is the one generic hook both pages use.
- [x] `.dz-page`/`.dz-state` promoted from `catalogue.css` to `src/design/components.css` — generic
      page-shell/status primitives now shared by every feature, not redefined per-feature.
- Bug found + fixed live: `Artwork.artist` is nullable at the DB level (`on_delete=SET_NULL`) even
      though the generated schema type omits `null` — `types.ts` corrects it; card/detail fall back
      to "Unknown artist". Verified end-to-end against real seeded data (1000+ artworks).
- Tests: `CatalogueController.test.ts` (6) — no-auto-fetch, query merge/page-reset, stale-response
      dropping, error surfacing, subscriber notification.

## Phase 5 — Collector: requests + activity `[!]` partially blocked on backend Phase 19 (darzmarket-api)

Matches backend V1's `crm` app (8 request kinds, per-kind `detail` shapes). **The client brief's
"stop after Save" line lands here: request _creation/listing_ works today, but the core loop
(reply thread + safe retry + enforced offer floor) needs backend Phase 19 first — don't ship offers
or the reply UI against the current API.**

- [ ] Request creation UI per kind: information/price/availability/hold/offer/viewing/purchase/message
      — each kind's `detail` shape is different, see `apps.crm.serializers.DETAIL_SERIALIZERS`
- [ ] Collector's own request list/detail (`GET/POST /api/crm/requests/`)
- [ ] Activity self-logging (`POST /api/crm/activity/`) — kind is now a closed set
      (`view`/`save`/`search`/`login`, see `ChoiceRegistry['crm.activity_kind']`)
- [ ] **Reply-thread chat UI** `[!]` blocked on backend Phase 19 — two-way `RequestMessage` thread,
      polling (~30-60s + on focus), unread badges; also the unified "Chat with Darz" surface. Faithful
      port of the old `request_thread` (v754+); do NOT build against the current `RequestEvent` (that's
      an internal admin status log, not a chat).
- [ ] **Send `client_req_id` on request/offer POST** `[!]` blocked on backend Phase 19 — idempotency
      key so a retry/double-tap doesn't duplicate; handle the already-landed (409/200) response.
- [ ] **Offer UI respects the enforced floor** `[!]` blocked on backend Phase 19 — surface the
      server's floor rejection; don't rely on client-side validation alone.

## Phase 6 — Collector: saved/favorites ✅ backend ready (Phase 10 merged)

This is flow 3 of the client brief's "build first" set — do it right after Login + Artwork list.

- [ ] Save/unsave button + saved-items list UI (backend `SavedArtwork` endpoints exist as of Phase 10)

## Phase 7 — Admin: catalog/crm/sales

Matches backend V1 exactly — the only admin surfaces that currently exist.

- [ ] Catalog CRUD (Artist/Artwork/ArtworkImage) — includes the multipart image upload flow
- [ ] Unified CRM request feed (filterable by kind/status/assignee) + transition actions
- [ ] Sales CRUD + transition/payment/delivery-status actions
- [ ] Respect the optimistic-lock pattern everywhere (`expected_version`, handle 409s in the UI)

## Phase 8 — Collector: auctions ✅ backend ready (Phase 11 merged, incl. real increment ladder)

Old app's largest single feature (event pages, live server-authoritative bidding, paddle
registration, outbid/won/lost/closing notifications, results archive). Backend Phase 11 is merged and
its real-time delivery mechanism is decided/built — confirm WebSocket-vs-polling against the shipped
backend before designing the live-bid UI (the frontend architecture depends on that choice). The real
increment ladder + 10-min closing window are now in place (backend PR #1).

- [ ] Event/lot pages, live bid display, place-bid UI (proxy/max), paddle registration flow
- [ ] Notification UI (outbid/won/lost/closing)
- [ ] Results archive view

## Phase 9 — Collector: profile, questionnaire, chat, settings/membership

- [ ] Profile view/edit (partially supported today via `Collector.preferences` JSON — confirm real
      field mapping against the old questionnaire before building)
- [ ] "Chat with Darz" — maps to `crm.Request(kind=message)` unless a distinct channel is decided
- [ ] Settings (language/currency/layout)
- [ ] Membership display/redemption (backend Phase 13 merged — ready)
- [ ] PWA install + push opt-in (backend Phase 13 merged — VAPID/web-push ready)

## Phase 10 — Gallery Update Portal (frontend) ✅ backend ready (Phase 12 A+B merged)

- [ ] No-login token+PIN portal: load state, submit updates, pricelist/Q&A
- [ ] Admin review/approve desk UI

## Phase 11 — Admin: Marketing Hub, AI Tagging, Document Builder, Accounting ✅ backend ready

(Phases 14-17 all merged)

- [ ] Marketing Hub UI (campaigns/analytics — content generator/asset-library scope TBD, see backend
      Phase 14's open owner-decision)
- [ ] AI Tagging & Recommendations admin desk (working queue, confirm-batch ledger, readiness toggle)
- [ ] Document Builder UI (generic document editor + PDF export)
- [ ] Accounting desk UI (4 ledger books + Private Deals) — real Django permission scope replaces
      the old passkey hack; don't rebuild the passkey pattern in the frontend

## Phases 12+ — Parity-gap surfaces (match backend Phases 20-26) `[!]` each blocked on its backend phase

Old-app surfaces the current backend has no model for (from `DarzStudio/docs/engineering/BACKEND_API_REPO_STATUS.md`;
owner decision 2026-09-04: scope all seven now). Faithful-port rule applies — read the old app's real
surface before building each. Ordered by V1 relevance:

- [ ] **Curated-set catalogue (`in_app`)** `[!]` backend Phase 24 — the collector list must show the
      curated `in_app` set, not a raw published feed; consume the catalogue change-stamp/head-check.
      **This unblocks the "Partial" half of frontend Phase 4 (flow 2).**
- [ ] **Collector questionnaire** `[!]` backend Phase 25 — capture + display; feeds recommendations
      (ties into Phase 9 profile). Don't build until the backend stores answers.
- [ ] **Logistics & Payment desk** `[!]` backend Phase 20 (`DARZ_LOGI_SCHEMA`, large surface)
- [ ] **Library + pricelist builders** `[!]` backend Phase 21 (two builders; `savedItems`)
- [ ] **Insights & Stories** `[!]` backend Phase 22 (`storiesView`)
- [ ] **Projects / Data Health / Import desks** `[!]` backend Phase 23 (admin tooling)
- [ ] **i18n + white-label (BlueArt)** `[!]` backend Phase 26 (lowest priority)

## Phase 13 — Testing

- [ ] Component tests for shared/base components
- [ ] E2E on critical flows (login, browse→detail→request, admin CRUD, optimistic-lock conflict)

## Phase 14 — Deploy & cutover — later, owner-gated

- [ ] Build/hosting decision (static hosting vs. SSR — likely static given no server-rendering need)
- [ ] Environment config (API base URL per environment)
- [ ] DNS/hosting cutover plan, coordinated with `darzmarket-api`'s own Phase 18
