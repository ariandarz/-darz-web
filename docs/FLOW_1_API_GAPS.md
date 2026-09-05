# Flow 1 (Collector request / offer → Admin inbox) — API gaps

**Date:** 2026-09-05 · **Flow:** Collector Login → Artwork List → Artwork Details →
Save / Request / Offer → Admin receives the action
**Reference:** `ariandarz/darzstudio.art` @ `main` (`c46d96d`) — `app.html`, `darz-studio.html`
**Status:** open — for the owner / Arya to decide. **No backend, API-contract or
`src/api/schema.d.ts` change was made.** Gap IDs continue the series in
`docs/API_GAP_ANALYSIS.md` and `docs/PHASE_6_API_GAPS.md`.

## Summary

The flow **shipped complete and working end-to-end** against the API as it stands: all four
collector actions file real requests, and the admin feed receives them and can transition them.
Nothing was blocked.

What the gaps below cost is **fidelity to the old app and admin legibility**, not function. Two of
them (G-F1-5, G-F1-6) are the ones `docs/TASKLIST.md` already records as "backend Phase 19"; they
are restated here because this is the flow that consumes them.

---

## G-F1-1 — the per-kind `detail` shape is not in the published schema

**Current API behavior.** `POST /api/crm/requests/` takes
`RequestCreate = {kind, artwork?, detail?}`, and `detail` is typed `unknown`
(`src/api/schema.d.ts`, `RequestCreate`). The backend has eight distinct shapes behind it
(`apps.crm.serializers.DETAIL_SERIALIZERS`, per `docs/TASKLIST.md` Phase 5), but the OpenAPI
document publishes none of them, so the generated client cannot type or validate any of it.

**Missing field or endpoint.** Either the eight `detail` variants published as named schema
components and referenced from `RequestCreate` (a discriminated union on `kind`), or the shapes
documented well enough to hand-write them.

**Expected behavior.** `npx openapi-typescript` produces a `detail` type per kind, so an offer that
is missing `amount`, or a viewing request missing its preferred date, fails at compile time rather
than at the server.

**Affected frontend screens.** `ActionButtons` and `OfferSheet` on `/artwork/:id`; every
per-kind request form Phase 5 still has to build (availability, purchase, message…).

**Example request and response.**

What this branch sends for an offer — the frontend's best reading, not a contract:

```http
POST /api/crm/requests/ HTTP/1.1
Authorization: Bearer <collector access token>
Content-Type: application/json

{"kind": "offer", "artwork": "0f0d…", "detail": {"amount": 9500, "currency": "USD"}}
```
```json
{ "success": true,
  "data": { "id": "rq1", "kind": "offer", "status": "new", "artwork": "0f0d…",
            "detail": {"amount": 9500, "currency": "USD"}, "version": 1,
            "created_at": "2026-09-05T06:23:00Z", "updated_at": "2026-09-05T06:23:00Z" },
  "message": "Created", "timestamp": "2026-09-05T06:23:00Z" }
```

**Why the change is needed.** `{amount, currency}` is a guess. If the backend expects
`{offer_amount, offer_currency}`, every offer this frontend files is silently mis-shaped — it will
still return 201, because `detail` accepts anything. This is the single highest-risk gap in the
flow: it fails quietly, in production, on the most commercially important action.

---

## G-F1-2 — no offer floor is exposed to, or enforced for, the client

**Current API behavior.** Nothing in `ArtworkCollector` or in the request endpoints carries a
minimum acceptable offer, and `POST /api/crm/requests/` accepts any `detail`. The old app had two
layers: a client-side check (`DZ._offerFloor`, `app.html:11097`) and a server backstop (a
`darz_place_offer` RPC that enforced the gallery-set floor at the database, `app.html:11106`).

**Missing field or endpoint.** A server-side floor check on `kind: "offer"` returning a `400` with
a machine `error.code`, and — only if the owner wants the client-side pre-check back — a
per-artwork minimum the collector's token is allowed to see.

**Expected behavior.** A below-floor offer is rejected by the server with a message the sheet can
show, exactly as the old app's backstop did.

**Affected frontend screen.** `OfferSheet` on `/artwork/:id`.

**Example request and response.** Wanted:

```json
{ "success": false,
  "error": { "code": "offer_below_floor",
             "message": "Your offer is below the accepted range for this work — please enter a higher amount." },
  "timestamp": "2026-09-05T06:23:00Z" }
```

**Why the change is needed.** Right now **any** offer is accepted, including one far below what the
gallery will consider — the old app refused those before they ever reached a specialist. Note the
old app is emphatic that **the floor number itself stays private** (`app.html:11077`, "the
accepted-offer limit is kept PRIVATE — never reveal the floor number"), so the preferred fix is the
server-side check alone; do not publish the floor to collectors.

---

## G-F1-3 — no per-artwork action allow-list

**Current API behavior.** `ArtworkCollector` exposes `availability_status` but nothing that says
which collector actions this particular work offers. The old app had exactly that
(`DZ._actAllows`, `app.html:9240`, v1131 — "gallery chooses which collector actions (Buy/Hold/
Offer/Viewing) are available on this work"), plus a per-artwork hidden-action list (`actHidden`,
`app.html:9239`).

**Missing field or endpoint.** An `allowed_actions: string[]` (or four booleans) on
`ArtworkCollector`.

**Expected behavior.** A work the gallery has marked "no offers" renders without the Make an offer
box, instead of accepting an offer the gallery will never consider.

**Affected frontend screen.** `ActionButtons` on `/artwork/:id`.

**Example request and response.** Wanted, one extra key per artwork:

```json
{ "id": "0f0d…", "title": "Untitled", "availability_status": "available",
  "allowed_actions": ["purchase", "hold", "viewing"] }
```

**Why the change is needed.** Without it every published work shows all four actions. That is a
behavioural regression against the shipped app, and it generates requests the gallery has already
decided it does not want.

---

## G-F1-4 — the request status vocabulary is not published per kind

**Current API behavior.** `GET /api/crm/admin/requests/` documents `status` as "Filter by exact
status (vocabulary depends on kind)", but `GET /api/options/` publishes one flat choice set, with
no mapping from kind to the statuses that are legal for it. `RequestCollector.status` /
`RequestAdmin.status` are plain `string`, not an enum.

**Missing field or endpoint.** Either a per-kind status map in `/api/options/` (e.g.
`crm.request_status_by_kind`), or the legal next statuses on each request row.

**Expected behavior.** The admin "Move to…" control offers only transitions that are actually legal
for that row's kind.

**Affected frontend screen.** `AdminRequestsPage` (`/admin/requests`).

**Example request and response.** Wanted, inside the `/api/options/` payload:

```json
{ "crm.request_status_by_kind": {
    "offer":  [{"value":"new","label":"New"},{"value":"countered","label":"Countered"}],
    "hold":   [{"value":"new","label":"New"},{"value":"granted","label":"Granted"}] } }
```

**Why the change is needed.** The admin desk currently offers every status for every kind, so an
operator can attempt an illegal transition and only find out from a 400. It also means this
frontend cannot show a correct status filter without hardcoding a lookup — which
`CLAUDE.md` explicitly forbids ("never hardcode a label lookup").

---

## G-F1-5 — no idempotency key on request creation (restates the Phase 19 blocker)

**Current API behavior.** `RequestCreate` has no `client_req_id`. The old app generated one
(`dzReqCID`, used in the offer payload at `app.html:11105`).

**Missing field or endpoint.** An optional `client_req_id` on `RequestCreate`, with a repeat of the
same key returning the already-created row (200) instead of a duplicate (201).

**Expected behavior.** A retry after a timeout, or a double-submit that beats the client guard,
files one request.

**Affected frontend screens.** `ActionButtons`, `OfferSheet`.

**Example request and response.**

```http
POST /api/crm/requests/
{"kind":"offer","artwork":"0f0d…","detail":{"amount":9500},"client_req_id":"offer:0f0d:9500"}
```

**Why the change is needed.** This branch guards double-taps **in the client** (`RequestController`,
one in-flight POST per artwork+action, ported from `dzGuard`) and that is verified by test and in the
browser — three synchronous taps produce exactly one POST. But a client-side guard cannot survive a
network retry or a reload mid-flight. Only a server-side key can.

---

## G-F1-6 — no reply thread (restates the Phase 19 blocker)

**Current API behavior.** There is no message/reply endpoint on a request anywhere in the 129-path
schema. `POST /api/crm/admin/requests/{id}/transition/` takes a `note`, but nothing reads notes back
out, and the collector cannot see or answer one.

**Missing field or endpoint.** `GET/POST /api/crm/requests/{id}/messages/` (and the admin mirror) —
the `RequestMessage` two-way thread `docs/TASKLIST.md` Phase 5 describes.

**Expected behavior.** After filing an offer the collector can see Darz's reply and respond.

**Affected frontend screens.** The collector's own request list/detail and the "Chat with Darz"
surface (both still unbuilt), and the admin request detail.

**Why the change is needed.** Today the flow is one-way: the collector fires an action and hears
nothing back inside the app. That is the core of the collector loop and the reason Phase 5 is still
marked blocked.

---

## G-F1-7 — the admin feed returns bare UUIDs for collector and artwork

**Current API behavior.** `RequestAdmin` carries `collector: uuid` and `artwork: uuid | null` as
plain ids — no nested object, and no `expand`/`include` parameter on
`GET /api/crm/admin/requests/`. Compare `SavedArtwork`, which embeds the whole `ArtworkCollector`.

**Missing field or endpoint.** Nested `collector {id, display_name}` and
`artwork {id, title, artist}` on `RequestAdmin`, as the collector-facing endpoints already do.

**Expected behavior.** The request feed shows "Monir Farmanfarmaian — Untitled (Hexagon)" and the
collector's name, not `c1` / `aw1`.

**Affected frontend screen.** `AdminRequestsPage` (`/admin/requests`).

**Why the change is needed.** An operator cannot work a feed of raw UUIDs. The only alternative is
N+1 lookups per row (one `GET /api/catalog/artworks/{id}/` per request, and no collector-detail
endpoint exists at all for the name), so this frontend currently shows truncated ids — honest, but
not usable as a real inbox. **This is the gap that most limits the admin half of the flow.**
