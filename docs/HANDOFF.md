# Handoff — start here

**Rewritten 2026-09-23, after PRs #86-#90 all merged to `development`. No work is in flight.**

`docs/TASKLIST.md` is the progress record, `docs/ADMIN_V1_AUDIT.md` is the admin plan, and
`docs/NOTES-FOR-ARIAN.md` is the owner's decision list. This file is the two-minute version: where
things stand, what is genuinely next, and the traps that have already cost time.

---

## 1 · State

| | |
| --- | --- |
| `main` | `50215b3` (PR #84) |
| `development` | `f580eed` (PR #90) — **18 commits ahead of `main`** |
| Working branch | `claude/kind-ptolemy-vntmfh`, cut from `f580eed`; carries this doc sync only |
| Open PRs | none at the time of writing (the doc-sync PR is the exception, if still open) |
| Gate | **620 unit** (56 files) · **82 E2E** (collector 25 · desks 54 · smoke 3) · typecheck · lint 0 · format · build · `npm audit` **0** |
| CI | Node **22** both jobs · `push` on `main` only · concurrency cancels superseded PR runs · actions `@v5` |
| Live | https://darz-web.vercel.app — auto-deploys **`main`**, so it has **none** of the 18 commits |

**The admin panel and the collector app are functionally complete for V1, and every buildable task
is built and merged.** What remains is backend-blocked, owner-deferred, or one of the four owner
decisions in §3.

---

## 2 · What the last two sessions shipped

**PR #83 / #84 — the collector app's Phase 9 line, and five admin items.**
The **questionnaire** (`/questionnaire`) and **membership** (Settings › Membership) screens, the
last two unbuilt Phase 9 items. Plus G-CLUB-2 + G-MEMB-1 (two admin count strips), G-HEALTH-1 (the
Data Health counts panel), TD-3 (the invoice bank block) and TD-8 (`admin.css` split into six
parts).

**PR #85 — Phase 7 and Phase 13 closed, and a real bug.**
The silently-disabled optimistic lock on three admin editors (§4). Also 40 component tests, and
four "remaining" phases verified as dead ends.

**PR #86 — this file's previous rewrite**, plus `Segment` and `Toast` component tests.

**PR #87 — vitest 3 → 5**, clearing `GHSA-82fw-gwwq-j7x9` (a dev-only path-traversal advisory in
`vite`'s dev server). `npm audit` is 0, dev and prod.

**PR #88 — the i18n engine, shipped OFF**, exactly as the old app ships it. `src/i18n/`: the old
registry (`en · fa · fr · es · ar`), the 144-entry dictionary ported verbatim, `I18nController` on
the shared `Observable` base, `useT()`, and `<html lang/dir>` at boot. Two decisions remain before
the ~430 call sites are wired — **G-I18N-1**, §3.

**PR #89 — `docs/NOTES-FOR-ARIAN.md`**, the four open owner decisions in one place.

**PR #90 — CI stops running the gate twice.** A release PR has `development` as its head, so every
push to it fired `push` *and* `pull_request` on the same commit: the whole gate, twice, ~18 wasted
minutes per release. `push` now lists `main` only (`pull_request` already runs against the *merge*
commit, so nothing is tested less), a `concurrency` group cancels superseded PR runs, and every
action is pinned `@v5` (`v4` runs on Node 20, deprecated 2025-09-19).

**All eight of those merges were done by the owner personally** — no merge was made from a session.

---

## 3 · What is actually next

### Needs an owner decision — do not start without one

| Ref | Question |
| --- | --- |
| **Release** | `development` is **18 commits ahead of `main`**, so the live site has none of it. Say "release to main" and the whole thing runs: PR → CI → merge → merge-back → confirm level → confirm Vercel deployed. Merging is never a standing permission — ask per request (`CLAUDE.md`). |
| **API URL** | `.env.production` is the deliberate `api.invalid` placeholder, so the live site is **visual-only**: layout, routing, both themes and fonts are real; sign-in and data are not. This is the single biggest thing between the owner and a working site. One line changes. |
| **i18n — G-I18N-1** | The engine is built and off. Three answers unblock the rest: **which languages ship**, whether Farsi/Arabic get a **real RTL layout audit** (our CSS has never been audited; the old engine ships an RTL override sheet this port does not carry — guessing wrong means redoing the work), and whether the picker is visible. Recommendation on file: **Farsi first, with a real RTL pass.** |
| **`/artists` menu entry** | The artist index exists at `/artists` and nothing links to it. Nav, Market screen, or deep link only? ~30 minutes once answered. |
| **G-LOCK-1** | Backend: put the optimistic lock on Accounting and Auction Records. They are last-write-wins today — `enforce_version` is called only from catalog, accounts, projects, crm and sales. A silent overwrite in the ledger costs money. |
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

### Buildable without anyone — the honest remainder

Nothing is queued. The only frontend work that does not need an answer first is **Phase 5b** (the
Database desk's four hard filters — completeness, size ranges, duplicate images, Gallery Portal),
and that needs backend work before the frontend has anything to call; the desk already names those
filters as unavailable.

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
- **A sibling session's report is not about this repo until proven.** One was titled *"Stop CI
  running twice per pull request"* and cited PR numbers that all exist here — it was working on a
  different repository. Three primary-source checks settled it (this repo's `quality.yml` was
  untouched; our PR of that number had a different subject; our PR carried no comment from it).
  Check before pausing work for an overlap, and check before assuming one.
- **`npm run format` does not cover `docs/`.** `format:check` is
  `prettier --check "src/**/*.{ts,tsx,css}" "*.{ts,json,html}"` — running prettier over `docs/`
  reflows hundreds of unrelated lines and CI never asked for it. Edit Markdown by hand.

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
- **Merging needs the owner to ask, per request.** "Keep things moving" is not authorisation, and
  neither is the owner marking a PR ready for review.
- **Tests:** `vitest.config.ts` runs two projects — `logic` (`*.test.ts`, **node, no DOM**) and
  `components` (`*.test.tsx`, jsdom). The node project's lack of a DOM is deliberate: it is what
  proves `QuestionnaireController` and `bankDetails` survive a private window. Do not merge them.
- **Node 22 is the floor** (`engines`), because `jsdom@30` requires it. On Node 20 it fails
  *dishonestly* — the `.test.tsx` files never load and vitest still prints a green count.
- **Never bare `git stash`** in a worktree — the stack is shared with the main checkout.
- **Every env value comes from `.env`** — `resolveBaseUrl()` throws when `VITE_API_BASE_URL` is
  unset. No hardcoded fallbacks, ever.
