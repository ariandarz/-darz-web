# API integration — what the backend now serves, and where the frontend uses it

**Date:** 2026-09-11 · **Status:** current — the source of truth for what's wired vs. still open.

Supersedes `docs/API_GAP_ANALYSIS.md`, `docs/FLOW_1_API_GAPS.md`, `docs/PHASE_6_API_GAPS.md`, and
`docs/PHASE_8_API_GAPS.md` as the *live* reference — those four stay as the historical record of
what was missing and why (each still has its own decisions/reasoning worth keeping), but every gap
they listed is now either closed (below) or explicitly still open (bottom of this doc). Regenerate
`src/api/schema.d.ts` from a locally running `darzmarket-api` before trusting any shape here —
`npx openapi-typescript http://localhost:8000/api/schema/?format=json -o src/api/schema.d.ts`
(`CLAUDE.md`, "API access"; the local dev port may be 8000/8001/8010 depending on what else is
running — check `.env`/`.env.local`).

Backend PRs this closes: `phase-19-crm-collector-loop`, `phase-19-saved-hardening`,
`phase-11-admin-records-and-refine-filters`, `phase-19-catalogue-hardening-and-legacy-lookup`
(all merged to `darzmarket-api` `development`).

---

## Closed — CRM collector loop (`FLOW_1_API_GAPS.md`)

### G-F1-1 — typed `detail` per kind
**Still partially open.** The backend validates `detail` against
`apps.crm.serializers.DETAIL_SERIALIZERS[kind]` server-side (400 on a mismatch) and publishes a
`detail_polymorphic_serializer()` helper, but that helper isn't wired into the create endpoint's
`@extend_schema(request=...)` yet — so `RequestCreate.detail` is still `unknown` in the generated
schema. `src/api/types.ts::RequestDetail` stays `Record<string, unknown>`, flagged in its own
comment. **Follow-up for the backend**, not a frontend gap.

### G-F1-2 — offer floor
Enforced server-side (`RequestService.create`), never exposed to the client. A below-floor offer
gets `400 {"error":{"code":"offer_below_floor","message":"Your offer is below the accepted range
for this work — please enter a higher amount."}}`. **No frontend code change needed** — `HttpError`
already carries `message`, and `OfferSheet.tsx`'s existing inline error slot (`error` from
`useRequests()`) already renders whatever the server sends. Verified via
`RequestController.test.ts` + live.

### G-F1-3 — per-artwork `allowed_actions`
`Artwork.allowed_actions: string[]` (already resolved — empty stored list means all four).
- `src/features/requests/ActionButtons.tsx` filters the primary (`buy`) and secondary
  (`hold`/`visit`/`offer`) verbs by `artwork.allowed_actions`; `price`/`information` stay ungated.
  A `buy`-disallowed, non-price-on-request work shows no primary button at all rather than a
  disabled one.
- The server still rejects a gated kind it doesn't allow (400 `action_not_allowed`) as
  defense-in-depth — the frontend filter is UX, not the only guard.

### G-F1-4 — per-kind status vocabulary
`GET /api/options/` → `crm.request_status_by_kind: {kind: [{value,label}]}`, derived live from
`apps.crm.lifecycle.TRANSITIONS`. `RequestAdmin.allowed_transitions: string[]` reports the legal
next statuses for that specific row.
- `src/api/types.ts::RequestStatusByKind` + `Choice`.
- `src/features/admin/AdminRequestsPage.tsx`: the status **filter** dropdown is scoped to the
  selected kind's vocabulary (or the union across kinds when none is selected); the per-row
  **"Move to…"** dropdown uses that row's own `allowed_transitions` — it can never offer an illegal
  transition.

### G-F1-5 — idempotency (`client_req_id`)
`RequestCreate.client_req_id` (optional) + a partial unique constraint on the backend. A replay
returns the existing row (200) instead of a duplicate (201).
- `CrmService.createRequest({..., clientReqId})` (`src/api/services.ts`) sends it as
  `client_req_id`.
- `src/features/requests/RequestController.ts` passes the **same double-tap guard key**
  (`act:<artworkId>:<verb>` / `offer:<artworkId>:<amount>`) as `clientReqId` — a genuine retry of
  the identical action (same artwork/verb[/amount]) is deduped server-side too, surviving a reload
  mid-flight; a materially different retry (corrected offer amount) is a fresh key, so still a new
  request.

### G-F1-6 — reply thread (`RequestMessage`)
`GET/POST /api/crm/requests/{id}/messages/` + `/mark-seen/` (collector, own request only); admin
mirror under `/api/crm/admin/requests/{id}/messages/`. `RequestCollector`/`RequestAdmin` both carry
`unread_count`.
- `src/api/types.ts::RequestMessage`, `RequestMessageQuery`.
- `CrmService.requestMessages/postRequestMessage/markMessagesSeen` +
  `adminRequestMessages/postAdminRequestMessage/markAdminMessagesSeen` (`src/api/services.ts`).
- **API-only this round** — no thread UI yet. `AdminRequestsPage.tsx` shows `unread_count` as a
  small badge next to a row's status so the count is at least visible. The collector-facing
  request-detail + "Chat with Darz" thread screen is its own follow-up PR (owner-approved scope:
  faithful port of `app.html`'s `request_thread`, polling delivery).

### G-F1-7 — admin feed nesting
`RequestAdmin.collector: {id, display_name}`, `RequestAdmin.artwork: {id, title, artist:
{id, display_name} | null} | null` — no more bare uuids.
- `AdminRequestsPage.tsx` renders `r.collector.display_name` and
  `"<artist> — <title>"` (or just the title when the artist link is null) instead of a truncated id.

---

## Closed — Saved/Favorites (`PHASE_6_API_GAPS.md`)

### G-P6-1 — `is_saved`/`saved_at` on the artwork payload
`ArtworkCollectorSerializer.is_saved: boolean` / `saved_at: string | null`, computed server-side in
the same request that returns the artwork (collector principal only; always `false`/`null`
otherwise).
- **`SavedController` was rewritten** (`src/features/saved/SavedController.ts`) — it no longer
  walks every page of `GET /api/crm/saved/` into memory (`fetchAll()`/`ensureLoaded()`/`MAX_PAGES`
  are gone). `isSaved(artwork)` now reads `artwork.is_saved` and layers a small **local override
  map** on top for writes made this session, so every `SaveButton` still agrees immediately after a
  save/unsave without a refetch.
- `SaveButton` now takes the full `artwork` (not just an id) so it has `is_saved` to read.
  `ArtworkCard.tsx` / `ArtworkDetailPage.tsx` updated to pass it.

### G-P6-2 — `?artwork=`/`?ordering=`/declared pagination on `GET /api/crm/saved/`
- `src/api/types.ts::SavedArtworkQuery` (`artwork`, `ordering`, `per_page`, `page`).
- `CrmService.saved(query)` passes them straight through.
- **`SavedListController`** (new, `src/features/shared/ListController` seam — same one
  `CatalogueController`/`AdminRequestsController` use) replaces the old full-list read for the
  dedicated `/saved` page: `SavedItemsPage.tsx` is now a normal paginated list with a `Pager`,
  reloading only the current page after an unsave rather than re-walking everything.

### G-P6-3 — `created` on the save response
`SavedArtwork.created: boolean` (true for a fresh save or a restore-from-soft-delete, false for an
already-saved no-op).
- `SavedController.save()` reads it into `lastAction.created`.
- `SavedToast.tsx` copy: "Saved." / "Already saved." / "Removed from your saved works."

### G-P6-4 — documented default order
`GET /api/crm/saved/` is `-created_at` by default (server-side, documented). `SavedListController`
doesn't need to set `ordering` explicitly for the common case; it's exposed on `SavedArtworkQuery`
for a future sort control.

---

## Closed — "Refine" smart-filter dimensions (G7, `API_GAP_ANALYSIS.md`)

**No new backend storage was needed** — Phase 15's `recommendations.ArtworkTag` (landed after G7 was
written) already is dimension-keyed tag storage. What landed for the frontend:

- `GET /api/catalog/artworks/` gains 12 `?refine_<dim>=` params (repeatable, AND-combined like `tag`)
  — see `CatalogueQuery`'s `refine_${string}` index signature in `src/api/types.ts`. **No UI
  wired to them yet** — the "Refine" filter panel itself is still frontend Phase 12+ scope (the
  original deferral for *building the UI*; only the backend gap is closed here).
- `ArtworkCollectorSerializer.refine_tags: {dim: [values]}` per artwork, restricted to
  FeatureSettings-enabled dimensions — flows through automatically on `Artwork` (no `Omit` needed,
  it's just another field on the schema), not yet read by any component.
- `GET /api/options/`: `catalog.refine_dimension` (12 `{value,label}` dims), `catalog.refine_vocab`
  (`{dim: [{value,label}]}`), `catalog.refine_dimensions_enabled` (`string[]`, **live** — reflects
  an owner's FeatureSettings toggle immediately, not just after a redeploy).
- Two flagged deviations from the old app's naming, carried over from the backend gap doc: "colour"
  → the schema's canonical "color"; "decade" → the coarser "period" dimension (modern/contemporary
  only — no real decade-granularity data exists in this system).

**`OptionsMap` changed shape** (`src/api/services.ts`): it's `Record<string, unknown>` now, not
`Record<string, Array<{value,label}>>`, because `refine_dimensions_enabled` (a bare `string[]`) and
`request_status_by_kind`/`refine_vocab` (nested objects) don't fit the old flat-list assumption. Cast
at the read site — see `AdminRequestsPage.tsx::requestStatusByKind()` for the pattern.

---

## Closed — Auctions Records widening (G-P8-1 backend half, `PHASE_8_API_GAPS.md`)

`AuctionRecord` widened: `image_url`, `year`, `medium`, `dimensions`, `low_estimate`/
`high_estimate`, `hammer_amount`/`realized_amount`, `sale_name`, `provenance`, `literature`,
`exhibition`, `house_notes`, `previous_record`, `section` (past/upcoming/live), `status`
(sold/unsold/passed/withdrawn/pending), `is_highlight`, `highlight_order`. Collector list gains
`?section=`/`?is_highlight=`; new `GET /api/auctions/records/highlights/`. Admin list additionally
gets `?status=`. New `manage.py import_auction_records <csv|json>` bulk-import command.

**Not wired into the frontend yet** — `src/api/types.ts::AuctionRecord` already reflects every new
field (same schema-passthrough as `Artwork`/`refine_tags` above, no type change needed), but no
component reads the new fields, and there's no admin Records desk. This is **FE-R1…FE-R4**
(`docs/PHASE_8_PLAN.md` § Deferred), its own follow-up PR: admin Records desk (list/CRUD/import
trigger), highlight curation UI, and the collector Past/Upcoming/Live/Highlights sub-tabs +
image-led cards + record detail.

---

## Closed — Catalogue (flow 2) hardening + legacy-id resolution (`docs/TASKLIST.md` Phase 19)

- `GET /api/catalog/artworks/change-stamp/` — `{count, last_updated}`, same filter params as the
  list, no row body. **Not consumed by any component yet** — it exists for a future poller /
  atomic-partial-publish guard (fetch before a paginated walk, fetch again after, discard the walk
  if either value moved) once the frontend needs one. No current screen polls the catalogue.
- `GET /api/catalog/legacy-lookup/?legacy_id=` (public, no auth) — resolves an old Darz/Airtable
  id to `{id, resource_type: "artwork"}`. **Not consumed yet** — nothing in this frontend currently
  receives an external deep link with a legacy id; wire this in when/if such a link surface exists
  (e.g. an email campaign, a redirect from the old domain).

---

## Still open (not closed by this round — tracked, not forgotten)

- **G7's actual "Refine" filter UI** (the panel, the 12 dimension controls, `refine_tags` display) —
  frontend Phase 12+, per the original deferral. The backend is ready.
- **FE-R1…FE-R4** — admin Records desk, highlight curation, import trigger, collector
  Past/Upcoming/Live/Highlights sub-tabs. Own follow-up PR.
- **Request-detail thread UI / "Chat with Darz"** (G-F1-6's frontend half) — API is ready
  (`requestMessages`/`postRequestMessage`/`markMessagesSeen`), UI is a follow-up PR.
- **G-F1-1** — the typed per-kind `detail` union needs the backend to wire
  `detail_polymorphic_serializer()` into the create endpoint's `@extend_schema`. Backend follow-up.
- **Design-pass flags (2026-09-11)** — surfaces the design package shows that this backend has no
  field or endpoint for, left out rather than faked (each is a code comment at the call site too):
  - **Insights & Stories** nav tab and the **Chat** pill — no editorial or chat model (`TASKLIST.md`
    Phase 12+; chat = G-F1-6's thread UI above).
  - **Collector questionnaire** card on Profile → Overview (`qbQuestions`) — no backend model.
  - **Access key** card on Profile → Account — `GET /api/auth/me/` does not return the key.
  - **Account details** are read-only — no profile-edit endpoint (Phase 9); phone / city / preferred
    language are not on `Me`.
  - **Chat on WhatsApp** (detail, lot, profile) — needs the gallery's number (`theme.whatsapp`); no
    theme/settings endpoint. Same for the owner-editable copy the app ships as defaults
    (`shipNote`, hero copy, About text, social links) and the Terms / Privacy legal text.
  - **Auction poster** — `Auction` has no cover image; the first lot's artwork stands in (one
    `per_page=1` lots read per card). A `cover_image_url` on `Auction` would remove that read.
  - **Push to this device** — the VAPID public key is not published by the API.
  - **Documents** on Profile → Account — issued documents are not exposed to collectors.
  - **Logistics & payment** sheet and the auction-record panel under a work (`artwork.logi`,
    per-artist records join) — no fields.
  - Records: **Past** is shown (owner-toggled off by default in the old app) because it is the
    archive; **Highlights** stays hidden (no curated rows). Sections split client-side on
    `section` — no `?section=` filter on `GET /api/auctions/records/`.
- **Catalogue change-stamp / legacy-id lookup** — endpoints exist, nothing consumes them yet (see
  above) — wire in when the frontend actually needs a poller or handles an external deep link.
