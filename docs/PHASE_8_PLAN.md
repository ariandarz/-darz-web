# Phase 8 — Collector: Auctions — implementation plan

**Status:** not started · **Created:** 2026-09-10 · **Owner-approved slicing:** Option A (browse →
bid → notifications → records), Option A transport (WebSocket + lean REST resync).

This plan is the working contract for Phase 8. It spans **two repos** — `darzmarket-web` (this repo)
and `darzmarket-api` (`../darzmarket-api`, remote `ariandarz/darz-backend-api`). Every step ships
**backend and frontend together**; Phase 8 is only "done" when all four steps are merged on both
`development` branches and the end-to-end flow in [§ End-to-end test flow](#end-to-end-test-flow)
passes.

## Working agreement (owner, 2026-09-10)

1. Work proceeds in **four steps**. Each step = one backend branch + one frontend branch, each with
   its own PR.
2. When a step's backend + frontend PRs are both open and green, **Claude stops**. The owner merges
   the backend PR to `darzmarket-api`'s `development`, then the frontend PR to `darzmarket-web`'s
   `development`, themselves. Claude does not merge.
3. After a step is merged, Claude **updates this file** (checkboxes + the Progress log) and the two
   `TASKLIST.md` / `CHANGELOG.md` pairs, then starts the next step.
4. All nine backend gaps (BE-1 … BE-9, including the two optional ones) are **in scope**.

## Branches

| Step | Backend branch (`../darzmarket-api`, off `development`) | Frontend branch (this repo, off `development`) |
|---|---|---|
| 1 | `phase-11.1-auctions-lot-browse` | `phase-8-auctions-browse` |
| 2 | `phase-11.2-auctions-bidding` | `phase-8-auctions-bidding` |
| 3 | `phase-11.3-auctions-notifications` | `phase-8-auctions-notifications` |
| 4 | `phase-11.4-auctions-records` | `phase-8-auctions-records` |

`phase-11.x` mirrors the `phase-19.2-catalogue-query` precedent (frontend-driven backend gap work
gets a dotted sub-number off the original phase).

## Per-step procedure

1. **Backend branch first.** Implement that step's BE-* items. Run `python manage.py test apps.auctions`
   (plus `apps.core` where locking is touched) and the `spectacular` schema check. Open the backend PR.
2. **Frontend branch.** With a local backend running the step's backend branch, regenerate the typed
   client: `npx openapi-typescript http://localhost:8000/api/schema/?format=json -o src/api/schema.d.ts`.
   Implement the frontend. Run `npm run typecheck`, `npm test`, `npm run format:check`, `npm run build`.
   Screenshot-verify every new screen against `../DarzStudio/app.html` (CLAUDE.md rule 5). Open the
   frontend PR.
3. **Stop.** Owner merges backend `development`, then frontend `development`.
4. Claude updates this file + `docs/TASKLIST.md` + `docs/CHANGELOG.md` in both repos, then begins the
   next step.

## Backend gaps (recap)

| # | Gap | Backend change | Step |
|---|---|---|---|
| BE-1 | `LotCollectorSerializer.artwork` is a bare UUID | read-only nested `artwork` object (reuse catalog collector serializer) | 1 |
| BE-2 | collector can't tell "am I leading" from REST (and `leading_bidder_id` on a broadcast socket leaks identity) | computed `is_leading: bool` on `LotCollectorSerializer` (`request.user.collector == lot.leading_bidder`); WS payload unchanged, privacy note recorded | 1 |
| BE-3 | `Auction` has no lot count; event page opens on a poster the model can't provide | `lots_count` annotation on auction list/detail serializer. **`Auction.cover_image` deferred** to admin CRUD (Phase 7/11-admin); frontend falls back to first lot's artwork, flags "no dedicated poster" | 1 |
| BE-8 | WS closes `4001` for both missing and expired token | distinct close code for expired (`4003`), so the client refreshes rather than backing off | 1 |
| BE-9 | no auction seed data for local/E2E | `seed_auction` management command (non-production): one scheduled + one live auction with lots | 1 |
| BE-4 | no Conditions-of-Sale text on `Auction`; no server record of acceptance | `Auction.terms` (Text, blank) + `Auction.terms_required` (bool, default true) on the serializer; nullable `BidderRegistration.terms_accepted_at` + require `agree_terms: true` in the registration create payload when `terms_required` | 2 |
| BE-5 | `next_increment()` ladder lives only in the service | read-only `min_next_amount` + `opening_amount` on `LotCollectorSerializer` | 2 |
| BE-7 | `Notification.payload` shape undocumented; no lot title for the banner | read-only `lot_artwork_title` + `lot_number` on `NotificationSerializer`; document `payload` keys per kind in `@extend_schema` | 3 |
| BE-6 | Results archive has no collector endpoint | `GET /api/auctions/records/` + `/{id}/` with `IsCollectorPrincipal`, reuse `AuctionRecordSerializer` (already public-safe), add `?search=` / `?ordering=` / `?artist=`; column-parity gap → `docs/PHASE_8_API_GAPS.md` | 4 |

---

## Step 1 — Browse (read-only), no bidding

**Backend branch `phase-11.1-auctions-lot-browse`**

- [ ] BE-1 — nested `artwork` on `LotCollectorSerializer` (id, artist name, title, year, primary
      image, medium, dimensions). Reuse the existing catalog collector artwork serializer; guard the
      `artist == null` case (`on_delete=SET_NULL`, same bug the frontend already handles).
- [ ] BE-2 — `is_leading: bool` on `LotCollectorSerializer`, computed from
      `self.context["request"].user.collector`. False for an anonymous/team context. Add a code
      comment recording that WS `leading_bidder_id` remains a broadcast field (owner-acknowledged
      minor correlation surface, not changed here).
- [ ] BE-3 — `lots_count` on the auction list + detail serializers (queryset annotation, no model
      change). No `cover_image`.
- [ ] BE-8 — `LotConsumer.connect` / `JWTAuthMiddleware`: close `4003` when a token was supplied but
      failed validation (expired/invalid), keep `4001` for "no token / not authenticated".
- [ ] BE-9 — `apps/auctions/management/commands/seed_auction.py`: creates an artist + a few artworks
      if none exist, one `scheduled` auction and one `live` auction, 3–4 lots each, one lot already
      `live`. Idempotent-ish (`--fresh` to wipe prior seed). Not wired into any migration or CI.
- [ ] Tests: nested-artwork shape incl. null artist; `is_leading` true/false/anon; `lots_count`
      correct; WS `4003` vs `4001`; `seed_auction` runs clean on an empty DB.
- [ ] `spectacular` schema regen clean.

**Frontend branch `phase-8-auctions-browse`**

- [ ] `resolveWsUrl()` in `src/api/index.ts` — throws if `VITE_API_WS_URL` unset (mirror of
      `resolveBaseUrl()`). Add `VITE_API_WS_URL` to `.env`, `.env.example`, `.env.production`
      (`.env.production` gets a `wss://ws.invalid` placeholder, same rationale as `api.invalid`).
- [ ] `AuctionService extends ResourceService` (`src/api/services.ts`): `auctions()`, `auction(id)`,
      `lots(auctionId)`, `lot(id)`, `bidHistory(lotId)`. Wire into `DarzApi` + `useApi()`.
- [ ] `src/features/auctions/AuctionListController.ts extends ListController` — pagination + stale
      guard from the shared base.
- [ ] `src/features/auctions/LotSocket.ts extends Observable` — connect to
      `${wsUrl}/ws/auctions/lots/{id}/?token=${accessToken}`, exponential backoff, one
      token-refresh-and-reconnect on close `4003`, quiet fallback to a 5–10 s `lot(id)` REST poll
      after repeated failures. No bidding over the socket.
- [ ] `src/features/auctions/LotController.ts extends Observable` — holds the REST `LotCollector`
      snapshot, merges `LotSocket` frames over it, re-fetches `lot(id)` on every (re)connect and on
      `window` focus.
- [ ] `useAuctionList()`, `useLot(id)` hooks (`useSyncExternalStore`, same shape as `useCatalogue`).
- [ ] Routes: `/auctions`, `/auctions/:id`, `/auctions/lots/:lotId` (behind `RequireAuth`).
- [ ] Screens (port + cite `app.html` lines, screenshot-verify):
  - `/auctions` list — split poster cards, status system. `app.html` `auctionsList()` ~5674,
    list-card CSS ~1560–1697, `aucLabel`/status ~1642.
  - `/auctions/:id` event page — poster hero w/ fallback to first lot artwork, status pill,
    Opens-in / Closes-in countdown, description, registration-state band (read-only placeholder in
    Step 1 — real states arrive in Step 2), lot list. `app.html` `aucDetail()` ~8230–8330, lot-row
    CSS ~1708+.
  - `/auctions/lots/:lotId` — lot detail: artwork hero, lot number, estimate, live "Current bid /
    No bids yet", `bid_count`, reserve-met pill, countdown, bid history (anonymous, paddle + amount).
    Live values driven by `LotController`. No place-bid control yet. `app.html` bid history
    `bidHistoryHTML` ~6028, lot detail panel ~6031.
- [ ] `dz-state` loading/error, empty states for no-auctions and no-lots.
- [ ] Tests: `AuctionListController` (no-auto-fetch, query/page-reset, stale-drop, error surface);
      `LotSocket` (frame merge, reconnect, `4003` refresh path, poll fallback); `LotController`
      (REST+WS merge precedence, focus refetch).
- [ ] `typecheck` / `test` / `format:check` / `build` green. Screenshot comparison recorded in the PR.

**Step 1 exit criteria:** a collector can browse auctions, open an event, open a lot, and watch its
price / bid count / countdown update live as bids land (placed via Django admin or the admin API
during testing). No registration, no bidding UI.

---

## Step 2 — Register + bid

**Backend branch `phase-11.2-auctions-bidding`**

- [ ] BE-4a — `Auction.terms` (`TextField`, blank) + `Auction.terms_required` (`BooleanField`,
      default `True`). Migration. Both fields on `AuctionSerializer` (read-only for collectors).
- [ ] BE-4b — `BidderRegistration.terms_accepted_at` (`DateTimeField`, null=True). Migration.
      `BidderRegistrationCreateSerializer` gains `agree_terms: bool` (write-only); the create view
      rejects with 400 when `auction.terms_required` and `agree_terms` is not `True`, else stamps
      `terms_accepted_at = now()`. Expose `terms_accepted_at` on
      `BidderRegistrationCollectorSerializer`.
- [ ] BE-5 — `min_next_amount` (computed: `opening_amount` if `current_amount is None` else
      `current_amount + next_increment(current_amount)`) and `opening_amount` on
      `LotCollectorSerializer`, both read-only.
- [ ] Tests: terms_required gate (400 without `agree_terms`, 201 + timestamp with it);
      `terms_required=False` path; `min_next_amount` at opening, after one bid, unbounded-ladder point
      (e.g. 100,000,000); `opening_amount` present.
- [ ] `spectacular` regen clean.

**Frontend branch `phase-8-auctions-bidding`**

- [ ] `AuctionService`: `registrations()`, `register(auctionId, agreeTerms)`,
      `placeBid(lotId, maxAmount)`.
- [ ] `src/features/auctions/RegistrationController.ts` (or fold into `LotController` /
      `AuctionDetailController`) — my registration status per auction, drives the event-page band.
- [ ] Registration flow — Conditions-of-Sale gate: renders `auction.terms` when present, else the
      **ported Darz default** (`DARZ_AUC_TERMS`, `app.html` ~8177–8195) as a constant in the feature
      folder with a cite comment; "I have read and agree…" checkbox (`app.html` ~8202); "Register to
      bid" CTA panel (`app.html` `auc-reg` ~8300–8312). POSTs `register(auctionId, true)`.
- [ ] Event-page band states: not-registered → CTA; `pending` → "Registered — we are confirming your
      paddle" (`aucRegPending` copy); `approved` → "✓ Your paddle is confirmed — you can place bids";
      `rejected` → `aucRegRejected` copy. Copy from `THEME_DEFAULT` (`app.html` ~2844).
- [ ] Place-bid / raise-bid sheet — reuse the `Sheet` component. Live thousands-grouping amount
      field (port from `DZ.offer()` field behaviour, `app.html` ~11074), pre-filled to
      `lot.min_next_amount`. Reuse the `dzGuard` double-tap guard (same as Phase 5 request creation).
      Confirmation copy from `DZ.bid()` (`app.html` ~6042). Label "Place a bid" / "Raise your bid"
      by whether `is_leading`.
- [ ] Surface server rejections: below-floor (`min_acceptable`), "your new max must be higher than
      your current one", 403 not-approved, lot-not-live / outside-window. One `Toast` as the
      confirmation surface (Phase 6 pattern).
- [ ] Lot detail + lot rows gain the place-bid control; "Your bid is leading" state when
      `is_leading` (`app.html` ~8290).
- [ ] Tests: registration gate (no POST without checkbox), `register` happy path + `pending`/`approved`
      band; bid sheet (grouping, prefill, guard blocks 2nd tap), rejection mapping, `is_leading`
      label switch.
- [ ] Regenerate `schema.d.ts` against the Step 2 backend branch. `typecheck`/`test`/`format:check`/
      `build` green. Screenshots recorded.

**Step 2 exit criteria:** a collector can accept the Conditions of Sale, request a paddle, and —
once an admin approves — place proxy/max bids that move the live price; server-enforced floor and
"must increase" rejections show cleanly. Terms acceptance is recorded on the registration row.

---

## Step 3 — Notifications + live status vocabulary

**Backend branch `phase-11.3-auctions-notifications`**

- [ ] BE-7 — `lot_artwork_title` + `lot_number` (read-only, via `lot.artwork.title` / `lot.lot_number`,
      null-safe) on `NotificationSerializer`. Document the `payload` keys per kind in the
      `notification_list` `@extend_schema` description: `outbid`→`{amount}`, `won`→`{amount}`,
      `lost`→`{}`, `closing_soon`→`{ends_at}`.
- [ ] Tests: serializer includes title/number; null-lot notification still serializes.
- [ ] `spectacular` regen clean.

**Frontend branch `phase-8-auctions-notifications`**

- [ ] `AuctionService`: `notifications()`, `markRead(id)`.
- [ ] `src/features/auctions/AuctionNotificationsController.ts extends ListController` — auction-scoped
      now; shaped so a future global notification centre (Phase 9) reuses it. Boot + ~30–60 s poll +
      on-focus poll (matches the Phase 5 reply-thread decision; no WS for notifications).
- [ ] `/auctions/notifications` route + page — list, unread emphasis, "Mark read", tap → the related
      lot. Empty state.
- [ ] Live "Darz auction" banner — independent of the reply banner (`app.html` ~791, ~6062). Shows on
      any page when there's an unread `outbid` / `won` / `lost` / `closing_soon`, names the lot via
      `lot_artwork_title`.
- [ ] Unified status-pill system — port `aucPill` / status classes (`app.html` ~1297, ~1642, ~801):
      leading / outbid / reserve not met / reserve met / won / lost / closing soon / extended. Used
      on list cards, event page, lot rows, lot detail. Outbid between notification polls is inferred
      from `LotSocket` `leading_bidder_id` vs the collector's own `/me` id; the `outbid` notification
      is the authoritative signal.
- [ ] Tests: controller poll/markRead/unread count; banner show/hide by unread kind; pill mapping
      table; inferred-outbid vs notification-outbid precedence.
- [ ] Regenerate `schema.d.ts`. `typecheck`/`test`/`format:check`/`build` green. Screenshots recorded.

**Step 3 exit criteria:** when collector A is outbid, they see the banner + a notification naming the
lot; won/lost/closing-soon all render; the status vocabulary is consistent across every auction
surface.

---

## Step 4 — Results archive

### What "Results archive" is

A top-level collector surface in the old app ("Market · Auctions · **Records** · Insights · Profile ·
Settings"), **feature-flagged off by default** (`showRecordsTab: 'Hidden'` in `THEME_DEFAULT`). It is
**not** Darz's own settled lots — it's a market-intelligence archive of **external auction-house
results** used as comparables ("this artist sold for X at Christie's, 2023"). Backend model:
`AuctionRecord`, whose own docstring calls it *"unrelated to the Auction/Lot engine… a separate
concern from Darz's own settled lots."* Old-app Records had sub-tabs (Upcoming / Past / Highlights /
by-artist), search, sort (house, result), and a record-detail view over a rich cloud table
(artist, title, year, house, sale date, low/high estimate, hammer vs realized, currency, medium,
dimensions, image, provenance, sale name, section, source URL).

Backend `AuctionRecord` currently has ~9 of those: `artist` (+`artist_name_raw`), `house`,
`lot_title`, `sale_date`, `price_amount`, `currency`, `lot_reference`, `source_url`, `notes`.
**Owner call (2026-09-10): ship the lean view against those 9 fields now; log the missing columns as
a gap** rather than expanding the model this phase (model expansion + admin editing + importer
belongs with the admin Records desk, Phase 11-admin).

**Backend branch `phase-11.4-auctions-records`**

- [ ] BE-6 — `GET /api/auctions/records/` (paginated) + `GET /api/auctions/records/{id}/`,
      `permission_classes=[IsCollectorPrincipal]`, reuse `AuctionRecordSerializer` (already
      public-safe). Query params: `?search=` (artist name / `artist_name_raw` / `house` / `lot_title`),
      `?ordering=` (`-sale_date`, `-price_amount`, default `-sale_date,-created_at`), `?artist=<uuid>`.
      New `operation_id`s so they don't collide with the admin record ops.
- [ ] Tests: collector can list/retrieve; team principal behaviour per convention; search + ordering +
      artist filter; soft-deleted excluded.
- [ ] `spectacular` regen clean.

**Frontend branch `phase-8-auctions-records`**

- [ ] `AuctionService`: `records(query)`, `record(id)`.
- [ ] `src/features/auctions/RecordsController.ts extends ListController` — search + sort + artist
      filter.
- [ ] `/records` route + list page + `/records/:id` detail. Port the `rec2-*` card/list chrome from
      `app.html` `recordsView()` ~4760+ as far as the 9 available fields allow; **do not invent**
      columns for data we don't have — render what exists, flag the rest.
- [ ] `docs/PHASE_8_API_GAPS.md` — the missing columns (image, year, medium, dimensions, low/high
      estimate, hammer-vs-realized, provenance, sale name, Past/Upcoming/Live section) as a single
      gap entry for a later owner decision; note the old tab ships hidden by default.
- [ ] Add the "Records" nav entry (matching the old app's placement); note in a comment it is a new
      always-on surface here vs. the old `showRecordsTab` flag — flag to owner.
- [ ] Tests: controller search/sort/filter/page; detail render with sparse fields.
- [ ] Regenerate `schema.d.ts`. `typecheck`/`test`/`format:check`/`build` green. Screenshots recorded.

**Step 4 exit criteria:** a collector can open Records, search/sort external auction results, and open
a record; the field-parity gap is documented (and carried here, § Deferred).

---

## Deferred — admin Records desk (Phase 11-admin, not Phase 8)

Step 4 ships the **collector read** of `AuctionRecord` against the 9 fields that exist today. Full
old-app parity for the Records / "Auction highlights" archive needs the model widened and an admin
desk to maintain it. That work is **out of Phase 8 scope** — it belongs with the other admin surfaces
in frontend Phase 11 / backend Phase 11-admin — but is recorded here so nothing is lost. Also
mirrored in `docs/PHASE_8_API_GAPS.md` when Step 4 creates it.

### Backend gaps (widen `apps.auctions.AuctionRecord` + admin surface)

- [ ] **BE-R1** — add the missing reference columns to `AuctionRecord` (one migration):
      `image_url`, `year` (CharField — old data is imprecise, e.g. "c. 1971"), `medium`,
      `dimensions`, `low_estimate` / `high_estimate` (decimal, nullable), `hammer_amount` /
      `realized_amount` (decimal, nullable — old `price_amount` collapses hammer vs realized; keep
      `price_amount` as the display figure, add the split), `sale_name`, `provenance`, `literature`,
      `exhibition`, `house_notes`, `previous_record` (text).
- [ ] **BE-R2** — lifecycle/section fields: `section` (`past` / `upcoming` / `live` choice — drives
      the collector sub-tabs), `opens_at` / `closes_at` (datetime, nullable), `tz` (CharField),
      `status` (`sold` / `unsold` / `passed` / `withdrawn` / `pending` choice). Register the two new
      choice sets in `AuctionsConfig.ready()` so they reach `/api/options/`.
- [ ] **BE-R3** — highlight curation: `is_highlight` (bool) + `highlight_order` (int). A collector
      "Highlights" sub-tab and the home-page highlights strip read these.
- [ ] **BE-R4** — admin write surface for all of the above: extend `AuctionRecordSerializer` +
      `admin_record_list_create` / `admin_record_detail` (already exist) to accept the new fields;
      add `?section=` / `?status=` / `?is_highlight=` filters and `?ordering=` to the admin list.
- [ ] **BE-R5** — bulk import: a `import_auction_records` management command (CSV/JSON in) replacing
      the old Supabase `records` cloud table + `recArcPull` sync. Idempotent on
      `(house, sale_date, lot_reference)` or `source_url`. Old importer shape:
      `../DarzStudio/app.html` `_recArcMap` ~4724.
- [ ] **BE-R6** — extend the **collector** `GET /api/auctions/records/` (from BE-6) with the new
      read fields + `?section=` / `?is_highlight=` filters once BE-R1..R3 land, and a
      `GET /api/auctions/records/highlights/` (or `?is_highlight=true&ordering=highlight_order`) for
      the strip.
- [ ] Tests: migration + serializer round-trip for the new fields; section/status/highlight filters;
      importer idempotency; collector serializer still omits nothing confidential (there is nothing
      confidential on this model — it is all public reference data).

### Frontend gaps (frontend Phase 11 — admin desk + collector polish)

- [ ] **FE-R1** — admin Records desk: list (filter by section / status / highlight, search, sort),
      create/edit form for every field, soft-delete. Chrome from `darz-studio.html`'s admin table
      pattern (same `.ad-*` classes the `AdminRequestsPage` already uses).
- [ ] **FE-R2** — highlight curation UI: toggle `is_highlight`, drag/set `highlight_order`.
- [ ] **FE-R3** — import trigger: upload CSV/JSON → calls BE-R5 (or a thin admin endpoint wrapping
      it); show the importer's created/updated/skipped counts.
- [ ] **FE-R4** — collector Records upgrade once the fields exist: the Past / Upcoming / Live /
      Highlights **sub-tabs** (`app.html` `rec2-tabs`, `recSection` ~3576), image-led cards, the
      record-detail view with provenance / literature / exhibition / estimate-vs-hammer-vs-realized,
      the "Auction highlights" home strip, and the by-artist rollup on the artist page
      (`dzArtistLots` ~5216, `recordsView` ~4760). Restores the old `showRecordsTab` behaviour as a
      real setting rather than an always-on nav item.

### Exit criteria (deferred)

Admin can maintain the external-results archive (manual + bulk import, highlight curation) and the
collector Records surface reaches old-app parity: sub-tabs, rich record detail, highlights strip,
per-artist records. Tracked under frontend Phase 11 in `docs/TASKLIST.md`.

---

## End-to-end test flow

Run after Step 3 (Records is independent). Two collector sessions + one admin.

1. Admin: `python manage.py seed_auction --fresh` (or create via the admin API) → one `live` auction
   with a `live` lot.
2. Collector A: `/auctions/:id` → accept Conditions of Sale → register. Admin: approve the
   registration (paddle assigned). Band flips to "✓ paddle confirmed".
3. Collector A: place a max bid → REST 200; `LotSocket` frame updates price / `bid_count` /
   countdown; "Your bid is leading".
4. Collector B (registered + approved): places a higher max → Collector A gets the live banner + an
   `outbid` notification naming the lot; `is_leading` flips to B.
5. A bid inside `soft_close_sec` → `ends_at` extends; "Extended" pill.
6. Admin: `close` the lot (or let the sweep run) → `won` to the leader, `lost` to the other bidder;
   lot detail shows "Sold / You won"; artwork → `sold`.
7. `closing_soon` fires ~10 min before `ends_at` to everyone with a max bid.

---

## Progress log

_Append one entry per step as it merges. Newest last._

- **2026-09-10 — Step 1 backend: implemented + pushed, PR open, awaiting owner merge.**
  Branch `phase-11.1-auctions-lot-browse` (`darzmarket-api`, off `development` @ `a0b4dd0`), commit
  `9d907ca`. BE-1 (nested `artwork` on `LotCollectorSerializer` + N+1-safe querysets), BE-2
  (`is_leading`, request-aware), BE-3 (`lots_count` annotation + fallback), BE-8 (WS `4003` vs
  `4001`), BE-9 (`seed_auction` command). 8 new tests, `apps.auctions` 35→42, full suite 407 green,
  `ruff check` clean on touched files, `spectacular` clean. No migration. PR:
  https://github.com/ariandarz/darz-backend-api/pull/new/phase-11.1-auctions-lot-browse
  Step 1 frontend (`phase-8-auctions-browse`) not started yet — needs `schema.d.ts` regenerated
  against this backend branch.

## Resolved decisions

- **2026-09-10** — Slicing Option A, transport Option A (WS + lean REST resync). All of BE-1…BE-9 in
  scope. Steps merged by the owner, not Claude; plan updated after each. Results archive = lean view
  against the existing 9 fields. BE-3 = `lots_count` only, `cover_image` deferred. BE-4 = persist
  `terms_accepted_at` on the registration.
