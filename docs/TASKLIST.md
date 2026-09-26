# Darz Market Web — Task List (single source of truth)

**Last updated: 2026-09-26 (V1 Phase 10 — V1 complete).** This is the one place for *what is built and what is left*. It replaces
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
| Branches | `main` and `development`; `development` is the working line. **All V1 phases (0–9a, PRs #102–#111) are merged into `development`**; Phase 10 is `v1/phase-10-final`. |
| V1 | **Complete** — `V1_IMPLEMENTATION_PLAN.md` §5 ticked through Phase 10. The final picture is **`DARZ_WEB_V1_STATUS.md`** (final edition). |
| API adoption | 323 V1 operations: **261 Integrated · 1 Bound, no UI · 0 Not bound · 14 Excluded (owner-deferred) · 31 Excluded (not V1) · 15 Not needed · 1 Backend-only** (`docs/audit/2026-09-25/API_ADOPTION_MATRIX.md`, re-verified against the code). |
| Backend | `darz-backend-api` `development` @ `df0421f` (PR #70) — the final V1 API. Open defects: `V1_CONTRACT_ISSUES.md` § B (C-6…C-25). |
| Gate | typecheck · lint 0 · format · **838 unit** (76 files) · build · **155 E2E** (collector 40 · desks 105 · portal 6 · smoke 4). Runs on **Node 20**. |
| Live site | https://darz-web.vercel.app — Vercel auto-deploys `main`, **visual-only** until a real `VITE_API_BASE_URL` is set (Q-9). |

**V1 is built.** What remains is owner decisions, backend defects, and post-V1 features — below, and in
`DARZ_WEB_V1_STATUS.md` § Remaining gaps.

---

## Open work

> The 2026-09-25 V1 plan (`V1_IMPLEMENTATION_PLAN.md`, Phases 0–10) absorbed the old Batches 4–8 and the
> old sections B–E; they are done or have a recorded final disposition. What is left:

### A · Owner decisions (nothing below starts without one) — see `NOTES-FOR-ARIAN.md` and `V1_CONTRACT_ISSUES.md` § C
- [ ] **Real `VITE_API_BASE_URL`** (Q-9) — `.env.production` is the deliberate `api.invalid` placeholder, so
      the live site has no sign-in/data. **The single biggest blocker to a working site.**
- [ ] **Raise C-13 (security) with the backend before any real portal link is issued.**
- [ ] **Q-5 remainder — owner-deferred, API ready:** G-P24-2 selection-ready notice · G-P25-2(b) question-set
      editor · G-P5-4 archive · G-P5-5 withdraw/cancel · G-P5-12 activity read-back · G-P13-1 push opt-in ·
      G-CLUB-3 Club "Auction access" section · G-P5-9 counter-offer display (**Q-4**: wording).
- [ ] **Q-2** — project money / internal notes hidden in the UI only; ask the backend to strip them?
- [ ] **C-18 copy** — confirm the placeholder auction/lot window validation messages.
- [ ] **Request-kind wording** — the collector-facing kind words are the old copy, not `/api/options/`.
- [ ] **i18n (G-I18N-1)** — the engine ships OFF. Which languages, a real RTL pass, is the picker visible?
- [ ] **`/artists` has no menu entry** — as in the old app.
- [ ] **G-6 (Q-8)** — Intelligence · Marketing Hub · Document Builder stay not V1 unless reversed.

### B · Backend defects to raise on `darz-backend-api` → `V1_CONTRACT_ISSUES.md` § B
- [ ] **C-13** security · **C-19** WSGI Dockerfile (no auction WebSockets) · **C-6** lock 500s · **C-23**
      chat attach re-homes documents · **C-24** Awaiting-approval over-count · **C-25** extend does not
      revive a lapsed key · C-7, C-8, C-9, C-10, C-11, C-12, C-14, C-16, C-18, C-21 (the FE works around each).

### C · Frontend follow-ups (post-V1, small)
- [ ] Portal **"Save draft"** of a services selection (the one Bound-no-UI operation).
- [ ] Remove or wire `adminNav.isPathAllowed` (unused).
- [ ] Post-V1 candidates recorded in the matrix: legacy-id deep-link redirect, a `change-stamp` poller, the
      Database Refine filters (G7), FE-R1…R4 Records extras.

### D · Deferred / backend-blocked features (owner-scoped)
- [!] **Logistics & Payment desk** (backend Phase 20 — no `/api/logistics/` namespace).
- [!] **Library + pricelist formatting** (backend Phase 21; P3c formatted download).
- [!] **Insights & Stories** (backend Phase 22 — the nav tab stays hidden until a story can be published).
- [!] Social suite, Strategy, Automations, Languages, Analytics, Team Workspace, "Notify collectors"
      (no push-send endpoint), portal referral / drawn signature / offer engine.
- [ ] **Deploy Phase 14** — Vercel auto-deploys `main`; the ArvanCloud `docker build` + deep-route `curl`
      have **not been run**. DNS/hosting cutover pends the real API URL and `darzmarket-api` Phase 18.

### Done in V1 (was open on 2026-09-24)
- [x] Frontend adoption of every closed V1 and Group-B gap (Batches 1–8 → V1 Phases 0–9a).
- [x] Auction Sales (Phase 2) · Owner Access desk G-KEY-1 (Phase 8) · chat `document_refs` (Phase 6).
- [x] G-P24-1 chip name (Phase 1) · G-P25-1 questionnaire `answered` (Phase 0) · Phase 5b Database filters
      (Phase 4) · G-P5-11 artist link and G-P25-2(a) served question set (Phase 9a).
- [x] Phase 10: matrix re-verified, cross-cutting fixes, final `DARZ_WEB_V1_STATUS.md`.

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
| V1 · Phases 0–10 | ✅ 2026-09-25/26 (PRs #102–#111 + Phase 10): schema regen and live bugs, collector account, Sales + Auction Sales, auctions admin, catalogue/collectors, gallery portal P1/P3/P4, documents + chat, projects, owner Access desk, owner extras, final verification. See `V1_IMPLEMENTATION_PLAN.md` §5 and `DARZ_WEB_V1_STATUS.md`. |

---

## Notes for a new session
- Read `HANDOFF.md`, then this file, then `DARZ_WEB_V1_STATUS.md` and `API_GAPS.md`.
- Regenerate `src/api/schema.d.ts` from a locally-running backend before trusting any API shape.
- Verify every screen you touch against a real render (`CLAUDE.md` rule 5) — source-reading isn't enough.
- Historical detail (old task log, per-phase plans, superseded gap docs) is in `docs/archive/`.
