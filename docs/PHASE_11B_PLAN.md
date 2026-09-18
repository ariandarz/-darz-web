# Plan — Phase 11b: the Owner Panel

**Status:** **CONFIRMED 2026-09-18** — the owner answered *"go ahead with all your recommendation
and start step 0"*, so every D9-D16 recommendation below is the decision. **Step 0 is done**; see the
progress log. ·
**Sources read:** `ariandarz/darz-backend-api` @ `development` `12988db` (`urls.py`, views,
serializers, `docs/TASKLIST.md` Phases 23 + 27-35) · `ariandarz/darzstudio.art` @ `development`
**`darz-studio.html`** (the old admin panel — *not* `app.html`, which is the collector app) ·
this repo @ `main` `b3bb21d`.

Same working-contract form as `docs/PHASE_5_PLAN.md` and `docs/PHASE_24_35_PLAN.md`. Gaps found on
the API side go in `docs/PHASE_11B_API_GAPS.md` when there are any, and **no backend change is
proposed for any of them** — the owner's standing instruction is to build the UI around the gap and
record it.

---

## 1 · What the backend already gives, desk by desk

Backend Phases 23 and 27-35 built an entire admin panel's worth of API. **None of it has any
frontend UI.** This frontend has exactly one admin screen (`/admin/requests`) plus the one-line
scaffolding bar from the team sign-in, which `AdminLayout.tsx`'s own header already flags as
temporary: *"Deliberately **not** an admin shell; that is Phase 11."*

| Desk (old panel tab) | Endpoints | Backend phase |
|---|---|---|
| **Dashboard** | `GET /api/dashboard/admin/summary/` | 29 |
| **Collectors** (`users`) | `GET/POST /api/auth/admin/collectors/` · `GET/PATCH/DELETE .../{id}/` · `GET .../{id}/login-events/` | 27, 33 |
| **Access keys** (`access`) | `GET/POST /api/auth/admin/collectors/{id}/access-keys/` · `POST /api/auth/admin/access-keys/{id}/revoke/` · `POST .../{id}/extend/` | 27, 33 |
| **Access Requests** (`system`) | `GET /api/auth/admin/access-requests/` · `POST .../{id}/approve/` · `POST .../{id}/decline/` | 34 |
| **Collector Activity** (`activity`) | `GET /api/crm/admin/activity/` | 28 |
| **Collector Club** (`club`) | `GET/POST /api/crm/admin/selections/` · `GET/PATCH/DELETE .../{id}/` | 35 |
| **Memberships** (`memberships`, owner-only) | `GET/POST /api/auth/admin/membership-codes/` · `GET/PATCH/DELETE .../{id}/` · `POST .../{id}/renew/` | 30 |
| **Team logins** (`team`, owner-only) | `GET/POST /api/auth/admin/team-users/` · `GET/PATCH/DELETE .../{id}/` | 31 |
| **App Design** (`design`) | `GET/PUT /api/admin/app-theme/` · `POST .../reset/` · `GET/POST .../versions/` · `POST .../versions/{id}/activate/` · `DELETE .../versions/{id}/` — **plus the public `GET /api/app-theme/` (`AllowAny`)** | 32 |
| **Data Health** (`health`) | `GET /api/catalog/admin/data-health/` | 23 |
| **Import** (`import`) | `GET/POST /api/catalog/admin/import/batches/` · `GET .../{id}/` · `POST .../{id}/confirm/` · `POST .../{id}/discard/` · `PATCH .../{batch}/rows/{id}/` · `POST .../rows/{id}/reject/` | 23 |
| **Projects** (`projDash`…`projReports`) | `/api/projects/admin/` — `projects/` (+`/dashboard/`, `/reports/`, `/{id}/stage/`, `/{id}/attachments/`), `partners/`, `service-catalog/`, `packages/`, `checklists/`, each list + detail | 23 |
| **Audit log** (Settings → Audit log, owner-only) | `GET /api/admin/audit-log/` | 33 |

No API gaps were recorded by the backend for any of these — each is a plain admin CRUD/read desk,
faithfully scoped and real-HTTP-verified on their side. **This plan does not assume that holds; each
step re-checks the endpoint it consumes against the old desk's real behaviour before building, and
anything missing lands in `docs/PHASE_11B_API_GAPS.md`.**

---

## 2 · The old panel's real shape — and why the task list's flat list of nine desks is wrong

`docs/TASKLIST.md`'s Phase 11b entry lists nine desks as if they were siblings. They are not. The
old panel (`darz-studio.html:11721-11779`, `ADGROUPS`) is a **two-tier navbar** with sixteen groups,
and Phase 11b's desks are scattered across five of them:

```
Top row   Dashboard | Artworks | Artists | Galleries | Auctions | Market App | Documents | More
                                                       (owner) Social | Owner | Access Management
Second row (#adSubTabs)  the active group's sub-tabs
```

- `Artworks` → Database · **Import**
- `Market App` → Published works · **App Design**
- `More` folds five groups: **Collectors** · Sales · **Projects** · Intelligence · **Operations**
  - `Collectors` → **Collectors** · Requests & Activity · **Collector Club**
  - `Operations` → **App Design** · Logistics & Payments · Analytics · **Data Health**
  - `Projects` → Dashboard · Projects · Pipeline · Packages · Proposal · Calculator · Partners · Reports
- `Owner` (owner-only) → **Access** · **Team** · Strategy · Marketing · Accounting · Automations · Settings · Languages · Market Portal
- `Access Management` (owner-only) → **Memberships** · **Access Request**

Three things fall out of that, and each changes the work:

1. **App Design appears in two groups** (`market` and `operations`, `:11730` and `:11764`). One
   screen, two entry points. Not a bug to fix — a fact to port.
2. **Import is not a top-level desk**; it sits beside Database under Artworks. **Data Health is not
   one either**; it sits under Operations. Building them as standalone `/admin/import` and
   `/admin/health` pages with no group around them would be inventing an IA the old panel doesn't
   have.
3. **The owner gating is data, not markup.** `OWNER_ONLY` (`:11800`) is a literal list —
   `['igStudio','socialCal','socialAi','team','strategy','access','marketing','accounting',
   'automations','settings','system','memberships','portal']` — and `_dzAllowedTabs` (`:11794`)
   opens with an explicit rule worth quoting verbatim: *"THE OWNER ALWAYS SEES EVERY TAB — no
   Settings lock, role limit or owner-only flag ever hides a tab from the owner (owner request)."*
   Note `design` is deliberately **absent** from `OWNER_ONLY`, which is exactly why backend Phase 32
   gated App Design at `IsStandardAdminOrOwner` and Memberships/Team at `IsOwner`. The backend
   already matched this list; the frontend must match it too, from the same source.

### 2.1 Two desks the task list's Phase 11b entry is missing

That entry was written before backend Phases 34 and 35 landed. Both added an admin surface:

- **Access Requests** (`systemView`, `:33115`) — the review queue for the requests the collector
  gate now sends. This frontend built the *public submit* half in the last round (Phase 24-35 Step
  1); the *review* half has no UI, so every request submitted through the new form is currently
  invisible outside Django admin.
- **Collector Club** (`clubView`, `:33740`) — backed by Phase 35's `crm.CollectorSelection`, a
  named, admin-managed group of works + invited collectors that syncs the underlying
  `ArtworkSelectionGrant` rows.

And one the entry names only in passing:

- **Access keys** (`accessView`, `:33029`) — the old Owner → Access desk: every collector key with
  its expiry status, type/status filters, logins-today counter, and an "expiring soon / expired"
  review list. Phase 11b's entry folds key issue/revoke into the Collectors desk; the old panel has
  it as its **own owner-only desk** as well. Both are true — the same `AccessKey` rows, two views.

### 2.2 There is no approved design package for the panel

`../DarzStudio/design/market-app/` — the package CLAUDE.md calls "the first thing to open" — covers
the **Market App only** (the sibling `design/insights-stories/` covers one other surface). There is
no `design/admin/`.

So for Phase 11b, CLAUDE.md's "two sources required together" resolves differently: the approved
design spec **is** `darz-studio.html`'s own shipped CSS and markup, and the second source is the same
file's behaviour. That raises, not lowers, the bar on rule 5 — screenshot verification is the only
way to check a panel screen, because there is no reference capture to compare against. **Every step
below ends with a self-captured screenshot at 1440×900 compared field-by-field against the old
desk's rendered markup.**

The panel's own visual language is already in that file and should be ported the way
`src/design/tokens.css` was:

- `.ad-gtab` / `.ad-subtab` / `.ad-tabs` / `.ad-tabsep` — the two-tier nav (`:8193-8218`)
- the active-tab treatment is the brand seam: `background:var(--dz-seam) bottom/100% 2.5px no-repeat`
  — the same `--dz-seam` gradient this repo already has in `src/design/tokens.css`
- `.ad-card`, `.ad-h`, `.ad-badge`, `.ad-grpdot` (the red count dot), `.ad-cloudbar` (amber banner)
- `html.dz-admindark` — **the panel has its own dark theme**, independent of the Market App's
  `light`/`bw` skin. See D10.

### 2.3 Approve-a-request is a real behavioural deviation, not a port

The old panel's "Issue key" (`:37364`) opens the **full access-key modal** pre-filled from the
request — editable key, name, role, status, tier, and a composed note
`'From access request · ' + [city, why, 'via ' + source].join(' · ')`.

The backend's `POST /admin/access-requests/{id}/approve/` takes **one optional field, `tier`**
(`AccessRequestApproveSerializer`), derives the collector from the request, generates the key, and
returns the plaintext once with the message *"Key issued for {name} — shown once, deliver it
privately."*

So the new flow cannot be the old modal. The faithful thing is a small confirm with a tier picker,
then the shown-once key panel — and the composed note has nowhere to go on approve, only via a
follow-up `PATCH /admin/collectors/{id}/`. **Flagged, not silently dropped** (see D13).

### 2.4 "Shown once" appears in four places and must be one component

`POST .../collectors/{id}/access-keys/` (issue), `POST .../access-requests/{id}/approve/`,
`POST .../team-users/` (generated password) and `POST .../membership-codes/` (auto-generated code)
all return a secret the server never re-exposes. Four desks, one rule. That is one shared component
with a copy button and an explicit warning — built once in Step 1, reused by Steps 2, 3 and 4 —
**not four ad-hoc panels.** Same reasoning as CLAUDE.md rule 2.

### 2.5 Projects is bigger than everything else in this phase put together

`window.DZProjects` spans `darz-studio.html:13233-15535` — roughly 2,300 lines for eight sub-tabs,
a 17-stage pipeline with a status-derivation map, a package/checklist template system, a partner
directory, a calculator and a deliverables roll-up. Every other desk in this phase is a list, a
form and a couple of actions.

It does not belong in the same step as the rest, and arguably not in the same phase. See D12.

---

## 3 · Proposed work, in order

Each step is one PR, each ends green on `npm run typecheck && npm run lint && npm run format:check
&& npm test && npm run build`, and each ends with a screenshot compared against the old desk.

### Step 0 — the panel shell  *(prerequisite for every other step)*

Without this, each desk is an orphan page reachable only by typing a URL.

- `src/features/admin/adminNav.ts` — the `ADGROUPS` port: groups, labels, owner flags, the
  `OWNER_ONLY` list and the "owner always sees every tab" rule, as **data**, cited to
  `darz-studio.html:11721-11803`. Only the groups this phase actually builds are registered;
  unbuilt ones are **absent, not stubbed** (a greyed tab that does nothing is worse than no tab).
- `AdminShell` replaces `AdminLayout` — the two-tier navbar, the sign-out the scaffolding bar
  already carries, and `<Outlet/>`. `admin.css`'s `.ad-bar` block, flagged there as scaffolding,
  is deleted in the same commit rather than left to rot.
- Route tree: `/admin` → the group/tab paths. `RequireTeam` already exists and already guards the
  desk; this step adds a `RequireOwner` for the owner-only tabs, reading `me.role` — the same
  `owner` / `standard_admin` split the backend enforces, so a standard admin sees no Memberships
  or Team tab **and** cannot reach them by URL.
- `features.adminDesk` keeps gating the whole `/admin` prefix, unchanged.

**Verify:** every registered tab reachable; owner-only tabs absent for a standard admin and
redirecting on a typed URL; the active-tab seam renders.

### Step 1 — Dashboard + the shown-once component

- `GET /api/dashboard/admin/summary/` — requests needing attention per kind, today's
  requests/collectors/bids/logins, collector totals, catalogue breakdown by availability, auction
  live/scheduled + pending registrations, pending exhibition reviews. One read, no writes.
- The shared **shown-once secret** component (§2.4), built here because Step 2 needs it.
- Lands the shell's default page, so Step 0 stops opening on an empty frame.

The old `dashboard()` (`:21332`) carries tiles this API has no number for (perf/analytics charts,
cloud-sync banners) — backend Phase 29 scoped those out deliberately. Those tiles are **omitted and
listed in the step's PR body**, per CLAUDE.md rule 6; if the owner wants them kept as empty states,
that is D16.

### Step 2 — the Collectors group: Collectors · Access keys · Access Requests

The coherent "who gets in" cluster, and the one that closes a live hole: requests submitted through
the form shipped last round are currently invisible.

- **Collectors** (`users()`, `:32610`) — list/search/filter (tier, access_status), create, edit
  (optimistic-lock, 409 surfaced), soft-delete, per-collector login history.
- **Access keys** (`accessView()`, `:33029`) — issue (shown-once), revoke, extend (+1 week /
  +1 month / permanent — `AccessKeyService.extend`), the expiry-status cell (`expCell`, `:33042`:
  Never / Expired / Expires today / *n*d left, with its three colours) and the expiring-soon list.
- **Access Requests** (`systemView()`, `:33115`, panel `accReqPanel()`, `:33006`) — the pending
  cards with name · date · contact · city · "heard via" · referral · the quoted `why`, and the two
  actions. Copy verbatim, including the empty state: *"No access requests yet. A prospect can ask
  for access from the app sign-in screen ("Request access"). New requests appear here."*

### Step 3 — Collector Activity + Collector Club

- **Activity** (`activity()`, `:29385`) — read-only feed, filter by collector/kind/artwork.
- **Collector Club** (`clubView()`, `:33740`) — named selections: name, note, the artwork picker
  (`clubTog` tile grid) and the invited-collector list. Worth a careful read of Phase 35's overlap
  rule before building: removing a (work, collector) pair only revokes the grant if no *other*
  selection still wants it, so the UI must not imply a selection owns its grants exclusively.

**This step also settles a gap.** `docs/PHASE_24_35_API_GAPS.md` **G-P24-1** says the curated chip
can only ever read "Curated for You" because grants have no name. Phase 35 means the name now
**exists** (`crm.CollectorSelection.name`) — it is just not published on the collector-facing
`ArtworkSelectionSerializer`, which returns the artwork plus `visibility` and nothing else. The gap
stands; its description is being corrected in this same round.

### Step 4 — the owner desks: Memberships · Team logins

Both owner-only, both small CRUD, both shown-once.

- **Memberships** (`membershipsView()`, `:33306`) — issue (auto `DZ-<plan>-<6>` or custom), list,
  edit, renew (+1 month from `max(expiry, today)`), remove. Plans, and their on-screen prices, are
  in `MEMB_PLANS` (`:33131`): Basic Access / Premium Access / Free Invite. **No payment processing
  anywhere** — the old desk says so on screen and the backend stores no payment; the UI must keep
  saying it.
- **Team logins** (`teamView()`, `:19420`) — issue (password shown once), list, edit
  name/email/role/is_active, remove. The API 400s a team user acting on **their own** account, so
  those controls render disabled with a reason, not as a toast after the fact.
  Backend Phase 31 flagged one deviation already: the old desk hard-codes `role:'admin'` plus a
  per-tab `teamAccess` grant; this system has two real roles instead. The role picker offers those
  two — no parallel access-grant UI.

### Step 5 — App Design, both halves

- **The admin editor** — publish the live theme (freeform JSON: colours, layout, dark mode, stats
  strip, social links, per-page buttons — no fixed schema on either side), reset to factory,
  save/list/activate/delete named version checkpoints. The old desk's two buttons are distinct:
  "Save" and "Save version" (`designView()`, `:30426`); the API matches that exactly (a version is
  an explicit action, never an automatic snapshot).
- **The public consumer** — and this is the half that matters more. `GET /api/app-theme/` is
  `AllowAny`, readable pre-login, and it can carry the values this repo currently hardcodes: the
  WhatsApp chat number, hero copy, About text, social links, `shipNote`, Terms/Privacy text. Those
  are open items in `docs/API_INTEGRATION_GAPS.md`. Wiring them closes several at once — but it
  changes the **Market App**, not just the panel, and someone has to fix the key names. See D14.

### Step 6 — Data Health + Import

- **Data Health** (`healthView()`, `:26360`) — three checks survive into this architecture
  (duplicate images, incomplete records, published-but-hidden); the other five diagnosed the old
  app's own client-snapshot-vs-cloud drift, which does not exist here. The desk shows three, and
  says plainly that it shows three.
- **Import** (`importView()`, `:29703`) — the staging review queue. **The file parsing is
  frontend work**: the backend only accepts already-structured rows. CSV column mapping and paste
  are straightforward; PDF extraction means pdf.js, a new dependency. See D15.

### Step 7 — Projects

Deferred to its own plan (`docs/PHASE_11C_PLAN.md`) unless the owner says otherwise — see D12.
Eight sub-tabs, ~2,300 lines of old source, and one sub-tab (Proposal Builder) the backend
deliberately did not build.

---

## 4 · Owner decisions — all taken as recommended (2026-09-18)

> The owner answered every one of these with the recommendation. One turned out
> to be **unnecessary** once the code was opened: **D10**. `src/features/admin/admin.css`
> already established, back when the request desk was built, that the old panel's hard-coded
> light palette is mapped onto **this repo's tokens** rather than ported with its
> `html.dz-admindark` override layered on top. That gives Paper and Black from one rule set, so
> there is no "dark pass" to schedule and no second theme toggle in the panel header — verified on
> screen in both skins at Step 0. The recommendation ("light-only first, dark later") is therefore
> superseded by a better answer the repo already had.


| # | Question | My recommendation |
|---|---|---|
| **D9** | Port the old panel's full sixteen-group nav, or only the groups Phase 11b builds? | **Only the built groups**, using the real two-tier structure. An unbuilt group registered as a dead tab is worse than an absent one. The `ADGROUPS` port is written so adding the rest later is data, not surgery. |
| **D10** | `html.dz-admindark` — port the panel's own dark theme now, or light-only first? | **Light-only for Steps 0-4, dark in a dedicated pass.** The panel's dark rules are scattered through ~40 `html.dz-admindark` overrides; doing them per-desk guarantees drift. One pass at the end is cheaper and more consistent. |
| **D11** | Is the panel a desktop tool? The old one has a `<=820px` rule but is clearly built for a wide screen. | **Desktop-first**, porting the old file's own breakpoint behaviour where it exists, and **not** inventing a mobile panel the old app never had. |
| **D12** | Projects — in this phase, or its own? | **Its own (Phase 11c).** It is larger than Steps 0-6 combined and has its own sub-IA. |
| **D13** | On approve, the old flow composed a note (`'From access request · city · why · via source'`) that the new one-call approve has nowhere to put (§2.3). Keep it by following approve with a `PATCH` to the new collector, or drop it? | **Keep it** — one follow-up `PATCH`, so the reviewer's context survives into the collector record the way it used to. Cheap, and losing it is a real regression. |
| **D14** | App Design's public read — should the Market App start reading `GET /api/app-theme/` for the WhatsApp number, hero copy, About text, social links, `shipNote` and Terms/Privacy? And who fixes the key names? | **Yes, in Step 5**, with the key names taken from the old panel's own `app_theme` payload rather than invented here. This closes several `API_INTEGRATION_GAPS.md` items. It needs a confirmation because it changes the collector app. |
| **D15** | Import — CSV + paste only, or also PDF (pdf.js, a new dependency)? | **CSV + paste first**, PDF as a follow-up. The staging queue is useful the moment one input works, and pdf.js is a real weight to add for one desk. |
| **D16** | Dashboard tiles the new API has no number for (perf/analytics charts, cloud-sync banners) — omit, or keep as empty states? | **Omit, and list them in the PR body.** A cloud-sync banner describes an architecture this system does not have; an empty chart is a promise. |

---

## 5 · Not proposed now

- **Projects** — D12 above.
- **The Proposal Builder sub-tab** — not built on the backend either; would reuse
  `documents.Document` like the gallery portal's exhibition proposals, once scoped.
- **Audit log** (`GET /api/admin/audit-log/`) — real and owner-only, but it lives under the old
  panel's Settings tab, which this phase does not touch. Add it when Settings is built, or as a
  one-screen addendum if the owner wants it sooner.
- **Instagram / Social Studio, Automations / AI-assist, Strategy** — the backend flagged all three
  as deliberately unscoped, pending an owner decision on their side. No frontend work is possible.
- **Phase 11 proper** (Marketing Hub, AI Tagging, Document Builder, Accounting) — backend-ready and
  still unbuilt, but a separate task-list entry and a separate body of work.

---

## 6 · Size, honestly

Steps 0-6 are roughly the size of everything this repo has built so far. Step 7 (Projects) is
larger again. Nothing here is blocked on the backend, and nothing here is blocked on the Vercel
permission that blocks the v0.1 launch — this is build work that can proceed in parallel with that
being sorted out.

---

## Progress log

_Append one entry per step as it merges. Newest last._

- **2026-09-18 — plan written.** Waiting on the owner's confirmation and the D9-D16 answers.
  Nothing implemented.

- **2026-09-18 — owner confirmed the plan**, taking every D9-D16 recommendation. Recorded in §4,
  along with the one that turned out to be unnecessary (D10 — `admin.css` had already solved it).
- **2026-09-18 — Step 0 implemented and verified live.** The panel shell.
  `src/features/admin/adminNav.ts` is the `ADGROUPS` port (`darz-studio.html:11721-11803`) as data:
  groups, labels, owner flags, the `OWNER_ONLY` list and the "owner always sees every tab" rule,
  with the five Phase 11b groups registered and an unbuilt tab carrying `path: null` so nothing
  renders it (D9). `AdminShell` replaces the scaffolding `AdminLayout`, porting the two-tier navbar
  and all four of `_dzRenderSubnav`'s easy-to-miss rules (the More row prefix, the one-tab
  suppression, the no-group Dashboard, the group eyebrow). `RequireOwner` ports the old panel's own
  refusal card rather than redirecting — it has **no caller yet**, and gets one at Step 2 with the
  first owner-only desk. `/admin` and any unknown `/admin/...` clamp to the first page the role can
  open, which is the old panel's own `:11815` behaviour rather than the collector Market the global
  catch-all would otherwise give a team session.
  Verified live at 1440×900 against the local backend, as an **owner and a standard admin**, in
  **both skins**: `/admin` → `/admin/requests`; the two rows render; the More row, its separator and
  the group eyebrow are all present; the active tab's underline is the real `--dz-seam` gradient by
  computed style, not a flat colour; `/admin/team`, `/admin/collectors` and `/admin/nonsense` all
  clamp to the desk rather than to Market; signed out, the whole prefix goes to the team gate.
  158 tests (was 141), 17 added.
  One thing the screenshot showed that reading could not: with only one folded group and one tab
  built, the second row reads **"Collectors | COLLECTORS · Requests & Activity"** — the More-row
  entry, the group eyebrow and the group's first tab all say the same word. That is what the old
  panel does too (its More row lists the folded groups, the eyebrow is the group label, and the
  Collectors group's first tab is "Collectors"); it only looks odd because five-sixths of the row is
  not built yet. Left faithful rather than "fixed".
- **2026-09-18 — the map + the desk kit merged (PR #42)**, on the owner's instruction, after the
  scope grew to the whole panel: `docs/ADMIN_ARCHITECTURE.md` now governs everything outside this
  phase's 11 tabs, and the kit (DeskPage/DeskList/DataTable/filters/ConfirmDialog/ShownOnceSecret)
  is the shared vocabulary every desk assembles from.
- **2026-09-18 — Step 1 done: Dashboard + Chat** (the two group-less tabs). Dashboard over
  `GET /api/dashboard/admin/summary/` with the old :21349 rule kept — a tile opens exactly the rows
  it counted, via `?kind=&status=` deep links the requests desk now reads from the URL (G-DASH-1
  recorded for the initial-status inference). Chat over the crm admin thread endpoints, with the
  thread machine extracted to `MessageThreadController` and bound twice (collector/admin, seen
  direction flipped per :40547). The old pane's AI Monitor, mode, assignee, conversation status,
  Clear and client-side search have no backend — flagged in the page headers and G-CHAT-1/2.
  Live-verified end to end: tile → filtered desk (1 counted → 1 listed), thread send lands as a team
  bubble with "Sent to the collector ✓". 185 tests (was 179). The team gate's default landing is now
  `/admin` (the clamp), not a hardcoded desk.
- **2026-09-18 — Step 2 done: Collectors + Access Requests** (merged under the owner's overnight
  instruction, as Step 1 was). The roster over the server's own `CollectorFilterSet`; the
  per-collector workspace (record · keys · sign-ins) carrying the old Access desk's per-key
  features (shown-once issue, revoke, the three extends, `expCell`); the owner-only review queue
  with the §2.3 approve deviation and D13's follow-up note. Three gaps recorded (G-COL-1/2,
  G-KEY-1 — the roster-wide key desk stays `[!]`). Verified full circle: an issued key signed a
  real collector in at the gate; a standard admin gets the :33116 refusal card and no Access
  Management group. 190 tests.
- **2026-09-18 — Step 3 done (promoted): App Design, the control half.** The owner's switches are
  live end to end: desk → `theme.features` → public read on boot → the collector app, with the
  build-time set as the unremovable floor. Verified by switching Records off and watching the
  collector's deep link clamp, then Reset and Activate both round-trip. The copy/contact/social
  keys and the old visual editors follow with their consumers (D17). The live theme was reset to
  factory after verification, so nothing stays switched off by accident overnight.
- **2026-09-18 — Step 4 done: Memberships + Team logins**, the two owner-only CRUD desks, both
  shown-once shaped. The membership plan set is the collector tiers (the backend's Phase 30 call);
  the Team desk is the logins, with the old Workspace suite recorded as G-TEAM-1 rather than faked.
  Verified: auto-generated code + wa.me link + renew math on screen; a freshly issued team password
  signed its owner in as a standard admin with no gold groups.

