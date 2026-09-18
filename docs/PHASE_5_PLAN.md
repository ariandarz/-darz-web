# Phase 5 — Collector: requests + activity — implementation plan

**Status:** COMPLETE — all four steps implemented and merged (steps 1-3) or open as PR #26 (step
4). Owner-confirmed 2026-09-17 (D1-D11 — see § Resolved decisions; **F1 remains open**) ·
**Created:** 2026-09-17 · **Slicing proposed:** four frontend steps, no backend work — every API gap
is documented and the UI is built around it (owner instruction, 2026-09-17: "if any gaps on the API
side, focus only on the UI design and implement that, then update the API gaps document").

This plan is the working contract for finishing Phase 5. Unlike Phase 8 it touches **one repo**: the
backend (`../darzmarket-api`, remote `ariandarz/darz-backend-api`) is read, not changed. Three sources
were checked together on 2026-09-17, as `CLAUDE.md` requires:

- **Backend `development` @ `3801786`** (2026-09-11, the Phase-19-closing merge; nothing newer exists).
  Its OpenAPI document was generated locally (`manage.py spectacular`, venv, dummy `.env`) and is
  **byte-identical** to the committed `src/api/schema.d.ts` after `openapi-typescript` — the typed
  client is current, no regeneration is needed.
- **The design package** `design/market-app/` (build 1229) — **it is not on `darzstudio.art` `main`.**
  It lives only on the head of `darzstudio.art` PR #846 (`claude/youthful-shannon-8ind4p`, `627eea3`),
  an open **draft** against that repo's `development`. `CLAUDE.md` reference 0 assumes it is in the
  clone; until #846 merges, fetch that branch to read it (owner flag F1 below). Its captures for this
  phase: `03-detail(-full)`, `04-request-price`, `05-offer`, `15-profile-overview`, `16-profile-market`
  (the profile capture shows only the empty state — a fresh device), `23-chat`.
- **`app.html` @ `main` `e9e4d6d`** (v1232, 2026-09-12) — the shipped behaviour, line-cited below.
  The v1232 "post-launch collector loop" (`packages/domain/collector-loop.js`, doc 15) is **prepared,
  not wired** — a proposal, not a surface to port (see § Deferred).

## What we found (2026-09-17)

### The API the collector side has (all `IsCollectorPrincipal`, envelope `{success,data,message,timestamp}`)

| Need | Endpoint | State on `development` |
|---|---|---|
| File a request | `POST /api/crm/requests/` (`apps/crm/views.py:71`) | 8 kinds: `information · price · availability · hold · offer · viewing · purchase · message`. `detail` validated per kind by `DETAIL_SERIALIZERS` (`apps/crm/serializers.py:42-51`); unknown keys are **dropped**; `client_req_id` replays the row with **200** instead of **201** (`apps/crm/services.py:74-78`); `purchase/hold/offer/viewing` are gated by `artwork.allowed_actions` (`400 action_not_allowed`); an offer under the private floor is `400 offer_below_floor`. |
| Per-kind `detail` | same | `hold` → no fields (server sets `expires_at`, **48 h**, `apps/crm/models.py:155`) · `offer` → `amount` (decimal, returned as a **string**), `currency` (ISO list + `TMN`), `counter_of` (accepted, unused) · `viewing` → **`preferred_time` (datetime, required) + `mode` (`in_person` \| `virtual`, required)** · `information/price/availability/message` → `message` (optional) · `purchase` → `notes` (optional). The OpenAPI document still types `detail` as an opaque object (G-F1-1: `detail_polymorphic_serializer()` exists at `serializers.py:54` with zero call sites). |
| Statuses | `GET /api/options/` → `crm.request_status_by_kind` (`apps/crm/lifecycle.py:14-52`) | hold `requested→active→expired/released/converted` · offer `submitted→countered/accepted/declined/withdrawn` · viewing `requested→scheduled/cancelled→completed` · purchase `intent→qualified→negotiation→confirmed` · the four simple kinds `new→assigned→answered→closed`. **Only the admin transition route moves a status**; the collector has no transition, cancel or withdraw. |
| My requests | `GET /api/crm/requests/?kind=&status=` (`views.py:71`, `RequestCollectorSerializer`) | newest first, paginated (`page`/`per_page` work but are **not declared** in the schema). `artwork` is a **bare uuid** (no title / artist / image on this tier), `detail`, `unread_count`, `version`. **No `GET /api/crm/requests/{id}/`.** |
| Thread | `GET/POST /api/crm/requests/{id}/messages/`, `POST …/mark-seen/` | every kind is threadable; `body` + `artwork_refs`; sender `collector` \| `team`. Already wired (`CrmService.messages / postMessage / markSeen`). |
| Activity | `POST /api/crm/activity/` (`views.py:105`) | `kind ∈ view · save · search · login`, optional `artwork`, free `metadata`. Append-only, **no GET**. `CrmService.logActivity` exists (`src/api/services.ts:168`) and is **never called**. |
| Remove / clear my activity | — | **absent**: no collector delete, archive or hide (`admin_archived` is admin-only, no endpoint). |
| Hold expiry on read | — | the 48 h auto-expiry runs on admin transitions and a 300 s Beat sweep, **not** on the collector's list read — a hold can read `active` past `detail.expires_at`. |

### The frontend today (`src/features/requests/`, `profile/`, `conversations/`, `chat/`)

Built and merged: the `.actions` block (`ActionButtons`, filtered by `allowed_actions`), the Make-an-Offer
sheet, Send Inquiry (`InquiryAction` + `InquirySheet`, v0.1's one CTA), the confirmation sheet
(`dzActConfirm` → `ConfirmSheet`), `RequestController` (verb → kind, double-tap guard, one
`client_req_id` per action re-sent on retry), the general Chat and the per-request thread
(`ThreadPage` at `/chat/:id`), the Profile › Market list with the old app's five chips, and the admin
feed with server-driven transitions. Tests: 14 on `RequestController`, 4 on the admin controller.

Found on 2026-09-17, to fix in this phase:

1. **Request viewing is broken against the backend.** `visit` files `kind=viewing` with **no `detail`**
   (`RequestController.ts:167-215`), and `ViewingDetailSerializer` requires `preferred_time` + `mode`
   → `400 VALIDATION_ERROR`. Hidden in v0.1 (behind `features.commerceActions`), live in `full`.
2. **Request price** files a bare `kind=price` with the generic "Request received" copy. The old app
   opens the **Request Price & Availability** sheet (`app.html:11046-11048`) and confirms with
   "Enquiry received" (`:11064`).
3. **Non-inquiry rows are dead links**: `ProfilePage.tsx:431-434` routes purchase / hold / offer /
   viewing / price rows back to `/profile?tab=market`; the backend has a thread for each of them.
4. **Row labels drift from `ACT_KL`** (`app.html:7512`): `rows.ts:7-16` says "Hold · Offer · Viewing ·
   Purchase · Price request"; the old app says "24h hold · Offer made · Viewing request · Buy now ·
   Price enquiry · Message to Darz". `shortDate` drops the time the old app shows ("5 Sep · 14:30",
   `:7513`).
5. **No "Your acquisitions" section** (`dzAcqSectionHTML`, `app.html:9685-9703`: purchase / offer / hold
   rows with the Requested → In review → Accepted → Complete rail) and **no request-detail surface**
   (`DZ.actOpen`, `:11265-11318`: status banner, meta rows, the per-kind status note, the thread).
6. **Status vocabulary is hardcoded in three places** (`rows.ts:31-36`, `ProfilePage.tsx:52`,
   `ConversationsController.ts:33-40`) although `crm.request_status_by_kind` is published; the old
   app maps admin statuses to a **collector** vocabulary (`dzStatusMeta`, `:9421-9429`).
7. **Activity self-logging is not wired** (`logActivity` dead; TASKLIST Phase 5 `[ ]`).
8. **The artist-page enquiry bypasses `RequestController`** (`ArtistDetailPage.tsx:106-124`): a
   `Date.now()` `client_req_id` (not idempotent), a toast instead of the old app's "Enquiry received"
   confirmation (`app.html:11033-11044`).
9. **`docs/API_INTEGRATION_GAPS.md` drift**: G-F1-5 / G-F1-6 name `CrmService` methods and a
   `clientReqId` parameter that do not exist, and still list the thread UI as open.

### The old app's surfaces to port (line-cited; the design package agrees where it speaks)

- **Detail actions** `app.html:9217-9246` — primary `Buy now` (`act-primary`, `.dzglow` when
  available), boxes `24h hold · Request viewing · Make an offer` (`.act-box`, icons clock / eye / tag),
  price-hidden works get one `Request Price & Availability` primary (`:9242`). Capture `03-detail-full`.
- **`DZ.act`** `:10462-10469` — buy / hold / visit: guard → post → confirmation sheet with the exact copy
  already in `RequestController.CONFIRM_COPY`. **No form** for hold or viewing in the old app.
- **Request Price & Availability sheet** `:11046-11064` — title + chroma dash · work line · "A Darz
  specialist will respond within 2 days with price and availability." · First / Last · Email / Phone
  (optional) · City · prefilled "Please let me know the price and availability of this artwork." ·
  **Send enquiry** · "Darz will get back to you soon." Confirmation "Enquiry received" / "Thank you —
  your request is in. Darz will review price and availability and reply shortly." Capture
  `04-request-price`.
- **Make an Offer sheet** `:11074-11117` — as built today (`OfferSheet`), incl. the floor message.
  Capture `05-offer` (CTA reads **Submit offer**; `SCREENS.md` §14 says "Send offer" — the capture is
  the as-built truth).
- **Profile › Market** `profMarketHTML` `:9704-9736` — `Your acquisitions` (`:9685-9703`, rail
  `MKT_RAIL` `:9678`) · `Saved works` · `Requests & activity` with chips `All · Replies · Buy · Offers ·
  Enquiries` (`:9721-9726`), count header + `Clear activity` (`:9728`), rows `dzActRowHTML`
  (`:9482-9499`: thumb · kind label · title · date · `New reply` / status pill + amount / `Replied` /
  chevron or unseen dot), empty state `Nothing here yet` / "Save a work, request a price, or make an
  offer — it all gathers here." / **Browse the collection →** (`:9733`). Captures `15-profile-overview`,
  `16-profile-market`.
- **Status meta** `dzStatusMeta` `:9421-9429` → `In review · Replied · Accepted · Resolved · Not
  accepted · Closed` with pill classes `s-rev · s-ok · s-no · s-cl`; **status notes** `dzActStatusNote`
  `:9433-9477` (per kind × accepted / rejected / reviewing / replied / resolved / closed, plus the
  pending line "Darz has not replied yet. Their reply appears here, and you can write below.").
- **Request detail** `DZ.actOpen` `:11265-11318` — `<h3>` kind label · artwork card · `Current status`
  banner ("Submitted — awaiting Darz" until Darz moves it) · rows `Request · Amount · When` · reply /
  conversation (`.dz-thread`) · reply form ("Write to Darz…") · `View artwork` · `Remove from activity`
  · `Close`. Remove / Clear are **local-history deletes** with confirm copy at `:11333-11373`.
- **Activity logging** `:2804-2806, :2347, :9155-9162` — `login` on sign-in, `save` on save, `view`
  only for curated works; **search is never logged** in the old app.
- **Reply notice** `.dz-notif` ("Darz has replied to your request." / "Tap here to view the message and
  continue.", `COMPONENTS.md` § Toast and notices).

## Working agreement (proposed — owner to confirm)

1. **Four steps, four frontend branches, four PRs** into `development`. After each PR is open and
   green, Claude stops; merging stays an explicit owner ask (`CLAUDE.md`).
2. **No backend, API-contract or `schema.d.ts` change.** Every gap becomes a row in a new
   `docs/PHASE_5_API_GAPS.md` (ids `G-P5-n`, the `PHASE_6_API_GAPS.md` format) and one line in
   `docs/API_INTEGRATION_GAPS.md` § Still open, written in the step that meets it.
3. **Faithful port**: `app.html` (behaviour, copy) + the package (look). The only deviations are the
   owner decisions D1-D11 below, each flagged in a code comment and in the docs.
4. **Screenshot-verify** every touched screen at 390×844 and 1440×900, both skins, against the package
   captures listed above (fetched from the PR #846 branch until it merges).
5. **Flags**: the commerce kinds stay behind `features.commerceActions` (hidden in v0.1). The list,
   detail, status map and activity logging ship visible in v0.1 because Send Inquiry uses them; in
   v0.1 the data simply never contains a commerce kind.

## Branches

| Step | Frontend branch (this repo, off `development`) | Scope |
|---|---|---|
| 1 | `claude/zen-curie-n8ekum` (PR #22, with this plan) | every kind files a valid request: viewing sheet, price sheet, artist enquiry, fixes |
| 2 | `claude/zen-curie-n8ekum`, restarted from `development` after step 1 merges | status map + Profile › Market: acquisitions rail, list rows, chips, empty state |
| 3 | same, restarted after step 2 | request detail (status banner, notes, thread) for every kind, reply notice |
| 4 | same, restarted after step 3 | `ActivityLogger`: login · save · view · search |

All four steps ship from the session branch, one PR per step: the branch is restarted from
`development` once the previous step's PR has merged (the `phase-5-*` names first proposed here are
not used).

## Per-step procedure

1. Branch off `development`. Implement the step's checklist. Run `npm run typecheck`, `npm run lint`,
   `npm test`, `npm run format:check`, `npm run build`.
2. Verify against the live API when a backend is available (`../darzmarket-api`, docker compose +
   `runserver`, seeded data); otherwise the controller tests mock the exact JSON shapes in
   § What we found and the live pass is recorded in the Progress log when it happens.
3. Screenshot-verify (agreement 4). Write the step's gap rows (agreement 2). Open the PR, stop.
4. After merge: update this file (checkboxes + Progress log), `docs/TASKLIST.md`, `docs/CHANGELOG.md`.

## API gaps (recap) → `docs/PHASE_5_API_GAPS.md`

| # | Gap | Frontend answer |
|---|---|---|
| G-P5-1 | `detail` untyped in the schema (G-F1-1 restated; helper unattached) | per-kind `RequestDetail` union typed **by hand** from `apps/crm/serializers.py:14-40`, one comment citing it |
| G-P5-2 | collector rows carry a bare `artwork` uuid | rows read title / artist / image through the v0.1 `ArtworkCache` (one catalogue read per unseen id) |
| G-P5-3 | no `GET /api/crm/requests/{id}/` | detail = the row from the list store + the thread endpoint; a deep link to an unknown id loads the list first |
| G-P5-4 | no collector-side delete / archive / hide | `Remove from activity` and `Clear activity` — owner decision D4 |
| G-P5-5 | no collector transition (withdraw an offer, cancel a viewing) | not built; the old app had none either — documented only |
| G-P5-6 | hold expiry not applied on read | the UI treats `detail.expires_at < now` as expired regardless of `status` |
| G-P5-7 | `availability` kind has no old-app surface | not built; documented |
| G-P5-8 | `page` / `per_page` undeclared on the list and thread endpoints | works today; a schema-doc follow-up for the backend |
| G-P5-9 | `offer.amount` returns as a string; `counter_of` / `countered` carry no counter amount | format from string; counter-offers are a message from Darz, not a field |

---

## Step 1 — Every request kind files correctly (`claude/zen-curie-n8ekum`, PR #22)

**Status:** implemented 2026-09-17 — typecheck · lint (no new warnings) · 104 tests · format ·
build clean; live verification recorded in the Progress log.

- [x] **Viewing sheet** (D1). `ViewingSheet` in the offer-sheet chrome (`.dz-offerwrap`, `app.html:11074`):
      title **Request viewing** + chroma dash · `.si` work line · preferred date & time (native
      `datetime-local` styled as `.sheet input`) · mode `Segment` **In person · Virtual** (labels from
      the backend choices) · hint · `.dz-sheetcta` **Request viewing**. Files `kind=viewing`
      `{preferred_time, mode}`; confirmation unchanged ("Viewing request received" …, `:10465`).
- [x] **Request Price & Availability sheet** (D6). `PriceSheet` = the `InquirySheet` chrome with the
      old sheet's title, note, prefilled message, **Send enquiry**, foot line (`:11046-11048`); files
      `kind=price` `{message}`; confirmation "Enquiry received" / "Thank you — your request is in. Darz
      will review price and availability and reply shortly." (`:11064`). Wired as the primary on a
      price-hidden work (`:9242`) — `full` mode only; v0.1 keeps Send Inquiry.
- [x] **Buy now / 48h hold**: unchanged bare POST; the hold label now reads **48h hold** — D2
      (the API's TTL wins).
- [x] **Make an offer**: CTA stays **Submit offer** (D7). Fixed on the way: the sheet closed on a
      rejection, so the floor message was never seen — it now stays open with the message inline.
- [x] **Artist enquiry** through `RequestController` (stable guard key `artist:<id>`, one
      `client_req_id`), confirmation "Enquiry received" / "Thank you — your request is in. Darz will
      share available works by <artist> and reply shortly." (`:11033-11044`) instead of the toast.
- [x] **Typed `detail`** per kind (G-P5-1) in `src/api/types.ts`; `RequestController` sends the union.
- [x] Tests: labels, viewing detail, price sheet flow, artist enquiry idempotency, the success /
      failure result, the time helper (+ the 14 existing).
- [x] Docs: `docs/PHASE_5_API_GAPS.md` (G-P5-1 … 11), `API_INTEGRATION_GAPS.md` drift fixed (finding 9).

**Step 1 exit criteria:** every kind the old app exposes returns **201** with a valid `detail` against a
local backend, a retry returns **200**; `03-detail-full`, `04-request-price`, `05-offer` compared in
both skins; v0.1 unchanged.

---

## Step 2 — The collector's request list (`claude/zen-curie-n8ekum`, PR #24)

**Status:** implemented 2026-09-18 — typecheck · lint (3 pre-existing warnings, none new) ·
111 tests · format · build clean; live verification in the Progress log.

- [x] **`src/features/requests/status.ts`** — one domain module: `statusMeta(kind, status, detail)` →
      `{label, pill, stage, note}` porting `dzStatusMeta` (`:9421`), `dzMktStage` / `MKT_RAIL` (`:9670-
      9678`) and `dzActStatusNote` (`:9433-9477`) verbatim, over the backend vocabulary (table D3).
      Unknown statuses fall back to the `crm.request_status_by_kind` label. Replaces the three
      hardcoded lists (finding 6).
- [x] **Your acquisitions** (`:9685-9703`): purchase / offer / hold rows — thumb · `{artist} — {title}` ·
      sub-label `Purchase request · Offer · Hold request` · status pill (default **In review**) · stage
      rail `.aucrail` Requested · In review · Accepted · Complete, or the single closed line; max 10.
- [x] **Requests & activity** rows to `dzActRowHTML` (`:9482-9499`): `ACT_KL` labels (D8), date with
      time, right side `New reply` / status pill + amount / `Replied` / amount, unseen dot vs chevron.
      Count header; `Clear activity` — D4.
- [x] **Empty state** copy — D9.
- [x] Artwork data through `ArtworkCache` (G-P5-2); the store stayed `ConversationsController`,
      extended with the session-local hide behind `clearActivity()` / `hide()` (D4, G-P5-4).
- [x] Tests: the status map against the backend's own vocabulary (every kind × every status), the
      six words and their pill colours, the per-kind notes, the options fallback, the elapsed-hold
      override, the offer amount.
- [x] Docs: G-P5-2, G-P5-4, G-P5-6, G-P5-8, G-P5-9.
- Fixed on the way, not in the original scope: Profile derived its lists inside a `useMemo` keyed on
  the controller, which never changes — a poll landing while Profile was open never reached the
  screen, and the new clear would not have repainted. The derivation is per render now (a handful of
  rows).

**Step 2 exit criteria:** `16-profile-market` compared populated (against the `app.html` reading) and
empty (against the capture); admin transitions from `/admin/requests` change labels, rails and notes.

---

## Step 3 — Request detail and thread for every kind (`claude/zen-curie-n8ekum`, PR #25)

**Status:** implemented 2026-09-18 — typecheck · lint (3 pre-existing warnings, none new) ·
117 tests · format · build clean; live verification in the Progress log.

- [x] **Where it opens** — D10. Recommended: generalise `ThreadPage` at `/chat/:id` (the v0.1 thread
      route) with the `DZ.actOpen` blocks for non-inquiry kinds: `<h3>` kind label · `.actsh-art` card ·
      `.actsh-stat` **Current status** ("Submitted — awaiting Darz" until moved) · rows **Request ·
      Amount · When** (+ **Held until** for a hold, D11) · the status note when there is no reply ·
      the existing thread + composer · **View artwork** · **Close**. Alternative: a `RequestSheet`
      over Profile, faithful to the old sheet.
- [x] `rowTo` → every kind opens its detail (finding 3); Chat keeps listing inquiries only.
- [x] **Reply notice** `.dz-notif` above the nav — v0.1 had not shipped it (only the auction
      banner reused the class), so it is ported here over `newestUnread()`, for a request of any
      kind, dismissible, and cleared by reading the thread.
- [x] `Remove from activity` — D4, the in-place confirm (`:11333`), over the same session-local
      hide as Clear activity; the one sentence that would be false here is reworded, as there.
- [x] Tests: `ConversationsController` gained its first suite — the derived reads, the clear and
      the hide (nothing reaches the server), and the notice's pick.
- [x] Docs: G-P5-3, G-P5-4.

**Step 3 exit criteria:** each kind opens from the list, shows status + note + thread; a collector
reply and an admin reply round-trip; the notice appears and clears on read.

---

## Step 4 — Activity self-logging (`claude/zen-curie-n8ekum`, PR #26)

**Status:** implemented 2026-09-18 — typecheck · lint (3 pre-existing warnings, none new) ·
123 tests · format · build clean; live verification in the Progress log. **Phase 5 complete.**

- [x] **`ActivityLogger`** (OOP, wraps `CrmService.logActivity`): fire-and-forget, never blocks a
      screen, swallows failures, dedupes `view` per artwork per session.
- [x] Wire: `login` on collector sign-in (`app.html:2347`, in `LoginPage`) · `save` inside
      `SavedController` where the old app logged it (`:2806`, saves only, never an unsave) ·
      `view` on artwork detail open (D5a) · `search` on the toolbar's settled term (D5b).
- [x] Tests: the payload per kind, the view and search dedupes, the reset, and failure isolation
      for both a rejected promise and a synchronous throw.
- [x] Docs: TASKLIST Phase 5, CHANGELOG, G-P5-12.
- Two honest limits, both consequences of decisions already taken: the view dedupe is per
  page-load (in memory — `localStorage` is out, owner decision 2026-09-04), so a reload logs a
  fresh view; and because the call is fire-and-forget, a hard navigation in the same instant as
  sign-in can drop the `login` row. Losing a behavioural row is the accepted cost of never making
  a collector wait for one.

**Step 4 exit criteria:** rows for all four kinds appear in the backend admin for a seeded collector;
no UI path waits on the call.

---

## Owner decisions needed before Step 1

| # | Decision | Recommendation |
|---|---|---|
| D1 | Viewing needs a date/time + mode the old app never asked for | build the small `ViewingSheet` above (package `SCREENS.md` §14 lists "short confirmation forms" for hold / viewing) |
| D2 | "24h hold" label vs the backend's 48 h TTL | keep the label (owner theme `holdLabel`), record the mismatch; owner picks 24 h or 48 h backend-side later |
| D3 | Collector status vocabulary (table below) | confirm the mapping |
| D4 | `Remove from activity` / `Clear activity` have no API | **drop both** until a collector archive endpoint exists (a control that cannot act misleads); alternative: keep, disabled, with the old confirm copy |
| D5a | Log `view` on every detail open (old app: curated works only, no curated set exists yet) | yes — the backend's recommendation profile consumes it |
| D5b | Log `search` (old app never did; backend supports it) | yes, `{q}` in metadata, debounced on the settled query |
| D6 | Price sheet identity fields (First / Last / Email / Phone / City) — the backend snapshots contact from the account | omit them, as v0.1's Send Inquiry already does; keep title, note, prefilled message, CTA, foot line |
| D7 | Offer CTA "Submit offer" (as built) vs "Send offer" (`SCREENS.md`) vs the voice rule against "Submit" | keep "Submit offer" (the capture); rewording is the owner's call |
| D8 | Row labels: `ACT_KL` verbatim; `information` (v0.1 Send Inquiry) shown as "Enquiry" | confirm |
| D9 | Profile empty-state line: old "Save a work, request a price, or make an offer — it all gathers here." vs v0.1's "Save a work or send an inquiry — …" | old line when `commerceActions` is on, v0.1 line otherwise |
| D10 | Request detail as the `/chat/:id` route (v0.1 pattern) or a sheet (old app) | route |
| D11 | Show "Held until <expires_at>" on a hold (not in the old app) | show it — the data exists and the old app had no timer only because it had no backend |
| F1 | `design/market-app/` is only on `darzstudio.art` PR #846's branch | merge #846 (or say where the package should live); until then Claude fetches the branch |

### D3 — proposed collector status map (backend status → label · pill · rail stage · note)

| Kind | Status | Label | Pill | Stage | Note |
|---|---|---|---|---|---|
| hold | requested | — ("Submitted — awaiting Darz" in detail) | — | Requested | pending |
| hold | active | Accepted | s-ok | Accepted | accepted (hold) |
| hold | converted | Complete | s-ok | Complete | resolved |
| hold | expired · released | Closed | s-cl | closed line | closed |
| offer | submitted | — | — | Requested | pending |
| offer | countered | In review | s-rev | In review | reviewing (offer) |
| offer | accepted | Accepted | s-ok | Accepted | accepted (offer) |
| offer | declined | Not accepted | s-no | closed line | rejected (offer) |
| offer | withdrawn | Closed | s-cl | closed line | closed |
| viewing | requested | — | — | Requested | pending |
| viewing | scheduled | Accepted | s-ok | Accepted | accepted (visit) |
| viewing | completed | Resolved | s-ok | Complete | resolved |
| viewing | cancelled | Not accepted | s-no | closed line | rejected (visit) |
| purchase | intent | — | — | Requested | pending |
| purchase | qualified · negotiation | In review | s-rev | In review | reviewing (buy) |
| purchase | confirmed | Accepted | s-ok | Accepted | accepted (buy) |
| simple kinds | new | — | — | Requested | pending |
| simple kinds | assigned | In review | s-rev | In review | reviewing |
| simple kinds | answered | Replied | s-rev | In review | replied |
| simple kinds | closed | Closed | s-cl | closed line | closed |
| any | unknown | options label | s-rev | Requested | generic ("Darz updated this request to …") |

Notes are the `dzActStatusNote` strings (`app.html:9433-9477`), verbatim, keyed by the old verb
(`buy · hold · visit · offer · inquire`); `hold.expired` uses the closed line.

---

## Deferred — not Phase 5

- **Withdraw / cancel** by the collector (no API; the old app had none) — G-P5-5.
- **Counter-offers** as a field (backend `counter_of` inert) — a message from Darz carries it.
- **`availability` kind UI** — no old-app surface — G-P5-7.
- **OTP gate** before actions (`DZ.otpGate`, dormant by default in the old app).
- **Chat on WhatsApp** on the detail and Profile (design-pass flag, needs the gallery number).
- **The v1232 collector loop** (submissions, artwork requests, matching) — prepared, not wired, no
  backend model (backend Phases 20+ / frontend Phase 12+).
- **"Buy now" wording** (`VOICE.md` § Copy to fix suggests "Acquire this work") — owner copy call.

## End-to-end test flow

1. `full` mode, a seeded collector: open a work → **Buy now**, **24h hold**, **Request viewing** (sheet),
   **Make an offer**, and on a price-hidden work **Request Price & Availability** → each **201**; tap
   again inside the guard → one POST; retry after a failure → **200** replay.
2. Profile › Market: the five rows appear under **Your acquisitions** / **Requests & activity** with
   `ACT_KL` labels and no pill; from `/admin/requests` move each through its lifecycle → labels, rails
   and notes follow D3; reply from the admin → **New reply**, the notice, the Overview strip.
3. Open each row → detail with status, note, thread; reply → the admin feed shows it unread.
4. v0.1 mode: Send Inquiry unchanged; Profile lists the inquiry and the general chat only.
5. Sign in, save a work, open a work, search the catalogue → four activity rows in the backend admin.

## Progress log

_Append one entry per step as it merges. Newest last._

- **2026-09-17 — plan written**, waiting for the owner's confirmation and the D1-D11 / F1 answers.
- **2026-09-17 — owner confirmed** (D1-D11; F1 open). **Step 1 implemented** on
  `claude/zen-curie-n8ekum` (PR #22): `ViewingSheet` (preferred time + In person / Virtual, the two
  fields the backend requires), `PriceSheet` (the old Request Price & Availability sheet minus the
  identity fields), the artist enquiry through `RequestController` (stable key, "Enquiry received"),
  the hand-typed per-kind `detail` union, "48h hold", "Request Price & Availability" as the
  price-hidden primary, the offer sheet staying open on a rejection. `docs/PHASE_5_API_GAPS.md`
  written (G-P5-1 … 11); `API_INTEGRATION_GAPS.md` drift corrected.
- **2026-09-18 — Step 4 implemented and verified live. Phase 5 is complete.** `ActivityLogger`
  (fire-and-forget, guarded against both a rejected promise and a synchronous throw, deduping
  `view` per work per session and `search` per settled term) on one `ActivityProvider` mounted
  above the router, because the first event is `login` and that happens on `/login`, outside the
  authenticated tree. `save` is logged from inside `SavedController`, where the old app logged it.
  Verified against the local backend by driving a real session and reading
  `crm_collectoractivity` back: `login`, a `view` of one work, its `save`, **no second view when
  the same work is reopened**, a `view` of a different work, and two `search` rows carrying their
  terms — six rows, all four kinds. One finding from the first attempt, kept as a note rather than
  a fix: driving the flow with hard page loads dropped the `login` row, because a full navigation
  in the same instant aborts the in-flight POST; with the client-side navigation a collector
  actually performs, it lands.
- **2026-09-18 — Step 3 implemented and verified live.** `ThreadPage` now has two shapes over one
  thread: a conversation keeps v0.1's chat, every other kind opens `RequestDetail` — the old app's
  request card (heading, work, **Current status** banner, Request / Amount / **Held until** / When,
  and the per-kind note while Darz has not written). Every row in Profile opens its own detail now;
  Chat still lists inquiries only. The floating reply notice is ported, and **Remove from activity**
  sits under the composer with the old in-place confirm. Verified against the local backend: an
  offer (countered) shows "In review" with its note; a hold (active) shows "Accepted", "Held until
  19 Sept 2026, 12:34" and its own note; a collector reply round-trips onto the hold's thread; the
  price request shows Darz's reply as a bubble with the status "Replied"; the notice appears on
  Profile, points at the unread request, and is gone once the thread is read, with the row's pill
  moving from "New reply" to "Replied". Captured at 390×844 and 390×1700 in both skins and at
  1440×1000. Two blocks of the original are deliberately absent, both noted in the file: the
  separate "headline reply" channel (this backend has one thread, so Darz's reply is a bubble) and
  the WhatsApp CTA (no number is published).
- **2026-09-18 — Step 2 implemented and verified live.** `status.ts` (the one collector
  vocabulary, replacing the three hardcoded lists), "Your acquisitions" with the four-step rail,
  the activity rows on `ACT_KL` labels with the time in the date, the offer amount, the "New reply"
  state, the D9 empty state, and Clear activity (D4) as a session-local hide with the gap recorded.
  Verified against the local backend with the Step 1 data moved through real lifecycles
  (`purchase→qualified`, `hold→active`, `viewing→scheduled`, `offer→countered`, a second
  `offer→declined`, `price→answered` with an unread team reply, `information→assigned`): four
  acquisition cards with the right pill and rail stage, seven activity rows, the chips and their
  counts, the clear sheet and the cleared list — captured at 390×844 in both skins (the Paper skin
  is an app preference, not the OS one, so it is switched in Settings) and at 1440×1300. Three
  fixes followed the captures: the clear sheet's buttons were near-invisible (`.btn.destructive` is
  transparent ink in this skin) and now use the old app's own `.actsh-btn` / `.danger`; a request
  with no artwork showed the literal word "Artwork" and now shows only its message; and the stale
  `useMemo` above. Seeded works carry no image, so the thumbnails are the empty well — seed data,
  not the port.
- **2026-09-17 — Step 1 verified live** against `darzmarket-api` `development` @ 3801786 run
  locally (Postgres 16 + Redis started from the container's own binaries — Docker's daemon is not
  available there — `migrate`, a seeded artist / priced work / price-on-request work / collector
  key), `VITE_FEATURE_SET=full`, Playwright on the pre-installed Chromium at 390×844 @2× dark and
  1440×900 dark. Every kind landed as `GET /api/crm/requests/` reads it back: `viewing`
  `{preferred_time, mode: virtual}` (the path v0.1 broke), `hold` with the server's 48 h
  `expires_at`, `purchase` `{notes: ""}`, `offer` `{amount: "30000.00", currency: "USD"}`, `price`
  with the prefilled message, and the artist `information` request with `artwork: null`; each
  showed its confirmation sheet with the old copy. Captures reviewed: the action stack, the viewing
  sheet empty / filled / confirmed, the price-hidden detail, the price sheet + confirmation, the
  artist confirmation, the desktop viewing sheet. One spacing fix followed (the note and the field
  label sat flush under the work line). Two things noted, not changed: brand fonts do not load in
  the container (Google Fonts is blocked there), so the captures render the fallback serif and the
  price sheet's title wraps; and in `full` mode v0.1's **Send Inquiry** primary stacks above **Buy
  now** because `features.sendInquiry` stays on — a `features.ts` question for the owner, not a
  Phase 5 change.

## Resolved decisions

- **2026-09-18 (Claude, on the owner's D3 delegation):** the map is confirmed against
  `apps/crm/lifecycle.py` — every status of every kind has a row, pinned by a test that transcribes
  the backend's own table. One correction to the tabled draft: a resolved request's **pill** reads
  **Resolved** (`dzStatusMeta`'s own six words), while **Complete** stays the name of the rail's
  fourth step (`MKT_RAIL`); the draft had used "Complete" as a hold's pill, which belongs to neither
  vocabulary.
- **2026-09-17 (owner):** D1 viewing sheet — yes, the recommended option. D2 — **the API side wins:
  48 hours**, so the label reads "48h hold". D3 — the status map is confirmed as tabled, checked
  against `apps/crm/lifecycle.py` (every backend status of every kind has a row; unknown values fall
  back to the `/api/options/` label). D4 — **implement the UI** for Remove / Clear and record the
  API gap (G-P5-4). D5a, D5b — yes to both. D6 — omit the identity fields. D7 — keep "Submit
  offer". D8, D9, D10, D11 — the recommendations. F1 — open: the owner asked for an explanation of
  the design-package situation before deciding.
