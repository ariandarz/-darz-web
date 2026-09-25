# Handoff — start here

**Rewritten 2026-09-24.** This is the two-minute version: where things stand, what is genuinely
next, and the traps that have already cost time.

`docs/TASKLIST.md` is the single source of truth for *what's built and what's left*; `docs/API_GAPS.md`
is the gap index (fixed/pending); `docs/NOTES-FOR-ARIAN.md` is the owner's decision list. Historical
detail (old task log, per-phase plans, superseded gap docs) is in `docs/archive/`.

---

## 1 · State

| | |
| --- | --- |
| Branches | `main` and `development` kept level; `development` is the working line. |
| Last landed | Node-20 support (jsdom 29, engines/CI/Dockerfile/.nvmrc) + admin panel code-split (main bundle 976→539 kB) + docs consolidation. |
| Backend | `darz-backend-api` `development` @ `5f6d7ea` — **every V1 API gap is closed** (see `API_GAPS.md`). |
| Gate | **620 unit** (56 files) · **82 E2E** (collector 25 · desks 54 · smoke 3) · typecheck · lint 0 · format · build · `npm audit` **0**. Runs on **Node 20**. |
| Live | https://darz-web.vercel.app — auto-deploys **`main`**, **visual-only** until a real `VITE_API_BASE_URL` is set. |

**The admin panel and the collector app are functionally complete for V1, and every buildable task is
built and merged.** What remains is owner decisions, frontend adoption of the now-closed backend work,
the non-V1 backend gaps, and backend-blocked/deferred features — all in `TASKLIST.md` § Open work.

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

## 3 · What is actually next

**The frontend has not yet adopted the closed backend work** — that is the main queue now.
**`docs/API_ADOPTION_PLAN.md` is the batch order (one PR per batch — resume at the first unticked one)**;
`docs/API_GAPS_FRONTEND_ADOPTION.md` is the per-gap detail. **Step 0 is regenerate `src/api/schema.d.ts`**
from a running backend, then work the typecheck flags. Highlights: handle the access-request 200/429,
wire `ConflictBanner` on the two G-LOCK-1 desks, delete the hand-typed `detail` union, use the nested
`artwork`, pull viewing-mode from `/api/options/`, chip `selection_name`, questionnaire `answered`.

**Needs an owner decision — do not start without one** (`NOTES-FOR-ARIAN.md`):

| Ref | Question |
| --- | --- |
| **API URL** | `.env.production` is the `api.invalid` placeholder → the live site is visual-only. The single biggest thing between the owner and a working site. One line changes. |
| **i18n — G-I18N-1** | Engine built and off. Which languages ship; does RTL get a real layout audit (our CSS never has; the old engine ships an RTL override sheet this port lacks); is the picker visible? Recommendation on file: **Farsi first, with a real RTL pass.** |
| **`/artists` menu entry** | Exists at `/artists`, nothing links to it (the old app orphans it too). Nav / Market screen / deep link only? ~30 min. |
| **G-6** | Intelligence · Marketing · Document Builder — API ready, no UI. Deferred unless reversed. |

**Non-V1 backend gaps (Group B) — ✅ all shipped backend-side 2026-09-24** (B1–B5; see
`../darzmarket-api/docs/GROUP_B_API_GAPS_PLAN.md` and `API_GAPS.md`). What's left is **frontend
adoption** of them → `API_GAPS_FRONTEND_ADOPTION.md`: G-F1-1 · G-CHAT-2 · G-Q-1 + profile-edit ·
G-MEMB-3/6/7 · G-DOC-1 · G-AUC-4 · G-REC-1 · G-SALE-4 · G-HEALTH-2/3/4. **Auction Sales** is now
unblocked (filter `?source=auction`). **Still backend-blocked/deferred:** Logistics (Phase 20),
Library/pricelist (Phase 21), Insights & Stories (Phase 22). **The three 2026-09-24 backend candidates
are now ALL shipped & merged (2026-09-25, PRs #49/#50/#51 — backend `development` @ `57d408c`):**
`document_refs` on `RequestMessage` (attach a document into a thread, team-only, attach = share),
the roster-wide `GET /api/auth/admin/access-keys/` list + `…/summary/` (G-KEY-1), and auction→Sale
automation (a won lot auto-creates a draft `Sale(source=auction)`). All three now need **frontend
adoption** → `API_GAPS_FRONTEND_ADOPTION.md`.

---

## 4 · Things believed and found false

**A claim in a doc or a file header is not evidence.** Check it against the backend or the browser.
Each of these cost real time:

- **`src/api/schema.d.ts` goes stale fast** — the V1 backend work changed many shapes and added
  endpoints. **Regenerate it before trusting any API shape or conflict (409) behaviour.**
- **The optimistic lock was silently OFF on three desks.** `updateCollector`, `updateTeamUser` and
  `updateMembershipCode` sent the field as `version`; the API wants `expected_version`, and it is
  **optional**, so the server skipped the lock and wrote anyway. `src/api/optimisticLock.test.ts` now
  pins the **wire format** for all six locking calls.
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
