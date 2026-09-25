# API gaps — single source of truth

**Re-verified 2026-09-25** against `-darz-web` `development` @ `d987910` (PR #100) and `darz-backend-api`
`development` @ `df0421f` (PR #70), the **final V1 backend: 224 paths / 323 operations**. Every
operation's adoption state is now measured, not inferred: see `docs/audit/2026-09-25/API_ADOPTION_MATRIX.md`
(225 integrated · 3 partial · 9 bound-no-UI · 85 not bound · 1 backend-only). The phased plan that closes
the frontend side is **`V1_IMPLEMENTATION_PLAN.md`**. Backend↔frontend contract problems (including the
backend defects found in this pass) are in **`V1_CONTRACT_ISSUES.md`** (`C-…` IDs).

**What changed since the 2026-09-24 version of this file:** backend PRs #54–#70 closed another ~35 gaps
(section "2026-09-25 backend additions" below). None of them is adopted yet. Three earlier rows were
wrong or went stale: Phase 21 pricelists (per-link pricelists now exist), G-P25-1 (now a **live FE bug**,
C-3) and G-SALE-3 (the nested rows **break** the current Sales desk, C-1).

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
| G-LOCK-1 | accounting, auctions | Ledger + auction-record editors last-write-wins | ✅ Closed | `expected_version` mandatory → 409 when stale; **without it the view 500s** (`partial=True` skips the required check, then `validated.pop('expected_version')` raises — backend should 400). FE adopted 2026-09-25: both desks send it and show `ConflictBanner`; wire format pinned in `optimisticLock.test.ts` (8 calls). |

## CRM — collector requests (Phase 5 / Flow 1)

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-P5-1 | Untyped `detail` on collector **output** | ✅ Closed | Polymorphic union in schema; FE uses it (2026-09-25). One hand type stays: `HoldDetail.expires_at` — `HoldDetailSerializer` has no input fields, so the generated union has no hold member. |
| G-F1-1 | Untyped `detail` on **create** input | ✅ Closed | `RequestCreate.detail` types as the `RequestDetail` union (B4). FE adopted 2026-09-25: `RequestDetailInput` (generated members minus the read-only `counter_*`); offer `amount` now sent as a decimal string. |
| G-P5-2 | Bare artwork uuid on collector rows | ✅ Closed | Nested `{id,title,artist,image}`. FE adopted 2026-09-25: Chat, Profile and Acquisitions read it directly (no catalogue read); the thread's request card still resolves the full work by `id` for year · medium. |
| G-P5-3 | No single-request read | ✅ Closed | `GET /crm/requests/{id}/`. FE adopted 2026-09-25: a deep link to a thread reads its one request (`ConversationsController.open`). |
| G-P5-6 | Hold expiry not applied on read | ✅ Closed | Lazy expiry now server-side (list + detail). FE 2026-09-25: the client check stays as a backstop for a hold that lapses while the page is open. |
| G-P5-8 | Pagination params undeclared | ✅ Closed | Schema-only; no FE change. |
| G-P5-9 | String `amount`; no counter amount | ✅ Closed | `counter_amount`/`counter_currency` on `countered`; amount stays precise string. **FE: owner decision** — neither `app.html` nor the design package has any counter-offer UI or copy, so nothing is rendered yet (`API_ADOPTION_PLAN.md` Batch 3). |
| G-P5-10 | Viewing `mode` not in `/api/options/` | ✅ Closed | FE adopted 2026-09-25: `ViewingSheet` labels come from `crm.viewing_mode` (`viewingMode.ts`). |
| G-P5-4 | No durable collector archive | ✅ Closed | `POST /crm/requests/{id}/archive/`. Owner-decision UI. |
| G-P5-5 | No collector withdraw/cancel | ✅ Closed | `POST …/transition/` (whitelisted). Owner-decision UI. |
| G-P5-11 | Enquiry has no artist link | ✅ Closed | Nullable `artist` FK both tiers. Owner-decision UI. |
| G-P5-12 | Activity write-only | ✅ Closed | `GET /crm/activity/`. |
| G-F1-2..7 | Offer floor, allowed_actions, status vocab, idempotency, nested admin artwork | ✅ Closed | Flow-1 loop; see `FLOW_1_API_GAPS.md` history. |
| G-CHAT-2 | Nothing archives a message | ✅ Closed | `POST /crm/admin/messages/{id}/archive/` (B4) — admin-desk-only hide, distinct from soft-delete; `?include_archived=` on the admin thread. Collector view untouched. |
| G-Q-1 | Questionnaire contact step can't write collector contact | ✅ Closed | `PATCH /api/auth/me/` (B1) writes phone/city/full_name/preferred_language. FE ✅ adopted (Phase 1): after a successful submit the contact step's phone and language (English→`en`, Farsi→`fa`) go through `AuthService.updateMe`, best-effort; email is not writable and stays an answer only. |

## Catalog — selections, curation, filters

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-P24-1 | Selection name not exposed to collector | ✅ Closed | `selection_name` on `artworks/selections/`. FE ✅ adopted (Phase 1): the Market chip reads the first row's `selection_name`, else "Curated for You". |
| G-P24-2 | No change signal for "ready" notice | ✅ Closed | `GET /catalog/selections/` + `POST …/{id}/seen/`. Owner-decision UI. |
| Phase 5b | Database desk 4 hard filters | ✅ Closed | `gallery_portal`/`complete`/`duplicate_images`/`size` on admin filter set. |
| G-P6-1..4 | Saved/favorites loop | ✅ Closed | See `PHASE_6_API_GAPS.md` history. |
| G-CAT-1/3/8 | Admin row thumb + artist name, artists search/ordering/works_count, publish gate | ✅ Closed | 2026-09-25. See "2026-09-25 backend additions". |
| G-CAT-4..7 | Old editor fields with no backend | ➖ Stated on the editor | Not V1 API gaps. |
| G-CAT-9 | Source-freshness loop | ⛔ Deferred | Backend Phase 10 sources loop. |

## Recommendations — questionnaire

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-P25-1 | `GET questionnaire` 404 on first run | ✅ Closed | Returns 200 `{answers,submitted_at,answered}`. FE ✅ adopted (Phase 0): the controller and the Profile card branch on `answered` (`isQuestionnaireAnswered`). |
| G-P25-2 | Question set not served (hardcoded) | ✅ Closed | `GET /recommendations/question-set/` + admin CRUD. FE: drive the screen from it. |

## Notifications — web push

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-P13-1 | VAPID public key unpublished | ✅ Closed | `GET /notifications/vapid-public-key/`. FE: only if push is in scope. |

## Auctions

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-CLUB-3 | No invitation-only auctions | ✅ Closed | `Auction.invite_only` + `invited_collectors` (Phase 35). FE: admin toggle optional; collector side already filtered server-side. |
| G-AUC-4 | No `archived` on an auction | ✅ Closed | `Auction.archived` + `POST /auctions/admin/auctions/{id}/archive/` + `?archived=` (hidden by default) (B2) — FE ✅ adopted (Phase 3): Live Auctions' "Show archived" toggle + Archive / ↩ Restore on the list and the auction page. The collector list does not filter `archived` (backend candidate). |
| G-REC-1 | No auction-house facet on records list | ✅ Closed | Exact `?house=` on both records lists (B2) — FE ✅ adopted (Phase 3) on the admin Records desk ("All auction houses"; options = standard houses + a walk of the records — no facet endpoint, backend candidate). The collector Records page is the Artist view, where the old app hid the filter. |
| Auction poster | No `cover_image_url` on `Auction` | ✅ Closed | `cover_image_url` on `AuctionSerializer` + `POST`/`DELETE …/{id}/cover-image/` (B2). FE ✅ adopted (Phase 3): collector cards and the event hero read `cover_image_url`, the per-card first-lot read is deleted; the auction page uploads/removes the poster; the Live Auctions row shows it. |
| Records `?section=` | No server split Past/Upcoming/Live/Highlights | ✅ Closed | `?section=` already served on both records lists (was implemented; the earlier "pending" was a doc error). |
| G-AUC-1/2/3 | Auction edit + terms, lot edit, registration reset | ✅ Closed | 2026-09-25. See "2026-09-25 backend additions". |

## Membership / accounts / profile

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-MEMB-3/6/7 | No collector "my membership" read / expiry surfaced | ✅ Closed | `GET /api/auth/my-membership/` → `{tier, status, active_until}` (B1). `active_until` = most-recent redeemed membership-code expiry (null when none). FE ✅ adopted (Phase 1): Settings row sub-line + ACTIVE/EXPIRED pill and the sheet's "Active membership" / "Membership ended" blocks (`membership.ts`). The redeemed code is not returned, so the old "Code …" line is not shown. |
| Profile edit | No `PATCH /auth/me/` | ✅ Closed | `PATCH /api/auth/me/` (B1) edits phone/city/full_name/preferred_language; team principal 403. `me` GET now returns those contact fields (it didn't before B1). Also closed G-Q-1. FE ✅ adopted (Phase 1): Profile › Account is the editable card (`AccountForm`, `AuthService.updateMe`, session `me` refreshed). `email` is neither returned nor writable for a collector, so the old Email field is not shown (backend candidate: return it read-only). |
| Access-key display | `me` doesn't return the plaintext key | ➖ By design | Keys are hashed and never re-exposed. Not fixable; show the card as "issued", not the value. |
| G-KEY-1 | No roster-wide access-key list — keys served per collector only, so the old owner "Access" desk couldn't be built | ✅ Closed | 2026-09-25 (PR #50). `GET /api/auth/admin/access-keys/` — every key across the roster, soonest-to-lapse first, plaintext never re-exposed. Filters `?status=` (computed active/locked/**expired**, since the stored status only flips on a login attempt), `?collector=`, `?expiring_soon=true`, and search on collector name. Rows carry collector `{id, display_name}`, computed `is_expired`, and per-collector activity tallies. Plus `GET …/access-keys/summary/` for the desk KPI tiles (totals by state, expiring-soon, logins-today, collector totals). |
| G-MEMB-1/2/4/5 | (admin strips, tier literals, start date) | Mixed | G-MEMB-1 built (#83); G-MEMB-2/4/5 are literals/`theme.*` — owner-editable copy, not V1 API gaps. |

## Documents

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-DOC-1 | Issued documents not exposed to collectors | ✅ Closed | `GET /api/documents/` (B3) — the collector's own shared docs (id/kind/title/ref/pdf_url/shared_at). Admin issues via `POST /documents/admin/documents/{id}/share/`; collector-visible kinds: invoice/certificate/provenance/contract/receipt/proforma/artwork_sheet/condition_report. FE ✅ adopted (Phase 1): Profile › Account › "Your documents" (`DocumentsService`), opening `pdf_url`; "New" is per device (`darz_docs_seen`, as the old app). |
| document_refs (D19) | No way to attach a document to a collector's chat thread — only share-by-link | ✅ Closed | 2026-09-25 (PR #49). `RequestMessage` now carries `document_refs` (like `artwork_refs`): the admin reply endpoint accepts `document_refs: [id]` (team-only) and **attaching = sharing** (runs the G-DOC-1 share path + collector-visible-kind allowlist), so the doc lands on the collector's documents list and is openable. Reads expose them enriched `[{id, kind, title}]`. Replaces the D19 share-by-link workaround. |

## Sales / Data Health

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-SALE-4 | `Sale` has no source axis for auction settlement | ✅ Closed | `Sale.source` (market/auction) + `?source=` on the admin sales list (B5) — FE ✅ adopted (Phase 2): the Auction Sales tab and the Market Sales Source filter. **Auction→Sale automation now shipped too** (2026-09-25, PR #51): a won lot auto-creates a draft `Sale(source=auction)`, so the tab fills itself. |
| Auction→Sale automation | Won lots didn't auto-create a Sale (admin entered each by hand) | ✅ Closed | 2026-09-25 (PR #51), follow-up to G-SALE-4. On lot close (won), `LotService.close` auto-creates a **draft** `Sale(source=auction)` with `agreed_price` = hammer + buyer's premium and `commission_amount` = the premium. New `Sale.lot` FK links each sale back to its lot (also the idempotency key). Passed lots create nothing. |
| G-SALE-1/2/3 | Sales desk tiles, filters, bare-uuid rows | ✅ Closed | 2026-09-25. See "2026-09-25 backend additions". **G-SALE-3 breaks the current desk (C-1).** |
| G-HEALTH-1 | Data Health real counts panel | ✅ Closed | Built #83. |
| G-HEALTH-2/3/4 | Three Data Health checks/counts with no backend | ✅ Closed | B5: **G-HEALTH-2** `Artwork.source_type` + `?source_type=` (Gallery/Dealer/Artist-sourced counts); **G-HEALTH-3** `deleted_records` count on the report; **G-HEALTH-4** `?created_after=` (recently-added). |

## 2026-09-25 backend additions (PRs #54–#70) — backend ✅, frontend adoption per `V1_IMPLEMENTATION_PLAN.md`

| ID | Backend now serves | FE state | Phase |
| --- | --- | --- | --- |
| G-SALE-1 | `GET /sales/admin/sales/summary/` (total + per status/payment/delivery/source) | ✅ Adopted (Phase 2): Market Sales tiles + "N total" + the Source filter's values; the 4 `per_page=1` counts are gone. Ledger-wide, so Auction Sales counts its own rows; "Need attention" (overdue follow-ups) has no aggregate and is counted over a walk (backend candidate: an overdue count on `summary/`) | 2 |
| G-SALE-2 | `?search&payment_status&delivery_status&source&ordering` on the admin sales list | ✅ Adopted (Phase 2): search + Stage/Payment/Delivery/Source/Sort, each one param (`SalesController.test.ts`) | 2 |
| G-SALE-3 | Nested `artwork{id,title}`, `collector{id,display_name}`, `responsible{id,name}` on rows (input stays ids) | ✅ Adopted (Phase 0): read off the row; only the artist line is still a cached per-work read | 0 |
| G-SALE-5 | `follow_up_at` + `follow_up_overdue`, `POST …/follow-up/`, append-only `GET/POST …/notes/` | ✅ Adopted (Phase 2): the deal card's follow-up (presets/date/Clear, "due" from the server) and notes thread; the row's "Follow-up … · due" line; the Need attention tile | 2 |
| G-AUC-1 | `PATCH /auctions/admin/auctions/{id}/` (lock; draft/scheduled only) + `terms`/`terms_required` on create | ✅ Adopted (Phase 3): the auction page's details + terms form (ConflictBanner on 409, read-only past scheduled, client-side window check C-18); terms on create | 3 |
| G-AUC-2 | `PATCH /auctions/admin/lots/{id}/` (lock; scheduled only) | ✅ Adopted (Phase 3): Edit on each scheduled lot (same lock/banner pattern; low ≤ high checked) | 3 |
| G-AUC-3 | `POST /auctions/admin/registrations/{id}/reset/` (rejected → pending) | ✅ Adopted (Phase 3): ↺ Reset on rejected rows, old confirm + toast | 3 |
| G-COL-1 | `GET /auth/admin/collectors/summary/` (collectors, vip, active_30d, engaged) | Not bound: tiles substitute "Active" | 4 |
| G-COL-2 | `last_activity_at`, `purchase_count`, `?ordering=activity\|purchases` (list only, C-16) | Not sendable | 4 |
| G-CAT-1 | `thumb`, `artist_name` on admin artwork rows | Unused: names resolved from a capped roster | 4 |
| G-CAT-3 | Admin artists `?search&ordering` + `works_count` | Unused. The truncation at 100 is fixed (Phase 0 walks every page, C-5); server search, ordering and the count are Phase 4 | 4 |
| G-CAT-8 | Publish gate: 400 `details.missing` | Shown only as flattened text | 4 |
| G-CLUB-1 | `thumb` on club selection artworks | Unused (cover is always the fallback) | 4 |
| G-DOC-2 | `GET /documents/admin/documents/{id}/activity/` (flat `actor` + `actor_name`, C-15) | Not bound; nav History tab `path: null` | 6 |
| G-PROJ-1 | `?quick=` + `?partner=` on projects | Not sendable: client-side walks | 7 |
| G-PROJ-2/3 | `status` and `stages` writable on PATCH | Shown read-only; tiles stay 0 | 7 |
| G-PROJ-6/7 | `?archived=` bool fix; tombstoned partner round-trip | Nothing to adopt (bug fixes) | — |
| G-PROJ-8 | `description` on service-catalog items | Unused: hardcoded `DESCRIPTIONS` map | 5 / 7 |
| G-PROJ-9 | Manual FX fields + `GET …/projects/{id}/totals/` | Not bound | 7 |
| G-PORT-1 | Snapshot `image_url` on assigned works; `POST portal/{token}/artworks/{id}/image/` (multipart) | Unused: cards say "No image"; no upload | 5 |
| G-PORT-2 | `updates[]` in portal state | Unused: pills are per-tab memory | 5 |
| G-PORT-3 (P3a/P3b) | Pricelist `status` + `POST admin/pricelists/{id}/status/`, `GET …/pricelists/cap/`, structured `lines[]` + `POST portal/{token}/pricelists/build/` | Unused: rows always "Received" | 5 |
| G-PORT-4/6 | Update kinds `ask` + `withdraw` (an approved withdraw **unassigns** the work) | Never sent; admin confirm copy is wrong for withdraw | 5 |
| G-PORT-9 | `cover` in portal state | Unused | 5 |
| G-PORT-11 | Portal throttle only on writes | Nothing to adopt | — |
| G-PORT-12b | Editable exhibition catalogue: `/gallery/admin/exhibition-catalogue/` CRUD (lock) | No desk | 5 |
| G-PORT-13 | `POST /gallery/admin/links/{id}/reissue/` + expiry sweep | Not bound; copy says "no re-issue" | 5 |
| G-PORT-14 | `object_key` + `file_url` on pricelists | Unused | 5 |
| G-PORT-15 | `?search=` on admin links | Unused: client-side over one page | 5 |
| G-PORT-16 | `quantity` on exhibition service lines | Never sent | 5 |
| G-PORT-5/7/8, P3c | Referral tab, drawn signature, offer engine, formatted pricelist download | ⛔ **No backend**: not V1 | — |
| G-PORT-10 | Pre-PIN name probe | ➖ Dropped by owner | — |

## Backend defects found in the 2026-09-25 re-baseline (raise on `darz-backend-api`)

Full detail and FE work-arounds are in `V1_CONTRACT_ISSUES.md` § B. In short:
- **C-6** a PATCH without `expected_version` gives **500** on 18 endpoints (was recorded for 2).
- **C-7** no hold member in the detail union.
- **C-8** the portal state schema is undeclared.
- **C-9** the portal `pin` is documented as a query param on writes (actually body).
- **C-10** error `details` is untyped.
- **C-11** 4xx with `INTERNAL_ERROR`.
- **C-12** an admin can't view a portal replacement image.
- **C-13** security: portal PIN brute force, unthrottled logins, unvalidated anonymous uploads, builder
  artwork scope.
- **C-14** options are missing sale `source` and pricelist `status`.
- **C-18** no window validation on auction/lot edits.
- **C-19** the prod Dockerfile is WSGI, so there are no auction WebSockets.
- **C-2** unstable enum names.

## Owner-editable copy / theme (not API gaps — resolved via `/api/app-theme/`)

| Item | State | Note |
| --- | --- | --- |
| WhatsApp number, hero/About/ship copy, legal text, tier names/prices | ✅ Closed | Live under `theme.*` (`GET /api/app-theme/`, Phase 32). Was mis-recorded as gaps in older docs. |

## Deferred / unbuilt feature phases (owner-scoped — not seams)

| Item | State | Note |
| --- | --- | --- |
| G-6: Intelligence · Marketing Hub · Document Builder | ⛔ Deferred | API ready, no UI. Owner decision. |
| Phase 20 Logistics | ⛔ Deferred | No `/api/logistics/` namespace. |
| Phase 21 Library (saved-items library) | ⛔ Deferred | No library endpoints. **Per-link gallery pricelists are no longer a gap:** status lifecycle, soft cap and a structured builder shipped 2026-09-25 (P3a/P3b, see below). Only the formatted download (P3c) is still unbuilt. |
| Auction Sales | ✅ Done | Built V1 Phase 2 (2026-09-25): `/admin/sales?source=auction`, the Sales desk with a fixed `source=auction` scope; the auto-created drafts list there, each row's **Lot N** links to its auction page (lot resolved via `GET …/admin/lots/{id}/`). |
| G7 "Refine" filter UI, FE-R1…R4 (Records desk/curation/import/sub-tabs) | ⚪ Frontend-only | Backend ready; UI is this repo's Phase 12+. |
| Legacy-id lookup / catalogue change-stamp | ⚪ Frontend-only | Endpoints exist; nothing consumes them yet. |
| G-DEL-1 (three admin deletes) | ✅ Closed | Built Phase 6b (2026-09-22). |
| G-REQ-1..3 | ➖ By design | Recorded as not portable, not stubbed. |

---

## What's actually left, in one line each

- **No V1 backend *feature* gaps remain** (backend `development` @ `df0421f`, through PR #70). There are
  no 🔵 rows. There **are** backend *defects*: see `V1_CONTRACT_ISSUES.md` § B.
- **Frontend adoption of the closed backend work** → `V1_IMPLEMENTATION_PLAN.md` (phases 0–10); per-gap
  detail in `API_GAPS_FRONTEND_ADOPTION.md`. This is the main remaining work.
- **Frontend-only UI** (⚪ rows) → this repo's `TASKLIST.md`.
- **Deferred/unbuilt phases** (⛔ rows: Logistics/Library/Insights, Marketing Hub & Document Builder
  UIs) → owner-scoped; `TASKLIST.md`.

Rows marked "(verify)" carry an older doc's closed-claim that this session did not re-run against the
schema — confirm when that area is next touched.
