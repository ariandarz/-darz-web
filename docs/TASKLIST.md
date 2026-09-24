# Darz Market Web — Task List (single source of truth)

**Last updated: 2026-09-24.** This is the one place for *what is built and what is left*. It replaces
the long historical task log (that detail now lives in `CHANGELOG.md` and `docs/archive/`).

- **Gap state** (which API gaps are fixed/pending) → **`API_GAPS.md`**.
- **How to adopt the closed backend work** → **`API_GAPS_FRONTEND_ADOPTION.md`**.
- **Backend's next tier of gaps** → **`../darzmarket-api/docs/GROUP_B_API_GAPS_PLAN.md`**.
- **Owner decisions in one place** → **`NOTES-FOR-ARIAN.md`**. **Start-here** → **`HANDOFF.md`**.

> **Status legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked.
> When you finish a task: set `[x]`, add a 3-line `CHANGELOG.md` entry, update the API gap's row in
> `API_GAPS.md`, and move focus. Merging needs an explicit per-request owner instruction (`CLAUDE.md`).

**Hard constraint:** faithful port of the old DarzStudio app (see `CLAUDE.md`). Don't invent UI/copy/
structure — trace every decision to the approved package + `app.html`.

---

## Now — status

| | |
| --- | --- |
| Branches | `main` and `development` kept level; `development` is the working line. |
| Last landed | Node-20 support (jsdom 29, engines/CI/Dockerfile/.nvmrc) + admin panel code-split (main bundle 976→539 kB, chunk warning cleared). |
| Backend | `darz-backend-api` `development` @ `5f6d7ea` — **every V1 API gap closed** (see `API_GAPS.md`). |
| Gate | 620 unit (56 files) · 82 E2E (collector 25 · desks 54 · smoke 3) · typecheck · lint 0 · format · build · `npm audit` 0. Runs on **Node 20**. |
| Live site | https://darz-web.vercel.app — Vercel auto-deploys `main`, **visual-only** until a real `VITE_API_BASE_URL` is set. |

**The app is feature-complete for V1.** Collector app + admin panel (~111 files, 52 routes, most
admin endpoints bound) are built. What remains is: owner decisions, frontend adoption of the
now-closed backend gaps, the non-V1 backend gaps, and deferred/backend-blocked features — all below.

---

## Open work

### A · Owner decisions (nothing below starts without one) — see `NOTES-FOR-ARIAN.md`
- [ ] **Real `VITE_API_BASE_URL`** — `.env.production` is the deliberate `api.invalid` placeholder, so
      the live site has no sign-in/data. One line + redeploy once the backend has a public URL. **The
      single biggest blocker to a working site.**
- [ ] **i18n (G-I18N-1)** — the engine ships OFF (as the old app does). Decide: which languages ship,
      whether RTL gets a real layout pass, whether the picker is visible. ~430 strings unwired pending
      this. Recommendation: Farsi-first with a proper RTL pass.
- [ ] **`/artists` has no menu entry** — the old app orphans it the same way, so this is "add a link it
      never had," not "restore one." Nav / Market screen / deep-link only? ~30 min once decided.
- [ ] **G-6** (Intelligence · Marketing Hub · Document Builder) — API ready, no UI. Deferred unless the
      owner reverses it.

### B · Frontend adoption of the now-closed backend gaps → `API_GAPS_FRONTEND_ADOPTION.md`
Backend shipped these; the frontend still has the work-arounds. Do **Step 0 (regenerate `schema.d.ts`)**
first, then:
- [ ] **Access-request** (G-P34-1): treat 200 replay as success, handle 429. *(launch-gate half)*
- [ ] **G-LOCK-1**: wire `ConflictBanner` + `expected_version` on `LedgerEntryPage` and `RecordEditorPage`
      (both were last-write-wins).
- [ ] **CRM precision cluster** (G-P5-1/2/3/6/9/10): delete the hand-typed `detail` union, use nested
      `artwork`, deep-link `GET /crm/requests/{id}/`, drop the client hold-expiry, show `counter_amount`,
      pull viewing-mode labels from `/api/options/`.
- [ ] **G-P24-1**: curated chip reads `selection_name`. **G-P25-1**: questionnaire branches on `answered`
      (no more 404 special-case).
- [ ] Owner-decision UI (build only if wanted): G-P24-2 "selection ready" notice, G-P25-2 owner-editable
      questions, G-P5-4/5/11/12 (archive/withdraw/artist-link/activity read), G-P13-1 push opt-in,
      G-CLUB-3 invite-only auction admin toggle, Phase 5b Database-desk filters.

### C · Non-V1 backend gaps (Group B) — ✅ all shipped backend-side (B1–B5, 2026-09-24)
Every Group-B gap is now closed on `darz-backend-api` `development` (see `API_GAPS.md`). What remains
here is **frontend adoption** (the UI that consumes them) — tracked in `API_GAPS_FRONTEND_ADOPTION.md`,
not as a backend block:
- [x] Backend done: G-F1-1 (typed `detail` on the create schema), G-CHAT-2 (message archive), G-Q-1 +
      profile-edit (`PATCH /auth/me/`), G-MEMB-3/6/7 (`GET /auth/my-membership/`), G-DOC-1
      (`GET /documents/`), G-AUC-4 (auction archive), G-REC-1 (`?house=`), G-SALE-4 (`Sale.source`),
      G-HEALTH-2/3/4 (source_type / deleted count / created_after), auction `cover_image_url`, records
      `?section=` (found already served).
- [ ] Frontend adoption of the above → `API_GAPS_FRONTEND_ADOPTION.md`.

### D · Deferred / backend-blocked features (owner-scoped)
- [ ] **Auction Sales** — **unblocked** (G-SALE-4 shipped B5): `Sale.source` (market/auction) +
      `?source=` on the admin sales list. Build the tab by filtering `?source=auction`. (Backend note:
      no auction→Sale automation yet — an admin sets `source=auction`; a follow-up backend task is
      tracked in the API repo's TASKLIST.)
- [!] **Logistics & Payment desk** (backend Phase 20 — no `/api/logistics/` namespace exists).
- [!] **Library + pricelist builders** (backend Phase 21 — no standalone pricelist builder API).
- [!] **Insights & Stories** (backend Phase 22 — no editorial model).
- [ ] **Deploy Phase 14** — Vercel auto-deploys `main` (the old permission block cleared 2026-09-22).
      `DEPLOY_ARVAN.md` + `Dockerfile`/`nginx.conf` exist for an ArvanCloud option, but the `docker build`
      + deep-route `curl` have **not been run**. DNS/hosting cutover pends the real API URL and
      `darzmarket-api` Phase 18.

### E · Frontend-only follow-ups (backend ready — not API gaps)
- [ ] **G7 "Refine" filter panel** (12 dimensions, `refine_tags`) — frontend Phase 12+.
- [ ] **FE-R1…R4** — admin Records desk extras, highlight curation, import trigger, collector
      Past/Upcoming/Live/Highlights sub-tabs.
- [ ] Consume the legacy-id lookup / catalogue change-stamp endpoints when a surface needs them.

---

## Done — phase ledger (detail in `CHANGELOG.md` / `docs/archive/`)

| Phase | Status |
| --- | --- |
| 1 · Scaffold | ✅ Vite + React + TS, repo `ariandarz/-darz-web`. |
| 2 · Design system | ✅ Tokens/components ported from `app.html`; `ThemeController`; ADR-0001. |
| Design pass | ✅ Market App package re-skin (PR #15). |
| 3 · Typed API client + auth | ✅ OOP `HttpClient`/`ApiClient`/`AuthSession`/`ResourceService`; both principals; `/api/options/`. |
| 4 · Catalogue | ✅ Browse, toolbar, artwork detail, artist list/detail, `#dzGate` login, `ListController` base. |
| 5 · Requests + activity | ✅ All 8 request kinds, own-request list/detail, reply thread, `client_req_id`, activity logger. |
| 6 · Saved/favorites | ✅ `SavedController`/`SaveButton` over `is_saved`/`created` (no localStorage). |
| 7 · Admin catalog/crm/sales | ✅ Feed, team sign-in, sales CRUD, optimistic-lock wire-format fix (#85). |
| 8 · Auctions (collector) | ✅ Browse/bid/notifications/records; hidden in v0.1 behind `features.auctions`. |
| 9 · Profile/questionnaire/chat/settings/membership | ✅ All built (questionnaire + membership were the last two, #83). PWA push now unblocked (VAPID published) → see B. |
| 10 · Gallery Update Portal | ✅ Portal + admin desk + documents/PDF issue (2026-09-19). |
| 11 · Admin (Accounting, Owner Panel 11b, Projects 11c) | ✅ Accounting books+deals, audit log, Owner Panel desks, Projects suite. (Marketing/AI-Tagging/Doc-Builder = G-6, deferred.) |
| 12 · Catalogue core (admin) | ✅ Artworks/Artists/Published/Sales/Documents/Sources/Auctions-admin/Accounting steps. (Step 6 Auction Sales → D.) |
| Admin panel V1 | ✅ ~111 files, 52 routes; Requests parity, DB filters, polish, Phase 6b deletes (G-DEL-1), collector error boundary. |
| 13 · Testing | ✅ 620 unit + two E2E tiers (stub in CI, real-backend local); desk/collector walks are gates. CRUD-write/409 E2E needs a seeded CI backend. |
| 14 · Deploy | `[~]` Vercel live (visual-only); ArvanCloud guide written, not yet run. |
| — · Node 20 + admin code-split | ✅ 2026-09-24 (replaced the Node-22 floor; split shrank the bundle, cleared the chunk warning). |

---

## Notes for a new session
- Read `HANDOFF.md`, then this file, then `API_GAPS.md`.
- Regenerate `src/api/schema.d.ts` from a locally-running backend before trusting any API shape.
- Verify every screen you touch against a real render (`CLAUDE.md` rule 5) — source-reading isn't enough.
- Historical detail (old task log, per-phase plans, superseded gap docs) is in `docs/archive/`.
