# Handoff — start here

**Written 2026-09-22, end of the session that released PRs #69-#71.**
**Updated 2026-09-22 by the session that met Phase 6's DoD** — §3's three "waiting on the
owner" rows and its first unblocked item are done; the changes are marked inline.

This file is the fastest way into the repo for a new session: where things stand, what is
genuinely next, and the traps that have already cost time. `docs/TASKLIST.md` remains the
progress record and `docs/ADMIN_V1_AUDIT.md` remains the plan; this is the two-minute version
and the part neither of them says.

---

## 1 · State of the repo

| | |
| --- | --- |
| `main` / `development` | **Identical trees** (`main` leads by its merge commit only), as of PR #71 |
| Open PRs | **None** |
| Gate | **484 unit tests · 77 E2E tests** · typecheck · lint **0 warnings** · format · build |
| Deploy | Still none. The Vercel project does not exist — frontend Phase 14, blocked on a team role |

The admin panel is ~85-90% of V1. The collector app's v0.1 loop is closed. What is left is listed
in §3.

---

## 2 · What the last session changed, in one paragraph each

**The kit learned to confirm a write (#69).** `DeskToast`, `DeskSave` and `ConflictBanner` in
`src/features/admin/kit/`. The first two are ports of the old panel's own `toast()` and its
v510/v631 "✓ Saved" flash; the third was consolidated from six Projects desks that had each
written the same sentence independently. TD-4, TD-5, TD-6 and TD-7 closed. Three of the audit's
own findings turned out wrong when checked against the backend — see §4.

**The whole app was walked for the first time (#70).** Every route, opened in a browser. It found
**eight broken ones**, two already released to `main`. Six were one mistake repeated: trusting a
response's shape. One was a routing bug that had left a whole page unreachable. One was a blank
surface on every desk that no amount of source-reading could show. All fixed, and the walk is now
`e2e/desks.spec.ts` + `e2e/collector.spec.ts` so it cannot silently come back.

---

## 3 · What is actually next

### Waiting on the owner — do not start these without a ruling

| Ref | Question | Recommendation |
| --- | --- | --- |
| ~~**G-DEL-1**~~ | ~~Build the three deletes…~~ | ✅ **Approved and built 2026-09-22.** All three, old confirm copy verbatim, owner-only gate kept on documents |
| **G-LOCK-1** | Backend: put the optimistic lock on Accounting and Auction Records? They are **last-write-wins** today — two admins silently overwrite each other | **Yes for the ledger at least.** A silent overwrite there costs money |
| ~~**Collector error boundary**~~ | ~~The admin has `DeskBoundary`; the collector app has nothing…~~ | ✅ **Approved and built 2026-09-22** as `ScreenBoundary`. The design objection dissolved: the old app already catches a thrown render (`app.html:9821`) and "Something went wrong" is its heading verbatim, so no copy was invented |

### Unblocked — pick these up freely

1. ~~**Finish Phase 6's fidelity pass.**~~ ✅ **Done 2026-09-22** —
   `docs/ADMIN_V1_AUDIT.md` §10 "Phase 6 DoD — met". Two notes for whoever reads the advice
   above, because it was half right: the desks' file headers *were* usually honest about their
   differences, and the fixes still outnumbered the confirmations, because **three of the
   findings were not per-desk at all**. `DeskPage` had no `subtitle` slot and no `strip` slot, so
   every desk's sub-line and every count strip rendered below the filter row; and `.ad-deskintro`
   was a second subtitle class. None of that is visible in one desk's source. §5's method is what
   found them — and `e2e/capture-desks.mjs` now automates the screenshot half of it.
2. **Phase 5b** — the Database desk's four hard filters (completeness, size ranges, duplicate
   images, Gallery Portal). Backend work first; the desk already names them as unavailable.
3. **TD-8** — `admin.css` is one ~3,800-line file. Splitting it is safe now that the E2E walk
   exists, but there is no *visual* regression baseline, so split in small steps and screenshot.
4. ~~**TD-3**~~ — ✅ **done 2026-09-22.** The decision it was waiting on turned out to have a
   wrong option in it: **not `theme.*`**, because `GET /api/app-theme/` is `AllowAny` and would
   publish a card number and an IBAN to anyone who can reach the API. The page now seeds from the
   most recent issued invoice's `Document.fields.bank` — already stored server-side on every
   invoice, so shared, durable, and nothing new published. See `exhibitions/bankDetails.ts`.
5. **One recorded fidelity finding** that is a scope decision rather than a fix: the Market App's
   every-published-work tile is no longer blocked (G-2 shipped `published`) but is admin-only,
   while that desk reads the collector catalogue for its images. *(The Documents sub-tabs that
   sat here are resolved: **Create** was never missing — it is `/admin/issue`, and the Documents
   group had simply lost the entry point when that desk moved to Galleries; **Pricelists** is
   backend-blocked and `adminNav.ts` always said so, which the desk now says too.)*

### Not planned

Intelligence · Marketing · Document Builder — **G-6, deferred 2026-09-21**. Logistics, Analytics,
Stories, Social ×3, Languages, Strategy, Automations, Pricelists, Auction Sales — backend-blocked.

---

## 4 · Things that were believed and turned out false

Written down because each cost time, and because the pattern matters more than the items: **a
claim in a doc or a file header is not evidence.** Check it against the backend or the browser.

- The audit's **TD-5** named Accounting and Records as desks that mishandled a 409. They cannot
  409 at all — `enforce_version` is only called from `catalog`, `accounts`, `projects`, `crm` and
  `sales`. The real problem there was the opposite one (G-LOCK-1).
- The audit's **TD-6** called eight service methods dead. Three were **buttons the old panel ships
  and this port never built**; deleting them would have hidden a parity gap.
- The audit's **TD-9** said no test opens a desk. One had since #66.
- Three file-header comments still said the Year/Source/Market-App filters had no server param.
  **G-2 shipped them in #66.** The code was updated; the comments were not.
- `src/api/schema.d.ts` is **stale** — it declares no 409 on four endpoints that really do
  conflict. Anyone reading the generated types to decide whether a write can conflict would
  conclude, wrongly, that none can. Regenerate it against a running backend before trusting it
  (`CLAUDE.md` → API access).
- And two of my own, corrected in-branch: "only two desks have a subtitle" (a too-narrow grep;
  it is ten-odd, and three built desks had dropped theirs) and a conflict branch written for a
  transition endpoint that sends no version.
- **That subtitle correction was still short.** Grepping the style the old panel writes them in
  finds **seventeen**, and a fourth built desk had dropped its own (Live Auctions), a fifth had
  never had it (Galleries — it shares a route with Sources & Partners and drew that desk's
  heading), and Accounting had lost **all six** of its per-book lines. Restoring three of them
  the day before also put them in the wrong place, which is the `subtitle`-slot fix above. The
  pattern in this section holds for its own entries too.
- The Chat desk's header said `/api/crm/admin/requests/` has **no text-search param**, "a gap
  worth raising with the backend". **G-5 shipped it** on that exact endpoint the day before, and
  the Requests desk was already using it.

---

## 5 · How to see a screen (this is the unlock)

**Do not try to run the real backend for visual work.** You cannot sign into the panel: the only
`TeamUser` is `owner@darz.local` and its password is recorded nowhere; resetting it is refused as
a shared-resource change. Ask the owner if you genuinely need populated data.

Use the E2E stub instead — it accepts any sign-in and needs no backend:

```bash
node e2e/stub-server.mjs &                                      # :8787
npm run e2e:build                                               # builds against the stub's origin
npx vite preview --outDir dist-e2e --host 127.0.0.1 --port 4173 --strictPort &
```

Drive it with Playwright. The pinned Chromium is not installed on this machine — use
`channel: 'chrome'`, or for the suite:

```bash
PW_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run e2e
```

Sign-in, exactly:

- **Panel** — `/admin/login`, `input[name=email]` + `input[name=password]`,
  `form button[type=submit]`, then `waitForURL('**/admin')`. Do **not** wait on a regex like
  `/\/admin(\/|$)/`: it matches `/admin/login` itself and resolves before the session exists,
  which silently walks every route as a logged-out user.
- **Collector** — `/login` opens on a landing state; click **Enter the Room** first, then
  `input[name=firstName]` + `input[name=accessKey]`.

For a readable stack (the production build's is minified), point `.env.local`'s
`VITE_API_BASE_URL` at `http://127.0.0.1:8787/api` and run `npx vite --port 5180`.

**The stub's limits, which are also its contract.** It answers an empty *paginated* envelope for
any unmatched GET, so every screen renders its empty state — it cannot show a populated desk. A
few endpoints really return a bare array or a keyed object, and those are registered explicitly;
when a desk misbehaves under the stub, ask first whether the stub is the one lying. Its only
state is the principal, carried in the bearer token rather than remembered, because Playwright
runs spec files in parallel against one server.

---

## 6 · The bug this repo keeps writing

Eight instances by 2026-09-22. Code reads `.map` / `.length` / iterates a field straight off a
response; the field is not what was expected; the render throws; **the whole screen goes blank**,
because a thrown render takes its subtree with it.

It keeps happening for two reasons worth internalising: a `data &&` guard passes for *any* object,
so "not null" gets mistaken for "right shape"; and not every endpoint returns the paginated
envelope — `retrieve<X[]>` returns a bare array, so the assumption is wrong even against a
healthy backend.

What to reach for:

- **`asArray()`** (`src/api/shapes.ts`) — the default. One call, for a single field that should
  be a list.
- **`normaliseFacets` / `normaliseLedgerSummary`** — the pattern when a response has real
  structure worth a module.
- **`DeskBoundary`** — under the admin `<Outlet>`, catching what slipped through. It is a floor,
  not a substitute. **The collector app still has none** (see §3).

And the way to find more: walk the routes (§5) and assert nothing throws. Both spec files did
exactly that on their first run and both found real bugs.

---

## 7 · House rules that are easy to miss

- **Two sources, always** (`CLAUDE.md`): the approved design package *and* the old code. A screen
  built from description alone is not a faithful port.
- **Verify against a rendered screen before calling a screen done.** The panel-surface bug is the
  standing proof: the source read correctly and every desk was wrong.
- **A field the old app has and this backend does not support is a flag, not a deletion.** Say so
  in a comment and to the owner.
- **Merging needs the owner to ask, per request.** An instruction to "keep things moving" is not
  a merge authorisation; the 2026-09-22 note in `CLAUDE.md` spells out that distinction.
- **Never bare `git stash`** in a worktree — the stack is shared with the main checkout.
