# Darz Market Web — Frontend Task List (source of progress truth)

**Last updated:** 2026-09-21 (admin V1 plan: Phases 0-4, G-1…G-5 and most of Phase 6 shipped and
released) · **Current focus:** **the admin panel's V1 plan — `docs/ADMIN_V1_AUDIT.md` §10.** That
document, not this one, is where the current line of work is planned; this file records what has
landed and what is still open across the whole repo.

**Read this before trusting the sections further down: everything from "The v0.1 loop is closed"
onwards dates from 2026-09-18 or earlier and describes the collector app's v0.1 line** — including
the "What next (2026-09-18)" list, whose items 2-6 are still open but whose framing predates all
the admin work. It is true as history; it is not the current focus.

---

## Since 2026-09-19 — the admin panel (PRs #61-#68)

`docs/ADMIN_V1_AUDIT.md` (2026-09-21) surveyed the whole panel against `darz-backend-api` and the
old `darz-studio.html`, and produced a phased plan. Its headline finding: **the admin panel is
built** — 111 files / 34k lines, 52 routes, 111 of 141 admin endpoints bound — and was ~80-85% of
V1. What has shipped since:

| PR | What |
| --- | --- |
| #61 | **TD-1** — the case-collision that broke `npm run build` on every Mac while CI stayed green. |
| #62/#63 | The audit itself, and `docs/ADMIN_SCREENS.md`. |
| #64 | **Phases 2-4** — Accounting completion (entry detail, receipts, the Arian duplicate queue, the settlement worksheet), `/admin/settings` as the audit log, and the catalogue edges. 10 of the 30 unbound endpoints. |
| #65 | **Phase 1** — the Requests desk gets search (backend `darz-backend-api` #31) and its thread is reachable from the row. Three asks turned out **not portable** and are recorded as G-REQ-1…3 rather than stubbed. |
| #66 | **G-1** (table desks use the screen — `<DeskPage wide>`, 18 desks) and **G-2** (the Database desk's four missing filters, over a new facets endpoint). |
| #67 | **G-3** (how long a request has been waiting) and **G-4** (the Collectors overview strip). |
| #68 | The release — `main` and `development` level again, closing **TD-2** (`main` had been 72 commits behind, i.e. a one-page admin panel). |

**Phase 6 (the polish pass) is mostly done** — TD-4 (one success-feedback pattern), TD-5 (one 409
pattern) and TD-7 (lint back to 0 warnings) landed together with the kit's `DeskToast` / `DeskSave` /
`ConflictBanner`. Three things that work changed about the audit, all recorded there:

- **TD-5 named two desks that cannot 409 at all.** The optimistic lock is enforced only in the
  `catalog`, `accounts`, `projects`, `crm` and `sales` serializers — so the **ledger entry editor
  and the auction-record editor are last-write-wins**, and two admins silently overwrite each
  other with no error to catch. Backend gap **G-LOCK-1**; the frontend cannot fix it.
- **TD-6's "8 dead service methods" were not dead.** Three are **buttons the old panel ships and
  this port never built** (delete a deal, delete an auction, delete an issued document — the last
  owner-only in the old panel, though the API here allows any standard admin). New finding
  **G-DEL-1**, and **Phase 6b** is the half-day that builds them. Nothing was deleted; all eight
  bindings now say in a comment why they have no caller.
- **TD-7 hid a real bug**: `AuctionEventPage` read `Date.now()` during render with no timer at
  all, so its countdown was frozen at whatever it said when the page mounted.

**Open for the owner:** **G-DEL-1** (build the three deletes?) and **G-LOCK-1** (backend: lock the
ledger?). G-1…G-6 are all decided.

**2026-09-22 — the first full desk walk.** Opening all 35 built desks (possible at last by
signing in against the **E2E stub**, since the only local team login's password is recorded
nowhere) found **three blank desks**, two already on `main` — including a nested `<Route>`
that had left Phase 2's ledger-entry detail unreachable from any URL. Fixed, guarded by a new
`DeskBoundary`, and turned into `e2e/desks.spec.ts` so it is a gate: **38 E2E tests, 466 unit
tests**. Details in `docs/ADMIN_V1_AUDIT.md` §9a. **TD-9 is closed for the stub tier.**

### What next (2026-09-21, revised 2026-09-22)

1. **Finish Phase 6** — the DoD proper: compare each desk side by side with its Phase 0 capture
   (`docs/ADMIN_SCREENS.md` is the map) and either fix or record every difference. **Started
   2026-09-22**: all 35 desks opened and rendering clean, three compared in detail (Dashboard,
   Requests, Artworks Database) with their differences fixed or already recorded. The remaining
   ~31 capture-by-capture comparisons are what is left.
2. **Phase 6b** — the three deletes, once **G-DEL-1** is ruled.
3. **Phase 5b** — the Database desk's four *hard* filters (completeness, size ranges, duplicate
   images, Gallery Portal). Backend work first; the desk already names them as unavailable.
4. **Phase 13 E2E — its first tier landed 2026-09-21** (in #66, `e2e/`), which closes both the
   "biggest remaining gap" framing below *and* the decision it was waiting on: the answer was
   **both tiers, split by what each can honestly claim.** The **stub tier** (`e2e/smoke.spec.ts`,
   3 tests) runs the production build against a no-state node server in CI — it proves the app
   boots, the collector gate renders, a team session reaches the panel, and a desk survives an
   empty backend. The **real-backend tier** is local-only by design, because this repo's CI has no
   backend checkout. So the suite is no longer "nothing renders a component" — the remaining gap
   is **breadth**: 3 smoke tests across 52 admin routes, and the per-desk walks are still manual
   (CLAUDE.md rule 5). That is what TD-9 now means.
5. Then the older repo-wide items below — the Vercel role (item 4), backend G-F1-1, the hidden
   collector features, and Phase 7 (Intelligence / Marketing / Document Builder) only if **G-6**
   is ever reversed.

---

## Before that — the collector app's v0.1 line (2026-09-18 and earlier)

**The v0.1 loop is closed.** `/admin/login` (`TeamLoginPage`) signs a team member in against
`POST /api/auth/team/login/`; `RequireTeam` makes the admin desk a team-principal surface; the desk
moved out of the collector shell into `AdminLayout`. Before this, a collector could send an inquiry
and **nobody could answer it from this app** — the loop had only ever been exercised by calling the
admin API by hand (`V0_1_SCOPE.md` flag 8, now closed). Shipped via PR #29 → released to `main` by
PR #30, merged back by PR #31, all on the owner's explicit instruction.

**Phase 5 (collector requests + activity) is done and released** — all four steps, 2026-09-18, each
merged on the owner's explicit instruction. `docs/PHASE_5_PLAN.md` is the contract it was built to
(findings, owner decisions D1-D11 / F1, the D3 status map); `docs/PHASE_5_API_GAPS.md` records the
twelve gaps found on the API side (G-P5-1 … G-P5-12) — **none** was fixed by changing the backend,
per the owner's instruction to build the UI around the gap and document it instead.

**Release state (2026-09-18):** `main` (`77f3655`) and `development` (`b4b257e`) have **identical
trees**, and `main` is an ancestor of `development` (the one-commit lead is the merge-back itself,
no content). **Open PRs: none.** Nothing is in flight on a feature branch. Note the release
published nothing — the Vercel project still does not exist (see "What next" item 3), so `main`
moving has no deploy consequence in this repo today.

Before that, the Market App design pass (PR #15, branch `claude/darz-web-frontend-redesign-f686ie`)
was merged to `development` on 2026-09-17 on the owner's instruction ("land the design pass") and
`main` was brought level the same day, the way the v0.1 release was (the PR #17 / #18 pattern). Its
merge commit's tree is the gated PR head: typecheck clean · lint 3 pre-existing warnings · 98/98
tests · format · build. Two entry points `development` had are unlinked in the merged result;
researched 2026-09-18 and narrowed to **one** open owner decision (`/artists`) — recorded under
"Design pass" below.

**Eleven merged remote branches are still present.** Each is `ahead:0` against `development`, so
every commit on them is already in `development` and deleting the ref loses nothing:
`claude/darz-market-v0-1-hpy1xy`, `claude/darz-web-frontend-redesign-f686ie`,
`claude/flow-1-requests-offers-admin`, `claude/phase-6-saved-favorites-gy70nd`,
`docs-panel-backend-audit-2026-09-17`, `phase-19-crm-saved-wire`, `phase-19-format-fixes`,
`phase-8-auctions-bidding`, `phase-8-auctions-browse`, `phase-8-auctions-notifications`,
`phase-8-auctions-records`. **Do not spend another session trying to delete these from Claude:**
GitHub answers `403` to every ref deletion here (retried 2026-09-18, with and without
`push.negotiate`; ordinary pushes from the same session succeed, the agent proxy logs no denial of
its own, and the GitHub MCP server exposes no delete-branch tool). Use the repository's branches
page or a local clone.

**Reference repo state (`../DarzStudio` / `ariandarz/darzstudio.art`, 2026-09-18):** the approved
design package `design/market-app/` is now on that repo's **`main`** (`b8ee118`, 172 files / 161
screenshots), released via #846 → #858/#859. `CLAUDE.md` reference 0 is therefore true for a fresh
clone — the branch-fetch workaround earlier sessions needed is gone (this was Phase 5's owner flag
F1, now closed). Two things to know if you go looking there: its `development` (`9cc4b57`) carries
**v1233 unreleased** (`build.json` 1232 on `main`, 1233 on `development`), and v1233 ships a
**SQL §94 migration that is not applied to production** — its Admin degrades on its own until it is.
That repo's production deploys from its `main`, so §94 should be applied *before* v1233 is released.
Neither is this repo's work; it is recorded so nobody reads `main` there and assumes it is current.

**Backend cross-check (2026-09-18, `darz-backend-api` @ `development` `12988db`):** the local
clone was **24 commits behind**; pulling it brought in backend Phases **23, 24, 25, 27, 28, 29, 30,
31, 32, 33, 34, 35**. There are now **191 declared routes** and this frontend calls about **20** of
them — the backend is far ahead, and what to build next is limited by design, not by API. The
backend's own `docs/TASKLIST.md` is dated 2026-09-11 and describes none of it, so the inventory was
read from `urls.py`, views and serializers. Full findings and the proposed work:
**`docs/PHASE_24_35_PLAN.md`**; the gaps found: **`docs/PHASE_24_35_API_GAPS.md`**.

Collector-facing and newly buildable: **Phase 34** public "Request access"
(`POST /api/auth/access-requests/`) — which `LoginPage` currently stubs with a factual note because
no endpoint existed, and whose field set matches the old form exactly; and **Phase 24** curated
selections (`GET /api/catalog/artworks/selections/`) — today a collector holding grants sees **none
of them**. Phase 25's questionnaire is stored but its *questions* are not published (G-P25-2), so it
is not faithfully portable yet. Push is **still** blocked: the VAPID public key is not exposed by any
endpoint (G-P13-1, re-checked 2026-09-18). Everything else added is admin-side — **Phase 11b**
below, a whole panel's worth of API with no frontend UI.

**What next (2026-09-18, recommended order):**

0. **Backend Phases 23-35 catch-up — `docs/PHASE_24_35_PLAN.md`.** **Step 1 (the gate's "Request
   access" form, backend Phase 34) shipped 2026-09-18** — a real form over
   `POST /api/auth/access-requests/` in place of the stub note `LoginPage.tsx` used to flag in its
   own header. **D4 was ruled** by the owner: the credential model stays as it is (collector = first
   name + access key, team = email + password) and the design package's password-generating sign-up
   is **not** built, because this backend issues keys through an admin review queue and has no
   password generation at all — the one place "the package wins" is overridden, and why.
   **Step 2 (the "Curated for You" chip, backend Phase 24) shipped 2026-09-18** — a collector
   holding grants used to see **none** of their curated works; the chip now switches the catalogue's
   base set to `/artworks/selections/`. It is a filter on the same grid, never a separate section:
   `app.html:3432` still describes a "Private — for you" section, but `:8890` records that v669
   **removed** it, so porting that would have shipped something the old app deleted. Both plan steps
   are done; `docs/PHASE_24_35_PLAN.md` has the decisions and what was deliberately left out.
1. ~~CI~~ — **done 2026-09-18.** `.github/workflows/quality.yml` runs typecheck · lint ·
   format:check · test · build on every PR and on pushes to `main`/`development`, modelled on
   `darzstudio.art`'s `Quality`. Verified before landing against a real clean checkout
   (`git archive` + `npm ci`, no `.env.local`): all five steps pass, so its first run is green
   rather than red. `lint` exits 0 on the 3 pre-existing warnings, so they do not gate. Every
   "green" recorded in this file before that date was hand-run and unenforced.
2. **Phase 13 E2E** over Login → Browse → Save → Send Inquiry → Chat. Unblocked as of 2026-09-18:
   both halves of that chain now exist (the collector can send, a team member can reply). **This
   is the real remaining gap** — all 20 test files are logic/controller tests and *nothing* renders
   a component, so the class of bug caught only by a screenshot this afternoon (the admin bar
   laid out beside the table instead of above it, because `AdminLayout` returned a fragment under
   a centring flex `#root`) is still invisible to the suite. Needs one decision: run it against a
   seeded local backend in CI (heavier, honest) or stub the API at the network layer (lighter,
   less honest). Suggested: stub for the render/routing assertions, plus a small real-backend
   smoke set.
3. Owner decision on **one** unlinked entry point — the artist index `/artists`. Researched
   2026-09-18 (see "Design pass" below for the evidence): the old app's own artist list is
   orphaned the same way, so the question is whether to **add** an entry point it never had, not
   whether to restore one this port dropped. Recommendation: accept deep-link only. The other two
   that used to sit on this line are closed — `/auctions/notifications` is reachable from
   `AuctionBanner`, and `/admin/login` is correctly unlinked because the old admin is a separate
   application file.
4. Unblock the deploy (Phase 14) — **still blocked; narrowed to a Vercel team role, 2026-09-18.**
   There is no `darz-web` project on the team (it holds only `darzstudio-art` and `koocheh-web`).
   **Both** creation paths were tried and fail identically:
   `create_git_project` (even with `deploy:false`, i.e. link-only) and `deploy_to_vercel` (inline).
   The inline path is the informative one — its 403 carries Vercel's own
   `https://vercel.com/docs/accounts/team-members-and-roles` link, which is how Vercel frames a
   **role** problem, not a scope or connector one. Reading projects, deployments and teams all work,
   so the connection itself is healthy; it is specifically *create project* that the authenticated
   member's role forbids (on a Pro team, Viewer and Billing cannot create projects).
   Two ways out, and only the owner can take either: **(a)** raise that member's role to
   Member/Developer on "Darz Market Studio's projects", after which Claude can create and link it;
   or **(b)** create an empty project named `darz-web` linked to `ariandarz/-darz-web` by hand —
   deploying *into an existing* project is a different permission from creating one, so that is
   expected to work, though it has not been proven from here (proving it would mean deploying to a
   real project, and the only two that exist are live).
   The production build itself is verified green (`tsc -b` + `vite build`, 162 modules, 2026-09-18);
   `.env.production` is a deliberate `.invalid` placeholder, so the first deploy is visual-only
   until `darzmarket-api` Phase 18 publishes real API + WS URLs.
5. Backend G-F1-1 (the typed per-kind `detail`) — the one backend ask that would delete hand-written
   types from this repo; see `docs/PHASE_5_API_GAPS.md` G-P5-1.
6. Backend-ready collector items v0.1 hid: membership redeem (Phase 9), push opt-in once the API
   publishes the VAPID key, the "Refine" filter panel (backend ready since Phase 19).
7. Post-v0.1 by readiness: switch on auctions when wanted (built, Phase 8), Phase 7 catalog CRUD +
   sales, Phase 10 gallery portal, Phase 11 admin desks, FE-R1…FE-R4 records desk.
8. Phases 12+ wait for their backend phases; the curated `in_app` set (backend Phase 24) goes first.

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

**Client V1 API brief (2026-09-04) — build order & blockers.** The client shared a brief, their
`V1_FRONTEND_API_MAP.md`. **PR #832 was merged 2026-09-18**, so this is no longer a PDF read at
arm's length: the real document is `docs/V1_FRONTEND_API_MAP.md` on `darzstudio.art` `development`,
366 lines with `file:line` references throughout. Read that, not
`~/Downloads/DarzV1FrontendAPIBrief.pdf`. Its four findings — no reply channel in the API, the offer
floor enforced only in the database, no `client_req_id` counterpart, and no runtime legacy-id → UUID
mapping — overlap heavily with our own `docs/PHASE_5_API_GAPS.md`; worth reconciling into one list
rather than tracking the same gaps twice. **Its build-order guidance is superseded, not violated:**
it said build Login → Artwork list → Save/unsave and then STOP, and **do NOT jump to Requests /
Offers / Admin-queue**, because in September those depended on backend work that did not exist
(reply-thread, offer-floor, idempotency key, legacy-id). Backend Phase 19 landed and removed exactly
those blockers, which is why Phase 5 was built afterwards. Treat the "stop" line as history. Decisions locked with the owner
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
- [ ] **Owner decision — the artist index `/artists` has no entry point.** Researched against
      `app.html` 2026-09-18; the other two "missing links" resolved to **no change needed** and are
      recorded below rather than left open.
      1. **`/artists` — the one real question, and the old app has the same hole.** `artistsView()`
         exists (`app.html:5319`) with live search and sort handlers (`DZ.artSearch`/`DZ.artSort`,
         `:11497-11498`), so it was plainly meant to be reachable — but **nothing enters it**. The
         hash router's section table `SEC` (`:3577`) has keys for market / auctions / records /
         highlights / profile / settings / saved / stories / insights and **no `artists`**, and
         `render()` (`:5701`) does `else if(tab==='artists'){ if(currentArtist)artistView(currentArtist);
         else market(); }` — landing on the artists tab with no artist selected shows the **Market**.
         Its only two callers are its own search/sort handlers and the records-archive repaint. So
         this repo's orphaned `/artists` is a *faithful* reproduction of an entry point the old app
         lost, not a porting miss. `/artists/:id` (detail) is reachable from five places and is
         fine. **The decision is therefore not "restore a link" but "add one the old app never
         had".** Options: accept deep-link only (faithful, my recommendation), restore the
         catalogue hero's Artists pill the design package dropped, or place an entry where the
         package would put one. Not changed without a decision (faithful-port rule).
      2. **`/auctions/notifications` — not missing.** `AuctionBanner.tsx:43` navigates there for a
         notification with no lot. Reachable, and hidden in v0.1 anyway (`features.auctions` off).
         No change.
      3. **`/admin/login` — correctly unlinked.** The old admin is a **separate application file**
         (`darz-studio.html`), never linked from the collector app. A collector-facing link to the
         team gate would be an invention and a mild disclosure. No change.

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

## Phase 5 — Collector: requests + activity ✅ all four steps done 2026-09-18 (`docs/PHASE_5_PLAN.md`)

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
- [x] Collector's own request list — **Phase 5 step 2, 2026-09-18**: one status module
      (`features/requests/status.ts`) turns the backend's per-kind workflow tokens into the old
      app's collector vocabulary (In review · Replied · Accepted · Resolved · Not accepted ·
      Closed, no pill on a just-filed request), the four-step rail `dzMktStage`/`MKT_RAIL` and the
      per-kind note `dzActStatusNote` — replacing the three hardcoded status lists this repo had
      grown, with an unknown status falling back to the `/api/options/` label. Profile › Market now
      carries **Your acquisitions** (`dzAcqSectionHTML`: purchase / offer / hold with the rail, or
      one line once ended) over the saved works and the activity list, whose rows are
      `dzActRowHTML`'s: `ACT_KL` labels, the date with its time, the offer amount, "New reply", the
      unseen dot. **Clear activity** is built (owner decision D4) as a session-local hide — the
      backend has no collector archive (`docs/PHASE_5_API_GAPS.md` G-P5-4). Artwork titles come
      through `ArtworkCache` (G-P5-2).
- [x] Collector's own request detail — **Phase 5 step 3, 2026-09-18** (owner decision D10: the
      `/chat/:id` route, not a sheet): `ThreadPage` keeps v0.1's chat for a conversation and opens
      the old app's request card (`DZ.actOpen`) for every other kind — heading, the work,
      **Current status** ("Submitted — awaiting Darz" until Darz moves it), Request / Amount /
      **Held until** (D11) / When, and the per-kind `dzActStatusNote` line while there is no reply
      — over the same thread and composer, so a reply round-trips identically. Every Profile row
      opens its detail; the floating reply notice (`.dz-notif`) is ported; **Remove from activity**
      shares Clear activity's session-local hide (G-P5-4). Not ported, both flagged in the file:
      the old separate "headline reply" channel (one thread here) and the WhatsApp CTA (no number
      is published).
- [x] Activity self-logging — **Phase 5 step 4, 2026-09-18**: `features/activity/ActivityLogger`
      over `POST /api/crm/activity/`, fire-and-forget (a failure is swallowed, sync or async — it
      must never reach a save or a sign-in), `view` deduped per work per session and `search` per
      settled term. Wired at the four points the old app used: `login` on sign-in
      (`app.html:2347`), `save` inside `SavedController` (`:2806`, saves only), `view` on the
      artwork detail (owner decision D5a — the old app logged only curated works, and no curated
      set exists yet), `search` on the toolbar's settled term (D5b — the old app never logged one).
      The log is write-only: no endpoint reads it back (`docs/PHASE_5_API_GAPS.md` G-P5-12).
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
      **Principal-aware guard landed 2026-09-18**: `/admin/requests` sits behind `RequireTeam`
      (not `RequireAuth`) inside its own `AdminLayout`, outside the collector shell and providers —
      a collector session is sent to `/admin/login` instead of collecting 403s. The API's own admin
      permission is still the real gate; this just stops the UI pretending otherwise.
- [x] Team sign-in — **2026-09-18**: `/admin/login` (`TeamLoginPage`) over
      `POST /api/auth/team/login/` (`{email, password}` -> JWT pair, `principal=team`), a verbatim
      port of app.html's `st.view==='legacy'` card (app.html:2537-2542) reusing the collector gate's
      own classes, so it adds no CSS. `RequireTeam` guards the desk; `AdminLayout` carries the one
      piece of new markup — a bar with the signed-in identity and "LEAVE THE ROOM" — because the
      desk sits outside the collector `AppShell` and a team member would otherwise have no way out.
      The real admin shell is Phase 11; that bar should be deleted when it lands, not grown.
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

## Phase 10 — Gallery Update Portal (frontend) ✅ done 2026-09-19

- [x] No-login token+PIN portal (`/portal/:token`, 2026-09-19): gate → works + one-submission
      updates (the payload keys `GalleryUpdateService.approve` auto-applies) → funnel Status
      (feat_funnel) → pricelist upload (real multipart) → messages → Exhibition Services
      (create/pick/submit → composed package → document acceptance). Ported from
      `gallery-update.html` (build 914); gaps recorded as **G-PORT-1…11**
      (`docs/ADMIN_ARCHITECTURE.md` §2). Live-verified full-circle both ways (step15: 37 checks).
- [x] Admin review/approve desk UI — shipped with Phase 11b (the Sources & Partners desk); the
      issue reveal now hands over the ready-to-send `/portal/{token}` address.
- [x] **Phase 10b — the desk half + documents (2026-09-19, Portal V1 order):** the Exhibitions
      queue (third face of Sources), the per-partner shows + Q&A thread on the partner page, the
      composer (`/admin/sources/:id/exhibitions/:eventId` — request → priced package → approve →
      publish), and one-click proposal/invoice issue: create → client-rendered PDF
      (@react-pdf/renderer, brand TTFs bundled, golden-fixture design, D18 resolved) → upload →
      confirm, references per `doc-reference.js` (`DARZ-PRO/SINV-YYYY-NNNN`, highest-seen + 1).
      The updates queue now reads in words (was → now, raw payload behind a fold). Live-verified
      full circle both ways (step16: 22 checks; PDFs read back and inspected).

## Phase 11 — Admin: Marketing Hub, AI Tagging, Document Builder, Accounting ✅ backend ready

(Phases 14-17 all merged)

- [ ] Marketing Hub UI (campaigns/analytics — content generator/asset-library scope TBD, see backend
      Phase 14's open owner-decision)
- [ ] AI Tagging & Recommendations admin desk (working queue, confirm-batch ledger, readiness toggle)
- [ ] Document Builder UI (generic document editor + PDF export)
- [ ] Accounting desk UI (4 ledger books + Private Deals) — real Django permission scope replaces
      the old passkey hack; don't rebuild the passkey pattern in the frontend

## Phase 11b — Admin: Owner Panel ✅ backend ready 2026-09-17 · **plan confirmed 2026-09-18 → `docs/PHASE_11B_PLAN.md`** · Step 0 + the desk kit done

> **The panel is bigger than this phase.** `docs/ADMIN_ARCHITECTURE.md` (2026-09-18) is the whole
> admin as one system — **14 groups, 55 tabs**, of which Phase 11b is 11. It carries the
> port-vs-modernise rule the owner set, the desk kit's contract, the owner-controlled feature-flag
> architecture (§4), the Document Studio (§5), and the build order for everything else. Read it
> before starting any admin work outside this phase.

New since the last `TASKLIST.md` pass — the client asked to prioritize finishing "the panel" (the old
`darz-studio.html` admin app). Backend audited every old panel tab against existing `admin/*` routes
(`darzmarket-api` `docs/TASKLIST.md` Phases 27-32 + 23) and built every gap found; **none of it has
any frontend UI yet.** No API gaps were recorded for these — each is a plain admin CRUD/read desk,
faithfully scoped, real HTTP-verified. Old-panel tab names in parens for continuity with the design
package/faithful-port research.

> **Read `docs/PHASE_11B_PLAN.md` before starting any item below.** It is the working contract
> (Steps 0-7, decisions D9-D16, waiting on the owner). Three things it establishes that the list
> below got wrong, found by reading `darz-studio.html` rather than the backend's tab names:
>
> 1. **These desks are not siblings.** The old panel is a **two-tier navbar with sixteen groups**
>    (`darz-studio.html:11721-11779`), and Phase 11b's desks are scattered across five of them.
>    Import sits beside Database under *Artworks*; Data Health sits under *Operations*; App Design
>    appears in **two** groups. Building them as standalone top-level pages would invent an
>    information architecture the old panel does not have. **The panel shell is Step 0** and every
>    other step depends on it.
> 2. **Two desks are missing from the list below** (it predates backend Phases 34 and 35):
>    **Access Requests** (`systemView`, `:33115`) — the review queue for the requests the collector
>    gate now sends, so every request submitted through the form shipped in the last round is
>    currently invisible outside Django admin — and **Collector Club** (`clubView`, `:33740`),
>    backed by Phase 35's `crm.CollectorSelection`. A third, **Access keys** (`accessView`,
>    `:33029`), exists in the old panel as its own owner-only desk as well as folded into
>    Collectors below.
> 3. **There is no approved design package for the panel.** `design/market-app/` covers the Market
>    App only; there is no `design/admin/`. So `darz-studio.html`'s own shipped CSS *is* the spec,
>    which raises rather than lowers the bar on CLAUDE.md rule 5 — there is no reference capture to
>    compare a panel screen against.

- [x] **Panel shell** (Step 0 — prerequisite for every desk below) ✅ 2026-09-18 — the old panel's
      two-tier navbar ported as data (`adminNav.ts` ← `darz-studio.html:11721-11803`: groups,
      labels, the `OWNER_ONLY` list, and the explicit "THE OWNER ALWAYS SEES EVERY TAB" rule at
      `:11794`), an `AdminShell` replacing the scaffolding `AdminLayout`/`.ad-bar`, the `/admin`
      route tree clamping to the first page a role can open (`:11815`), and a `RequireOwner`
      rendering the old panel's own refusal card (`:33030`) rather than redirecting. Only the groups
      this phase builds are registered; an unbuilt tab carries `path: null` so nothing renders it —
      **absent, not stubbed** (D9). Verified live as both roles in both skins. 158 tests (+17).
      `RequireOwner` has no caller until Step 2 lands the first owner-only desk.
- [x] **Collectors desk** ✅ 2026-09-18 (old panel "Collectors" tab, `users()` :32610) —
      list/search/filter/sort over the server's own `CollectorFilterSet` + create/edit
      (optimistic-lock `version`, 409 surfaces) + soft-delete, and a per-collector workspace
      (`/admin/collectors/:id`) holding the record, the keys (issue → `ShownOnceSecret`, revoke,
      the three extend buttons, `expCell`'s Never/Expired/today/nd-left cell :33042) and the Phase
      33 sign-in log. The overview strip and activity/purchase sorts are **not ported** — the
      roster is paginated and no aggregate/rollup endpoint exists (G-COL-1/2). Live-verified full
      circle: an issued key signed a real collector in at the gate.
- [x] **Access Requests desk** ✅ 2026-09-18 (`systemView` :33115, `accReqPanel` :33006) —
      owner-only (`RequireOwner`'s first caller; a standard admin gets the :33116 refusal card and
      no Access Management group). Pending cards with the verbatim copy, sub-line, empty state and
      "{n} pending" badge; approve = tier picker + confirm → the once-shown key (§2.3 deviation);
      **D13 honoured** — the old composed note is PATCHed onto the new collector. Decline confirm
      verbatim (:37370). Live-verified: approve created the collector (tier landed), queue shrank,
      note present.
- [x] **Collector Activity feed** ✅ 2026-09-18 (old panel "Collector Activity" tab) — read-only
      view/save/search/login log over `GET /api/crm/admin/activity/`, as the second half of the
      "Requests & Activity" tab (a segment switches the halves — the old `activity()` page mixed
      them in one scroll; same content, one modern surface). Kind filter from `crm.activity_kind`;
      a collector's workspace deep-links into their own slice (`?view=activity&collector=`).
      Live-verified: 10 real rows including the session's own logins.
- [!] **Access keys desk** (old panel "Access", owner-only, `darz-studio.html:33029`) — the
      roster-wide view (every key across collectors, expiring-soon review list, logins-today
      counter) is **blocked by G-KEY-1**: keys are only listed per collector
      (`GET .../collectors/{id}/access-keys/`); no all-keys endpoint exists and paging every
      collector to build one client-side would not scale. The per-collector half (issue/revoke/
      extend/expiry cell/sign-ins) shipped inside the Collectors workspace 2026-09-18. Needs a
      `GET /api/auth/admin/access-keys/` list to build the desk proper.
- [ ] **Access Requests desk** (old panel "Access Request", owner-only, `:33115`, panel
      `accReqPanel()` `:33006`) — **missing from this list until 2026-09-18**; backend Phase 34
      shipped it after the list was written, so every request submitted through the "Request access"
      form this repo shipped in the last round is currently invisible outside Django admin. Pending
      cards (name · date · contact · city · "heard via" · referral · the quoted `why`) with Issue
      key / Decline. Note the **deviation** (plan §2.3): the old "Issue key" opened the full
      editable key modal pre-filled from the request; the API's approve takes one optional `tier`,
      derives the collector and returns the plaintext key once.
      `GET /api/auth/admin/access-requests/`, `POST .../{id}/approve/`, `POST .../{id}/decline/`.
- [x] **Collector Club desk** ✅ 2026-09-18 (old panel "Collector Club", `clubView` :33740) —
      selection cards with the PRIVATE badge, works count, invited badges ("no collectors yet"),
      note and created date (:33743-33759); the editor is name · note · search-backed work and
      collector pickers (the old in-memory tile wall does not survive a paginated catalogue). The
      Phase 35 overlap rule is stated in the delete confirm — a grant only lifts when no other
      selection still wants the pair. G-CLUB-1: the nested serializer carries no image, so the card
      cover is the old fallback gradient, always. Live-verified: a created selection granted an
      imported work to a collector (sync confirmed; the work stays off the chip only because it is
      unpublished — the recorded `is_published` rule).
- [x] **Dashboard** ✅ 2026-09-18 (old panel "Dashboard" tab, scoped to V1 essentials — perf/
      analytics charts and cloud-sync banners didn't port, per backend Phase 29) — requests-needing-
      attention per kind (each tile opens **exactly the rows it counted**, :21349's rule; the
      initial-status link leans on G-DASH-1, recorded), today's activity, collector/catalogue/
      auction totals, pending exhibition reviews. `GET /api/dashboard/admin/summary/`. Live-verified
      tile → filtered desk (1 counted → 1 listed).
- [x] **Chat desk** ✅ 2026-09-18 (old panel's Chat Dashboard, `darz-studio.html:40528`; its own
      top-row tab beside Dashboard, :11099) — conversation list (avatar initial · name · context ·
      unread · date, :40448) + thread with composer over the shared `MessageThreadController`
      (collector's `ThreadController` and admin's `AdminThreadController` are two bindings of one
      machine; seen-marking flipped per :40547). Copy verbatim: "← All", "No messages yet…",
      "Write a message to {name}…", "Sent to the collector ✓". AI Monitor / mode / assignee /
      conversation-status / Clear / client-side search **not ported — no backend** (G-CHAT-1/2
      recorded). Live-verified: send lands as a team bubble, seen marks on open.
- [x] **Memberships desk** ✅ 2026-09-18 (old panel "Memberships" tab, owner-only,
      `membershipsView` :33306) — issue (blank code auto-generates `DZ-<plan>-<6>`), search/plan/
      status filters (the server's own filterset), edit (version lock), renew (+1 month from
      max(expiry, today), server-side `membRenew`), remove behind a confirm; the wa.me WhatsApp
      link (:33322), monospace code cell, and the dot + Active/Expired/Inactive + days status cell
      (:33318, over `expiryParts`). "No payment processing anywhere" kept on screen. Plans are the
      collector tiers — the backend's own Phase 30 deviation from `MEMB_PLANS`, flagged in the page
      header. Live-verified: issue → auto code + wa.me link; renew → "29d left".
- [x] **Team logins desk** ✅ 2026-09-18 (old panel "👥 Team logins", owner-only) — issue
      (password shown once → `ShownOnceSecret`), search/role filter, edit name/email/role/active,
      remove; self-deactivate/self-remove surfaced as **disabled controls with the reason**, as this
      list asked. The old `teamView`'s surrounding Workspace suite (tasks · notes · time · contacts,
      :19420) is client-local in the old app with no backend here — G-TEAM-1, stated on the desk.
      Live-verified full circle: the shown-once password signed the new standard admin in, who
      lands on /admin with no gold groups.
- [~] **App Design** (old panel "App Design" tab) — **the switches half shipped 2026-09-18**: the
      desk (`/admin/design`, reachable from both its old groups) edits the typed `FeatureFlags`
      table and publishes it as `theme.features`; the Market App reads the public
      `GET /api/app-theme/` on boot (alongside `session.resume()`, before first paint) and merges
      validated switches over the `VITE_FEATURE_SET` floor — a dead endpoint can never dark-screen
      the app, `market` cannot be switched off, non-boolean/unknown keys are refused
      (`resolveFeatureFlags`, tested). Save vs "Save version" kept distinct (the old desk's two
      buttons); versions list/Activate/Delete + Reset. Live-verified: Records off → the collector's
      `/records` clamps to `/`; Reset restores; Activate re-applies a checkpoint.
      **Still open** `[ ]`: the `theme.copy`/`contact`/`social` keys (WhatsApp number, hero copy,
      About, shipNote, Terms/Privacy — the `API_INTEGRATION_GAPS.md` "Still open" items) land with
      their collector-side consumers, D17's key names from the old `app_theme` payload; and the old
      desk's fonts/colour/per-page-button editors, deliberately not built until something reads
      those keys (an editor for keys with no consumer lies about what Save does).
- [x] **Projects desk** ✅ 2026-09-19 — **Phase 11c** (`docs/PHASE_11C_PLAN.md`, all four steps in
      one PR): the seven desks under `/admin/projects…` (dashboard · list · pipeline · packages +
      service catalogue · calculator · partners · reports) plus the record (`/:id` — stage rail,
      the nine old sections, server-side attachments, the Proposal section) and the print report.
      Stage moves call `/stage/` (the status label is derived server-side, G-PROJ-2); the
      calculator prices from the catalogue (D21); the client proposal issues as a
      `documents.Document` (kind `proposal`) through the Phase 10b renderer. Not ported, stated:
      the old Proposal Builder (`:14647`), the client-side rate card, the seeds; the stage
      sub-state cannot be written (G-PROJ-3). Gaps **G-PROJ-1…5** in `ADMIN_ARCHITECTURE.md` §2.
      Live-verified on the real backend (see the PR).
- [x] **Data Health** ✅ 2026-09-18 (old panel "Data Health" tab, `healthView` :26360, scoped
      down) — the three surviving checks rendered with counts, first-50 items and an explicit
      "…and n more"; the desk says on screen why the other five did not port (they diagnosed the
      old client-sync architecture). Live-verified against the dev DB's real findings.
- [~] **Import desk** (old panel "Import" tab, `importView` :29703) — **CSV + Paste shipped
      2026-09-18** (owner decision D15): a tested RFC-4180 reader + column-mapper guessing headers
      onto `ArtworkAdminSerializer`'s own field names (`artist_name_raw` carries the artist as
      text), the verbatim "Imports land in Review first…" rule on screen, the staged-batch review
      (edit rows as JSON, reject, confirm, discard), per-row errors surfaced. Live-verified: a
      pasted CSV staged 2 rows and Confirm created 2 real artworks with zero errors. **Still open**
      `[ ]`: the PDF-catalogue and Images tiles (pdf.js + upload wiring) — stated on the desk as
      absent, not shown as dead buttons.

## Phase 12 — The catalogue core (build order §6 step 5: Artworks · Artists · Market App · Sales)

The most-used desks, over backend Phase 7's admin CRUD. `docs/ADMIN_ARCHITECTURE.md` §6-§7 carries
the order and the gaps (G-CAT-1…8, recorded 2026-09-18).

- [x] **Step 1 — Artworks Database + Artists** ✅ 2026-09-18 (overnight run) — `/admin/artworks`
      (`databaseView()`, `:26605`: search + filters + the removable-chip row, ✓ APP per-work
      publish toggle (`dbAppBox`, `:23957`), status pills (`:8791`), Edit/Remove) and
      `/admin/artworks/:id|new` (`editArt`, `:34065`: guarded transitions from the ported
      `AVAILABILITY_TRANSITIONS` table, provenance rows with the old storage contract, per-work
      collector actions on `crm.collector_action`, the multi-image store — multipart upload via a
      `FormData`-aware `HttpClient`, primary, soft remove) + `/admin/artists` (`artistsView()`,
      `:33522`: roster, client-side search per G-CAT-3, INLINE intro edit, CRUD with
      `expected_version`). 212 tests (+11). Verified live end to end — including a real image
      upload through moto-S3 standing in for MinIO (dl.min.io is egress-blocked; moto serves
      signed URLs the browser loads).
- [x] **Step 2 — Published works + Market Sales** ✅ 2026-09-18 (overnight run) —
      `/admin/published` (`marketView()`, `workspaces-runtime.js:533`: the public catalogue slice
      with images, search, "Remove from Market App", the hidden-by-a-gap tile from Data Health;
      found live that the collector list serves `visible_all` only — the tile says "in the public
      catalogue" and the private layer points at the Club) and `/admin/sales` + `/admin/sales/:id`
      (`DZSales`, `darz-studio.html:12517`: per-status stat tiles from pagination totals, ＋ New
      deal with kit `Picker`s — promoted from the Club editor — the guarded linear chain, the two
      setters, and the R7 draft-only terms lock, said on the card). `SALE_TRANSITIONS` ported +
      tested; `useSaleRefs` resolves the row's bare uuids (G-SALE-3). Gaps G-SALE-1…5 + G-CAT-9
      recorded. 215 tests (+3). Verified live end to end (18 checks) — publish/unpublish full
      circle across the two desks, deal create→confirm→lock, payment setter, list resolution.
- [x] **Step 3 — Documents: Library · Proposals · Invoices + the record's lifecycle** ✅
      2026-09-18 (overnight run) — `/admin/documents` (+`?kind=` — the old sticky sub-tab as
      routes, `documentsView()`, `workspaces-runtime.js:507`) and `/admin/documents/:id`: create
      (freeform kind + ref + visibility + owner-lock), draft-only editing with a validated JSON
      fields editor, **PDF upload on the backend's own client-renders-server-stores contract**
      (multipart; a version snapshot per upload), confirm (needs a PDF, locks) → sign → archive,
      and **Copy link** sharing (D19's share-by-link, live). The shell's sub-tabs became
      query-aware (three tabs, one pathname) without regressing filtered desks. History and the
      Builder stay marked with reasons (G-DOC-2, D18). Verified live: the full lifecycle
      draft→PDF→confirm→sign, fields persistence, kind tabs lighting right, versions rendering.
- [x] **Step 4 — Galleries & Sources: partners + the Source Updates queue** ✅ 2026-09-18
      (overnight run) — `/admin/sources` (`sourcesView()`, `darz-studio.html:27288`; the Galleries
      tab opens the gallery slice): the partner roster with the `source_type` axis, issue → the
      ONE-TIME token+PIN reveal (the serializer's own contract, ShownOnceSecret ×2), the ported
      reminder banner ("n source updates awaiting your review → Review them"), and the queue as
      the desk's second half (segment) — approve/reject with the note, the confirm naming what
      approval DOES per kind (availability/price/correction apply to the artwork; the rest record
      intent). `/admin/sources/:id`: record + enable/disable, the Phase-12 funnel switches (the
      model's "never a collector identity" promise kept on the copy), and the snapshot works list
      — assign via the kit Picker, remove, per-work funnel-stage override. Verified live end to
      end INCLUDING the portal side: a real `POST /portal/{token}/updates/` with the issued
      token+PIN (201) → banner → queue → approve; disable → the portal answers 401.
- [x] **Step 5 — Auctions admin: Live Auctions + Register to Bid** ✅ 2026-09-19 (overnight
      run) — `/admin/auctions` (`auctionsView()`, `darz-studio.html:31677`: search + status
      filter, ＋ New auction on the create serializer's exact fields) and `/admin/auctions/:id`:
      the no-edit record (G-AUC-1 stated), the Phase-35 **invite-only card** (switch + invited
      collectors via the kit Picker — "an uninvited collector never sees the sale"), and the lots
      desk — create with the confidential reserve (shown only here), **Go live** (the artwork
      transitions to Reserved server-side), **Close / Close early** (the found-live rule: `force`
      bypasses the END TIME, never the reserve — the confirm says the whole rule).
      `/admin/auction-registrations`: the paddle queue with the ported action titles; approving
      assigns the next sequential paddle number. G-AUC-1…3 recorded. Verified live end to end:
      create → invite → lot → go-live → artwork Reserved → queue resolve → approve → paddle #1 →
      close early → passed → artwork back to Available. (Redis joined the local stack for the
      Channels lot-state broadcast.)
- [ ] **Step 6 — Auction Sales** `[!]` — `Sale` has no source axis (G-SALE-4); auction settlement
      is its own loop. Waits on the backend decision. Bulk selection (status/publish) also
      returns in a later pass.
- [x] **Step 7 — Accounting: the four-ledger books** ✅ 2026-09-19 (overnight run) —
      `/admin/accounting` (owner-only end to end, the backend's own `IsOwner`): the four books
      (Darz · Koocheh · Personal · Expenses Arian) as a segment, the per-currency summary strip
      (`acctSummary` served — income/expense/net/pending/salaries, NEVER summed across
      currencies, plus the manual-rate converted-income view), the month/type/status filters,
      and entry CRUD over the write serializer's whole set (essentials + manual FX + sale
      labels; `book` immutable on edit, said on the form). Deals, attachments/receipts, the
      Arian review and the settlement follow as their own step. Verified live: income + expense
      land, the strip nets 38,000 USD, books are separate worlds, edit flips the pill, and a
      standard admin meets the refusal card.
- [x] **Step 8 — Accounting: Private Deals + receipts** ✅ built 2026-09-19 (PR #53, left open —
      the overnight merge window closed with #52) — the Accounting desk gains the Books | Private
      Deals segment; `/admin/accounting?view=deals` lists with stage/payment/month filters, the
      per-currency deals summary under the same filters, and rows carrying the serializer's own
      `calc` line (net · remaining — `pdealCalc` served, never client math).
      `/admin/accounting/deals/new|:id`: the old panel's widest form — the deal · the work ·
      buyer · seller · commission & payment · the 15-amount money grid (each amount with its own
      currency) · follow-up · deal FX — plus the calc card and slotted attachment uploads with
      served links. Unset choice fields are omitted from the write (a '' would 400). Verified
      live: create → calc nets the Darz share and the remaining · receipt upload · row/summary
      math · month include/exclude.
- [x] **Step 6 — Auction Records desk** ✅ 2026-09-19 (overnight run) — `/admin/auction-records`
      (+`/new|:id`): the widened external-results DB (backend Phase 11-admin, BE-R1…R6) as a full
      desk — search + the Past/Upcoming/Live sections + the admin-only status filter; rows with
      the linked-artist-beats-raw label, realized-beats-hammer-beats-price money line, ★
      highlights; a four-section editor over the serializer's whole field set (year is free text
      — "c. 2005" is real data). The old tab's import machinery and archive browser are dead
      architecture (the Import desk's CSV path covers bulk entry). Verified live: create with a
      linked artist → row anatomy → section filter → search by house → edit round-trip
      (unstar). The collector browse requires collector auth (its 401 to a bare probe is the
      permission working). — `Sale` has no source axis (G-SALE-4); auction settlement
      is its own loop. Waits on the backend decision. Bulk selection (status/publish) also
      returns in a later pass.

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
- [x] **Projects / Data Health / Import desks** — **unblocked 2026-09-17**: backend Phase 23 merged,
      full faithful port. Data Health + Import shipped in Phase 11b, Projects in Phase 11c
      (2026-09-19) — this bullet stays only as the Phases-12+ cross-reference.
- [ ] **i18n + white-label (BlueArt)** `[!]` backend Phase 26 (lowest priority) — still not built.

## Phase 13 — Testing

- [x] **The E2E harness — stub tier in CI, real-backend tier local** ✅ 2026-09-18 (overnight
      run) — `e2e/smoke.spec.ts` (@playwright/test) walks gate → team sign-in → panel → a desk
      against `e2e/stub-server.mjs` (the envelope + canned boot routes + empty lists, so every
      desk must survive an empty backend); a second `e2e` job in `quality.yml` runs it with its
      own Chromium. The real-backend tier is deliberately local-only — `e2e/README.md` states the
      two tiers' claims and the rule of thumb (a new desk gets its real-backend walk before it
      ships; the smoke only grows with the boot/shell contract).

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
