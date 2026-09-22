# Handoff — start here

**Rewritten 2026-09-22, end of the session that shipped PRs #83, #84 and #85.**

`docs/TASKLIST.md` is the progress record and `docs/ADMIN_V1_AUDIT.md` is the plan. This file is
the two-minute version: where things stand, what is genuinely next, and the traps that have
already cost time.

---

## 1 · State

| | |
| --- | --- |
| `main` | `50215b3` (PR #84) |
| `development` | `05bf997` (PR #85) — **6 commits ahead of `main`** |
| Open PRs | none |
| Gate | **589 unit · 81 E2E** · typecheck · lint 0 · format · build |
| CI | Node **22** (both jobs) |
| Live | https://darz-web.vercel.app — auto-deploys `main`, so it does **not** yet have PR #85 |

**The admin panel and the collector app are functionally complete for V1.** Everything that was
unblocked has been built. What remains is either backend-blocked, owner-deferred, or one owner
decision (§3).

---

## 2 · What the last session shipped

**PR #83 / #84 — the collector app's Phase 9 line, and five admin items.**
The **questionnaire** (`/questionnaire`) and **membership** (Settings › Membership) screens, the
last two unbuilt Phase 9 items. Plus G-CLUB-2 + G-MEMB-1 (two admin count strips), G-HEALTH-1 (the
Data Health counts panel), TD-3 (the invoice bank block) and TD-8 (`admin.css` split into six
parts).

**PR #85 — Phase 7 and Phase 13 closed, and a real bug.**
See §4 for the bug. Also 40 component tests, and four "remaining" phases verified as dead ends.

---

## 3 · What is actually next

### Needs an owner decision — do not start without one

| Ref | Question |
| --- | --- |
| **Release** | `development` is 6 commits ahead of `main`. Say "release to main" to ship the lock fix, the component tests and the Node 22 CI fix. Merging is never a standing permission — ask per request (`CLAUDE.md`). |
| **API URL** | `.env.production` is the deliberate `api.invalid` placeholder, so the live site is **visual-only**: layout, routing, both themes and fonts are real; sign-in and data are not. This is the single biggest thing between the owner and a working site. |
| **i18n** | The only remaining buildable item — see `docs/TASKLIST.md`'s Phase 26 row for the full scoping. It is a real port (the old app ships `darz_i18n.js`, 31KB, with en · fa · fr · es · ar), **but the old app ships it OFF** and three answers are needed first: which languages ship, whether Farsi/Arabic get real **RTL layout** (the old CSS is LTR-only — guessing wrong means redoing the work), and whether the picker is visible. |
| **G-LOCK-1** | Backend: put the optimistic lock on Accounting and Auction Records. They are last-write-wins today, and `enforce_version` is only called from catalog, accounts, projects, crm and sales. A silent overwrite in the ledger costs money. |
| **G-6** | Intelligence · Marketing · Document Builder — deferred 2026-09-21. Still deferred unless the owner reverses it. |

### Backend-blocked — verified 2026-09-22, do not re-check

The API's complete namespace list is `accounting · admin · app-theme · auctions · auth · catalog ·
crm · dashboard · documents · gallery · health · marketing · notifications · options · projects ·
recommendations · sales`. Therefore:

- **Logistics & Payment (Phase 20)** — no `/api/logistics/` at all.
- **Library + pricelist builders (Phase 21)** — the only pricelist routes are the gallery-portal
  pair already built in Phase 10.
- **Insights & Stories (Phase 22)** — no endpoint.
- **Auction Sales (Step 6)** — `SaleAdmin` carries `seller_source` and `source_request`, but
  neither identifies an auction, and `sales_admin_sales_list` accepts `status` only.
- **PWA push** — the API publishes no VAPID public key.

### Open backend gaps, each recorded where its screen is

`G-Q-1` (no collector self-update) · `G-MEMB-3` (no membership expiry) · `G-MEMB-6` (no "my
membership" read — `tier` is the CRM segmentation every collector has) · `G-MEMB-7` (no
`expires_before=`; the one Memberships tile that drives an action) · `G-HEALTH-2/3/4` (no
`source_type` on an artwork, no deleted-row count, no `created_after`) · `G-DOC-1` (nowhere to edit
the studio's bank details except by issuing an invoice) · `G-SALE-4` · `G-CLUB-3` · `G-AUC-4` ·
`G-REC-1` · `G-CHAT-2`.

---

## 4 · Things believed and found false

**A claim in a doc or a file header is not evidence.** Check it against the backend or the browser.
Each of these cost real time:

- **The optimistic lock was silently OFF on three desks.** `updateCollector`, `updateTeamUser` and
  `updateMembershipCode` sent the field as `version`; the API wants `expected_version`, and it is
  **optional**, so the server skipped the lock and wrote anyway. Collectors, Memberships and **Team
  logins** were last-write-wins with no 409 — and on Team the raced field is `role`. TypeScript
  could not catch it: both spellings are a `number` and `version` is a real field on each model.
  `src/api/optimisticLock.test.ts` now pins the **wire format** for all six locking calls.
- **TD-3 proposed the one place the data must not go.** It said the invoice bank details "belong
  under `theme.*`". `GET /api/app-theme/` is **`AllowAny`** — a card number and IBAN there would be
  public. They now come from the last issued invoice's `Document.fields.bank`.
- **The old app's `dzMembPlanLabel` would have shown a VIP "Basic Access."** Its plans are
  `basic/premium/free`; this backend's are `CollectorTierEnum` (`vip · active · new ·
  institutional`). Choice labels come from `GET /api/options/` — never a hardcoded map.
- **The desk strip geometry was wrong on all eight strip desks.** `auto-fit` stretched the row
  full-width where the old `.ad-stats` is a fixed `repeat(6, 1fr)`. Invisible in source; only a
  capture comparison shows it.
- **The old app's questionnaire intro builds three Roman-numeral points and never renders them**
  (G-Q-2). Dead code is not a spec.
- **The E2E stub was lying** about `accounts.collector_tier` (served `standard`, not in the enum).
  When a screen misbehaves under the stub, ask first whether the stub is wrong.
- **`src/api/schema.d.ts` is stale** — it under-reports 409s. Regenerate against a running backend
  before trusting it for conflict behaviour.

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
`waitForURL('**/admin')` — never a regex like `/\/admin(\/|$)/`, which matches `/admin/login`
itself and walks every route logged out. Collector: `/login` opens on a landing state — click
**Enter the Room** first, then `input[name=firstName]` + `input[name=accessKey]`.

**Two harnesses worth knowing:**

- `node e2e/capture-desks.mjs` — screenshots all 34 admin desks at the reference settings.
- `node e2e/diff-desks.mjs <baseline-dir>` — compares a fresh capture set against a saved one.
  It compares **pixels, not bytes**: Chromium's PNG encoder is not byte-deterministic, so `cmp`
  reports changes that are not there (two of 34 did exactly that during the TD-8 split).

---

## 6 · The bug this repo keeps writing

Code reads `.map` / `.length` off a response, the field is not what was expected, the render throws,
and **the whole screen goes blank**. Eight instances by 2026-09-22.

It recurs because a `data &&` guard passes for *any* object, and because not every endpoint returns
the paginated envelope (`retrieve<X[]>` returns a bare array).

Reach for **`asArray()`** (`src/api/shapes.ts`) by default; `normaliseFacets` /
`normaliseLedgerSummary` when a response has real structure. `DeskBoundary` (admin) and
`ScreenBoundary` (collector) catch what slips through — they are a floor, not a substitute.

---

## 7 · House rules that are easy to miss

- **Two sources, always** (`CLAUDE.md`): the approved design package *and* the old code. A screen
  built from description alone is not a faithful port.
- **Verify against a rendered screen before calling one done.** Source-reading describes structure,
  not the rendered result.
- **A field the old app has and this backend cannot support is a flag, not a deletion.** Say so in a
  comment and to the owner.
- **Merging needs the owner to ask, per request.** "Keep things moving" is not authorisation.
- **Tests:** `vitest.config.ts` runs two projects — `logic` (`*.test.ts`, **node, no DOM**) and
  `components` (`*.test.tsx`, jsdom). The node project's lack of a DOM is deliberate: it is what
  proves `QuestionnaireController` and `bankDetails` survive a private window. Do not merge them.
- **Node 22 is the floor** (`engines`), because `jsdom@30` requires it. On Node 20 it fails
  *dishonestly* — the `.test.tsx` files never load and vitest still prints "549 passed".
- **Never bare `git stash`** in a worktree — the stack is shared with the main checkout.
