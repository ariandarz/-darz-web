# Overnight report — 2026-09-19

**For the owner's morning review.** Written under your instruction of 2026-09-18 ("move forward
on every task and open point that doesn't require me… including merging completed work… I'll
review those decisions in the morning"). Every merge below carries that instruction in its merge
commit. The default rule — open the PR and stop — is back in force as of this report.

---

## 1 · What landed (all gated, all live-verified, each merged after green CI)

| PR | What | State |
|---|---|---|
| #43 | Phase 11b Step 1 — Dashboard + Chat | merged |
| #44 | Phase 11b Step 2 — Collectors + Access keys + workspace | merged |
| #45 | Phase 11b Step 3 — Requests & Activity + Access Requests | merged |
| #46 | Phase 11b Step 4 — App Design (theme.features) + Memberships + Team | merged |
| #47 | Phase 11b Step 5 — Data Health + Import (CSV + Paste) | merged |
| #48 | Phase 11b Step 6 — Activity feed + Collector Club — **Phase 11b complete** | merged |
| #49 | Phase 12 Step 1 — **Artworks Database + editor + Artists** | merged |
| #50 | Phase 12 Step 2 — Published works + Market Sales | merged |
| #51 | Phase 12 Step 3 — Documents (Library/Proposals/Invoices + lifecycle + share links) | merged |
| #52 | Phase 13 **E2E harness** (CI tier) + Phase 12 Steps 4–7: **Galleries & Sources**, **Auctions admin + paddle queue**, **Auction Records**, **Accounting ledgers** | open — driving to green, will merge under the overnight instruction if CI passes before you wake |

Full detail per step: `docs/TASKLIST.md` (Phases 11b/12/13 sections) and `docs/CHANGELOG.md`.
The whole admin: 14 groups / 55 tabs — **every desk with a served backend is now live** except
the ones listed in §5.

## 2 · Routine decisions I took (review at leisure — none is hard to reverse)

- **Honest absences over dead buttons** throughout (the D15 pattern): unbuilt halves are a line
  of copy naming the reason, never a control that does nothing.
- **Published works tab counts "the public catalogue"** — found live that the collector list
  serves `visible_all` works only; Selected/Private-selection works reach collectors via the
  Club, and the desk says so rather than showing a number that undercounts silently (G-CAT-2).
- **Auction close semantics** — found live that `force` bypasses the *end time*, never the
  reserve (the engine never sells under reserve). The desk offers "Close early" until the
  scheduled end and the confirm states the whole rule.
- **The E2E suite is two-tier**: a stub smoke in CI (boot/shell/routing claims only) + the
  real-backend walks kept local by design. Its first two CI failures were diagnosed from the
  job's own logs and fixed (build-before-serve; ipv4 binds); a third, flaky-looking failure now
  uploads its own failure context as a CI artifact.
- **Local dev stack additions** (this machine only): moto-S3 stands in for MinIO
  (`dl.min.io` is egress-blocked here) and redis-server joined for the Channels lot broadcast.
- **Kit growth**: `Picker` promoted from the Club editor on its second consumer; `FilterChips`;
  query-aware shell sub-tabs (three Documents tabs share one pathname without regressing
  filtered desks).

## 3 · Decisions waiting on you (each also in `docs/ADMIN_ARCHITECTURE.md` §Open decisions)

| # | Question | My recommendation |
|---|---|---|
| **D17** | `theme.*` key names for the owner-controlled copy strings | take the old panel's own `app_theme` payload names, so migrating production theme is a copy |
| **D18** | The Document Studio's PDF renderer | `@react-pdf/renderer` (~0.5 MB) — everything else of the Documents desk already ships; only in-browser generation waits |
| **D19** | G-DOC-1 — no document ref on a collector thread | share-by-link is LIVE on the document page; raise `document_refs` with the backend when convenient |
| **D20** | Insights & Stories UI ahead of backend Phase 22 | only if you want it visibly soon |
| — | `/artists` entry link (the design-pass leftover, task #5) | still yours |

## 4 · Dev credentials touched tonight (all LOCAL DB only — nothing production)

You said you'd rotate keys; these are what exists: `desk@example.invalid` (owner) /
`standard@example.invalid` / `night-admin@example.invalid` — password `step0-verify`
(night-admin's was reset to it tonight); the "Night Gallery (II)" partner portal token+PIN
(shown once in the verify run); assorted dev artifacts (Night Work I/II artworks, a Night Sale
auction with one passed lot, an INV-2026-001 document, a Tehran Auction record, two ledger
entries in the Darz book). None of it leaves this machine.

## 5 · Still unbuilt, and why

- **Projects (Phase 11c)** — its own plan per the architecture doc (~2,300 lines of old source).
- **The Gallery Portal surface** (`/portal/{token}`) — the partner-facing no-login UI; the admin
  half shipped tonight and a real portal submission was verified against the API.
- **Accounting step 2** — private deals, attachments/receipts, Arian review, settlement.
- **Document Studio generation** — D18. · **Auction Sales tab** — no source axis on `Sale`
  (G-SALE-4), backend decision. · **History tab** — no audit feed (G-DOC-2).
- **Backend-blocked families** — Social · Logistics · Analytics · Languages · Strategy ·
  Automations · Intelligence (unchanged).
- **Owner-blocked** (untouched, as before): Vercel project/role; the 11 stale remote branches
  (GitHub 403s every ref deletion from here); darzstudio.art §94 + v1233 release; backend asks.

## 6 · New gaps recorded tonight (the build-around-never-fix rule held)

G-CAT-1…9 (catalogue), G-SALE-1…5 (sales), G-DOC-2 (documents), G-AUC-1…3 (auctions) — each
with its resolution in `docs/ADMIN_ARCHITECTURE.md` §7. No backend code was changed.

## 7 · Gate state at this report

typecheck clean · lint 3 pre-existing warnings · format clean · **215 unit tests** · 3 e2e
(green in CI as of the ipv4 fix; one flaky run under investigation via the new artifact upload)
· build clean. Local verify screenshots: `scratchpad/shots/step7/` (s7…s13).
