# Phase 5 (Collector requests + activity) — API gaps

**Date:** 2026-09-17 · **Phase:** 5 (frontend requests + activity) · **Repo:** `-darz-web`
**Backend:** `darzmarket-api` (`ariandarz/darz-backend-api`), `development` @ `3801786` (2026-09-11,
the Phase-19-closing merge; its OpenAPI document regenerated locally is byte-identical to
`src/api/schema.d.ts`).
**Status:** open — recorded for the backend. **No backend, API-contract or `src/api/schema.d.ts`
change is made in Phase 5** (owner instruction 2026-09-17: build the UI around each gap and write
the gap down here). Plan: `docs/PHASE_5_PLAN.md`.

## Summary

Every collector request surface the old app ships can be built on the API as it stands: the eight
kinds file, replay on `client_req_id`, thread, and list. What the gaps below cost is **precision and
a few controls**, not function: the per-kind `detail` is typed by hand instead of from the schema,
rows need a second read for their artwork, there is no single-request read, and the collector can
neither hide a request nor withdraw one. Each gap names the file where the frontend works around it.

Gap IDs continue the `G…` series (`docs/API_GAP_ANALYSIS.md`, `docs/PHASE_6_API_GAPS.md`,
`docs/PHASE_8_API_GAPS.md`). Step that meets each gap is in brackets.

---

## G-P5-1 — `detail` is untyped in the published schema (restates G-F1-1) [step 1]

`RequestCreateSerializer.detail` is a bare `JSONField` and `RequestCollectorSerializer.detail` a
model `JSONField`, so `RequestCreate.detail` / `RequestCollector.detail` generate as `unknown`.
`detail_polymorphic_serializer()` (`apps/crm/serializers.py:54-65`) would publish the per-kind union
but has **no call site** — `apps/crm/views.py:50-67` passes `request=RequestCreateSerializer`.

- **Frontend:** `src/api/types.ts` types the union by hand from `DETAIL_SERIALIZERS`
  (`apps/crm/serializers.py:14-51`): `HoldDetail` (server-set `expires_at`), `OfferDetail`
  (`amount`, `currency`, `counter_of`), `ViewingDetail` (`preferred_time`, `mode`),
  `MessageDetail` (`message`), `PurchaseDetail` (`notes`). Keys outside a kind's serializer are
  dropped server-side; the stored `detail` is the serializer's `.data` (an offer's `amount` returns
  as a **string**).
- **Closes it:** `request=detail_polymorphic_serializer()`-backed `@extend_schema` on the create view
  and a typed `detail` on the collector output serializer; then regenerate `schema.d.ts` and delete
  the hand-typed union.

## G-P5-2 — collector rows carry a bare `artwork` uuid [step 2]

`RequestCollectorSerializer` (`apps/crm/serializers.py:99-110`) returns `artwork` as a uuid; the
admin tier nests `{id, title, artist}` (G-F1-7). A "my requests" row needs title, artist and image.

- **Frontend:** rows read the artwork through the v0.1 `ArtworkCache` (one catalogue read per unseen
  id, shared with Chat and Profile).
- **Closes it:** the same nested read-only `artwork` object on the collector serializer.

## G-P5-3 — no single-request endpoint [step 3]

There is no `GET /api/crm/requests/{id}/`; the thread endpoint returns messages only, never the
request. A deep link to a request must find it in the list.

- **Frontend:** the request detail reads the row from the list store (`ConversationsController`,
  which loads every kind) and the thread from `…/messages/`; an unknown id loads the list first.
- **Closes it:** `GET /api/crm/requests/{id}/` (own request only, `RequestCollectorSerializer`).

## G-P5-4 — no collector-side remove / archive / clear [step 3]

`Request.admin_archived` is admin-tier only and no endpoint sets it; there is no collector delete,
hide or archive. The old app's **Remove from activity** / **Clear activity** (`app.html:11333-11373`)
were local-history deletes with a cloud mirror.

- **Frontend (owner decision D4, 2026-09-17: implement the UI).** Built in step 2:
  `ConversationsController.clearActivity()` / `.hide(id)` keep a set of hidden ids in the snapshot
  and `activity()` filters it, with **Clear activity** in the list header over the old app's confirm
  sheet (`app.html:11355-11360`). The hide is **in memory for this session only** — never
  `localStorage` (owner decision 2026-09-04) — so the rows return on the next load. One sentence of
  the original copy is deliberately not ported: "This can't be undone." would be false here, so the
  sheet says Darz keeps its own record and the list returns on reload. Stated again in a code
  comment at the call site. `hide(id)` is wired for step 3's "Remove from activity".
- **Closes it:** `POST /api/crm/requests/{id}/archive/` (+ `?archived=` on the collector list) or a
  collector-side `hidden` flag; then the controls persist.

## G-P5-5 — no collector transition: withdraw an offer, cancel a viewing [not built]

`offer.withdrawn` and `viewing.cancelled` exist in `apps/crm/lifecycle.py:30,37` but only the admin
transition route (`POST /api/crm/admin/requests/{id}/transition/`) can reach them.

- **Frontend:** not built — the old app had no cancel / withdraw either. Recorded only.
- **Closes it:** a collector transition endpoint limited to those two targets.

## G-P5-6 — hold expiry is not applied on the collector read path [step 2]

`_auto_expire_if_overdue` (`apps/crm/services.py:113-135`) runs on admin transitions and on the
300 s Beat sweep, not on `GET /api/crm/requests/` — a hold can read `status: "active"` past
`detail.expires_at`.

- **Frontend:** the status map treats `detail.expires_at < now` as expired whatever `status` says.
- **Closes it:** call the lazy expiry on the collector list read, or return `is_expired`.

## G-P5-7 — the `availability` kind has no old-app surface [not built]

`kind=availability` is a simple-lifecycle request the old app never exposed: availability was part of
"Request Price & Availability". No collector UI files it.

- **Frontend:** not built; the price sheet files `price`.

## G-P5-8 — pagination params undeclared on the list and thread endpoints [step 2]

`crm_requests_list` and `crm_request_messages_list` declare no `page` / `per_page` in the schema
(`src/api/schema.d.ts`) although `CustomPagination` honours both.

- **Frontend:** sends them anyway (`ConversationsController`, `ThreadController`).
- **Closes it:** `@extend_schema(parameters=[…])` on both views.

## G-P5-9 — `offer.amount` is a string on the wire; counter-offers carry no amount [step 2]

`OfferDetailSerializer.amount` re-renders through DRF's decimal-to-string default; `counter_of` is
accepted, stored and never validated or used (`apps/crm/serializers.py:26`), and the `countered`
status carries no counter amount.

- **Frontend:** formats the amount from a string; a counter-offer is a message from Darz, not a field.
- **Closes it:** `COERCE_DECIMAL_TO_STRING = False` or a numeric field; a `counter_amount` on the
  transition when `countered`.

## G-P5-10 — viewing `mode` choices are not published by `/api/options/` [step 1]

`ViewingDetailSerializer.mode` is an inline `ChoiceField([("in_person","In person"),
("virtual","Virtual")])` (`apps/crm/serializers.py:31`) that `ChoiceRegistry` never registers.

- **Frontend:** `src/features/requests/ViewingSheet.tsx` carries the two labels verbatim with the
  citation — the one hardcoded choice list in this phase.
- **Closes it:** `ChoiceRegistry.register("crm.viewing_mode", …)` in `apps/crm/apps.py`.

## G-P5-11 — an artist enquiry has no artist field [step 1]

An information request keeps only `message` (`SimpleDetailSerializer`); `artwork` is the only
foreign key. "Enquire about works by <artist>" (`app.html:11033-11044`) therefore reaches the admin
as a message that names the artist, not as a link.

- **Frontend:** `RequestController.enquireAboutArtist` files `kind=information`, `artwork: null`,
  `detail.message` = "Please let me know about available works by <artist>.".
- **Closes it:** a nullable `artist` FK on `Request` exposed on both tiers.
