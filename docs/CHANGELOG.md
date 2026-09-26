# Changelog — Darz Market Web

Format rule: **one entry per task/step, at most 3 lines.** Line 1 = date + what was done.
Newest first. Add an entry whenever a task in `docs/TASKLIST.md` moves to done (`[x]`).

---

## 2026-09-26 — V1 Phase 7: Projects quick/partner, status, stage sub-state, FX + totals

- List quick cards ride `?quick=` (only "Deliverables ≤7d" walks); record Status `<select>` saves `status`; a stage move PATCHes the old `setStage` seeding (`moveStages`) then moves; Delayed/Awaiting read real counts; owner FX block + server totals panel (decimal strings, "No currency", converted row). New C-24 (awaits-approval predicate). Stale G-PROJ notes removed.
- Matrix: totals → Integrated (258/0/9/55/1). **802 unit · 148 E2E** (desks 100). Deviations: `V1_IMPLEMENTATION_PLAN.md` §3h.

## 2026-09-25 — V1 Phase 6: document history/share/owner-lock, chat document_refs, message archive

- Document page: per-document History (G-DOC-2, flat actor C-15), Share with collector / Stop sharing (G-DOC-1), `owner_lock` disables the guarded moves for a standard admin with the reason; nav "Library & history" restored, History tab stays hidden (per-document feed). Admin chat: Attach document (D19 `document_refs`, never another collector's doc), chips on both threads, per-message Archive/Restore + "Include archived" (G-CHAT-2).
- Matrix: 4 Not bound + 2 Partial → Integrated (257/0/9/56/1). **783 unit · 140 E2E** (collector 38, desks 92). Deviations: `V1_IMPLEMENTATION_PLAN.md` §3g.

## 2026-09-25 — V1 Phase 5: gallery portal (P1/P3/P4), Sources desk, exhibition catalogue

- Portal: typed/normalised state (C-8), work images + cover, Replace image (multipart, PIN in form, C-9), Ask + Remove-from-portal (withdraw), server Sent pills / Pending review / History, pricelist status + builder. Desk: server partner search, Regenerate (reissue), pricelist file/lines/status/cap, ask/withdraw/image review copy, new Service checklist desk (catalogue CRUD, lock), compose quantity, service descriptions via API.
- Matrix: 9 ops → Integrated (251/2/9/60/1). **765 unit · 133 E2E** (portal 6, desks 86). Deviations: `V1_IMPLEMENTATION_PLAN.md` §3f.

## 2026-09-25 — V1 Phase 4: Database, Artists, Published, Collectors, Club, Data Health, Dashboard

- Database rows lead with `thumb` + `artist_name`; Gallery Portal / Duplicates / Details / Size filters (list + facets), `source_type`/`created_after` link chips; publish `details.missing` → the old refusal popup (row + editor). Artists: server search/sort/pager + Works. Published: admin `?published=true`. Collectors: `summary/` strip + Recently active / Most purchases. Club cover from `thumb`. Data Health: all nine boxes in three bands, linked. Dashboard catalogue tiles link.
- Matrix: 1 op → Integrated (242/2/9/69/1). **739 unit · 119 E2E** (desks 78). Deviations: `V1_IMPLEMENTATION_PLAN.md` §3e.

## 2026-09-25 — V1 Phase 3: auctions admin (edit, lot edit, archive, poster, reset, house) + collector cover

- Auction page ports the old Manage-auction modal: poster upload/remove, details + terms form (locked PATCH, ConflictBanner, read-only past scheduled, C-18 checks), lot edit; Live Auctions walks all pages, "Show archived" + Archive/↩ Restore, poster thumbs; Register to Bid ↺ Reset; Records "All auction houses" (`?house=`). Collector cards read `cover_image_url` (per-card lot read gone); event lots get loading/empty states. C-19 already degrades (poll + notice).
- Matrix: 7 ops → Integrated (241/2/9/70/1). **720 unit · 111 E2E** (desks 70). Deviations: `V1_IMPLEMENTATION_PLAN.md` §3d.

## 2026-09-25 — V1 Phase 2: Sales desk (summary, filters, follow-up, notes) and Auction Sales

- Market Sales: strip from `summary/` (+ Need attention = overdue follow-ups), search + Stage/Payment/Delivery/Source/Sort; deal page gains follow-up set/clear, append-only notes, Source/Lot rows, Delete deal. Auction Sales at `/admin/sales?source=auction`, each sale linking to its lot. Stale G-SALE notes removed.
- Stub serves a two-sale ledger (market + auction with lot), summary, follow-up, notes. **697 unit · 101 E2E** (desks 62). Deviations: `V1_IMPLEMENTATION_PLAN.md` §3c.

## 2026-09-25 — V1 Phase 1: collector account (profile edit, my-membership, documents, chip, G-Q-1, legal links)

- Profile › Account is editable via `PATCH /auth/me/` (`AuthService.updateMe`, session `me` refreshed); "Your documents" (G-DOC-1) ported from `dzDocsSectionHTML`; Settings membership row + sheet read `/auth/my-membership/`; chip shows `selection_name`; questionnaire writes phone/lang; legal links use `/documents/public/{kind}/`; "Make an offer" hidden without a currency (Q-6); Profile tiles wait with `.dz-state`.
- Stub reads request bodies (and now answers a cold-load refresh with the right principal). **677 unit · 97 E2E** (collector 35).

## 2026-09-25 — V1 Phase 0: schema regen + four live bugs (C-1…C-5)

- `schema.d.ts` regenerated from backend `df0421f`. Sales desk reads the nested G-SALE-3 rows; `ProjectStatus` is aliased through the field (C-2); the questionnaire and Profile card branch on `answered` (C-3); a portal entry error no longer freezes the gate (C-4).
- `walkPages` moved to `src/api/paging.ts` and used wherever a list was read as one oversized page (C-5); `Locked<T>` for required locks. **647 unit · 89 E2E** (+Artists-past-100, +Sales-nested walks).

## 2026-09-25 — V1 re-baseline: both repos synced, gap docs re-measured, phased V1 plan written

- Backend V1 = `darz-backend-api` `development` @ `df0421f` (224 paths / 323 ops); web `development` holds every branch. Matrix, admin, collector and backend-contract audits in `docs/audit/2026-09-25/`.
- New `V1_IMPLEMENTATION_PLAN.md` (Phases 0–10), `V1_CONTRACT_ISSUES.md` (C-1…C-22, Q-1…Q-9), baseline `DARZ_WEB_V1_STATUS.md`; `API_GAPS.md` + `API_GAPS_FRONTEND_ADOPTION.md` re-baselined. Docs only; gate unchanged (636 unit).

## 2026-09-25 — API adoption Batch 3: thread deep link, viewing-mode labels, hold-expiry backstop

- A deep link to a thread reads its one request (`GET /crm/requests/{id}/`, G-P5-3); ViewingSheet labels come from `crm.viewing_mode` (G-P5-10); the client hold check is now a documented backstop (G-P5-6).
- **G-P5-9 not built** — the old app and the package have no counter-offer UI or copy; an owner question. **636 unit · 87 E2E**.

## 2026-09-25 — API adoption Batch 2: the lock on the ledger entry and auction-record editors (G-LOCK-1)

- **Both PATCHes now send `expected_version`** — the backend made it *required*, so every ledger/record edit was failing (a 500) until this. A stale save shows `ConflictBanner`; Reload re-reads the row.
- `optimisticLock.test.ts` pins 8 calls (was 6); two desk E2E walks assert the lock on the wire and the banner. **630 unit · 86 E2E**.

## 2026-09-25 — API adoption Batch 1: schema regen, typed request detail, nested artwork, access-request replay/429

- **`schema.d.ts` regenerated** from backend `development` @ `021ce07`; the 11 flags fixed. Hand-typed `detail` union → generated (G-P5-1/G-F1-1); Chat/Profile/Acquisitions read the nested artwork (G-P5-2).
- **Request access** treats a 200 replay as success, reuses one `client_req_id` per submission, and shows a sentence on 429 (G-P34-1/2). Stub serves nested rows; **628 unit · 84 E2E**.

## 2026-09-23 — The docs are brought level with what is merged

- **`HANDOFF.md`, `TASKLIST.md`, `NOTES-FOR-ARIAN.md` and `CLAUDE.md` updated together.** They
  still described a `development` 6 commits ahead and three open PRs; #86-#90 are all merged and
  it is 18 ahead. Gate re-measured, not copied: **620 unit · 82 E2E · typecheck · lint 0 · format ·
  build · `npm audit` 0**.
- **No code changed.** Nothing was in flight and nothing was half-built; this is a record pass.

## 2026-09-22 — CI stops running the gate twice

- **`push` now lists `main` only.** A release pull request has `development` as its head, so every
  push to it fired `push` *and* `pull_request` on the same commit — the full gate, twice, at once.
  `pull_request` already runs against the merge commit, so nothing is tested less.
- **A `concurrency` group cancels superseded pull-request runs.** Pushing three commits no longer
  leaves two stale runs to finish. `push` runs on `main` are exempt: that one is the post-merge
  record of a deployed commit.
- **Every action pinned to `@v5`.** `v4` runs on Node 20, deprecated 2025-09-19 — the runner was
  already forcing them onto Node 24 and warning on every job.

## 2026-09-22 — The optimistic lock was off on three desks, and Phase 13's last row closed (#85)

- **`updateCollector`, `updateTeamUser` and `updateMembershipCode` sent `version`; the API wants
  `expected_version`.** The field is *optional*, so the server skipped the lock and wrote anyway —
  Collectors, Memberships and Team logins were last-write-wins with no 409, and on Team the raced
  field is `role`. TypeScript could not catch it: both spellings are a `number`.
- **`src/api/optimisticLock.test.ts` pins the wire format** for all six locking calls, so the next
  rename cannot silently disable it again.
- **40 component tests** across `Dropdown`, `Sheet` and the form primitives; `vitest.config.ts` now
  runs two projects (`logic`, node/no-DOM · `components`, jsdom). Phase 7 and Phase 13 closed, and
  four "remaining" phases verified as backend dead ends.

## 2026-09-22 — The handoff doc, and two more component suites (#86)

- **`docs/HANDOFF.md` rewritten** as the two-minute start-here: state, what is next, the traps —
  including the claims in these docs that turned out false when checked.
- **`Segment` and `Toast` tests** added on top of #85's 40.

## 2026-09-22 — vitest 3 → 5, clearing a dev-only advisory (#87)

- **`GHSA-82fw-gwwq-j7x9`** (path traversal in `vite`'s dev server) is gone; `npm audit` reports
  **0 vulnerabilities**, dev and prod. Never shipped — the dev server is not in the bundle.
- **Node 22 became the floor** (`engines`), because `jsdom@30` requires it. On Node 20 the suite
  fails *dishonestly*: the `.test.tsx` files never load and vitest still prints a green count.

## 2026-09-22 — The i18n engine, shipped OFF exactly as the old app ships it (#88)

- **`src/i18n/`**: the old app's registry (`en · fa · fr · es · ar`), its 144-entry dictionary
  ported verbatim, `I18nController` on the shared `Observable` base, a `useT()` hook, and
  `<html lang/dir>` applied at boot. The nav is the first wired surface.
- **Default behaviour is unchanged** — with no `theme.langs` the app is English-only and `?lang=`
  is ignored; an E2E test guards that. One liberty taken, and stated: `darz_i18n.js` translates by
  sweeping the DOM after every render, which fights React, so substitution moved to a `t()` lookup.
- **G-I18N-1 stays open with evidence.** Farsi was enabled in a browser — direction flips, the nav
  translates — but English inside an RTL container has bidi artifacts (the hero lede rendered as
  `.Contemporary Iranian works…`). Wiring the ~430 remaining strings before the RTL decision is
  what would cause rework.

## 2026-09-22 — The owner's four open decisions, in one place (#89)

- **`docs/NOTES-FOR-ARIAN.md`**: the release, the real API URL, the i18n decisions, and the
  `/artists` menu entry — each with what it unblocks and what it costs.

## 2026-09-22 — The container is built and run, and it had three bugs

- **`Dockerfile` and `nginx.conf` are no longer unverified.** Built, started,
  and driven in a browser: SPA fallback on four deep routes, assets still
  404ing, cache and security headers, gzip (928 KB → 245 KB), correct content
  types, the master process running as `nginx`, `(healthy)`, 80.9 MB — and the
  app itself loading a deep route, signing in and rendering a desk in
  Cormorant Garamond with zero JS errors.
- **Three bugs that `nginx -t` and review both passed.** `listen [::]:8080`
  crashes nginx outright on a host without IPv6. Every security header was
  silently absent from every response, because nginx's `add_header` replaces
  rather than merges and both cache locations declared their own. And
  `USER nginx` killed the container at boot — the stock image's writable paths
  are root-owned, and this repo had *asserted* they were world-writable.
- `docs/DEPLOY_ARVAN.md` §7 is rewritten from "what is NOT verified" into what
  is, what is not, and those three bugs.

## 2026-09-22 — The deploy block is cleared, and ArvanCloud is scoped to the frontend

- **Frontend Phase 14 is closed.** The owner created the `darz-web` Vercel project on the team
  and imported the repo, so `main` auto-deploys — **https://darz-web.vercel.app**, verified
  serving. The "blocked on a Vercel team role" item, open since 2026-09-07, is done. Creating
  the project from here still 403s; it did not need to.
- **The deploy is visual-only and stays that way** until `darzmarket-api` has a public URL.
  `.env.production` is the deliberate `api.invalid` placeholder.
- **ArvanCloud is frontend-only** (owner, 2026-09-22). `docs/DEPLOY_ARVAN.md` §1 says so and
  says what that buys: the same build, served from inside Iran with no foreign origin on the
  critical path — and no sign-in, because the API is nowhere yet. §4 stays as guidance for
  whenever the backend moves, with the note that a split (frontend in Iran, API abroad) moves
  the blocked-origin problem from the fonts onto the data path, where it cannot be self-hosted
  away.

## 2026-09-22 — Released: Phase 6's DoD, the three deletes, the collector boundary (#73, #74)

- **`main` and `development` are the same commit** (`dd62f7a`) — not merely identical trees.
  No open PRs. Owner's instruction to merge, given per-request as always.
- **What went out:** #72's docs, and #73 — Phase 6's DoD met, **G-DEL-1**'s three deletes,
  `ScreenBoundary` for the collector app, the Chat search **G-5** had already unblocked, the
  Documents group's Create tab, Auction Records' ★ Highlights filter, and a live crash on the
  released Private Deals view that verifying the deletes exposed.
- **The release publishes nothing.** `create_git_project` was retried against the team on this
  branch and still answers `403 forbidden: You don't have permission to create the project`.
  Frontend Phase 14's two ways out both need the owner — see "What next" item 4.

## 2026-09-22 — Phase 6's DoD met, G-DEL-1 built, and the collector app gets a boundary

- **The comparison is repeatable now.** `e2e/capture-desks.mjs` shoots every built desk at
  the reference harness's own settings (1440x900, dark) against the E2E stub, so "hold the
  two side by side" is a command. Every remaining desk was then compared against its
  capture per `docs/ADMIN_SCREENS.md`.
- **Three findings were cross-cutting, not per-desk.** `DeskPage` had no `subtitle` slot, so
  all 33 desk sub-lines rendered *below* the filter row with their negative margin pulling
  them into it; it had no `strip` slot either, so all four count-tile strips sat below the
  filters where the old panel puts them above; and `.ad-deskintro` was a second subtitle
  class with its own width. All three fixed at the kit, not per desk.
- **The old panel has 17 desk sub-lines, not two.** Live Auctions, Artists and Galleries had
  dropped theirs; Accounting had lost all six of its per-book lines. Restored, each to the
  half that is true of this backend — the passkey/device-sync clauses are not repeated.
- **Built** (each the old panel's own control): Auction Records' ★ Highlights filter, the
  Chat search box that **G-5** had already unblocked, the Documents group's **Create** tab
  (the desk exists as `/admin/issue`; the group lost its entry point), and **G-DEL-1**'s
  three deletes — deal, auction and document, old confirm copy verbatim, the document one
  owner-gated as the old panel gates it.
- **A live bug on a released desk**, found verifying those deletes against a seeded stub:
  the Private Deals view read its summary the way §9a's ledger bug read its own and rendered
  `DeskBoundary` instead of a desk. It survived the first full walk because
  `/admin/accounting`'s other three views are `?view=` on the same route and only the bare
  path was ever opened. Fixed, all four views now in the walk, `normaliseDealsSummary` with
  five regression tests.
- **The collector app gets `ScreenBoundary`** — the counterpart of `DeskBoundary` the route
  walk recommended and left undone because it puts copy in front of collectors. It does not:
  `app.html:9821` is the old app's own catch around a thrown render and "Something went
  wrong" is its heading verbatim. Gated by a `/_boom` route that exists only in the E2E
  build.
- **77 E2E · 484 unit · typecheck · lint 0 · format · build.**
## 2026-09-22 — Released: Phase 6's kit and the first full walk of the app (#69, #70, #71)

- **`main` and `development` are level again**, identical trees, no open PRs. The release publishes
  nothing — the Vercel project still does not exist (Phase 14, blocked on a team role).
- **What went out:** the desk kit's write feedback (#69) and the eight broken routes the first full
  walk of the app found (#70) — two of them already on `main`, one of them a nested `<Route>` that
  had left Phase 2's ledger-entry detail unreachable from any URL since it shipped.
- **Gate at release:** 478 unit tests · 71 E2E tests (was 443 and 3) · typecheck · lint 0 warnings ·
  format · build. `docs/HANDOFF.md` is new and is where a fresh session should start.

## 2026-09-22 — Every desk was opened for the first time, and three were blank

- **The walk.** Signing into the panel against the **E2E stub server** removed the blocker
  that the only local team login's password is recorded nowhere — so all 35 built desks
  could be opened. Three rendered a completely blank page, two of them already on `main`:
  `/admin/accounting` (`.length` on an undefined `currencies`), `/admin/projects`
  (`responsibility_by_member is not iterable`), and `/admin/accounting/deals/new` — a
  `<Route>` nested inside another route's `element`, which had also left
  **`/admin/accounting/entries/:id` unregistered**, so Phase 2's ledger-entry detail was
  unreachable from any URL since the day it shipped.
- **Fixed at two levels.** `normaliseLedgerSummary` and the `readMembers` guard where the
  crashes happened (23 new unit tests, modelled on `artworkFacets`), and `DeskBoundary`
  under the desk `<Outlet>` so the *next* one degrades to a legible message with the navbar
  intact instead of a white page. Four instances of one mistake earned the floor under it.
- **Then the 15 `:id` routes**, which found three more of the same crash — the artwork
  editor's image store and its selection grants (both **bare-array** endpoints the stub was
  answering with an envelope), the auction invite list (thrown inside a `.then()`, so the
  panel hung on "loading" instead of reaching its error handler) and a project's partner
  orgs. Two were caught by the new boundary rather than blanking. Seven instances of one
  mistake earned `asArray` in `src/api/shapes.ts`, and the stub now states the real shape of
  the two endpoints it was misreporting.
- **Then the collector app**, never walked before either, where the eighth instance was the
  worst: `/auctions/lots/:id` was a **white screen**, because `primaryImage` read
  `artwork.images` off an artwork that was not there — and unlike a desk, a collector route
  has **no boundary under it**. Fixed; an equivalent boundary for the collector shell is
  left as a recommendation, since it puts new copy in front of collectors.
- **The panel's surface was wrong on every desk**, and only a screenshot could show it:
  `.dz-page`'s `min-height: 100%` is inert under the admin shell, so the desk surface ended
  with the content and left a horizontal seam on every short desk — and a 1040px form desk
  painted only that wide, leaving darker gutters. The old panel is uniform edge to edge. The
  surface is now the shell's and fills the viewport.
- **`e2e/desks.spec.ts` + `e2e/collector.spec.ts`** turn the walk into a gate: every desk, its
  own heading, a surviving shell, nothing thrown — **71 E2E tests** across desks, detail routes
  and the collector app. Verified by reverting a guard and watching it fail. Plus the Phase 6 fidelity pass's first fixes: the
  missing subtitles on Dashboard, Requests and Collectors, and three comments that still
  denied filters G-2 shipped.

## 2026-09-21 — The kit gets one way to say it worked, and one way to say it clashed

- **Success (TD-4).** The old panel confirms a write in two places at once and both are ported:
  `.dz-toast` (`darz-studio.html:370-372`, the admin's centred card — not the collector app's
  bottom pill) and the v510/v631 `.dz-saved` flash, where the Save button itself turns green and
  reads "✓ Saved" for 2s while keeping its own background. `DeskSave` flashes only when the write
  **resolves**; a button congratulating you on a failed save is the one lie it must never tell.
- **Conflict (TD-5).** `ConflictBanner`, taken verbatim from the six Projects desks that had each
  written the sentence independently, now shared by all six and added to five more. Two
  corrections to the audit: Accounting and Records **cannot 409** — they are last-write-wins
  (**G-LOCK-1**) — and TD-6's "8 dead service methods" are not dead; three are buttons the old
  panel ships and this port never built (**G-DEL-1**).
- **Lint back to 0 (TD-7)**, one of the three a real bug: `AuctionEventPage` had no countdown
  timer at all, so "2d 23h" froze at mount. Both auction pages now use `useNow`.

## 2026-09-19 — Tidy up the superseded rows, and price them all in one pass

- **"Tidy them up"** on the standard-set card does what was an instruction: re-points every package
  line naming a superseded row onto the service it was merged into (collapsing a duplicate if the
  programme held both sides), **then** deletes the rows. That order is the whole point — deleting
  first leaves a programme holding a line whose service no longer exists — so it is `tidyUp.ts`,
  planned and tested, not three calls in a click handler. A row whose merged partner is missing is
  left alone and said out loud rather than stranding its lines.
- **"Price them all in one pass"** on the library: every unpriced service in one column, type down
  it, save once. Only the boxes actually filled are written; a blank stays "quoted per show". Saves
  one at a time, so a rejection names the service and everything before it stands.
- **No prices were invented.** Darz's coverage menus carry none (checked `coverage-packages.html`
  and `darz-studio.html`'s `COV_CHK` — money appears nowhere in either), so there is no real figure
  to seed and the owner types theirs in.

## 2026-09-19 — Exhibition Services, on its own, and one page to an issued document

- **Its own section** (`/admin/exhibition-services`): one list — name, what it covers, price —
  edited in place, with the programmes under it. The price list is no longer three tabs deep inside
  Projects, and it is still the same rows every proposal is priced from.
- **`/admin/issue`** replaces composing-then-a-modal-per-kind: pick the show (client, dates and
  venue fill themselves) · proposal or invoice, reference numbered for you · services from the
  library, price and description filled · quantity, price, discount, note, payment terms · the
  document beside it as you type · one button that saves the package, renders the PDF and files it.
- **Quantity** is new (G-PORT-16): it rides the document, where the client reads it, because the
  service line has no field for it. The compose desk keeps the request, the package and the
  document history, and hands off to the one page rather than growing a modal.

## 2026-09-19 — The four look-alike pairs are one service each (owner's ruling)

- "Installation photography" / Exhibition Photo Coverage · "Video walkthrough / reel" / Video
  Documentation · "Artist interview" / Artist Interview · "Collector network push" / Darz Listing.
  Each pair is now ONE catalogue row, on the exhibition side — the name the gallery's portal shows,
  and the one `priceList.ts` joins a package's prices by. 27 service lines, 20 unpriced.
- No price was invented by the merge: three keep the Toman price the exhibition line already had,
  and Darz Listing stays quoted-on-request because neither side carried one. `MERGED_SERVICES`
  records what was folded into what; the five programmes keep the same line counts.
- A workspace seeded before the ruling still holds the folded rows — the seed only ever adds — so
  the desk names them (`supersededRows`) and leaves deleting to the owner.

## 2026-09-19 — The gallery workflow pass: one price list, and nothing sent into a void

- Walked the whole admin↔gallery chain live and fixed what it found. **The composer now prices a
  package from the service catalogue an admin can edit** (`priceList.ts`) — it used to open blank
  although the gallery had already been shown the price, so Darz retyped from memory (G-PORT-12).
  It never converts a currency and says on screen how many lines carried over.
- **A pricelist a gallery sends now reaches the desk** (nothing in this app had ever read them back,
  G-PORT-14); the partner page also lists every proposal and invoice issued to them, across shows.
- Issuing a link hands over a **ready-to-send invitation** (the old panel's own templates,
  `darz-studio.html:36197-36198`) and a way straight into the partner; the partner list gained
  search and a **Waiting** column in place of an internal switch; dashboard tiles are links; a lost
  link and an unpriced line now say what they are instead of "0 TMN" and nothing. G-PORT-13/15.

## 2026-09-19 — D21 resolved: the catalogue carries Darz's real services, in Toman

- "Add the standard set" (owner-only, idempotent) writes the 8 priced exhibition services with their
  real Toman prices, the 22 other Exhibition Coverage services unpriced, the 5 coverage programmes and
  the 4 checklists. The old `projSeedIfEmpty` USD figures were demo data and are gone. A project
  proposal now chooses its currency and never invents a rate. Gaps G-PROJ-8/9.

## 2026-09-19 — Phase 11c: Projects — the eight-tab group over backend Phase 31

- Dashboard, list, record (stage rail, nine sections, attachments, one-click proposal), print
  report, 17-stage board, packages + service catalogue, catalogue-priced calculator (D21),
  partners with responsibility matrices, reports + checklist templates. Gaps G-PROJ-1…7.
- Reviewed adversarially before the PR: the non-priced proposal prints no totals at all, the
  PRO series is scanned across both proposal kinds, a deleted partner org can no longer wedge
  a record's saves, and the desks share one page-walker and one client-name rule.

## 2026-09-19 — Phase 10b: the desk half — Exhibitions queue, composer, one-click documents

- The gallery loop closed from the desk side: requested shows queue into Sources, the composer
  prices/approves/publishes, and proposals/invoices issue in one click — client-rendered brand
  PDFs (golden-fixture design) uploaded + confirmed; the updates queue reads in words.

## 2026-09-19 — Phase 10: the Gallery Portal (`/portal/:token`)

- The no-login partner surface, ported from `gallery-update.html`: PIN gate, works + one-submission
  updates (the payload keys approval auto-applies), funnel Status, pricelist upload, messages, and
  the Exhibition Services workspace through to document acceptance. Gaps G-PORT-1…11 recorded.

## 2026-09-19 — Phase 12 Step 8: Private Deals + receipts (PR #53, left open)

- The Accounting desk's second half: the deals CRM with the server-computed per-deal calc and
  per-currency summary, the 15-amount money grid, slotted receipt uploads with served links.

## 2026-09-19 — Phase 12 Step 7: Accounting — the four-ledger books

- `/admin/accounting` (owner-only): the four books as a segment, the per-currency summary strip
  (never summed across currencies), month/type/status filters, entry CRUD with manual FX and
  sale labels. Deals/attachments/settlement follow as their own step.

## 2026-09-19 — Phase 12 Step 6: the Auction Records desk

- `/admin/auction-records` (+editor): the widened comparables DB as a desk — sections, search,
  status, highlights, and a four-section editor over the whole serializer. The old import
  machinery stays dead architecture; CSV bulk entry lives in the Import desk.

## 2026-09-19 — Phase 12 Step 5: Auctions admin — Live Auctions + Register to Bid

- `/admin/auctions` (+detail): create, the Phase-35 invite-only card, lots with the confidential
  reserve, Go live (artwork → Reserved), Close/Close early (force bypasses the end time, never
  the reserve — found live). `/admin/auction-registrations`: the paddle queue; approval assigns
  the next sequential number. G-AUC-1…3 recorded.

## 2026-09-18 — Phase 12 Step 4: Galleries & Sources — partners + Source Updates

- `/admin/sources` (+detail): the partner roster, issue with the one-time token+PIN reveal,
  enable/disable, funnel switches, the snapshot works list with assign/remove/stage override,
  and the Source Updates queue (approve applies availability/price/correction to the artwork).
  Verified live including a real portal-side submission with the issued credentials.

## 2026-09-18 — Phase 13: the E2E harness (stub tier in CI)

- `e2e/`: a Playwright smoke over the production build against a canned envelope stub
  (boot → gate → team sign-in → panel → a desk; empty lists everywhere else), plus a second
  CI job with its own Chromium. The real-backend tier stays local by design (`e2e/README.md`).

## 2026-09-18 — Phase 12 Step 3: Documents — Library/Proposals/Invoices + lifecycle

- `/admin/documents` (+`?kind=` tabs) and the record page: create, draft-only edit with a JSON
  fields editor, PDF upload (client-renders-server-stores; versioned), confirm→sign→archive,
  Copy-link sharing (D19 live). Query-aware sub-tabs. G-DOC-2 recorded; the Builder waits on D18.

## 2026-09-18 — Phase 12 Step 2: Published works + Market Sales

- `/admin/published`: the Market App tab — the public catalogue slice with images, search,
  Remove-from-app, and the hidden-by-a-gap tile (Data Health's own count). `/admin/sales`:
  the deals ledger — stat tiles from per-status totals, ＋ New deal (kit Pickers), the guarded
  linear chain, payment/delivery setters, R7 draft-only terms lock. G-SALE-1…5 recorded.

## 2026-09-18 — Phase 12 Step 1: the catalogue core — Artworks Database + Artists

- The panel's biggest desk (`databaseView()` ported onto Phase 7's admin CRUD): search + filter
  toolbar with the old removable-chip row, the ✓ APP per-work publish toggle, status pills, and a
  full editor — guarded status transitions, provenance rows, per-work collector actions, the real
  multi-image store (multipart upload / primary / remove). Artists: roster + inline intro + CRUD.
  Gaps G-CAT-1…8 recorded; verified live end to end (moto S3 standing in for MinIO).

## 2026-09-18 — Phase 11b Step 6: Activity feed + Collector Club — the phase's desks complete

- The "Requests & Activity" tab gains its second half: the read-only view/save/search/login log
  (Phase 28) behind a segment, kind-filtered from options, deep-linkable from a collector's
  workspace. The Collector Club (Phase 35): selection cards with the ported anatomy, search-backed
  work/collector pickers, and the grant-overlap rule stated in the delete confirm. G-CLUB-1
  recorded (no image on the nested serializer → the old fallback gradient, always).
- Live-verified: 10 real activity rows; a created selection granted an imported work (sync
  confirmed end to end). Every Phase 11b desk is now built except the G-KEY-1-blocked standalone
  Access desk; App Design's copy keys and Import's PDF/Images remain as marked halves. 201 tests.

## 2026-09-18 — Phase 11b Step 5: Data Health + Import (CSV + Paste)

- Data Health: the three surviving checks with counts and first-50 items; the desk states why the
  other five did not port. Import: a tested RFC-4180 reader + column mapper onto the serializer's
  own fields, the verbatim Review-first rule, staged batches with JSON row edit / reject / confirm /
  discard and per-row errors. PDF/Images tiles stated as absent (D15), not dead buttons.
- Live-verified end to end: paste → mapper guessed all four columns → staged 2 rows → Confirm
  created 2 real artworks through the real create path, zero errors. 201 tests (+5).

## 2026-09-18 — Phase 11b Step 4: Memberships + Team logins

- Memberships (owner-only): issue with auto `DZ-<plan>-<6>` codes, wa.me links, the :33318 status
  cell over `expiryParts`, server-side renew (+1 month from max(expiry, today)), edit/remove. Plans
  are the collector tiers — the backend's own Phase 30 deviation, flagged. "No payment processing
  anywhere" kept on screen.
- Team logins (owner-only): create → password shown once, search/role, edit, remove; self-guards as
  disabled controls with the reason. The old Workspace suite around it has no backend (G-TEAM-1).
  Live-verified full circle: the shown-once password signed the new admin in. 196 tests.

## 2026-09-18 — Phase 11b Step 3: App Design — the owner controls the app

- `/admin/design` (both its old groups) edits the typed FeatureFlags table and publishes it as
  `theme.features`; the app reads the public `GET /api/app-theme/` on boot, before first paint,
  merging validated switches over the `VITE_FEATURE_SET` floor (`resolveFeatureFlags`: unknown keys
  and non-booleans refused, `market` unswitchable; fetch failure applies nothing).
- Save vs "Save version" kept distinct; versions Activate/Delete; Reset to factory. Live-verified:
  Records off → collector `/records` clamps to `/`; Reset restores; Activate re-applies. The old
  desk's fonts/colours/button editors wait for their consumers (D17). 196 tests (+6).

## 2026-09-18 — Phase 11b Step 2: Collectors + Access Requests

- The Collectors roster (search/tier/access/sort = the server's own filterset), create/edit with the
  version lock, and a per-collector workspace: record, keys (issue → shown-once, revoke, the three
  extend buttons, expCell :33042 as a tested pure module) and the Phase 33 sign-in log. Overview
  strip and activity sorts not ported — no aggregates served (G-COL-1/2); the owner Access desk is
  blocked on a roster-wide key list (G-KEY-1).
- The Access Requests review queue, owner-only (RequireOwner's first caller): verbatim cards/copy,
  approve → tier + confirm → once-shown key, D13's note PATCHed onto the new collector, verbatim
  decline confirm. Schema regenerated from the live backend (13,246 → 18,937 lines).
  Live-verified full circle: an issued key signed a collector in. 190 tests (+5).

## 2026-09-18 — Phase 11b Step 1: Dashboard + Chat

- Dashboard over `GET /api/dashboard/admin/summary/`, keeping :21349's rule — a tile opens exactly
  the rows it counted (`?kind=&status=` deep links; the requests desk reads its opening filter from
  the URL; G-DASH-1 records the initial-status inference). Chat = the crm admin thread endpoints;
  the thread machine now lives once in `MessageThreadController`, bound by collector and admin
  subclasses with the seen direction flipped (:40547).
- Old-pane AI Monitor/mode/assignee/status/Clear/search have no backend — flagged, G-CHAT-1/2.
  Live-verified end to end. 185 tests (+6). Team gate lands on `/admin` now, not a hardcoded desk.

## 2026-09-18 — The admin as one system: the full map + the desk kit

- `docs/ADMIN_ARCHITECTURE.md` — all **14 groups / 55 tabs**, the owner's port-content /
  modernise-mechanics rule, the desk kit contract, owner-controlled feature flags via `app-theme`
  (§4), the one-Document-Studio answer (§5), and the build order. `adminNav.ts` now carries the
  whole map with each tab's API state and owning phase, so doc and navbar cannot drift.
- `features/admin/kit/` — DeskPage · DeskList · DataTable · filters · ConfirmDialog ·
  ShownOnceSecret. `AdminRequestsPage` refactored onto it as the worked example. 179 tests (+21).

## 2026-09-18 — Phase 11b Step 0: the panel shell

- The old panel's two-tier navbar, ported as data (`adminNav.ts` ← darz-studio.html:11721-11803) and
  rendered by `AdminShell`, which replaces the scaffolding `AdminLayout`/`.ad-bar`. All four of
  `_dzRenderSubnav`'s rules ported: the More-row prefix, one-tab suppression, the no-group
  Dashboard, the group eyebrow. `/admin` and unknown `/admin/...` clamp to the first page a role
  can open (:11815), not to the collector Market.
- Owner confirmed D9-D16 as recommended; D10 proved unnecessary — `admin.css` already maps the old
  palette onto tokens, so both skins work from one rule set. Verified live, both roles, both skins.
  158 tests (+17).

## 2026-09-18 — Phase 11b plan drafted; entry-point question narrowed to one

- `docs/PHASE_11B_PLAN.md` — Steps 0-7 over backend Phases 23 + 27-35, decisions D9-D16, waiting on
  the owner. Read from `darz-studio.html`: the desks are **not** siblings (a two-tier navbar with
  sixteen groups, so a panel shell is Step 0), two desks were missing from the task list (Access
  Requests, Collector Club), and there is no approved design package for the panel.
- `/auctions/notifications` and `/admin/login` closed as no-change; `/artists` is the one open
  decision, and the old app's own artist list is orphaned the same way. G-P24-1 narrowed.

## 2026-09-18 — Phase 14: the deploy blocker narrowed to a Vercel role

- Both creation paths fail identically — `create_git_project` (even link-only, `deploy:false`) and
  `deploy_to_vercel` (inline). The inline 403 carries Vercel's team-members-and-roles doc link, which
  is how Vercel frames a role problem; reads of projects/deployments/teams all work.
- Owner action: raise the member's role, or hand-create an empty `darz-web` project to deploy into.

## 2026-09-18 — "Curated for You" chip (backend Phase 24)

- `query.curated` switches `CatalogueController` between `/artworks/` and `/artworks/selections/` —
  a filter on the same grid, never a separate section (app.html:8890 records v669 removing that).
  Chip hidden at zero grants; label/count/titles/`.on` inversion ported from :8583-8594 and :278.
- The notice and the selection name are not ported — no API signal for either (G-P24-1/2). 141 tests.

## 2026-09-18 — "Request access" is a real form (backend Phase 34)

- `LoginPage`'s stub note becomes the old app's form (app.html:2544-2565, verbatim) over
  `POST /api/auth/access-requests/`. The `@` split, `?ref=` chain and `client_req_id` live in
  `features/auth/accessRequest.ts` as pure functions. `Input`'s `label` widened to `ReactNode`.
- Verified live against the backend at `12988db`; both contact paths round-trip. 137 tests (+11).
  G-P34-1/2 raised with the backend as `darz-backend-api` #28 (owner decision D8).

## 2026-09-18 — Backend Phases 23-35 surveyed; two collector ports planned

- Pulled `darz-backend-api` `development` 24 commits forward (`3801786` → `12988db`): Phases 23, 24,
  25, 27-35. 191 routes exist; this frontend calls ~20. `docs/PHASE_24_35_PLAN.md` (plan, D1-D8) and
  `docs/PHASE_24_35_API_GAPS.md` (G-P34-1/2, G-P24-1/2, G-P25-1/2, G-P13-1) written.
- Nothing implemented — awaiting owner confirmation.

## 2026-09-18 — CI, and a test that was green in CI and red on a desk

- `.github/workflows/quality.yml`: typecheck · lint · format:check · test · build, on every PR and
  on pushes to `main`/`development`. Verified on a real clean checkout (`npm ci`) before landing,
  so its first run is green. Until now every recorded "green" was hand-run and unenforced.
- `resolveFeatureSet` no longer defaults its argument to `import.meta.env` — a JS default fires on
  an explicit `undefined`, so the "unset" test re-read the ambient env and failed for anyone whose
  `.env.local` set `full`. Now pure, with a `vi.stubEnv` regression guard. 126 tests.

## 2026-09-18 — Released the team sign-in to `main`

- PR #30 brought `main` level (`77f3655`), PR #31 merged the release commit back (`b4b257e`) — the
  PR #27 / #28 pattern. Trees identical; `main` is an ancestor of `development` again.
- Publishes nothing: the Vercel project still does not exist (Phase 14, `403`), so `main` moving
  has no deploy consequence in this repo yet.

## 2026-09-18 — Team sign-in: the v0.1 loop closes

- `/admin/login` ports app.html's "Darz team sign-in" card verbatim (:2537-2542) onto
  `POST /api/auth/team/login/`, reusing the collector gate's classes — no new CSS.
- `RequireTeam` + `AdminLayout` move the desk out of the collector shell: a collector session is
  redirected instead of collecting 403s, and a team member finally has a sign-out.

## 2026-09-18 — Docs: the Phase 5 release, F1 closed, both blockers re-tested

- `TASKLIST.md` header + "What next" rewritten post-Phase-5 (the team sign-in screen, v0.1 flag 8, is
  item 1); `PHASE_5_PLAN.md` marked released and **F1 closed** — `design/market-app/` is on `main`.
- Re-tested, still blocked: Vercel project creation and branch deletion, both `403`. Build green.

## 2026-09-18 — Phase 5 step 4: activity self-logging — Phase 5 complete

- `features/activity/ActivityLogger` over `POST /api/crm/activity/`: fire-and-forget (guarded
  against a rejected promise and a synchronous throw alike), `view` deduped per work per session,
  `search` per settled term. One `ActivityProvider` above the router, because the first event is
  `login` on `/login`. Wired at the old app's four points: login, save (inside `SavedController`,
  saves only), view (D5a) and search (D5b). Verified live: six rows, all four kinds, no second view
  when a work is reopened. 123 tests. Phase 5's four steps are done.

## 2026-09-18 — Phase 5 step 3: a detail and a thread for every request kind

- `ThreadPage` in two shapes over one thread: a conversation keeps v0.1's chat, every other kind
  opens `RequestDetail` — the old app's request card (`DZ.actOpen`): the work, the **Current
  status** banner, Request / Amount / **Held until** / When, and the per-kind note while Darz has
  not written. Every Profile row opens its detail now. The floating reply notice (`.dz-notif`) is
  ported over a new `newestUnread()`, and **Remove from activity** shares the session-local hide
  (G-P5-4). `ConversationsController` gained its first test suite. 117 tests.

## 2026-09-18 — Phase 5 step 2: the collector's request list (`docs/PHASE_5_PLAN.md`)

- `features/requests/status.ts` — one collector vocabulary over the backend's per-kind statuses
  (pill · rail stage · per-kind note), pinned by a test against `apps/crm/lifecycle.py`; replaces
  three hardcoded lists. Profile › Market: **Your acquisitions** with the four-step rail, activity
  rows on `ACT_KL` labels with time, amount and "New reply", the D9 empty state, and **Clear
  activity** as a session-local hide (D4 · G-P5-4). Fixed on the way: Profile's lists were memoized
  on a value that never changes, so a poll never reached the screen. 111 tests.

## 2026-09-17 — Phase 5 step 1: every request kind files correctly (`docs/PHASE_5_PLAN.md`)

- `ViewingSheet` (preferred time + In person / Virtual — `ViewingDetailSerializer` requires both;
  the bare POST was rejected 400) · `PriceSheet` (the old Request Price & Availability sheet,
  `app.html:11046-11064`, without the identity fields) · artist enquiry through `RequestController`
  (idempotent, "Enquiry received") · per-kind `detail` typed by hand (G-P5-1) · "48h hold" (D2) ·
  the offer sheet stays open on a rejection. New `docs/PHASE_5_API_GAPS.md` (G-P5-1 … 11);
  `API_INTEGRATION_GAPS.md` G-F1-5 / G-F1-6 drift corrected. 104 tests.

## 2026-09-17 — Design pass landed: PR #15 → `development`, `main` brought level

- Merged on the owner's instruction ("land the design pass"); the merge commit's tree is the gated PR
  head (typecheck · lint 3 pre-existing warnings · 98/98 tests · format · build). Two entry points
  `development` had are now unlinked (artist index, auction notifications) — owner decision recorded
  in `docs/TASKLIST.md` § Design pass. Task list refreshed (focus, "What next", Phases 5 / 8 / 14).

## 2026-09-11 — v0.1 launch scope (branch `claude/darz-market-v0-1-hpy1xy`)

- **Feature controls** — `src/features/shell/features.ts` (`VITE_FEATURE_SET`): v0.1 shows Market ·
  Records · Chat · Profile · Settings and Send Inquiry; auctions, bidding, offers, holds, viewings,
  the questionnaire, AI chat and stories stay in the codebase, hidden; hidden routes redirect.
- **App shell + nav** — `AppShell` with the old `<nav id="nav">` (bottom bar / desktop top bar),
  `LayoutController` (the `html.dz-desktop` switch at 900px), desktop two-column artwork detail.
- **Inquiry loop** — `InquiryAction` / `InquirySheet`; `RequestController` idempotency keys;
  `ConversationsController` + `ThreadController`; `/chat`, `/chat/:id`; admin feed shows names,
  the message and a `New` chip.
- **Profile** (`/profile`) and **Settings** (`/settings`) — Phase 9's first cut, read-only account.
- **Records** — `RecordsArchiveController` (five houses), Cards / List, artist page with
  evidence-gated insights (`insights.ts`, tested), full record detail; artist page links to it.
- **Images** — one fit-not-crop rule on every artwork image (`catalogue.css` `.card .img img`).
- Schema regenerated from backend Phase 19.3; 17 test files / 98 tests. Details and owner flags:
  `docs/V0_1_SCOPE.md`.

## 2026-09-11 — Design pass: the Market App shell + every screen re-skinned to the design package

Source of truth is now the Market App design-system handoff package (`darzstudio.art`
`design/market-app/`, PR #846, build 1229): tokens ported verbatim (`src/design/tokens.css`), the
charcoal skin is the collector default, and every screen was captured with Playwright at 390×844 and
1440×900 against the package's own captures (fonts served from the package's `inline.css`). New:
`features/shell` (`.frame` · glass header + **Leave the Room** · chroma line · bottom nav / desktop
top nav, `LayoutController` for `html.dz-desktop`), `Dropdown` (`dzSel`) and `Segment` (`.viewseg`)
components, catalogue single view (`ViewPreference`), previous/next arrows on the detail
(`BrowseSet`), View in Room, share, the "More works by this artist" card, the artist page's
`dzUniCard` tiles + enquiry, auction posters (first lot), the event page's countdown/register card/
lot rows, the records tab (sub-sections · sort · Cards|List · empty state), **Profile** (Overview ·
Market · Auctions · Account, `ProfileController`), **Settings** (`DevicePreferences`), and the
`#dzGate` black-world login. Typecheck / lint (3 pre-existing-style warnings) / 82 tests / format /
build clean. Owner-facing scope flags are listed in `docs/API_INTEGRATION_GAPS.md` § Still open.
**Merged onto v0.1 (2026-09-12):** v0.1's feature controls, nav order (Market → Records → Chat →
Profile → Settings), Send Inquiry, Chat, Records archive, Profile and Settings pages are the
behaviour; the design pass supplies the tokens, the shell chrome (header · chroma · 430px frame), the
catalogue / detail / artist / auction styling and the `#dzGate` login on top of them.

## 2026-09-11 — API integration: wire Saved/Requests/Admin to the merged backend gaps

New `docs/API_INTEGRATION_GAPS.md` — the live map of what four merged `darzmarket-api` PRs now
serve and where this frontend uses each one; supersedes `API_GAP_ANALYSIS.md`/
`FLOW_1_API_GAPS.md`/`PHASE_6_API_GAPS.md`/`PHASE_8_API_GAPS.md` as the current reference (each
kept as historical record, pointer added). `SavedController` rewritten around `artwork.is_saved`
(no more full-list walk); `SavedItemsPage` is a real paginated list (`SavedListController`).
`ActionButtons` filters by `artwork.allowed_actions`; `RequestController` sends `client_req_id`.
`AdminRequestsPage` shows real collector/artwork names, a live per-kind status vocabulary, and
per-row `allowed_transitions`. `OptionsMap` widened for the new nested/dynamic option shapes.
`schema.d.ts` regenerated. 82/82 tests green (rewrote `SavedController.test.ts`,
`RequestController.test.ts`'s idempotency assertions), typecheck + build clean, verified live
against the local backend (screenshots + network trace).

## 2026-09-10 — Phase 8 step 4: auctions — the external auction-house Records archive

Backend `darzmarket-api` `phase-11.4` adds a read-only collector view of `AuctionRecord`:
`GET /api/auctions/records/` + `/{id}/` (`IsCollectorPrincipal`), `?search=` (artist / house / lot
title), `?ordering=` (`sale_date` / `price_amount` +/-), `?artist=<uuid>`, plus a computed
`artist_display_name` (linked Artist's name, else `artist_name_raw`). Frontend:
`AuctionService.records()/record()`; `RecordsController extends ListController` (debounced 300ms
`setSearch` + `setOrdering`, like the catalogue toolbar); `useRecords()` / `useRecord()`. `/records`
(RecordsPage) + `/records/:id` (RecordDetailPage) ported from `app.html` `recordsView()` (~4760+):
the `.rec2-hd` header + chroma seam, the `.rec2-tools` search/sort row, a `.rec2-grid` of `.rec2-c`
cards (house + sale-month, artist, lot title, price realised); the detail reuses the shared
`.detail` shell + `.fields` with the source link + notes. "Records" link in the auctions hero — the
old `showRecordsTab: 'Hidden'` flag is not reproduced, it is a plain always-on route now.
`auctions.css` ports the `.rec2-*` chrome (source lines cited). **`docs/PHASE_8_API_GAPS.md` G-P8-1**
records the field-parity gap: the backend `AuctionRecord` is much leaner than the old Records tab
(no image / year / medium / dimensions / estimates / hammer-vs-realized / sale_name / provenance /
Past-Upcoming-Live section / highlights) — the widened model + the admin Records desk that maintains
it are deferred to Phase 11 (`docs/PHASE_8_PLAN.md` § Deferred). 4 new tests (84 total); typecheck /
lint / format / build clean. Verified end-to-end in-browser (seeded records): the list renders
`artist_display_name` (FK name + `artist_name_raw` fallback both), newest-first, a debounced
server-side search filters to one house, and the detail shows all fields + the source link.
Frontend PR `phase-8-auctions-records`; backend PR `phase-11.4-auctions-records`.
**On merge, Phase 8 (auctions) is complete.**

## 2026-09-10 — Phase 8 step 3: auctions — notifications feed + live banner + unified status pills

Backend `darzmarket-api` `phase-11.3` adds read-only `lot_artwork_title` / `lot_number` to the
collector notification serializer + documents the `payload` shape per kind. Frontend:
`AuctionService.notifications() / markRead()`; `AuctionNotificationsController extends ListController`
— the feed with a boot + ~45s poll + on-focus refresh (no WS for notifications, matching the Phase 5
thread decision), optimistic `markRead` / `markAllRead`, and `unread` / `unreadCount` / `latestUnread`.
`AuctionNotificationsProvider` puts one on context inside `RequireAuth` (mirrors `SavedProvider`) and
renders `AuctionBanner` — the live "Darz auction" banner ported from `app.html` `.dz-anotif` (~793):
fixed bottom-centre, independent of any reply banner, kind-coloured status word + a matching left
seam bar, count chip, tap → the related lot (marks read). `/auctions/notifications` page — newest
first, unread emphasised, per-row + "Mark all read", tap → the lot; "Notifications (N)" link in the
auctions hero. `status.ts` — the one vocabulary (`lotPills` / `notificationPill` / `notificationLine`,
ported from `aucPill`, app.html ~6258) wired into the lot rows + lot detail; `auctions.css` ports
`.aucpill*` + `.dz-anotif*` + the feed rows (source lines cited). 12 new tests (80 total);
typecheck / lint / format / build clean. Verified end-to-end in-browser (two notifications for a real
collector): the banner shows the newest unread with the right accent, the feed lists both with pills

- "Lot N" (proves BE-7), and marking one read updates the hero count, the mark-all count and swaps
  the banner to the next unread — all off one shared polled controller. Frontend PR
  `phase-8-auctions-notifications`; backend PR `phase-11.3-auctions-notifications`.

## 2026-09-10 — Phase 8 step 2: auctions — Conditions of Sale + paddle registration + place/raise bid

Backend `darzmarket-api` `phase-11.2` adds `Auction.terms`/`terms_required`,
`BidderRegistration.terms_accepted_at` + `agree_terms`, and `opening_amount`/`min_next_amount` on the
collector lot. Frontend: `AuctionService.registrations()/register()/placeBid()`; `RegistrationController`
(Observable) loads the collector's paddles, `forAuction(id)`, `register()` with an in-flight guard and
the server's terms-required 400 surfaced verbatim; `LotController.placeBid()` — double-tap guard,
merges the returned lot like a live frame (price / count / `is_leading` before the WS echo), surfaces
the floor / must-increase / not-approved / not-live rejections verbatim. `ConditionsSheet` renders
`auction.terms` or the ported `DARZ_AUC_TERMS` (app.html ~8177-8195) + the "I have read and agree"
checkbox; `RegistrationBand` is the event-page `bidRegState` slot (`.auc-reg` CTA / `.auc-msg`
pending|approved|rejected, app.html ~8300); `BidSheet` is a grouped max-amount field (reuses
`requests/amount`) pre-filled with `min_next_amount`, label by `is_leading`, `Toast` on accept /
rejection. `auctions.css` ports `.auc-msg*` / `.auc-reg` / `.dz-trm*` / `.actions .act-primary.bid`
(source lines cited). 13 new tests (68 total); typecheck / lint / format / build clean. Verified
end-to-end in-browser against a seeded local backend (real collector + admin approval): terms gate →
register (`terms_accepted_at` stamped) → approve → place bid ("Your bid is leading" + "Your bid is
in." toast) → a below-your-max raise is rejected with the server's message in the sheet + toast.
Frontend PR `phase-8-auctions-bidding`; backend PR `phase-11.2-auctions-bidding`.

## 2026-09-10 — Phase 8 step 1: collector auctions browse (list / event / lot) + live WebSocket

Read-only browse; bidding/registration is step 2. New `src/features/auctions/`: `AuctionListController`
(extends the shared `ListController`), `LotSocket` (the `ws/auctions/lots/{id}/?token=` live socket —
backoff reconnect, one token-refresh-and-retry on close 4003, quiet REST-poll fallback past the retry
cap) and `LotController` (REST `Lot` snapshot + `LotSocket`; merges live frames, re-fetches on
reconnect/focus, recomputes `is_leading` from the frame's `leading_bidder_id`). API layer:
`AuctionService`, `resolveWsUrl()` + `VITE_API_WS_URL` (mirrors `resolveBaseUrl()` — throws if unset,
no hardcoded fallback), `schema.d.ts` regenerated against `darzmarket-api` `phase-11.1`. Screens
`/auctions`, `/auctions/:id`, `/auctions/lots/:lotId` ported from `app.html` (`auctionsList` /
`aucDetail` / lot view; CSS class names + source lines cited). "Auctions" link added to the catalogue
hero. 13 new tests (60 total), typecheck/lint/format/build clean. Verified in-browser against a
seeded local backend: a bid placed via the admin path pushed a live WS frame that updated the lot
page (current bid / bid count / "Your bid is leading") with no reload. Depends on backend
`phase-11.1-auctions-lot-browse` (merged): nested `artwork` + `is_leading` on the collector lot
serializer, `lots_count` on `Auction`, WS close-code 4003 for an expired token, `seed_auction`
command. Plan + step breakdown: `docs/PHASE_8_PLAN.md`. Frontend PR `phase-8-auctions-browse`.

## 2026-09-07 — Phase 14: Vercel deploy config (deploy itself blocked)

Owner opened Phase 14 ("deploy it") and chose a **UI-only deploy** — publish the interface for visual
review now, wire the real API later. Two files, no application code touched. `vercel.json`: static
hosting on Vercel (`framework: vite`, `outputDirectory: dist`) plus the rewrite that does the real
work — every route but `/` is client-side, so `/artwork/:id`, `/saved`, `/artists`, `/login` and
`/admin/requests` would 404 on a static host without a fallback to `index.html`. `.env.production`:
`VITE_API_BASE_URL=https://api.invalid/api`, a deliberate placeholder — `darzmarket-api` has no
deployed URL, and `resolveBaseUrl()` throws when the var is unset with `api` built at module load, so
unset is a blank page rather than a degraded one; `.invalid` is RFC 2606 reserved and can never
resolve, so calls fail fast instead of reaching an unintended host. This does not weaken the
no-hardcoded-fallbacks rule — the code still has no fallback and still throws. Verified against the
real production build with `.env.local` moved aside: placeholder baked into the bundle, no `localhost`
leaked in, `/` → 200 and `/saved` → 200, and the app boots and renders the gate rather than
white-screening. **The deploy did not run:** `create_git_project` returns `403 forbidden — "You don't
have permission to create the project"` on team `Darz Market Studio's projects`; retried with the
default name, same result. Not worked around by deploying into the existing `darzstudio-art` or
`koocheh-web` projects — that would overwrite unrelated live projects. PR #4 → `main`, PR #5 →
`development`.

## 2026-09-07 — Merged and published Phase 6 + Flow 1 to `development` and `main`

Owner call: merge and publish. PR #1 (Phase 6 saved/favorites) → `development` (`5f65f4b`), PR #2
(Flow 1 request/offer → admin inbox) → `development` (`8ded1fc`), PR #3 synced `main` (`5b7ac9c`).
Both branches then had identical trees. Full suite re-run on the merge result before each step:
typecheck clean, 47/47 tests across 6 files, `format:check` clean, build clean; `lint` clean apart
from the one pre-existing `useCatalogue.ts` exhaustive-deps warning. Nothing was committed — both
branches were already fully pushed, so this was merge and sync only. `main` could not be pushed
directly from this session, so the sync went through PR #3 rather than a direct push; the identical
local merge commit was discarded to keep one merge in history instead of two. Carried forward
unresolved, unchanged by the merge: the offer `detail` shape (G-F1-1, a reading of the API rather
than a documented contract — a wrong shape still returns 201) and the missing principal-aware guard
on `/admin/requests`.

## 2026-09-05 — Flow 1: collector request/offer → admin inbox

`src/features/requests/`: `RequestController` (OOP, extends the shared `Observable`) files the four
artwork-detail actions through `POST /api/crm/requests/` — Buy now→`purchase`, 24h hold→`hold`,
Request viewing→`viewing`, Make an offer→`offer`, plus `price` as the primary on a price-on-request
work. `ActionButtons` (`.act-primary` + `.act-row`/`.act-box`, ported from app.html:9236-9243 with
the v458 column rule), `OfferSheet` (the Make an Offer sheet incl. live thousands-grouping and both
validation messages verbatim), `ConfirmSheet` (`dzActConfirm`). The `dzGuard` double-tap guard is
ported and proven at the server: three synchronous taps → one POST. `src/features/admin/`:
`AdminRequestsPage` at `/admin/requests` over `AdminRequestsController extends ListController` —
kind/status filters and per-row transition, statuses from `GET /api/options/`. Old frontend attached
read-only as `ariandarz/darzstudio.art` @ main (c46d96d); nothing copied from it — not the inline
Supabase credentials, not the OTP gate, not the localStorage model. 12 new tests (47 total);
typecheck/test/lint/format/build green; flow verified end-to-end in a browser. Maps and gaps in
`docs/FRONTEND_PORT_MAP.md` and `docs/FLOW_1_API_GAPS.md`. **No API-contract or `schema.d.ts`
change.** Branch `claude/flow-1-requests-offers-admin`.

## 2026-09-04 — Phase 6: collector saved / favorites

`src/features/saved/`: `SavedController` (OOP) is the one **server-derived** source of truth for the
saved set — reads `GET /api/crm/saved/`, wraps `crm.save()`/`crm.unsave()`, refuses a second write
for an artwork while one is in flight, and holds nothing in `localStorage` (owner call: offline =
NO), so the state is still right after a refresh. `SaveButton` (icon on `ArtworkCard`, `.actions`
row on `ArtworkDetailPage`), `/saved` + `SavedItemsPage` reusing the catalogue's card/grid chrome,
and one `Toast` for every confirmation and failure. New shared `Observable` base — `ListController`
and `SavedController` extend it rather than duplicating snapshot/listener plumbing. 14 new tests
(31 total); typecheck/test/lint/format/build green; every screen screenshot-verified, including the
pending, error and after-refresh states. **No backend, API-contract or `schema.d.ts` change** — the
four gaps found (`is_saved`, `saved/` query params, created-vs-restored, ordering) are written up in
`docs/PHASE_6_API_GAPS.md`, and none of them blocked the flow. Flagged: `app.html` was unreachable
from this session, so the control reuses already-ported chrome instead of a fresh line-by-line diff.
Branch `claude/phase-6-saved-favorites-gy70nd`.

Follow-up (2026-09-05): the detail-page Save control lost its magenta in Black mode —
`html.dz-bw .btn.outline` (components.css:83-88, a faithful port of app.html:48) resets every
outline button's colour with `!important` and flattened the saved state with it. Fixed with a
feature-scoped `html.dz-bw .btn.dz-save-action.on` override rather than narrowing the ported
block. The card heart was never affected (it is not a `.btn`) — verified in both themes.

## 2026-09-04 — Phase 4b/c: artist pages + login-gate design fidelity

Artist list/detail (`ArtistListPage`/`ArtistDetailPage`) over the backend's `ArtistFilterSet` — no
backend change needed. New `src/features/shared/ListController` abstract base; `CatalogueController`
and `ArtistListController` both extend it instead of duplicating the pagination/stale-response state
machine. `.dz-page`/`.dz-state` promoted to `src/design/components.css` (shared across features).

Login gate rebuilt across three screenshot-compared passes into an exact copy of `app.html`'s
`#dzGate`: landing (wordmark/chroma/eyebrow/"Enter the Room"/beta caption) then "Private Access"
form in the existing `Sheet`, with every field the old modal has (First name, access key w/
show-hide eye + `.code` styling, "Request access"). `Input` gained `trailing`/`inputClassName`
props. New CLAUDE.md rule: verify every new screen against a real screenshot before calling it
done — the first two passes missed the logo/chroma, then missed fields/links, because that
never happened.

## 2026-09-04 — Phase 4: collector catalogue + artwork detail

`src/features/catalogue/`: `CatalogueController` (OOP, same shape as `AuthSession`) + `useCatalogue`
— query state, fetch, pagination, stale-response guard. `CataloguePage` (hero/toolbar/grid/pager),
`ArtworkCard`, `CatalogueToolbar` (debounced search + sort + currency-gated price sort),
`ArtworkDetailPage` (Template A port: hero/status/fields/price/about — no action buttons yet, those
need Phase 5/6). Added `react-router-dom`: `/login`, `/` (catalogue), `/artwork/:id`, `/_design`
(Phase 2 showcase moved off root); `RequireAuth` guard + a minimal collector `LoginPage` (the API's
default permission is `IsAuthenticated`). Found + fixed live: `Artwork.artist` is nullable
(`on_delete=SET_NULL`) though the generated type omits it. Verified end-to-end against real seeded
data. 6 new tests. Backend companion: `darzmarket-api` `phase-19.2-catalogue-query` (merged) added
`?search=`/`?ordering=` + `ArtistFilterSet` + `CollectorRequestFilterSet`. Branch
`phase-4-catalogue` (based on unmerged `phase-3-api-client`).

## 2026-09-04 — Phase 3: typed API client + auth

`src/api/`: OOP client (hard rule) — `HttpError` hierarchy → `HttpClient` (fetch + `{success,data}`
envelope unwrap) → `ApiClient` (auth header + one 401→refresh→retry). `AuthSession` holds the
access token in memory + the refresh token in `localStorage['dz-refresh']` (owner call);
`abstract ResourceService` → `Auth`/`Catalog`/`Crm`/`Recommendation`/`Options` services; `DarzApi`
facade + `api` singleton; `ApiProvider` + `useApi`/`useSession`. `schema.d.ts` generated from the
live backend. `VITE_API_BASE_URL` from `.env` only (no hardcoded fallback). `vitest` + 9 client
tests; verified live against the running backend. Backend half: `darzmarket-api` branch
`phase-19-auth-session` (token refresh / logout / me + `currency`/`price_type`/multi-tag +
`core.filters`). Gap analysis + decisions in `docs/API_GAP_ANALYSIS.md`. Branch `phase-3-api-client`.

## 2026-09-04 — Phase 2: design system

Ported the shipped collector app's tokens + base components to React/TS (owner call: match
`app.html` `:root` over the stale guideline — warm palette, Cormorant body). `src/design/`:
`tokens.css`/`tokens/` (verbatim, line-cited), `Theme` + `ThemeController` classes (OOP core,
Paper⇄Black, `dz-theme` persist). `src/components/`: Logo/Wordmark, Chroma, Eyebrow, Button, Input,
Textarea, Card, Pill, Avatar, Toast, Sheet. Prettier added; `src/App.tsx` is now the showcase.
See `docs/adr/0001-styling-and-oop.md`. Branch `phase-2-design-system`; build + typecheck + lint green.

## 2026-08-28 — Phase 1: project scaffold

Vite + React + TypeScript scaffold in a new, separate git repo (local only, no GitHub remote yet).
Design/planning groundwork: confirmed the design-reference approach (DarzStudio `main`, not copied
in), the API-client strategy (live OpenAPI fetch), and wrote the full cross-repo phase breakdown.
