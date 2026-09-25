# Frontend adoption — the V1 **and Group-B** API gaps are now closed backend-side

**Written 2026-09-24. Audience: a session working in THIS repo (`-darz-web`).**

Every gap in `../darzmarket-api/docs/V1_API_GAPS_PLAN.md` **and**
`../darzmarket-api/docs/GROUP_B_API_GAPS_PLAN.md` has shipped on the backend (`darz-backend-api`
`development` @ `a140548`; see its `docs/CHANGELOG.md`, all entries dated 2026-09-24). This file is the
frontend's side of that work: for each closed gap, the endpoint/field now available, the work-around to
delete, and where that work-around lives in this repo. V1 adoptions are below; the **Group-B** section
is at the end.

Gap IDs (`G-P…`, `G-LOCK-1`) match `docs/PHASE_5_API_GAPS.md`, `docs/PHASE_24_35_API_GAPS.md` and the
backend plan — after adopting each, delete or update its note in those files so the two repos stay
honest.

## ⟶ 2026-09-25 re-baseline (read this first)

Measured against backend `development` @ `df0421f` (PR #70, **final V1: 224 paths / 323 operations**) and
`-darz-web` `development` @ `d987910` (PR #100). Per-operation evidence is in
`docs/audit/2026-09-25/API_ADOPTION_MATRIX.md`. The order of work is **`V1_IMPLEMENTATION_PLAN.md`**; the
per-gap sections further down stay valid as *how-to* notes, except where § "Outdated entries" says otherwise.

### Backend V1 availability vs frontend adoption, by app

| App | Operations | Integrated | Partial | Bound, no UI | Not bound | Final V1 disposition of the not-bound ones |
| --- | --- | --- | --- | --- | --- | --- |
| accounts / auth | 36 | 29 | – | – | 7 | access-keys roster + summary (Ph 8); collectors summary (Ph 4); `PATCH me` + `my-membership` (Ph 1); single membership-code/team-user reads: **not needed** (list rows suffice) |
| catalog | 37 | 32 | – | – | 5 | `selections/` + `seen` (Ph 9, G-P24-2); admin artist detail: not needed; `change-stamp`, `legacy-lookup`: **excluded** (no V1 surface consumes them) |
| crm | 25 | 18 | 2 | – | 5 | message archive (Ph 6); collector archive/transition (Ph 9); `GET activity/` (Ph 9, G-P5-12); admin selection detail: not needed |
| auctions | 38 | 30 | 1 | – | 7 | auction PATCH/archive/cover, lot PATCH, registration reset (Ph 3); `records/highlights/`: **excluded** (the Records screen filters `?section=`) |
| accounting | 24 | 23 | – | 1 | – | deal attachments list: bound, a render in Ph 10 if the old deal card showed them |
| sales | 12 | 7 | – | – | 5 | summary, follow-up, notes (Ph 2); DELETE (Ph 2, only if the old desk deletes) |
| documents | 15 | 10 | – | – | 5 | collector `GET /documents/` + `public/{kind}/` (Ph 1); activity + share (Ph 6) |
| gallery | 52 | 35 | – | 3 | 14 | all in Ph 5, except portal `GET messages/`, `GET status/` and `GET exhibitions/{id}/`: **not needed** (embedded in portal state / the list); link DELETE: Ph 5 if the old desk had it |
| projects | 32 | 28 | – | 3 | 1 | totals (Ph 7); single reads: not needed |
| recommendations | 28 | 2 | – | 2 | 24 | question-set collector read (Ph 9); **24 admin ops = Intelligence + question-set editor: excluded from V1 (G-6, Q-8)** unless the owner reverses it |
| notifications | 3 | – | – | – | 3 | VAPID + push subscribe (Ph 9, G-P13-1) |
| marketing | 9 | – | – | – | 9 | **excluded from V1** (G-6, Q-8) |
| dashboard, core/options/theme/audit, health | 12 | 11 | – | – | – | `GET /api/health/` is backend-only |

### Partially integrated
- `POST /crm/admin/requests/{id}/messages/` and the collector `POST /crm/requests/{id}/messages/` send
  `body` + `artwork_refs` but never `document_refs`. Ph 6 does the admin attach; the collector side doesn't
  attach in the old app either (it only renders), so no change there.
- `POST /auctions/admin/auctions/` omits `terms` / `terms_required` → Ph 3.

### Existing UI not correctly connected to the API (bugs)
- **C-1** Sales desk vs nested rows (G-SALE-3) → Ph 0.
- **C-3** questionnaire and Profile card vs 200 `answered:false` (G-P25-1) → Ph 0.
- **C-4** portal entry hangs on an unexpected status → Ph 0.
- **C-5** five lists silently capped at 100 → Ph 0.
- Portal "image needs updating" sends a flag with no file. "Withdrawn" goes out as an availability update, not the
  `withdraw` kind. Pricelist rows always read "Received". The "Sent" pills are lost on reload → Ph 5.
- The admin withdraw-approval confirm says "changes nothing automatically", but the backend unassigns the work → Ph 5.
- Document `owner_lock` is displayed but not enforced: a standard admin gets a 403 on Save/Upload/Confirm/Sign/Archive → Ph 6.
- Compose never sends line `quantity` → Ph 5.

### Missing UI for existing APIs (V1)
Sales summary, filters, follow-up, notes and the Auction Sales tab (Ph 2). Auction/lot edit, archive, cover,
registration reset and the house filter (Ph 3). Database filters, thumbs, publish `missing`, artists search and
pager, collectors summary and sorts, club thumb, Data Health tiles (Ph 4). Portal images, cover, history,
replacement upload, ask/withdraw and pricelist builder; admin reissue, partner search, pricelist
status/cap/file/lines, and the exhibition-catalogue editor (Ph 5). Document History tab and share, chat attach,
message archive (Ph 6). Projects quick/partner, status/stages, FX and totals (Ph 7). The Access desk (Ph 8).
Profile edit, documents, my-membership (Ph 1).

### Missing forms / actions / tables / filters / pagination / search
- **Forms:** profile edit (Ph 1), auction edit, lot edit (Ph 3), exhibition-catalogue item (Ph 5), project
  FX (Ph 7), pricelist builder (Ph 5).
- **Actions:** follow-up set/clear, add note (Ph 2), archive/restore auction, cover upload, registration reset
  (Ph 3), link reissue, pricelist status (Ph 5), document share, message archive, attach doc (Ph 6), extend or
  revoke from the roster (Ph 8).
- **Tables:** Auction Sales (Ph 2), access-key roster (Ph 8), document history (Ph 6), exhibition catalogue (Ph 5).
- **Filters and search:** sales `search/payment_status/delivery_status/source/ordering`; artworks
  `gallery_portal/complete/duplicate_images/size/source_type/created_after`; artists `search/ordering`;
  collectors `ordering=activity|purchases`; projects `quick/partner`; auctions `archived`; records `house`;
  links `search`; admin thread `include_archived`.
- **Pagination:** C-5 (Ph 0); admin auctions list and Club list load `per_page: 100` with no pager (Ph 3, Ph 4).

### Missing loading / error / empty states
- Profile has no loading state; its tiles read 0 while loading (Ph 1).
- Auction event lots have no loading or empty state (Ph 3).
- Portal entry has no error path for 5xx/4xx (C-4, Ph 0).
- Every admin list desk renders all three through `DeskList`, and `DeskBoundary`/`ScreenBoundary` catch render
  throws.

### Authentication / authorisation gaps
- The UI owner gates match the backend's `IsOwner` set exactly (accounting, memberships, team users, audit
  log), plus Access Requests, which is **stricter in the UI** than the backend (Q-1).
- **UI-only gates (cosmetic):**
  - Project `money`/`internal_notes` are hidden from standard admins, but the API returns them (Q-2).
  - Document delete is owner-only in the UI, but the endpoint accepts any admin.
  - A standard admin can't pick a sale's "responsible", because team users are `IsOwner`. The nested
    `responsible` now covers the read.
- **Backend security defects (C-13):** portal PIN brute force, unthrottled logins, unvalidated anonymous
  uploads. The FE's 429 copy never fires on login.
- Token refresh, logout and the two principals (collector key vs team password) are complete. The portal uses
  `PortalClient` (no bearer) with the PIN rules per C-9.

### Payload mismatches (backend vs frontend expectations)
C-1 nested sales rows · C-2 project status enum name · C-3 questionnaire 200 · C-6 optional-typed but
required lock (500 when missing) · C-7 no hold member · C-8 portal state untyped · C-9 pin placement ·
C-10 untyped error `details` · C-15 document activity actor shape · C-16 list-only rollups · C-17 access-key
status lag · C-20 `Project.results` · C-22 string decimals in totals. All are in `V1_CONTRACT_ISSUES.md`.

### Outdated entries in this file (as of 2026-09-25)
- **§ P0 G-P34-1/2, § P1 G-LOCK-1, § P2 G-P5-1/2/3/6/10, § Group-B G-F1-1** are **done** (#99). Their
  sections are history.
- **Step 0** cites backend `5f6d7ea`; regenerate from `df0421f` or later. The committed `schema.d.ts` predates
  PRs #67–#70 and G-SALE-3 (11 paths missing, 15 type errors on regen).
- **§ Phase 5b** says "four unavailable filters". They are still unwired and are joined by `source_type` and
  `created_after`.
- **§ G-KEY-1** calls it owner-only. The backend is `IsStandardAdminOrOwner`, so the gate is Q-1.
- Everything in the 2026-09-25 backend additions (G-SALE-1/2/3/5, G-AUC-1/2/3, G-COL-1/2, G-CAT-1/3/8, G-CLUB-1,
  G-DOC-2, G-PROJ-1/2/3/8/9, G-PORT-1…16) has **no section below**. Its adoption detail is the matching phase
  in `V1_IMPLEMENTATION_PLAN.md` plus `API_GAPS.md` § "2026-09-25 backend additions".

---

## Step 0 — regenerate the typed client first (do this before any task)

Several tasks below are "the schema now types this correctly." They only land once `schema.d.ts` is
regenerated from a backend carrying this work. Per `CLAUDE.md`:

```bash
# backend (../darzmarket-api), on development @ 5f6d7ea or later
cd ../darzmarket-api && docker compose -f docker-compose-local.yml up -d
source venv/bin/activate && python manage.py runserver

# this repo
npx openapi-typescript http://localhost:8000/api/schema/?format=json -o src/api/schema.d.ts
```

Then `npm run typecheck` — the new types will flag every call site that was compensating for the old
shape. Work those flags top-down. **Do not hand-edit `schema.d.ts`.**

**Verify each screen you touch** against a real render (the `CLAUDE.md` rule): every one of these is a
behaviour change on a shipped screen, not a new screen, so confirm the old behaviour still works and
the new path does what the backend now allows.

All new endpoints use the standard envelope (`{success, data, message, timestamp}` / error form) —
the existing `ApiClient` wrapper already unwraps it; no per-call parsing.

---

## P0 — the launch-blocker adoptions (small, do first)

### G-P34-1 · Access-request dedupe is now real
- **Backend now:** `POST /api/auth/access-requests/` accepts `client_req_id`; a retry with the same key
  **replays the original row with 200** instead of creating a duplicate (first insert is 201).
  Also rate-limited (`5/hour`/IP by default, env `ACCESS_REQUEST_THROTTLE_RATE`) → **429** on abuse.
- **Frontend:** the "Request access" form already sends `client_req_id` (`'ar_'+…`) and disables the
  button in-flight. Change: (a) treat **200 and 201 alike** as success (a 200 is a replay, not an
  error); (b) handle **429** with a human message ("Too many attempts — try again shortly") rather
  than the generic error. Drop the code comment/caveat that says a duplicate lands in the admin queue.
- **Done when:** a double-submit shows one success and no duplicate; a rapid loop surfaces the 429 copy.

---

## P1 · G-LOCK-1 — turn on the conflict path for two admin desks

- **Backend now:** the **accounting ledger-entry editor** and the **auction-record editor** enforce
  `expected_version`. A stale PATCH returns **409** in the standard envelope (it only rejects, never
  changes a total). `LedgerEntryUpdateSerializer` and `AuctionRecordUpdateSerializer` carry
  `expected_version`.
- **Frontend:** these two desks were last-write-wins, so their save paths were built without the 409
  handling the other desks have. Send `expected_version` on PATCH and wire the existing
  `ConflictBanner` (as the catalog/sales/CRM editors already do). The generic 409 pattern (`kit`) is
  already in the tree — reuse it, don't invent a second one.
- **Files:** the ledger entry editor (`src/features/admin/LedgerEntryPage.tsx`) and the auction-record
  editor (`src/features/admin/RecordEditorPage.tsx`). Match how `ArtworkEditorPage` / sales detail do
  it today.
- **Done when:** editing a row two tabs at once, the second save shows the conflict banner (not a
  silent overwrite); a normal save still works and the version advances.

---

## P2 — CRM collector precision (one schema regen unblocks most of this)

### G-P5-1 · Delete the hand-typed `detail` union
- **Backend now:** `RequestCollectorSerializer.detail` publishes the real per-kind union (`RequestDetail`
  polymorphic) in the schema; runtime value unchanged.
- **Frontend:** after Step 0, delete the hand-typed union in `src/api/types.ts` (the `HoldDetail` /
  `OfferDetail` / `ViewingDetail` / `MessageDetail` / `PurchaseDetail` block built from
  `DETAIL_SERIALIZERS`) and read the generated type instead. `offer.amount` is still a **string** (a
  deliberate money-precision call — do not assume number).

### G-P5-2 · Drop the second read for a request row's artwork
- **Backend now:** `RequestCollectorSerializer.artwork` is nested `{id, title, artist{id,display_name},
  image}` (light).
- **Frontend:** "my requests" / activity rows read the artwork through the v0.1 `ArtworkCache`
  (`ConversationsController`, shared with Chat/Profile). Use the embedded `artwork` object directly;
  keep `ArtworkCache` only where a surface still needs the fuller artwork shape.
- **Done when:** the conversations/activity list renders the work with no extra catalogue request
  (check the network panel).

### G-P5-3 · Deep-link a single request
- **Backend now:** `GET /api/crm/requests/{id}/` (own request only).
- **Frontend:** `ThreadPage` currently finds the row in the list store (`ConversationsController`,
  which loads every kind) and waits for the list on a cold deep link. Fetch the one request directly;
  keep the list fetch only for the surrounding list view.

### G-P5-6 · Hold-expiry is now server-side
- **Backend now:** the lazy expiry runs on the collector read, so a hold never reports `active` past
  `detail.expires_at`.
- **Frontend:** the status map's client-side `expires_at < now → expired` override can stay as a
  harmless belt-and-suspenders, but it's no longer load-bearing — note that in the code comment (or
  remove it if you prefer the server as sole source). No behaviour change expected either way.

### G-P5-9 · Show the counter-offer amount as a field
- **Backend now:** a `countered` transition carries `counter_amount` (+ `counter_currency`, default the
  offer's), stored on the offer detail. The offer `amount` is a typed decimal string.
- **Frontend:** where a counter currently arrives only as a message from Darz, read `counter_amount` /
  `counter_currency` off the offer detail and render the figure. Format from the string (don't coerce).

### G-P5-10 · Stop hardcoding the viewing-mode labels
- **Backend now:** `crm.viewing_mode` is in `/api/options/` (`in_person` / `virtual`).
- **Frontend:** `src/features/requests/ViewingSheet.tsx` carries the two labels verbatim. Populate them
  from the options endpoint (the app already reads `/api/options/` for other dropdowns) and delete the
  hardcoded pair.

### G-P5-8 · No change needed
Pagination params (`page`/`per_page`) are now declared in the schema. The frontend already sends them;
this only removes an `unknown`-param note. Nothing to build.

### G-P5-4 / G-P5-5 / G-P5-11 / G-P5-12 · Collector actions now durable (owner-decision features)
Only build the ones the owner wants surfaced — the endpoints now exist either way:
- **G-P5-4 durable archive:** `POST /api/crm/requests/{id}/archive/` (body `{archived}`, default true);
  `?archived=` on the collector list (archived hidden by default when the param is absent). Today
  `ConversationsController.clearActivity()`/`.hide(id)` are **session-only** (owner's 2026-09-04
  no-localStorage call) — they can now persist server-side. Update the copy that currently says the
  rows return on reload, since they no longer will once wired.
- **G-P5-5 collector transition:** `POST /api/crm/requests/{id}/transition/`, whitelisted to
  `offer→withdrawn` / `viewing→cancelled` (any other target 403s). The old app shipped no
  withdraw/cancel UI — build only if the owner now wants it.
- **G-P5-11 artist enquiry link:** create accepts a nullable `artist`; both tiers expose
  `artist {id, display_name}`. `RequestController.enquireAboutArtist` currently files
  `kind=information` with the artist named only in `detail.message` — it can now pass `artist` so the
  request is a real link.
- **G-P5-12 read activity back:** `GET /api/crm/activity/` (own activity, newest first, filter by
  kind/artwork). `ActivityLogger` is write-only today; wire a read only if a surface needs it.

---

## P2 — Curated selections, questionnaire, push

### G-P24-1 · The curated chip can show its real name
- **Backend now:** `GET /api/catalog/artworks/selections/` (the "Curated for You" grid) exposes
  `selection_name` on each item — the most-recent named selection the work belongs to, or `null` for a
  bare grant.
- **Frontend:** the chip always reads "Curated for You". Use `selection_name` when present, falling
  back to "Curated for You" when `null` (this mirrors the old app's `s[0]?.name || 'Curated for You'`).

### G-P24-2 · The "your curated selection is ready" notice is now buildable
- **Backend now:** `GET /api/catalog/selections/` (collector tier) returns
  `[{id, name, changed_at, is_new}]`, newest-changed first — `is_new` = the selection gained a grant
  since the collector last opened it. `POST /api/catalog/selections/{id}/seen/` marks it seen
  (server-side "last seen", own selection only).
- **Frontend:** this notice was **not ported** (no change signal existed). It can now be built the old
  app's way: show the "ready · tap to view" notice when any selection has `is_new`, and POST `…/seen/`
  on open to dismiss. Confirm with the owner it's wanted before building (it was a deliberate
  non-port, not an oversight).

### G-P25-1 · Stop special-casing the questionnaire 404
- **Backend now:** `GET /api/recommendations/questionnaire/` returns **200** with
  `{answers: null, submitted_at: null, answered: false}` for a never-answered collector (a saved row
  has `answered: true`).
- **Frontend:** remove the "treat 404 as first-run" special case; branch on `answered` instead.

### G-P25-2 · Serve the owner-editable question set (was hardcoded)
- **Backend now:** `GET /api/recommendations/question-set/` (collector) returns the one active set
  `{title, intro, questions:[{prompt, question_type, options, order}]}` (empty shape when none active).
  Types: `single_choice` (has `{value,label}` options) and `text`. Admin CRUD lives under
  `/api/recommendations/admin/question-sets/` (list/create · get/patch/delete · `activate/`), PATCH is
  optimistic-locked.
- **Frontend:** the questionnaire currently hardcodes questions/intro. Drive the collector screen from
  `GET …/question-set/` so the owner's edits show. If the owner wants to edit the set from the admin
  panel, that's a new admin desk over the admin CRUD (scope with the owner — the old panel had a
  Collectors-linked editor).
- **Done when:** the collector questionnaire renders the served set; no question strings remain in
  frontend source.

### G-P13-1 · Web-push opt-in can now subscribe
- **Backend now:** `GET /api/notifications/vapid-public-key/` (AllowAny) returns `{public_key}`
  (empty string when unprovisioned).
- **Frontend:** the push opt-in was stubbed because `pushManager.subscribe()` needs this key. Fetch it,
  and treat an empty string as "push not configured — keep the control hidden/disabled" rather than an
  error. Only build if push is in the V1 scope the owner wants now.

---

## P2 — Invite-only auctions (G-CLUB-3, shipped by backend Phase 35)

- **Backend now:** `Auction.invite_only` (bool) + an `invited_collectors` M2M exist
  (`apps/auctions/models.py`). An uninvited collector never sees an invite-only auction in the
  list/detail and can't register a paddle for it (server-enforced). `invite_only` is on the base
  collector-facing `AuctionSerializer` (safe bool); the invited-collector identities are admin-only via
  `GET/POST /api/auctions/admin/auctions/{id}/invite-only/` (`AuctionInviteOnlySerializer`).
- **Frontend:** this was recorded as an open backend gap in `docs/TASKLIST.md` (the old panel's "Make
  an auction private…") but the backend has since shipped it. Two surfaces: (a) collector side needs no
  new work — the server already filters invite-only auctions out for the uninvited, so the existing
  list/detail just works; optionally show an "invite-only" marker from the `invite_only` bool. (b) the
  admin auction desk (`AuctionsAdminPage` / `AuctionAdminDetailPage`) can expose the invite-only toggle
  + invited-collector picker over the admin endpoint. Build the admin side only if the owner wants it.
- **Done when:** an admin can mark an auction invite-only and add collectors; an uninvited collector
  cannot see or register for it (verify against a second collector session).

## P2 — Admin Database desk: the four "unavailable" filters are now real (Phase 5b)

- **Backend now:** `ArtworkAdminFilterSet` (admin artworks list) accepts:
  `?gallery_portal=` (visibility == gallery_portal), `?complete=` (reuses Data Health's incomplete
  definition), `?duplicate_images=` (shared-`object_key` signal), and `?size=small|medium|large`
  (bucketed on the largest side in cm: ≤50 / 50–120 / >120).
- **Frontend:** the admin Database desk names these four as unavailable. Add them to the desk's filter
  set (the cheap exact filters shipped in #66 already show the pattern — server-side param, chip that
  clears individually, URL round-trips). Remove the "unavailable" copy for each as it's wired.

---

## Group-B adoption — non-V1 screen-completion seams (shipped B1–B5, 2026-09-24)

Each closes one incomplete admin/collector screen. None blocks launch; build as the owner scopes each
screen. All use the standard envelope.

### G-F1-1 · Typed request-create body
- **Backend now:** `RequestCreate.detail` types as the per-kind `RequestDetail` union in the schema.
- **Frontend:** after the Step-0 regen, drop any `unknown`/manual cast on the create body's `detail`;
  build it from the generated union (offer `amount` stays a string).

### G-Q-1 + Profile edit · `PATCH /api/auth/me/`
- **Backend now:** `PATCH /api/auth/me/` (collector) edits `full_name`/`phone`/`city`/
  `preferred_language`; `me` GET now returns those fields; a team principal PATCHing gets 403.
- **Frontend:** (a) Profile → Account is read-only today — add an edit form over PATCH me;
  (b) point the questionnaire **contact step** at the same endpoint (closes G-Q-1) instead of dropping
  what the collector enters. `preferred_language` is `fa`/`en`.

### G-MEMB-3/6/7 · Collector membership screen
- **Backend now:** `GET /api/auth/my-membership/` → `{tier, status, active_until}` (`active_until` =
  most-recent redeemed membership-code expiry, `null` when none).
- **Frontend:** the Membership screen shows only `me.tier` today — read this endpoint to show status +
  "Active until …" (render `null` as no end date). Access keys stay "issued", never the value.

### G-DOC-1 · Profile → Account "Documents"
- **Backend now:** `GET /api/documents/` (collector) returns own **shared** docs
  `{id, kind, title, ref, pdf_url, shared_at, created_at}`, newest-shared first.
- **Frontend:** build the "Your documents — invoices, certificates & provenance" list from it
  (read-only; `pdf_url` is presigned). Optionally a client-tracked "New" badge on `shared_at`, like the
  old app.

### G-CHAT-2 · Admin chat-message archive
- **Backend now:** `POST /api/crm/admin/messages/{id}/archive/` (body `{archived}`) — an admin-desk-only
  hide (distinct from soft-delete; the collector's thread is untouched). The admin thread hides archived
  messages by default; `?include_archived=true` shows them.
- **Frontend:** add an archive/restore control on the admin chat/thread desk + an "include archived"
  toggle. It does **not** remove the message for the collector.

### G-AUC-4 + cover image · Admin auction desk
- **Backend now:** `Auction.archived` + `POST /auctions/admin/auctions/{id}/archive/` + `?archived=`
  (hidden by default); `cover_image_url` on `AuctionSerializer` + `POST`/`DELETE …/{id}/cover-image/`
  (multipart).
- **Frontend:** add an archive/restore action to `AuctionsAdminPage` (archived off the default list);
  add a cover-image upload; render cards from `cover_image_url` and **drop the per-card first-lot image
  read**.

### G-REC-1 · Records house facet
- **Backend now:** exact `?house=` on both the collector and admin records lists.
- **Frontend:** add a house filter/dropdown to the Records desk (distinct from the free-text search).

### G-SALE-4 · Auction Sales tab (now unblocked)
- **Backend now:** `Sale.source` (`market`/`auction`) + `?source=` on the admin sales list. **And, as of
  2026-09-25 (PR #51), auction→Sale automation is live:** a won lot auto-creates a **draft**
  `Sale(source=auction)` (agreed_price = hammer + buyer's premium, commission_amount = the premium), with
  a new read-only `lot` FK on each sale linking back to the auction lot.
- **Frontend:** build the deferred **Auction Sales** tab by filtering `?source=auction`. The rows now
  arrive on their own after each lot closes (as `draft`) — surface them for the admin to review/confirm,
  and use `lot` to link a row back to its auction lot. Manual `source=auction` create still works for
  off-platform auction sales.

### G-HEALTH-2/3/4 · Data Health desk counts
- **Backend now:** `Artwork.source_type` (gallery/artist/collector/dealer/other) + `?source_type=`
  (Gallery-/Dealer-/Artist-sourced counts); `deleted_records` count on `GET /catalog/admin/data-health/`;
  `?created_after=` on the admin artworks list (recently-added).
- **Frontend:** fill the three previously-absent counts tiles — the source-type band via `?source_type=`
  filtered counts, the "Deleted (permanent)" tile from `deleted_records.count`, and "Recently Added"
  via a `?created_after=<iso>` count. Also surface `source_type` in the artwork editor if wanted.

### document_refs (D19) · Attach a document into a collector thread
- **Backend now (PR #49):** `RequestMessage.document_refs`. The admin reply endpoint
  (`POST /api/crm/admin/requests/{id}/messages/`) accepts `document_refs: [<document id>]` (team-only) and
  **attaching = sharing** — the doc is run through the G-DOC-1 share path (collector-visible-kind allowlist
  enforced), so it lands on the collector's Documents list and is openable. Thread reads return
  `document_refs` **enriched** as `[{id, kind, title}]`.
- **Frontend:** in the admin chat/thread composer, add a "attach document" picker that sends
  `document_refs` alongside `body`; render attached docs on each message from the enriched shape. This
  replaces the D19 share-by-link workaround on `DocumentDetailPage` (keep link as a fallback).

### G-KEY-1 · Owner "Access" desk (roster-wide keys)
- **Backend now (PR #50):** `GET /api/auth/admin/access-keys/` — every key across the roster,
  soonest-to-lapse first, plaintext never returned. Filters: `?status=` (computed
  active/locked/**expired**), `?collector=`, `?expiring_soon=true`, and `?search=` on collector name. Each
  row: `{id, collector:{id,display_name}, status, is_expired, issued_at, expires_at, last_used_at,
  activity:{saved,holds,offers,requests,auction,logins}, created_at}`. Plus
  `GET /api/auth/admin/access-keys/summary/` → `{total_keys, active_keys, locked_keys, expired_keys,
  expiring_soon, logins_today, total_collectors, active_collectors}`.
- **Frontend:** build the standalone owner **Access** desk — KPI tiles from `…/summary/`, the key table +
  filters from the list, the "expiring/expired — extend or lapse" review via `?expiring_soon=true` /
  `?status=expired`. Revoke/extend already exist per-key. Never show a plaintext key (issued-only).

---

## Suggested order

1. **P0** G-P34-1 (200/201/429 handling) — tiny, and it's the launch gate's frontend half.
2. **Step 0 schema regen**, then the **CRM precision cluster** (G-P5-1/2/3/6/9/10) — one regen, a batch
   of typecheck-guided cleanups, all on shipped collector screens.
3. **G-LOCK-1** conflict wiring on the two admin editors.
4. **G-24-1** chip name + **G-P25-1** questionnaire 200 — both small.
5. Then the owner-decision features (G-P24-2 notice, G-P25-2 admin editor, G-P5-4/5/11/12 UI, G-P13-1
   push, Phase 5b filters) as the owner scopes them.
6. **Group-B adoptions** (section above) per screen: the small typed/config ones first (G-F1-1 with the
   regen; profile-edit + G-Q-1; my-membership; records `?house=`), then the screen builds
   (collector Documents, admin chat archive, auction archive + cover image, Auction Sales tab, the
   Data Health count tiles).
7. **The three 2026-09-25 follow-ups** (PRs #49/#50/#51): `document_refs` attach in the chat composer,
   the Auction Sales tab now that lots auto-settle, and the standalone owner **Access** desk (G-KEY-1) —
   all after a schema regen.

After each, update/remove the matching note in `docs/PHASE_5_API_GAPS.md` /
`docs/PHASE_24_35_API_GAPS.md` so a later reader doesn't re-flag a closed gap.
