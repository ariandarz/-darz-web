# Darz Market Web — Frontend Task List (source of progress truth)

**Last updated:** 2026-09-17 (design pass landed; `main` and `development` level) ·
**Current focus:** **closing the v0.1 loop after the design pass** — see "What next" just below.
The Market App design pass (PR #15, branch `claude/darz-web-frontend-redesign-f686ie`) was merged to
`development` on 2026-09-17 on the owner's instruction ("land the design pass") and `main` was brought
level the same day, the way the v0.1 release was (the PR #17 / #18 pattern). Its merge commit's tree is
the gated PR head: typecheck clean · lint 3 pre-existing warnings · 98/98 tests · format · build. Two
entry points `development` had are unlinked in the merged result — an **owner decision**, recorded
under "Design pass" below. **Open PRs: none.** Merged remote branches, safe to delete (not deleted):
`claude/darz-market-v0-1-hpy1xy`, `claude/darz-web-frontend-redesign-f686ie`,
`claude/flow-1-requests-offers-admin`, `claude/phase-6-saved-favorites-gy70nd`,
`phase-19-crm-saved-wire`, `phase-19-format-fixes`, `phase-8-auctions-browse`,
`phase-8-auctions-bidding`, `phase-8-auctions-notifications`, `phase-8-auctions-records`.

**Backend cross-check (2026-09-17, from `darzmarket-api`):** Phases 27-32 (the full old-panel admin
audit — Collectors, Collector Activity, Dashboard, Memberships, Team, App Design) and Phase 23
(Projects/Data Health/Import) all merged — see the new **Phase 11b** section below, none of it has
frontend UI yet. Also corrected two stale `[!]` blockers this pass: backend Phases 24 (curated-set
catalogue) and 25 (questionnaire) were already merged when this file last said blocked — both are
real, buildable now.

**What next (2026-09-17, recommended order):**

1. Owner decision on the two unlinked entry points (artist index `/artists`, `/auctions/notifications`)
   — see "Design pass" below; then one small PR either way.
2. Unblock the deploy (Phase 14): a project-creating Vercel role, or a hand-created empty project
   linked to the repo; then the real API + WS URLs in `.env.production` once `darzmarket-api` Phase 18
   exists. Until then the deployed build is visual-only.
3. Close the v0.1 loop end to end: a team sign-in screen so admins can reply from `/admin/requests`
   (`docs/V0_1_SCOPE.md` flag 8), Phase 13 E2E over Login → Browse → Save → Send Inquiry → Chat, and
   backend G-F1-1 (the typed per-kind `detail`).
4. Backend-ready collector items v0.1 hid: membership redeem (Phase 9), push opt-in once the API
   publishes the VAPID key, the "Refine" filter panel (backend ready since Phase 19).
5. Post-v0.1 by readiness: switch on auctions when wanted (built, Phase 8), Phase 7 catalog CRUD +
   sales, Phase 10 gallery portal, Phase 11 admin desks, FE-R1…FE-R4 records desk.
6. Phases 12+ wait for their backend phases; the curated `in_app` set (backend Phase 24) goes first.

Previously (2026-09-11, branch `claude/darz-market-v0-1-hpy1xy`, merged 2026-09-12 — PR #16 to
`development`, PR #17 to `main`, PR #18 back):
**Current focus:** **v0.1 — the launch scope** (`docs/V0_1_SCOPE.md`): Market → Records → Chat →
Profile → Settings, one contact CTA (Send Inquiry), everything else preserved behind
`src/features/shell/features.ts`. Branch `claude/darz-market-v0-1-hpy1xy`. Phase 9's Profile / Chat /
Settings and Phase 5's reply thread + idempotency key shipped inside it (backend Phase 19.3 landed).

Previously (2026-09-11, branch `phase-19-crm-saved-wire`, merged into this branch):
**Current focus:** **API integration wiring (branch `phase-19-crm-saved-wire`).** Four backend
`darzmarket-api` PRs merged 2026-09-11 (Phase 19 collector-loop hardening, Saved/Favorites
hardening, Auctions Records widening + "Refine" filters, catalogue change-stamp + legacy-id lookup)
— `docs/API_INTEGRATION_GAPS.md` is the live map of what's now available and where this frontend
uses it. This round wired the already-built consumers: `SavedController`/`SaveButton`/
`SavedItemsPage` around `is_saved`/`created` (Phase 6), `ActionButtons`/`RequestController` around
`allowed_actions`/`client_req_id`/the offer-floor message (Phase 5), `AdminRequestsPage` around
nested collector/artwork + live status vocabulary + `allowed_transitions` (Phase 7). Still open,
each its own follow-up PR: the request-detail/"Chat with Darz" thread UI, the admin Records desk
(FE-R1…FE-R4), and the "Refine" filter panel UI (frontend Phase 12+, backend now ready). Plan:
`docs/PHASE_8_PLAN.md` (Phase 8 auctions itself is done — see below). Owner call
2026-09-07: merge and publish. PR #1 (Phase 6 saved/favorites) and PR #2 (Flow 1 request/offer →
admin inbox) both merged to `development`; PR #3 synced `main`; PR #4 landed the Phase 14 deploy
config; PR #5 brought `development` back level; PR #6 + #7 were docs-only (recorded the merges +
deploy state in this file, `CLAUDE.md`, `CHANGELOG.md`). `main` (`76bc65d`) and `development`
(`602f547`) now have **identical trees**. **No open PRs** (GitHub API, 2026-09-07). Two stale
remote branches remain — `origin/claude/flow-1-requests-offers-admin` and
`origin/claude/phase-6-saved-favorites-gy70nd` — their work is fully merged; safe to delete.
Nothing is in flight on a feature branch.

**The one thing not done: the deploy itself is blocked.** Owner chose a UI-only deploy
(2026-09-07), the config is committed and the production build is verified, but creating the Vercel
project fails with `403 forbidden — "You don't have permission to create the project"` on team
`Darz Market Studio's projects`. Needs a Vercel role that can create projects, or an empty project
created by hand to deploy into. See Phase 14.

Delivered so far: Phases 2/3/4 (design system, typed API client + auth, catalogue browse + artwork
detail + artist list/detail + the exact `#dzGate` login gate), **Phase 6** (saved/favorites), **Phase
5's request-creation half**, and **Phase 7's CRM feed**. Phase 6 was flow 3 of the client brief's
"build first" set (Login → Artwork list → Save/unsave) — that set is **done**, which is where the
brief says to stop. The old frontend is a read-only reference (`ariandarz/darzstudio.art` @ `main`
`c46d96d`, cloned outside this repo); the old→new screen/API map is `docs/FRONTEND_PORT_MAP.md`, and
API gaps are in `docs/PHASE_6_API_GAPS.md` and `docs/FLOW_1_API_GAPS.md` (**no backend/schema change
made** in any of it). Next up: **Phase 7's remaining admin surfaces** or **Phase 8** (auctions) —
both backend-ready; **Phase 5 stays backend-blocked** on backend Phase 19.

**Open for the owner (Phase 6):** (a) `../DarzStudio/app.html` was NOT reachable from the session
that built Phase 6, so the save control's glyph/placement/microcopy reuse the already-ported card
and button chrome rather than a fresh line-by-line diff against the original — a fidelity pass is
worth doing when that repo is to hand; (b) pre-existing, not introduced here: `src/design/base.css`
sets `a { color: inherit }` but no `text-decoration`, so every link in the app (catalogue card text,
the "Artists"/"Saved" pills) renders underlined — flagged rather than changed, since it is a
cross-cutting visual decision.

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
      (`ariandarz/-darz-web`) — task branch → PR is still the workflow. The original "owner
      pushes/merges, never Claude" rule was relaxed on 2026-09-07: the owner asked Claude to merge
      and publish, and PRs #1-#5 were merged by Claude on that instruction. Merging remains an
      explicit per-request ask, not a standing permission; default is still open the PR and stop.

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

## Design pass — Market App design package ✅ landed 2026-09-17 (PR #15)

Re-skinned every collector screen to the `darzstudio.art` `design/market-app/` handoff package
(PR #846, build 1229) — the design source of truth since 2026-09-11 (`CLAUDE.md` reference 0). Built
2026-09-11, merged onto v0.1 2026-09-12, landed on `development` + `main` 2026-09-17.

- [x] Tokens ported verbatim (`src/design/tokens.css`), charcoal as the collector default; the shell
      (`features/shell`: 430px frame, glass header + Leave the Room, chroma, nav pips, desktop top
      nav); shared `Dropdown` (`dzSel`) + `Segment` (`.viewseg`); catalogue (view segment, dropdowns
      wired to `ordering` / `currency`, single view, desktop grid), artwork detail (prev / next within
      the browse set, View in Room, Share, About the artist, asking-price block, delivery note, more
      by this artist), artist page (`dzUniCard` tiles, enquiry request), auctions + lot pages, the
      `#dzGate` login. Screenshot-compared at 390×844 and 1440×900 in both skins. Entry:
      `docs/CHANGELOG.md` 2026-09-11.
- [x] Merge policy when v0.1 (PR #16) landed underneath it: **v0.1 owns behaviour** (routes, feature
      flags, the nav set Market · Records · Chat · Profile · Settings, the Chat / Records / Profile /
      Settings screens, `LayoutController`, Send Inquiry); **the design pass owns the skin** (tokens,
      shell chrome, catalogue / detail / artist / auctions / lot / gate styling, Dropdown / Segment).
      Surfaces not ported (no backend) are listed in `docs/API_INTEGRATION_GAPS.md` § Design-pass flags.
- [ ] **Owner decision — two entry points `development` had that the merged result lacks** (the
      routes exist; nothing links to them): (1) the **artist index** `/artists` — the catalogue hero's
      Saved / Auctions / Artists pills were dropped per the package, and no screen links to the index
      now (deep-link only, and it is live in v0.1; Saved is reachable from Profile, Auctions has its
      nav tab when on); (2) **`/auctions/notifications`** — its link lived in the design pass's
      Profile → Auctions tab, which the merge replaced with v0.1's Profile (matters only with
      `VITE_FEATURE_SET=full`). Options: restore the pills, add an Artists entry where the package
      places one, or accept deep-link only. Not changed without a decision (faithful-port rule).

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

## Phase 5 — Collector: requests + activity `[~]` step 1 of 4 done 2026-09-17 (`docs/PHASE_5_PLAN.md`): every kind files; the list, the detail and activity logging follow

Matches backend V1's `crm` app (8 request kinds, per-kind `detail` shapes). Backend Phase 19
(`darzmarket-api`) shipped the core-loop backend work (reply thread API, offer floor enforcement,
idempotency, per-artwork `allowed_actions`) 2026-09-11 — see `docs/API_INTEGRATION_GAPS.md` for
what's wired vs. still open. The reply-thread / "Chat with Darz" UI shipped in v0.1 (2026-09-11,
see Phase 9) — nothing in this phase is backend-blocked any more except the typed `detail` (G-F1-1).

- [x] Request creation UI per kind — **Phase 5 step 1, 2026-09-17** (`docs/PHASE_5_PLAN.md`):
      `purchase` (Buy now), `hold` (**48h hold** — the API's TTL, owner decision D2), `viewing`
      (**`ViewingSheet`**: preferred time + In person / Virtual, the two fields
      `ViewingDetailSerializer` requires — the bare POST v0.1 sent was rejected 400), `offer` (Make
      an Offer sheet, now staying open on a floor rejection so the message is seen), `price`
      (**`PriceSheet`** — the old Request Price & Availability sheet, `app.html:11046-11064`, minus
      the identity fields the backend snapshots itself, D6) as the primary on a price-hidden work,
      and the artist page's enquiry through `RequestController` (idempotent key, "Enquiry
      received"). `detail` is typed per kind **by hand** from `apps/crm/serializers.py`
      (`docs/PHASE_5_API_GAPS.md` G-P5-1); `availability` has no old-app surface (G-P5-7);
      `message` is the general Chat. Actions still filter by `artwork.allowed_actions` (G-F1-3).
- [x] Collector's own request list/detail — v0.1 (2026-09-11): Profile › Market lists the collector's
      requests with filter chips over `GET /api/crm/requests/`, Overview › Recent activity shows the
      latest, and each inquiry opens as its thread at `/chat/:id`. No separate detail page is planned.
- [ ] Activity self-logging (`POST /api/crm/activity/`) — kind is now a closed set
      (`view`/`save`/`search`/`login`, see `ChoiceRegistry['crm.activity_kind']`)
- [x] **Reply-thread chat UI** — shipped in v0.1 (2026-09-11) over backend Phase 19.3
      (`GET/POST /api/crm/requests/{id}/messages/` + `mark-seen`): `ThreadController`, `ThreadPage`,
      polling + on focus, unread from `unread_count`. See Phase 9.
- [x] **Send `client_req_id` on request/offer POST** — shipped in v0.1: `RequestController` mints one
      key per action, re-sends it on a retry, drops it on success; `CrmService.createRequest` returns
      `{row, replayed}` (201 vs 200) via `ApiClient.sendEnveloped`.
- [x] **Send Inquiry** (v0.1's one contact CTA) — `InquiryAction` + `InquirySheet`; `information`
      kind with the message in `detail`; duplicate guard shows the open inquiry instead of a second Send.
- [x] **Offer UI respects the enforced floor** — done 2026-09-11. No code change needed:
      `OfferSheet.tsx`'s existing inline error slot already renders whatever the server's
      `offer_below_floor` rejection message says. See `docs/API_INTEGRATION_GAPS.md` G-F1-2.

## Phase 6 — Collector: saved/favorites ✅ merged 2026-09-07 (PR #1, then #3 to `main`)

Flow 3 of the client brief's "build first" set — built right after Login + Artwork list, and the
point the brief says to stop. Frontend only: **no backend, API-contract or `schema.d.ts` change.**

- [x] `SavedController` (OOP) — the single **server-derived** source of truth for "is this saved",
      wrapping `api.crm.save()` / `unsave()`. **No `localStorage`** (owner decision 2026-09-04:
      offline = NO; the old app's `saved`/`deleted`/`darz_save_edit` local model was its main bug
      class and is deliberately not ported). **Rewritten 2026-09-11** (`docs/API_INTEGRATION_GAPS.md`
      G-P6-1): now reads `artwork.is_saved` directly (computed server-side in the same request that
      fetches the artwork) instead of walking every page of `GET /api/crm/saved/` into memory —
      `isSaved(artwork)` layers a small local override map (this tab's own writes) on top of that.
- [x] Per-artwork in-flight guard — `SavedController` refuses a second save/unsave for an id while
      one is running, and `SaveButton` is `disabled` + `aria-busy` meanwhile, so neither a
      double-tap nor a key-repeat can fire two writes. Different artworks stay independent.
- [x] `SaveButton` — one control, two variants: the icon overlay on `ArtworkCard` (a sibling inside
      `.card-wrap`, since a `<button>` inside the card's `<a>` is invalid HTML) and the
      `.actions` row on `ArtworkDetailPage`. Kept `.btn.outline` in both states so it does not
      impersonate the detail page's primary CTA — that slot is Phase 5's "Make an offer". Now takes
      the full `artwork` prop (was just an id) so it has `is_saved` to read.
- [x] `/saved` route + `SavedItemsPage` — same `.hero`/`.count`/`.grid`/`ArtworkCard` chrome as the
      catalogue (no second card design). **Rewritten 2026-09-11 as a real paginated list**
      (`SavedListController`, the same `ListController` seam the catalogue/admin feed use) instead
      of a one-off full-list read — see G-P6-2. Empty state, load error + "Try again", "Saved" link
      in the catalogue hero, and a `Pager`.
- [x] Loading / success / error states: `dz-state` while the page loads, the pending control while a
      write is in flight, and one `Toast` ("Saved." / "Already saved." / "Removed from your saved
      works." / the failure message) as the single confirmation surface everywhere — the "Already
      saved." variant is new, from the `created` flag (G-P6-3).
- [x] New shared `Observable` base (`src/features/shared/Observable.ts`) — `ListController` and
      `SavedController` both extend it instead of each re-implementing snapshot/listener plumbing.
- [x] `SavedController.test.ts` rewritten 2026-09-11 for the override-map design (12 tests): the
      override layered on `artwork.is_saved`, the duplicate-action guard, unsave incl. the
      idempotent 404, `created`-aware messaging, error surfacing, reset.
- [x] Every gap in `docs/PHASE_6_API_GAPS.md` (G-P6-1…G-P6-4) closed 2026-09-11, backend and
      frontend both — see `docs/API_INTEGRATION_GAPS.md` for the detail. Nothing was ever blocked by
      them; this closed the "extra full read" cost the original doc flagged.

## Phase 7 — Admin: catalog/crm/sales

Matches backend V1 exactly — the only admin surfaces that currently exist.

- [ ] Catalog CRUD (Artist/Artwork/ArtworkImage) — includes the multipart image upload flow
- [x] Unified CRM request feed (filterable by kind/status/assignee/archived) + transition actions —
      `AdminRequestsPage` at `/admin/requests` over `AdminRequestsController extends ListController`.
      Chrome ported from `darz-studio.html`'s `.ad-h`/`.ad-toolbar`/`.ad-card`/`.ad-tbl`. Statuses
      come from `GET /api/options/`'s `crm.request_status_by_kind`, never a hardcoded lookup — the
      filter dropdown scopes to the selected kind, and each row's "Move to…" uses that row's own
      `allowed_transitions` so it can never offer an illegal status. **Now shows a real collector
      name and artist — title** (`RequestAdmin.collector`/`.artwork` are nested objects, not bare
      uuids — gap G-F1-7 closed 2026-09-11) plus an unread-reply badge and an archived chip.
      No principal-aware route guard yet — `RequireAuth` only proves a session exists, and the API's
      own admin permission is the real gate.
- [ ] Sales CRUD + transition/payment/delivery-status actions
- [ ] Respect the optimistic-lock pattern everywhere (`expected_version`, handle 409s in the UI)

## Phase 8 — Collector: auctions ✅ all 4 steps merged (hidden in v0.1 behind `features.auctions`) — see `docs/PHASE_8_PLAN.md`

Old app's largest single feature (event pages, live server-authoritative bidding, paddle
registration, outbid/won/lost/closing notifications, results archive). Backend Phase 11 is merged;
real-time delivery is **WebSocket via Django Channels** (`ws/auctions/lots/{id}/?token=<jwt>`,
read-only — bids go over REST). Owner slicing (2026-09-10): Option A (browse → bid → notifications →
records), transport Option A (WS + a lean REST resync). All backend gaps BE-1…BE-9 in scope; each
step ships a `darzmarket-api` branch **and** a `darzmarket-web` branch, owner merges both, then the
next step. Full step breakdown + the deferred admin Records-desk gaps: `docs/PHASE_8_PLAN.md`.

- [x] **Step 1 — browse (read-only)** — **merged both sides.** Backend `phase-11.1-auctions-lot-browse`
      (BE-1 nested artwork, BE-2 `is_leading`, BE-3 `lots_count`, BE-8 WS 4003 close code, BE-9
      `seed_auction`). Frontend `phase-8-auctions-browse`: `/auctions`, `/auctions/:id`,
      `/auctions/lots/:lotId` — `AuctionListController`, `LotSocket` + `LotController` (live frame
      merge, reconnect/focus refetch, ~8s poll fallback). Verified: a bid via the admin path pushed a
      live WS frame that updated the lot page with no reload.
- [x] **Step 2 — register + bid** — **merged both sides.** Backend
      `phase-11.2-auctions-bidding` (BE-4 `Auction.terms`/`terms_required` +
      `BidderRegistration.terms_accepted_at` + `agree_terms`; BE-5 `opening_amount`/`min_next_amount`
      on the lot). Frontend `phase-8-auctions-bidding`: `RegistrationController`, `ConditionsSheet`
      (ported `DARZ_AUC_TERMS`), `RegistrationBand` (CTA / pending / approved / rejected),
      `LotController.placeBid` (in-flight guard, merges the returned lot, surfaces server rejections
      verbatim), `BidSheet` (grouped max field, `min_next_amount` prefill, `Toast`). Verified:
      terms gate → register (`terms_accepted_at` stamped) → admin approve → place bid ("Your bid is
      leading" + toast) → a below-your-max raise rejected with the server's message.
- [x] **Step 3 — notifications + status vocabulary** — **merged both sides.** Backend
      `phase-11.3-auctions-notifications` (BE-7: `lot_artwork_title`/`lot_number` on the collector
      notification serializer + `payload`-shape docs). Frontend `phase-8-auctions-notifications`:
      `AuctionNotificationsController` (boot + ~45s poll + on-focus, optimistic markRead/markAllRead),
      `AuctionNotificationsProvider` (one on context inside `RequireAuth`, renders the banner),
      `AuctionBanner` (ported `.dz-anotif`), `/auctions/notifications` page, `status.ts` (the one
      `lotPills`/`notificationPill`/`notificationLine` vocabulary) wired into the lot rows + lot
      detail. "Notifications (N)" link in the auctions hero. Verified: banner shows the newest unread,
      the feed lists with pills + "Lot N", marking one read propagates everywhere.
- [x] **Step 4 — results archive** — frontend merged 2026-09-10 (PR #12); the backend endpoint is
      merged too (the v0.1 Records tab reads it — `docs/V0_1_SCOPE.md` § 2). In v0.1 the Phase 8
      `/records` page was superseded by `features/records` (`RecordsArchiveController`); the design
      pass's own Records page was dropped in the PR #15 merge. Backend
      `phase-11.4-auctions-records` (BE-6: collector `GET /api/auctions/records/` + `/{id}/` with
      `?search=` / `?ordering=` / `?artist=`, and a computed `artist_display_name`). Frontend
      `phase-8-auctions-records`: `RecordsController extends ListController` (debounced search + sort),
      `/records` + `/records/:id` ported from `recordsView()` (`.rec2-*` chrome), "Records" link in
      the auctions hero (the old `showRecordsTab` flag is gone). 4 new tests (84 total). Verified:
      list renders `artist_display_name` (FK + raw fallback), newest-first, debounced server-side
      search, detail with all fields + source link. **Field-parity gap logged in
      `docs/PHASE_8_API_GAPS.md` (G-P8-1); the admin Records desk is deferred to Phase 11**
      (`docs/PHASE_8_PLAN.md` § Deferred).

## Phase 9 — Collector: profile, questionnaire, chat, settings/membership `[~]` v0.1 (2026-09-11)

- [x] Profile — `/profile` (`ProfilePage`, port of `profileView` :9802): Overview · Market · Account
      anchors (Auctions behind `features.profileAuctions`); saved works, requests & activity with
      filter chips, account details. **Read-only**: no profile-update / password endpoint exists.
- [x] "Chat with Darz" — `/chat` + `/chat/:id` (`ChatPage`, `ThreadPage`): the general conversation
      is one `Request(kind=message)` created with a stable `client_req_id`; artwork inquiries are
      `Request(kind=information)` threads. `ConversationsController` (boot + 45s poll + focus) and
      `ThreadController` (30s poll, mark-seen). AI chat stays off (`features.aiChat`).
- [x] Settings — `/settings` (`SettingsPage`, port of `settingsView` :9827): profile row, Appearance
      (Paper/Black), account links, legal, about, Leave the Room. Notifications / membership / PWA
      rows behind flags.
- [ ] Questionnaire — **unblocked 2026-09-17**: backend Phase 25 merged
      (`GET/POST /api/recommendations/questionnaire/`); the `[!]` blocker in the Phases 12+ section
      below is stale. Still hidden behind `features.questionnaire` pending this UI.
- [ ] Membership display/redemption (backend Phase 13 merged — ready)
- [ ] PWA install + push opt-in `[!]` VAPID public key is still not published by the API (checked
      2026-09-17 — `apps.notifications` has no `GET` for it); push delivery itself is ready
      (Phase 13), but the frontend can't complete the browser subscribe handshake without the key.

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

## Phase 11b — Admin: Owner Panel (Collectors, Memberships, Team, Dashboard, App Design, Activity, Projects, Data Health, Import) ✅ backend ready 2026-09-17

New since the last `TASKLIST.md` pass — the client asked to prioritize finishing "the panel" (the old
`darz-studio.html` admin app). Backend audited every old panel tab against existing `admin/*` routes
(`darzmarket-api` `docs/TASKLIST.md` Phases 27-32 + 23) and built every gap found; **none of it has
any frontend UI yet.** No API gaps were recorded for these — each is a plain admin CRUD/read desk,
faithfully scoped, real HTTP-verified. Old-panel tab names in parens for continuity with the design
package/faithful-port research.

- [ ] **Collectors desk** (old panel "Collectors" tab) — list/search/filter (tier, access_status) +
      create/edit/soft-delete + issue/revoke access keys (plaintext key shown once on issue, never
      re-fetchable — the UI must warn "copy this now").
      `GET/POST /api/auth/admin/collectors/`, `GET/PATCH/DELETE .../{id}/`,
      `GET/POST .../{id}/access-keys/`, `POST /api/auth/admin/access-keys/{id}/revoke/`.
- [ ] **Collector Activity feed** (old panel "Collector Activity" tab) — read-only, filter by
      collector/kind/artwork. `GET /api/crm/admin/activity/`.
- [ ] **Dashboard** (old panel "Dashboard" tab, scoped to V1 essentials — see the backend doc for
      what didn't port: perf/analytics charts, cloud-sync banners) — requests-needing-attention per
      kind, today's activity, collector/catalogue/auction totals, pending exhibition reviews.
      `GET /api/dashboard/admin/summary/`.
- [ ] **Memberships desk** (old panel "Memberships" tab, owner-only) — issue (auto-generates a
      `DZ-<plan>-<6 chars>` code or accepts a custom one)/list/edit/renew (+1 month)/remove. Records
      a WhatsApp contact + private notes for manual outreach — **no payment processing anywhere**,
      same as the old desk's own on-screen copy. `GET/POST /api/auth/admin/membership-codes/`,
      `GET/PATCH/DELETE .../{id}/`, `POST .../{id}/renew/`.
- [ ] **Team logins desk** (old panel "👥 Team logins", owner-only) — issue (generates a password
      shown once)/list/edit (name/email/role/is_active)/remove. Cannot deactivate/remove your own
      account (the API 400s it — surface that as a disabled control, not just an error toast).
      `GET/POST /api/auth/admin/team-users/`, `GET/PATCH/DELETE .../{id}/`.
- [ ] **App Design** (old panel "App Design" tab) — publish the live theme (freeform JSON — colors,
      layout, dark mode, stats strip, social links, per-page buttons; no fixed schema, the frontend
      defines what keys it reads), reset to factory defaults, save/list/activate/delete named
      version checkpoints. The **public** read (`GET /api/app-theme/`, `AllowAny`) is what the
      Market App itself should read for its live design — **this closes several "no theme/settings
      endpoint" gaps already recorded in `docs/API_INTEGRATION_GAPS.md`'s "Still open" section**:
      the WhatsApp chat number, hero copy, About text, social links, `shipNote`, and Terms/Privacy
      text can all now live under `theme.*` keys instead of being hardcoded. Update that doc's
      "Still open" bullet once this lands.
      `GET/PUT /api/admin/app-theme/`, `POST .../reset/`, `GET/POST .../versions/`,
      `POST .../versions/{id}/activate/`, `DELETE .../versions/{id}/`.
- [ ] **Projects desk** (old panel "Projects" — Dashboard/List/Pipeline/Packages/Proposal/Calculator/
      Partners/Reports sub-tabs) — full pipeline CRUD: create/edit/archive a project, drag/move
      through 17 stages (auto-derives the status label — don't compute it client-side), partner
      orgs, service catalog, package templates, checklist templates, file attachments, the
      dashboard priority-queue tiles, the deliverables-roll-up report. **Not built on the backend**
      (flagged, not silently dropped): the Proposal Builder's document composition — defer that
      sub-tab until it's scoped (would reuse `documents.Document` like the gallery portal's
      exhibition proposals). Endpoints under `/api/projects/admin/` — see `darzmarket-api`
      `docs/TASKLIST.md` Phase 23 for the full list (projects/partners/service-catalog/packages/
      checklists, each list+detail; projects also get `/stage/`, `/dashboard/`, `/reports/`,
      `/attachments/`).
- [ ] **Data Health** (old panel "Data Health" tab, scoped down — see the backend doc: most of the
      old desk's checks diagnosed the old app's own client-sync architecture, which doesn't exist
      here) — three real checks: duplicate images, incomplete records, published-but-hidden works.
      `GET /api/catalog/admin/data-health/`.
- [ ] **Import desk** (old panel "Import" tab) — CSV/PDF/paste/image parsing **stays frontend**
      (client-side, e.g. a CSV-column-mapper and pdf.js page extraction, same as the old app); the
      backend only stages the parsed rows for review/edit and confirms them into real artworks
      (reusing the existing artwork-create validation — a row that fails is flagged with its error,
      never silently dropped, and doesn't block the rest of the batch).
      `GET/POST /api/catalog/admin/import/batches/`, `GET .../{id}/`, `POST .../{id}/confirm/`,
      `POST .../{id}/discard/`, `PATCH .../{batch_id}/rows/{id}/`, `POST .../rows/{id}/reject/`.

## Phases 12+ — Parity-gap surfaces (match backend Phases 20-26) `[!]` each blocked on its backend phase

Old-app surfaces the current backend has no model for (from `DarzStudio/docs/engineering/BACKEND_API_REPO_STATUS.md`;
owner decision 2026-09-04: scope all seven now). Faithful-port rule applies — read the old app's real
surface before building each. Ordered by V1 relevance:

- [ ] **Curated-set catalogue (`selected`/`private_selection`)** — **unblocked 2026-09-17**: backend
      Phase 24 merged (`GET /api/catalog/artworks/selections/`, grant-gated, admin
      `admin/artworks/{id}/selection-grants/`). Old `[!]` blocker on this line is stale.
      **This unblocks the "Partial" half of frontend Phase 4 (flow 2).**
- [ ] **Collector questionnaire** — **unblocked 2026-09-17**: backend Phase 25 merged (same endpoint
      as Phase 9's Questionnaire item above — build once, wire both).
- [ ] **Logistics & Payment desk** `[!]` backend Phase 20 (`DARZ_LOGI_SCHEMA`, large surface) — still
      not built.
- [ ] **Library + pricelist builders** `[!]` backend Phase 21 (two builders; `savedItems`) — still
      not built.
- [ ] **Insights & Stories** `[!]` backend Phase 22 (`storiesView`) — still not built.
- [ ] **Projects / Data Health / Import desks** — **unblocked 2026-09-17**: backend Phase 23 merged,
      full faithful port. See the new "Phase 11b" section below for the real endpoint list — this
      bullet stays only as the Phases-12+ cross-reference.
- [ ] **i18n + white-label (BlueArt)** `[!]` backend Phase 26 (lowest priority) — still not built.

## Phase 13 — Testing

- [ ] Component tests for shared/base components
- [ ] E2E on critical flows (login, browse→detail→request, admin CRUD, optimistic-lock conflict)

## Phase 14 — Deploy & cutover `[~]` config landed; deploy blocked on a Vercel permission

Owner opened this 2026-09-07 ("deploy it") and chose a **UI-only deploy** — publish the interface
for visual review now, wire the real API later.

- [x] Build/hosting decision — **static hosting on Vercel** (no server-rendering need, as expected).
      `vercel.json` committed: `framework: vite`, `outputDirectory: dist`, and the rewrite that does
      the real work — every route but `/` is client-side, so `/artwork/:id`, `/saved`, `/artists`,
      `/login` and `/admin/requests` 404 on a static host without a fallback to `index.html`.
      Verified against the built output: `/` → 200, `/saved` → 200.
- [~] Environment config (API base URL per environment) — **placeholder only, on purpose.**
      `.env.production` sets `VITE_API_BASE_URL=https://api.invalid/api`. `darzmarket-api` has no
      deployed URL yet, and `resolveBaseUrl()` (`src/api/index.ts`) throws when the var is unset with
      `api` built at module load — so unset is a *blank page*, not a degraded one. `.invalid` is
      RFC 2606 reserved and can never resolve, so calls fail fast and visibly instead of reaching an
      unintended host. Verified: the placeholder is baked into the bundle, no `localhost` leaks in,
      and the app boots and renders the gate rather than white-screening. **Done when the real base
      URL replaces that one line** — nothing else changes.
- [!] **Run the deploy** — blocked on Vercel permissions. `create_git_project` for
      `ariandarz/-darz-web` on team `Darz Market Studio's projects` (`team_N1xHzmEmOOIjt4MMmWTT5XYa`,
      Pro) returns `403 forbidden — "You don't have permission to create the project"`; retried with
      the default project name, same result. The connected account can read the team but not create
      in it. Unblock by granting it a project-creating role, or by hand-creating an empty project
      linked to the repo to deploy into. Deploying into the existing `darzstudio-art` or
      `koocheh-web` projects was **not** done — that would overwrite unrelated live projects.
      **Re-checked 2026-09-17:** the team still lists only `darzstudio-art` and `koocheh-web`; no
      project for this repo exists — still blocked. `.env.production` now also carries
      `VITE_API_WS_URL=wss://ws.invalid` and `VITE_FEATURE_SET=v0.1` next to the API placeholder.
- [ ] DNS/hosting cutover plan, coordinated with `darzmarket-api`'s own Phase 18

> **What the deployed build will and won't be, until the API URL is real:** layout, chrome,
> typography, the chroma seam, routing/deep links and both Paper and Black themes are real. Login and
> every piece of data are **not** — every API call fails with a network error. It is a visual-review
> build, and should not be shown to anyone as a working product.
