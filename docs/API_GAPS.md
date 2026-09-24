# API gaps — single source of truth

**Last verified 2026-09-24** against `-darz-web` `development` and `darz-backend-api` `development`
@ `5f6d7ea`. This file is **the** live index of every recorded API gap and its current state. It
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
| G-P34-2 | access-request | No rate limit on public `POST /auth/access-requests/` | ✅ Closed | Throttle `5/hour`/IP (env). FE: handle 429. |
| G-P34-1 | access-request | No `client_req_id` dedupe | ✅ Closed | 200 replay / 201 new. FE: treat 200 as success. |
| G-LOCK-1 | accounting, auctions | Ledger + auction-record editors last-write-wins | ✅ Closed | `expected_version` → 409. FE: wire `ConflictBanner` on those 2 desks. |

## CRM — collector requests (Phase 5 / Flow 1)

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-P5-1 | Untyped `detail` on collector **output** | ✅ Closed | Polymorphic union in schema. FE: delete hand-typed union in `src/api/types.ts`. |
| G-F1-1 | Untyped `detail` on **create** input | 🔵 Pending | Create view `@extend_schema(request=…)` still bare → `RequestCreate.detail` is `unknown`. Backend one-liner. |
| G-P5-2 | Bare artwork uuid on collector rows | ✅ Closed | Nested `{id,title,artist,image}`. FE: drop the `ArtworkCache` second read. |
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
| G-CHAT-2 | Nothing archives a message | 🔵 Pending | Admin chat desk. Owner: archive-vs-delete semantics. |
| G-Q-1 | Questionnaire contact step can't write collector contact | 🔵 Pending | Covered by collector profile-edit endpoint. |

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
| G-AUC-4 | No `archived` on an auction | 🔵 Pending | Admin auction desk. |
| G-REC-1 | No auction-house facet on records list | 🔵 Pending | `AuctionRecord.house` exists; needs a filter facet. |
| Auction poster | No `cover_image_url` on `Auction` | 🔵 Pending | Nice-to-have; removes a per-card lot read. |
| Records `?section=` | No server split Past/Upcoming/Live/Highlights | 🔵 Pending | Client split works; efficiency only. |
| G-AUC-1/2 | (cited in `services.ts`/`types.ts`) | ✅ Closed (verify) | Carried closed; re-verify on next auctions touch. |

## Membership / accounts / profile

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-MEMB-3/6/7 | No collector "my membership" read / expiry surfaced | 🔵 Pending | `me.tier` only today. Collector Membership screen. |
| Profile edit | No `PATCH /auth/me/` (phone/city/language read-only) | 🔵 Pending | `Me` already returns phone/city; nothing writes them. Also closes G-Q-1. |
| Access-key display | `me` doesn't return the plaintext key | ➖ By design | Keys are hashed and never re-exposed. Not fixable; show the card as "issued", not the value. |
| G-MEMB-1/2/4/5 | (admin strips, tier literals, start date) | Mixed | G-MEMB-1 built (#83); G-MEMB-2/4/5 are literals/`theme.*` — owner-editable copy, not V1 API gaps. |

## Documents

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-DOC-1 | Issued documents not exposed to collectors | 🔵 Pending | Profile → Account "Documents". Owner: which types are collector-visible. |

## Sales / Data Health

| ID | Gap | State | Note |
| --- | --- | --- | --- |
| G-SALE-4 | `Sale` has no source axis for auction settlement | 🔵 Pending | `seller_source`/`source_request` exist; settlement axis missing. |
| G-SALE-1/3 | (cited in `types.ts`) | ✅ Closed (verify) | Carried closed. |
| G-HEALTH-1 | Data Health real counts panel | ✅ Closed | Built #83. |
| G-HEALTH-2/3/4 | Three Data Health checks with no backend | 🔵 Pending | Pin the exact three against the desk. |

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
| Auction Sales | ⛔ Deferred | Backend-blocked; re-verified 2026-09-22. |
| G7 "Refine" filter UI, FE-R1…R4 (Records desk/curation/import/sub-tabs) | ⚪ Frontend-only | Backend ready; UI is this repo's Phase 12+. |
| Legacy-id lookup / catalogue change-stamp | ⚪ Frontend-only | Endpoints exist; nothing consumes them yet. |
| G-DEL-1 (three admin deletes) | ✅ Closed | Built Phase 6b (2026-09-22). |
| G-REQ-1..3 | ➖ By design | Recorded as not portable, not stubbed. |

---

## What's actually left, in one line each

- **Frontend adoption of the closed backend work** → `API_GAPS_FRONTEND_ADOPTION.md` (start there).
- **Group-B backend gaps** (🔵 rows above) → `../darzmarket-api/docs/GROUP_B_API_GAPS_PLAN.md`.
- **Deferred/unbuilt** (⛔ / ⚪ rows) → owner-scoped; tracked in `TASKLIST.md`.

Rows marked "(verify)" carry an older doc's closed-claim that this session did not re-run against the
schema — confirm when that area is next touched.
