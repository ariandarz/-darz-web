# API gaps — single source of truth

**Last verified 2026-09-24** against `-darz-web` `development` and `darz-backend-api` `development`
@ `a140548` — **all V1 and Group-B backend gaps are now merged; every 🔵 row below is closed.** The
only work left is frontend adoption (`API_GAPS_FRONTEND_ADOPTION.md`) and deferred/unbuilt phases.
This file is **the** live index of every recorded API gap and its current state. It
supersedes the live-status role of `API_INTEGRATION_GAPS.md`, `API_GAP_ANALYSIS.md`,
`FLOW_1_API_GAPS.md`, `PHASE_5_API_GAPS.md`, `PHASE_6_API_GAPS.md`, `PHASE_8_API_GAPS.md` and
`PHASE_24_35_API_GAPS.md` — those stay only as the historical record of what was missing and why.

When a gap's state changes, change it **here**, and (for a fix) delete the matching work-around per
`API_GAPS_FRONTEND_ADOPTION.md`. Regenerate `src/api/schema.d.ts` from a running backend before
trusting any shape (`CLAUDE.md` → "API access").

## State legend

| State | Meaning |
| --- | --- |
| ✅ **Closed** | Backend serves it. If the frontend still has a work-around, the "FE" note says so → see `API_GAPS_FRONTEND_ADOPTION.md`. |
| 🔵 **Pending (backend)** | Real gap; backend must add a field/endpoint. Tracked in `../darzmarket-api/docs/GROUP_B_API_GAPS_PLAN.md`. |
| ⚪ **Frontend-only** | Backend is ready; the remaining work is UI in this repo (not an API gap). |
| ⛔ **Deferred** | Owner decision to defer / not-V1 / whole unbuilt feature phase. |
| ➖ **By design** | Not a gap — intentionally not exposed (e.g. security). |

---

## P0 / P1 — launch-relevant (all closed backend-side 2026-09-24)

| ID | Area | Gap | State | Note |
| --- | --- | --- | --- | --- |
| G-P34-2 | access-request | No rate limit on public `POST /auth/access-requests/` | ✅ Closed | Throttle `5/hour`/IP (env). FE adopted 2026-09-25: a 429 reads "Too many attempts — try again shortly." |
| G-P34-1 | access-request | No `client_req_id` dedupe | ✅ Closed | 200 replay / 201 new. FE adopted 2026-09-25: both are success; the key is reused across retries of the same values (`AccessRequestKey`). |
| G-LOCK-1 | accounting, auctions | Ledger + auction-record editors last-write-wins | ✅ Closed | `expected_version` → 409. FE: wire `ConflictBanner` on those 2 desks. |

## CRM — collector requests (Phase 5 / Flow 1)

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-P5-1 | Untyped `detail` on collector **output** | ✅ Closed | Polymorphic union in schema; FE uses it (2026-09-25). One hand type stays: `HoldDetail.expires_at` — `HoldDetailSerializer` has no input fields, so the generated union has no hold member. |
| G-F1-1 | Untyped `detail` on **create** input | ✅ Closed | `RequestCreate.detail` types as the `RequestDetail` union (B4). FE adopted 2026-09-25: `RequestDetailInput` (generated members minus the read-only `counter_*`); offer `amount` now sent as a decimal string. |
| G-P5-2 | Bare artwork uuid on collector rows | ✅ Closed | Nested `{id,title,artist,image}`. FE adopted 2026-09-25: Chat, Profile and Acquisitions read it directly (no catalogue read); the thread's request card still resolves the full work by `id` for year · medium. |
| G-P5-3 | No single-request read | ✅ Closed | `GET /crm/requests/{id}/`. |
| G-P5-6 | Hold expiry not applied on read | ✅ Closed | Lazy expiry now server-side. |
| G-P5-8 | Pagination params undeclared | ✅ Closed | Schema-only; no FE change. |
| G-P5-9 | String `amount`; no counter amount | ✅ Closed | `counter_amount`/`counter_currency` on `countered`; amount stays precise string. |
| G-P5-10 | Viewing `mode` not in `/api/options/` | ✅ Closed | FE: drop hardcoded labels in `ViewingSheet.tsx`. |
| G-P5-4 | No durable collector archive | ✅ Closed | `POST /crm/requests/{id}/archive/`. Owner-decision UI. |
| G-P5-5 | No collector withdraw/cancel | ✅ Closed | `POST …/transition/` (whitelisted). Owner-decision UI. |
| G-P5-11 | Enquiry has no artist link | ✅ Closed | Nullable `artist` FK both tiers. Owner-decision UI. |
| G-P5-12 | Activity write-only | ✅ Closed | `GET /crm/activity/`. |
| G-F1-2..7 | Offer floor, allowed_actions, status vocab, idempotency, nested admin artwork | ✅ Closed | Flow-1 loop; see `FLOW_1_API_GAPS.md` history. |
| G-CHAT-2 | Nothing archives a message | ✅ Closed | `POST /crm/admin/messages/{id}/archive/` (B4) — admin-desk-only hide, distinct from soft-delete; `?include_archived=` on the admin thread. Collector view untouched. |
| G-Q-1 | Questionnaire contact step can't write collector contact | ✅ Closed | `PATCH /api/auth/me/` (B1) writes phone/city/full_name/preferred_language. FE: point the contact step at it. |

## Catalog — selections, curation, filters

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-P24-1 | Selection name not exposed to collector | ✅ Closed | `selection_name` on `artworks/selections/`. |
| G-P24-2 | No change signal for "ready" notice | ✅ Closed | `GET /catalog/selections/` + `POST …/{id}/seen/`. Owner-decision UI. |
| Phase 5b | Database desk 4 hard filters | ✅ Closed | `gallery_portal`/`complete`/`duplicate_images`/`size` on admin filter set. |
| G-P6-1..4 | Saved/favorites loop | ✅ Closed | See `PHASE_6_API_GAPS.md` history. |
| G-CAT-1..7 | Catalogue/artwork editor edges | ✅ Closed (verify) | Cited in `src/api/services.ts`/`types.ts`; carried closed — re-verify on next catalogue touch. |

## Recommendations — questionnaire

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-P25-1 | `GET questionnaire` 404 on first run | ✅ Closed | Returns 200 `{answers,submitted_at,answered}`. |
| G-P25-2 | Question set not served (hardcoded) | ✅ Closed | `GET /recommendations/question-set/` + admin CRUD. FE: drive the screen from it. |

## Notifications — web push

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-P13-1 | VAPID public key unpublished | ✅ Closed | `GET /notifications/vapid-public-key/`. FE: only if push is in scope. |

## Auctions

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-CLUB-3 | No invitation-only auctions | ✅ Closed | `Auction.invite_only` + `invited_collectors` (Phase 35). FE: admin toggle optional; collector side already filtered server-side. |
| G-AUC-4 | No `archived` on an auction | ✅ Closed | `Auction.archived` + `POST /auctions/admin/auctions/{id}/archive/` + `?archived=` (hidden by default) (B2). |
| G-REC-1 | No auction-house facet on records list | ✅ Closed | Exact `?house=` on both records lists (B2). |
| Auction poster | No `cover_image_url` on `Auction` | ✅ Closed | `cover_image_url` on `AuctionSerializer` + `POST`/`DELETE …/{id}/cover-image/` (B2). FE: drop the per-card first-lot image read. |
| Records `?section=` | No server split Past/Upcoming/Live/Highlights | ✅ Closed | `?section=` already served on both records lists (was implemented; the earlier "pending" was a doc error). |
| G-AUC-1/2 | (cited in `services.ts`/`types.ts`) | ✅ Closed (verify) | Carried closed; re-verify on next auctions touch. |

## Membership / accounts / profile

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-MEMB-3/6/7 | No collector "my membership" read / expiry surfaced | ✅ Closed | `GET /api/auth/my-membership/` → `{tier, status, active_until}` (B1). `active_until` = most-recent redeemed membership-code expiry (null when none). |
| Profile edit | No `PATCH /auth/me/` | ✅ Closed | `PATCH /api/auth/me/` (B1) edits phone/city/full_name/preferred_language; team principal 403. `me` GET now returns those contact fields (it didn't before B1). Also closed G-Q-1. |
| Access-key display | `me` doesn't return the plaintext key | ➖ By design | Keys are hashed and never re-exposed. Not fixable; show the card as "issued", not the value. |
| G-KEY-1 | No roster-wide access-key list — keys served per collector only, so the old owner "Access" desk couldn't be built | ✅ Closed | 2026-09-25 (PR #50). `GET /api/auth/admin/access-keys/` — every key across the roster, soonest-to-lapse first, plaintext never re-exposed. Filters `?status=` (computed active/locked/**expired**, since the stored status only flips on a login attempt), `?collector=`, `?expiring_soon=true`, and search on collector name. Rows carry collector `{id, display_name}`, computed `is_expired`, and per-collector activity tallies. Plus `GET …/access-keys/summary/` for the desk KPI tiles (totals by state, expiring-soon, logins-today, collector totals). |
| G-MEMB-1/2/4/5 | (admin strips, tier literals, start date) | Mixed | G-MEMB-1 built (#83); G-MEMB-2/4/5 are literals/`theme.*` — owner-editable copy, not V1 API gaps. |

## Documents

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-DOC-1 | Issued documents not exposed to collectors | ✅ Closed | `GET /api/documents/` (B3) — the collector's own shared docs (id/kind/title/ref/pdf_url/shared_at). Admin issues via `POST /documents/admin/documents/{id}/share/`; collector-visible kinds: invoice/certificate/provenance/contract/receipt/proforma/artwork_sheet/condition_report. |
| document_refs (D19) | No way to attach a document to a collector's chat thread — only share-by-link | ✅ Closed | 2026-09-25 (PR #49). `RequestMessage` now carries `document_refs` (like `artwork_refs`): the admin reply endpoint accepts `document_refs: [id]` (team-only) and **attaching = sharing** (runs the G-DOC-1 share path + collector-visible-kind allowlist), so the doc lands on the collector's documents list and is openable. Reads expose them enriched `[{id, kind, title}]`. Replaces the D19 share-by-link workaround. |

## Sales / Data Health

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-SALE-4 | `Sale` has no source axis for auction settlement | ✅ Closed | `Sale.source` (market/auction) + `?source=` on the admin sales list (B5) — the Auction Sales tab is now buildable. **Auction→Sale automation now shipped too** (2026-09-25, PR #51): a won lot auto-creates a draft `Sale(source=auction)`, so the tab fills itself. |
| Auction→Sale automation | Won lots didn't auto-create a Sale (admin entered each by hand) | ✅ Closed | 2026-09-25 (PR #51), follow-up to G-SALE-4. On lot close (won), `LotService.close` auto-creates a **draft** `Sale(source=auction)` with `agreed_price` = hammer + buyer's premium and `commission_amount` = the premium. New `Sale.lot` FK links each sale back to its lot (also the idempotency key). Passed lots create nothing. |
| G-SALE-1/3 | (cited in `types.ts`) | ✅ Closed (verify) | Carried closed. |
| G-HEALTH-1 | Data Health real counts panel | ✅ Closed | Built #83. |
| G-HEALTH-2/3/4 | Three Data Health checks/counts with no backend | ✅ Closed | B5: **G-HEALTH-2** `Artwork.source_type` + `?source_type=` (Gallery/Dealer/Artist-sourced counts); **G-HEALTH-3** `deleted_records` count on the report; **G-HEALTH-4** `?created_after=` (recently-added). |

## Owner-editable copy / theme (not API gaps — resolved via `/api/app-theme/`)

| Item | State | Note |
| --- | --- | --- |
| WhatsApp number, hero/About/ship copy, legal text, tier names/prices | ✅ Closed | Live under `theme.*` (`GET /api/app-theme/`, Phase 32). Was mis-recorded as gaps in older docs. |

## Deferred / unbuilt feature phases (owner-scoped — not seams)

| Item | State | Note |
| --- | --- | --- |
| G-6: Intelligence · Marketing Hub · Document Builder | ⛔ Deferred | API ready, no UI. Owner decision. |
| Phase 20 Logistics | ⛔ Deferred | No `/api/logistics/` namespace. |
| Phase 21 Library / pricelist builders | ⛔ Deferred | No pricelist endpoints. |
| Auction Sales | ⚪ Frontend-only | **Unblocked** by G-SALE-4 (B5) — filter the sales list on `?source=auction`. As of 2026-09-25 (PR #51) won lots also **auto-create** the draft sale, so the tab fills itself; each row's `lot` FK links back to the auction lot. Building the tab is this repo's work. |
| G7 "Refine" filter UI, FE-R1…R4 (Records desk/curation/import/sub-tabs) | ⚪ Frontend-only | Backend ready; UI is this repo's Phase 12+. |
| Legacy-id lookup / catalogue change-stamp | ⚪ Frontend-only | Endpoints exist; nothing consumes them yet. |
| G-DEL-1 (three admin deletes) | ✅ Closed | Built Phase 6b (2026-09-22). |
| G-REQ-1..3 | ➖ By design | Recorded as not portable, not stubbed. |

---

## What's actually left, in one line each

- **No backend gaps remain.** The V1 and Group-B plans plus the three follow-up candidates
  (document_refs D19, G-KEY-1 access-key roster, auction→Sale automation) are all merged (backend
  `development` @ `57d408c`, PRs #49/#50/#51); there are no 🔵 rows left.
- **Frontend adoption of the closed backend work** → `API_GAPS_FRONTEND_ADOPTION.md` (start there) —
  this is the main remaining work.
- **Frontend-only UI** (⚪ rows, incl. the now-unblocked Auction Sales tab) → this repo's `TASKLIST.md`.
- **Deferred/unbuilt phases** (⛔ rows: Logistics/Library/Insights, Marketing Hub & Document Builder
  UIs) → owner-scoped; `TASKLIST.md`.

Rows marked "(verify)" carry an older doc's closed-claim that this session did not re-run against the
schema — confirm when that area is next touched.
