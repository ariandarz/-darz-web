# Handoff — start here

**Rewritten 2026-09-24; § 1 and § 3 updated 2026-09-26 for post-V1.** This is the two-minute version:
where things stand, what is genuinely next, and the traps that have already cost time.

`docs/DARZ_WEB_V1_STATUS.md` is the completed-V1 picture; `docs/TASKLIST.md` is the single source of truth
for *what's built and what's left*; `docs/API_GAPS.md` is the gap index; `docs/NOTES-FOR-ARIAN.md` is the owner's decision list. Historical
detail (old task log, per-phase plans, superseded gap docs) is in `docs/archive/`.

---

## 1 · State

| | |
| --- | --- |
| Branches | `main` and `development`; `development` is the working line. All V1 phase PRs (#102–#111) are merged into `development`; Phase 10 is `v1/phase-10-final`. `development` is ahead of `main` until the owner says "release development to main". |
| V1 | **Complete (2026-09-26).** The final picture — sections, routes, APIs, roles, gaps — is **`DARZ_WEB_V1_STATUS.md`** (final edition). |
| Backend | `darz-backend-api` `development` @ `df0421f` (PR #70) — the final V1 API, 323 operations. |
| API adoption | 261 Integrated · 1 Bound, no UI · 0 Not bound · 14 Excluded (owner-deferred) · 31 Excluded (not V1) · 15 Not needed · 1 Backend-only (`docs/audit/2026-09-25/API_ADOPTION_MATRIX.md`). |
| Gate | typecheck · lint 0 · format · **838 unit** (76 files) · build · **155 E2E** (collector 40 · desks 105 · portal 6 · smoke 4). Runs on **Node 20**. |
| Live | https://darz-web.vercel.app — auto-deploys **`main`**, **visual-only** until a real `VITE_API_BASE_URL` is set (Q-9). |

**The collector app, the gallery portal and the admin panel are built and bound for V1.** What remains is
owner decisions, backend defects and post-V1 features — see § 3.

---

## 2 · What the recent sessions shipped

- **The whole V1 backend gap set closed** (`darz-backend-api`, 2026-09-24): access-request hardening
  (rate-limit + dedupe), optimistic lock on accounting/auction-records (G-LOCK-1), the CRM precision
  cluster, curated-selection name + change signal, questionnaire 200 + owner-editable question set,
  VAPID key, invite-only auctions (G-CLUB-3), and the Phase-5b admin filters. See its `docs/CHANGELOG.md`.
- **Node-20 support** (this repo): jsdom pinned to 29 (jsdom 30 needs Node 22), `engines`/CI/Dockerfile/
  `.nvmrc` moved to Node 20, vitest kept at 5 (security). 620/620 tests pass on Node 20.
- **Admin panel code-split**: every admin page is `React.lazy` (`src/routes.tsx`), a `<Suspense>` in
  `AdminShell`; main bundle 976→539 kB, chunk-size warning cleared.
- **Docs consolidation**: `API_GAPS.md` (gap source of truth) + `API_GAPS_FRONTEND_ADOPTION.md`
  created, `TASKLIST.md` rewritten, 14 historical docs moved to `docs/archive/`.

---

## 3 · What is actually next (post-V1)

V1 is done; there is no frontend V1 queue left. Start from **`DARZ_WEB_V1_STATUS.md` § Remaining gaps**, and
work in this order:

1. **Owner decisions** (`V1_CONTRACT_ISSUES.md` § C, `NOTES-FOR-ARIAN.md`) — nothing below starts without one:
   - **Q-9 · real `VITE_API_BASE_URL`** — the live site is visual-only until it is set. The single biggest
     thing between the owner and a working site.
   - **Q-5 remainder, API ready:** G-P24-2 selection-ready notice · G-P25-2(b) question-set editor · G-P5-4
     archive · G-P5-5 withdraw/cancel · G-P5-12 activity read-back · G-P13-1 push · G-CLUB-3 Club "Auction
     access" · G-P5-9 counter-offer (**Q-4** wording). Each is a small phase of its own
     (`v1/phase-9x-<slug>` pattern, same gate/stub/render/docs rules).
   - **Q-2** project money UI-only · **Q-8** G-6 stays deferred · C-18 validation copy · request-kind wording ·
     i18n (G-I18N-1) · `/artists` menu entry.
2. **Backend defects to raise** (`V1_CONTRACT_ISSUES.md` § B, final status column): **C-13 security** before
   any real portal link, **C-19** WSGI (no auction WebSockets in prod), **C-6** lock 500s, **C-23** chat attach
   re-homes documents, **C-24** Awaiting-approval over-count, **C-25** extend does not revive a lapsed key;
   the rest have FE work-arounds in place.
3. **Small FE follow-ups:** the portal "Save draft" (the one Bound-no-UI operation), `isPathAllowed`
   cleanup, the post-V1 candidates in the matrix.
4. **Post-V1 features with no backend:** Logistics, Library, Insights & Stories, the Social suite — owner-
   scoped, `TASKLIST.md` § D.

When the backend moves past `df0421f`: regenerate `src/api/schema.d.ts`, re-run the matrix method (header of
`API_ADOPTION_MATRIX.md`; Phase 10's script approach is described in its Summary), and update the stub in the
same PR.

---

## 4 · Things believed and found false

**A claim in a doc or a file header is not evidence.** Check it against the backend or the browser.
Each of these cost real time:

- **`src/api/schema.d.ts` goes stale fast** — the V1 backend work changed many shapes and added
  endpoints. **Regenerate it before trusting any API shape or conflict (409) behaviour.**
- **The optimistic lock was silently OFF on three desks.** `updateCollector`, `updateTeamUser` and
  `updateMembershipCode` sent the field as `version`; the API wants `expected_version`, and it is
  **optional**, so the server skipped the lock and wrote anyway. `src/api/optimisticLock.test.ts` now
  pins the **wire format** for all eight locking calls (six until G-LOCK-1 added the ledger entry and the auction record, 2026-09-25).
- **TD-3 proposed the one place the data must not go.** Invoice bank details "belong under `theme.*`" —
  but `GET /api/app-theme/` is **`AllowAny`**, so a card number/IBAN there would be public. They come
  from the last issued invoice's `Document.fields.bank`.
- **`dzMembPlanLabel` would have shown a VIP "Basic Access."** Choice labels come from
  `GET /api/options/` — never a hardcoded map (`CollectorTierEnum`, not `basic/premium/free`).
- **The desk strip geometry was wrong on all eight strip desks** — `auto-fit` stretched where the old
  `.ad-stats` is a fixed `repeat(6, 1fr)`. Invisible in source; only a capture comparison shows it.
- **The E2E stub was lying** about `accounts.collector_tier`. When a screen misbehaves under the stub,
  ask first whether the stub is wrong.
- **A sibling session's report is not about this repo until proven** — one cited PR numbers that all
  exist here while working on a different repository. Check primary sources before pausing for overlap.
- **`npm run format` does not cover `docs/`.** `format:check` is `"src/**/*.{ts,tsx,css}" "*.{ts,json,html}"`.
  Editing Markdown with prettier reflows hundreds of unrelated lines. Edit Markdown by hand.

---

## 5 · How to see a screen (the unlock)

**Do not try to run the real backend for visual work** — the only `TeamUser` is `owner@darz.local`
and its password is recorded nowhere. Use the E2E stub:

```bash
node e2e/stub-server.mjs &                                      # :8787
npm run e2e:build                                               # builds against the stub
npx vite preview --outDir dist-e2e --host 127.0.0.1 --port 4173 --strictPort &
```

Then drive it with Playwright. On a machine without the pinned browser, point at the installed one:
`export PW_CHROMIUM=/opt/pw-browsers/chromium-*/chrome-linux/chrome`.

**Sign-in, exactly.** Panel: `/admin/login`, `input[name=email]` + `input[name=password]`, then
`waitForURL('**/admin')` — never a regex like `/\/admin(\/|$)/`, which matches `/admin/login` itself
and walks every route logged out. Collector: `/login` opens on a landing state — click **Enter the
Room** first, then `input[name=firstName]` + `input[name=accessKey]`.

**Two harnesses worth knowing:**
- `node e2e/capture-desks.mjs` — screenshots all 34 admin desks at the reference settings.
- `node e2e/diff-desks.mjs <baseline-dir>` — compares a fresh capture against a saved one, in
  **pixels not bytes** (Chromium's PNG encoder is not byte-deterministic).

---

## 6 · The bug this repo keeps writing

Code reads `.map` / `.length` off a response, the field is not what was expected, the render throws,
and **the whole screen goes blank**. Eight instances by 2026-09-22.

It recurs because a `data &&` guard passes for *any* object, and because not every endpoint returns
the paginated envelope (`retrieve<X[]>` returns a bare array).

Reach for **`asArray()`** (`src/api/shapes.ts`) by default; `normaliseFacets` / `normaliseLedgerSummary`
when a response has real structure. `DeskBoundary` (admin) and `ScreenBoundary` (collector) catch what
slips through — a floor, not a substitute.

---

## 7 · House rules that are easy to miss

- **Two sources, always** (`CLAUDE.md`): the approved design package *and* the old code. A screen built
  from description alone is not a faithful port.
- **Verify against a rendered screen before calling one done.** Source-reading describes structure, not
  the rendered result.
- **A field the old app has and this backend cannot support is a flag, not a deletion.** Say so in a
  comment and to the owner.
- **Merging needs the owner to ask, per request.** "Keep things moving" is not authorisation, and
  neither is the owner marking a PR ready for review.
- **Tests:** `vitest.config.ts` runs two projects — `logic` (`*.test.ts`, **node, no DOM**) and
  `components` (`*.test.tsx`, jsdom). The node project's lack of a DOM is deliberate — it proves
  `QuestionnaireController` and `bankDetails` survive a private window. Do not merge them.
- **Node 20 is the supported runtime** (`engines` `^20.19 || …`). `jsdom` is pinned to **29** for this;
  jsdom 30 needs Node 22 and its `.test.tsx` workers fail to spawn on 20. `vitest` stays at 5 (security).
- **Never bare `git stash`** in a worktree — the stack is shared with the main checkout.
- **Every env value comes from `.env`** — `resolveBaseUrl()` throws when `VITE_API_BASE_URL` is unset.
  No hardcoded fallbacks, ever.
