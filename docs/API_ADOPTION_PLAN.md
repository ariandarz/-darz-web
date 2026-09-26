# API adoption plan — batch by batch

> **Superseded from Batch 4 onward (2026-09-25)** by **`V1_IMPLEMENTATION_PLAN.md`**, which re-measures
> against backend `df0421f` (PRs #54–#70 added ~35 closed gaps this plan never saw) and folds Batches 4–8 into
> Phases 0–9. Batches 1–3 below are done (#99) and stay as the record.

**Written 2026-09-25.** Execution plan for `API_GAPS_FRONTEND_ADOPTION.md` (the *what* of each gap).
This file is the *order*: one batch per session, one PR per batch. Tick batches off here; tick
individual gaps in `TASKLIST.md` / `API_GAPS.md` / `CHANGELOG.md` as usual.

**To resume:** find the first batch below that isn't `[x]` and say "do batch N".

---

## What was measured today (not copied from a doc)

Backend `darz-backend-api` `development` @ `57d408c` (2026-09-25 — past the `2ca75f0`/`a140548` the
older passages cite; now includes PRs #49/#50/#51: `document_refs`, the access-key roster + summary
(G-KEY-1), and auction→Sale automation). Schema generated from it and diffed against ours:

- **All 16 new endpoints are in the schema:** `PATCH /auth/me/`, `GET /auth/my-membership/`,
  `GET /documents/`, `GET /crm/requests/{id}/`, `POST /crm/requests/{id}/archive/`,
  `POST /crm/requests/{id}/transition/`, `GET /crm/activity/`, `POST /crm/admin/messages/{id}/archive/`,
  `GET /catalog/selections/`, `POST /catalog/selections/{id}/seen/`,
  `GET /recommendations/question-set/`, `/recommendations/admin/question-sets/`,
  `GET /notifications/vapid-public-key/`, `POST /auctions/admin/auctions/{id}/archive/`,
  `POST|DELETE …/{id}/cover-image/`, `GET|POST …/{id}/invite-only/`.
- **All new filters are in the schema:** `?house=` (both records lists), `?source=` (admin sales),
  `?source_type=` / `?created_after=` / `?gallery_portal=` / `?complete=` / `?duplicate_images=` /
  `?size=` (admin artworks + facets), `?archived=` (admin auctions, collector requests),
  `?include_archived=` (admin request messages).
- **Regenerating `schema.d.ts` produces only 11 typecheck errors, from just 2 gaps:**
  - **G-P5-2** (nested `artwork` on collector requests) — 10 errors: `chat/ChatPage.tsx` (23, 88),
    `chat/ThreadPage.tsx` (47, 48), `conversations/ConversationsController.ts` (144),
    `profile/Acquisitions.tsx` (65), `profile/ProfilePage.tsx` (151, 219, 288, 385).
  - **G-CHAT-2** (`RequestMessage.archived` now required) — 1 error: the optimistic message
    literal in `chat/ThreadPage.tsx` (87).
- **So the compiler will not find the other ~25 gaps.** Most are new endpoints nothing calls yet, or
  hand-written code the schema can't see (`src/api/types.ts` detail union, `ViewingSheet` labels,
  questionnaire 404 path). Each batch below lists its call sites from a grep, not from typecheck.
- **The E2E stub (`e2e/stub-server.mjs`) serves the old shapes** — e.g. the questionnaire still
  answers 404 (`:161-165`), collector requests carry a bare artwork id. Every batch must update the
  stub alongside the code, or the render check will test the old API.

## Step 0 recipe — no Docker, no database needed

`drf-spectacular` builds the schema from code, so a running server isn't required. Verified today:

```bash
# once per session: backend clone + venv (backend lives at ../darz-backend-api in this container)
python3 -m venv /tmp/bvenv && /tmp/bvenv/bin/pip install -q -r ../darz-backend-api/requirements.txt
cp ../darz-backend-api/.env.example ../darz-backend-api/.env      # placeholders are enough
cd ../darz-backend-api && /tmp/bvenv/bin/python manage.py spectacular --format openapi-json --file /tmp/schema.json

# this repo
npx openapi-typescript /tmp/schema.json -o src/api/schema.d.ts
npm run typecheck
```

The `CLAUDE.md` route (`runserver` + fetch `/api/schema/`) gives the same document; use it when a
real backend is already up. Never hand-edit `schema.d.ts`. **The regen is committed in Batch 1
together with the fixes** — committing it alone leaves the gate red.

## The loop for every batch

1. Branch off `development` → one PR per batch (target `development`). Merge only when the owner
   says so, per `CLAUDE.md`.
2. Make the change; update `e2e/stub-server.mjs` to the new shape; add/adjust unit tests.
3. Gate: `npm run typecheck && npm run lint && npm run format:check && npm test && npm run build`,
   plus `npm run e2e` against the stub.
4. Render check (`HANDOFF.md` §5): screenshot every screen touched, dark + light, and compare with
   the design package capture / `app.html`. A behaviour change on a shipped screen still gets one.
5. Docs: tick `TASKLIST.md`, flip the row in `API_GAPS.md` (drop its "FE:" note), one 3-line
   `CHANGELOG.md` entry per batch, tick the batch here.

---

## Batch 1 — Schema regen + the compiler's flags + P0  `[x]`
*The foundation; everything else assumes the regenerated types.*

| Gap | Change | Where |
| --- | --- | --- |
| Step 0 | Regenerate `schema.d.ts` (recipe above). | `src/api/schema.d.ts` |
| G-P5-2 | Read the nested `artwork {id,title,artist,image}` directly; drop the `useArtworks()` second read on these surfaces (keep `ArtworkCache` where a fuller shape is still needed). Fixes 10 of 11 errors. | `chat/ChatPage.tsx`, `chat/ThreadPage.tsx`, `conversations/ConversationsController.ts`, `profile/Acquisitions.tsx`, `profile/ProfilePage.tsx` |
| G-CHAT-2 (type only) | Add `archived: false` to the optimistic message literal. The admin UI is Batch 6. | `chat/ThreadPage.tsx:87` |
| G-P5-1 | Delete the hand-typed `HoldDetail`/`OfferDetail`/`ViewingDetail`/`MessageDetail`/`PurchaseDetail` union; alias the generated one. `offer.amount` stays a string. | `src/api/types.ts:128-159`, importers (`requests/status.ts`, `RequestController.ts`) |
| G-F1-1 | Type `createRequest`'s `detail` from the generated create union; drop manual casts. | `src/api/services.ts:196` |
| G-P34-1 / G-P34-2 | Treat 200 (replay) like 201; a 429 shows "Too many attempts — try again shortly" (confirm wording against `VOICE.md`) instead of the raw error; drop the "duplicate lands in the queue" caveat. | `features/auth/LoginPage.tsx:117-129`, `services.ts:1486` |

**Stub:** nested artwork on `GET /crm/requests/`; a 429 path for access requests if a test drives it.
**Done when:** gate green on the new schema; Chat, Thread, Profile, Acquisitions render the work
with no extra catalogue call (network panel); a double-submit of Request Access shows one success.

## Batch 2 — G-LOCK-1: conflict path on the two last-write-wins desks  `[x]`

| Gap | Change | Where |
| --- | --- | --- |
| G-LOCK-1 | Send `expected_version` on PATCH; on 409 show the existing `ConflictBanner` from `admin/kit` — copy `ArtworkEditorPage`'s pattern, don't build a second one. | `admin/LedgerEntryPage.tsx` + `services.ts:1211 updateEntry`; `admin/RecordEditorPage.tsx:141` + `services.ts:1169 updateRecord` |

**Tests:** extend `src/api/optimisticLock.test.ts` so it pins the wire format for these two calls
(six today → eight). **Stub:** a 409 branch for a stale version.
**Done when:** two tabs, second save shows the banner; a normal save advances the version.

**Done 2026-09-25.** Two corrections to the plan above, found doing it: the ledger PATCH lives in
the inline entry form in **`AccountingPage.tsx`**, not `LedgerEntryPage` (which only calls `/status/`
and the Arian review — neither is locked); and the lock is **mandatory**, not optional, so before this
batch every ledger and record edit against the current backend **failed with a 500**, not a silent
overwrite. **Backend bug to raise:** both views validate with `partial=True` (which skips a
field's `required`) and then `validated.pop("expected_version")` — a missing lock is a `KeyError` →
500 instead of a 400. Confirmed by running the two serializers on a lock-less body. The entry form's Reload re-reads the entry and re-keys the form on `id:version`. The new
lot-update endpoint (G-AUC-2, backend #55) also requires `expected_version` — nothing calls it yet.

## Batch 3 — CRM precision, the rest  `[x]` (G-P5-9 → owner)

| Gap | Change | Where |
| --- | --- | --- |
| G-P5-3 | `ThreadPage` fetches `GET /crm/requests/{id}/` on a cold deep link instead of waiting for the whole list. Add `CrmService.request(id)`. | `chat/ThreadPage.tsx`, `services.ts` |
| G-P5-6 | Client hold-expiry override: keep as belt-and-braces, reword the comment (server is now the source). | `requests/status.ts` |
| G-P5-9 | Render `counter_amount` / `counter_currency` on a countered offer, formatted from the string. Find the old app's counter copy in `app.html` first. | `chat/RequestDetail.tsx`, `requests/status.ts` |
| G-P5-10 | Viewing-mode labels from `/api/options/` (`crm.viewing_mode`); delete the hardcoded pair. | `requests/ViewingSheet.tsx:27-30` |

**Done when:** a deep link to `/thread/:id` loads with one request call; a countered offer shows its
figure; ViewingSheet shows labels from options.

**Done 2026-09-25, except G-P5-9.** `ConversationsController.open(id)` reads one request when the list
does not hold it (kept apart from the lists; `isMissing` tells "gone" from "loading"). The viewing
labels go through `viewingModeChoices` (values from `ModeEnum`, labels from options, raw value as the
fallback). **G-P5-9 is an owner question:** `app.html`, `DarzStudioAllInOne.html` and the design
package (`SCREENS.md`/`VOICE.md`) have **no** counter-offer UI or copy — a countered offer shows today
as "In review" with Darz's message in the thread. Proposal if wanted: one more meta row in the
request card beside "Amount" (e.g. "Darz's counter · 11,000 USD"), formatted from the string; the
label wording is the owner's to give.

## Batch 4 — Small collector reads: chip, questionnaire, profile edit, membership  `[ ]`

| Gap | Change | Where |
| --- | --- | --- |
| G-P24-1 | Chip text = `selection_name ?? 'Curated for You'` (the old `s[0]?.name \|\| …`). | `catalogue/CuratedChip.tsx`, `useCuratedCount.ts` |
| G-P25-1 | Branch on `answered`; delete the 404-as-first-run path. | `services.ts:424-433`, `questionnaire/QuestionnaireController.ts`; stub `:161-165` → 200 |
| Profile edit | Account section gets an edit form over `PATCH /auth/me/` (`full_name`/`phone`/`city`/`preferred_language`); optimistic-lock not applicable. Port the old edit form's fields and copy from `app.html`. | `profile/ProfilePage.tsx`, `services.ts` (`AuthService.updateMe`) |
| G-Q-1 | Questionnaire contact step writes through the same `PATCH /auth/me/` instead of dropping it. | `questionnaire/QuestionnaireController.ts` |
| G-MEMB-3/6/7 | Membership reads `GET /auth/my-membership/`: status + "Active until …" (`null` → no end date). Keys stay "issued". | `membership/MembershipSheet.tsx`, `services.ts` |

**Question to settle before starting:** does `preferred_language` stay editable while i18n
(G-I18N-1) is off? Recommendation: show it — it's a stored preference, not a UI switch.

## Batch 5 — G-DOC-1: collector "Your documents"  `[ ]`
*A new list on a shipped screen — needs the full two-source port.*

| Gap | Change | Where |
| --- | --- | --- |
| G-DOC-1 | Profile → Account "Your documents — invoices, certificates & provenance", read-only over `GET /documents/`; open `pdf_url` (presigned); optional "New" badge from `shared_at` as the old app did. | new `profile/Documents.tsx` (or in `ProfilePage.tsx`), `services.ts` (collector `DocumentsService`, separate from `/documents/admin`) |

**Find first:** the old screen in `app.html` + the design package capture. Empty state copy from
`VOICE.md`. **Stub:** `GET /api/documents/` with 2 rows + an empty variant.

## Batch 6 — Admin desk extras: chat archive, auction archive + poster, records house  `[ ]`

| Gap | Change | Where |
| --- | --- | --- |
| G-CHAT-2 | Archive/restore control per message + "include archived" toggle (`?include_archived=true`). Collector thread unaffected. | `admin/AdminThreadPage.tsx`, `AdminThreadController.ts`, `services.ts` |
| G-AUC-4 | Archive/restore action; archived hidden by default, a toggle to show (`?archived=`). | `admin/AuctionsAdminPage.tsx`, `AuctionAdminDetailPage.tsx` |
| Auction poster | Cover-image upload/remove (multipart); cards read `cover_image_url`; **drop the per-card first-lot image read**. | same + collector `auctions/AuctionListPage.tsx` |
| G-REC-1 | "All auction houses" dropdown → `?house=` (the desk comment at `RecordsAdminPage.tsx:31` records it as not built). | `admin/RecordsAdminPage.tsx`; collector `records/RecordsPage.tsx` if the old app had it there |

## Batch 7 — Data Health counts + Auction Sales tab  `[ ]`

| Gap | Change | Where |
| --- | --- | --- |
| G-HEALTH-2 | Gallery-/Dealer-/Artist-sourced tiles = counts via `?source_type=`. Optionally surface `source_type` in the artwork editor. | `admin/DataHealthPage.tsx:28-29`, `healthCounts.ts` |
| G-HEALTH-3 | "Deleted (permanent)" tile from `deleted_records.count`. | same |
| G-HEALTH-4 | "Recently added" = count with `?created_after=<iso>` (window from the old app). | same |
| G-SALE-4 | Build the Auction Sales tab: `/admin/sales` filtered `?source=auction`; `source` on sale create where relevant. Port the old tab's columns from `app.html`. | `admin/SalesPage.tsx`, `SalesController.ts`, `adminNav.ts`, `saleForm.ts` |

**Update 2026-09-25 (PR #51):** auction→Sale automation is now live — a won lot auto-creates a draft
`Sale(source=auction)` (hammer + buyer's premium; new read-only `lot` FK links back), so the tab fills
itself. Surface the drafts for review/confirm; use `lot` to link a row to its auction lot. Manual
`source=auction` create still works for off-platform auction sales.

**Also newly landed (regen the schema):** `document_refs` on `RequestMessage` (attach a doc into a chat
thread, team-only) and the roster-wide access-key desk endpoints (G-KEY-1). See
`API_GAPS_FRONTEND_ADOPTION.md` for both.

## Batch 8+ — Owner-decision UI (do **not** start without a yes)

Endpoints exist; each was a deliberate non-port or an open scope question. Ask these in one message
(also listed in `NOTES-FOR-ARIAN.md`), then schedule the "yes" items as Batch 8, 9, …

| Ref | Question for the owner | Size if yes |
| --- | --- | --- |
| G-P24-2 | Show the "your curated selection is ready · tap to view" notice? (old app had it; not ported) | S |
| G-P25-2 | (a) Drive the collector questionnaire from `GET /question-set/` — recommended regardless, it removes hardcoded questions from `questionnaire/questions.ts`. (b) Build the admin question-set editor desk? | a: S · b: M |
| G-P5-4 | Make activity "clear/hide" durable server-side (copy "returns on reload" changes)? | S |
| G-P5-5 | Collector withdraw offer / cancel viewing? (old app had no UI) | S |
| G-P5-11 | Artist enquiry sends the real `artist` link? (no visible change — recommend yes) | XS |
| G-P5-12 | Any surface that reads activity back? | — |
| G-P13-1 | Web-push opt-in in V1? (empty key → keep hidden) | M |
| G-CLUB-3 | Admin invite-only toggle + invited-collector picker on the auction desk? | M |
| Phase 5b | Wire the four Database-desk filters (portal / complete / duplicate images / size)? Recommend yes — no new UI pattern, same chips as #66. | S |

## Not in this plan

- **Backend-blocked:** Logistics (Phase 20), Library/pricelist (Phase 21), Insights & Stories (Phase 22).
- **Owner decisions outside the gap list:** real `VITE_API_BASE_URL`, i18n (G-I18N-1), `/artists`
  menu entry, G-6.
- **Housekeeping at the end:** once Batch 7 lands, the "FE:" notes in `API_GAPS.md` should all be gone
  and `API_GAPS_FRONTEND_ADOPTION.md` can move to `docs/archive/`.

## Found while doing Batch 1 (2026-09-25)

Regenerated against backend `development` @ `021ce07` — past the `57d408c` above; the extra merges
(#54 gallery-portal quick wins, #55 lot update + paddle reset G-AUC-2/3, #56 collectors overview
summary + roster rollups G-COL-1/2) typecheck clean and are **not yet in any batch** — they need
their own rows in `API_GAPS.md` / `API_GAPS_FRONTEND_ADOPTION.md` before they are scheduled.

- **The generated `RequestDetail` has no hold member.** `HoldDetailSerializer` takes no input, so
  drf-spectacular publishes nothing for it, yet a stored hold carries `expires_at`. `HoldDetail` stays
  hand-typed (one field) in `src/api/types.ts`. A backend `read_only` `expires_at` on that serializer
  would let it go.
- **`OfferDetail` marks `counter_amount`/`counter_currency` required**, because openapi-typescript does
  not split read and write shapes. The create body uses `RequestDetailInput`, which omits them.
- **Owner question — an offer on a work with no currency.** Make an Offer shows on such a work and
  sends `currency: ''`; the backend 400s ("not a valid choice") and that message is what the collector
  sees. Unchanged by Batch 1 (the type admits `''` on purpose). Hide the button, default a currency, or
  keep it?
- **New copy flagged:** the 429 line "Too many attempts — try again shortly." has no `app.html` source
  (the old app had no rate limit); it is the adoption guide's wording.
- The E2E stub now serves collector requests in the nested shape, their full artworks, and a 200
  access-request replay — the Chat/Profile rows are exercised, not just an empty list.

## Progress

| Batch | Scope | State | PR |
| --- | --- | --- | --- |
| 1 | Schema regen · G-P5-1/2 · G-F1-1 · G-P34-1 | `[x]` 2026-09-25 | #99 |
| 2 | G-LOCK-1 | `[x]` 2026-09-25 | #99 |
| 3 | G-P5-3/6/9/10 | `[x]` 2026-09-25 (G-P5-9 → owner) | #99 |
| 4 | G-P24-1 · G-P25-1 · profile edit · G-Q-1 · G-MEMB-3/6/7 | `[ ]` | |
| 5 | G-DOC-1 | `[ ]` | |
| 6 | G-CHAT-2 · G-AUC-4 · poster · G-REC-1 | `[ ]` | |
| 7 | G-HEALTH-2/3/4 · G-SALE-4 | `[ ]` | |
| 8+ | Owner-decision items | waiting on owner | |
