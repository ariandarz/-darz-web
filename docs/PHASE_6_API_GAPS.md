# Phase 6 (Saved / Favorites) — API gaps

**Date:** 2026-09-04 · **Phase:** 6 (frontend saved/favorites) · **Repo:** `-darz-web`
**Backend:** `darzmarket-api` (`ariandarz/darz-backend-api`), Phase 10 `SavedArtwork` endpoints.
**Status:** open — for the owner to decide. **No backend, API-contract or `src/api/schema.d.ts`
change was made in this branch** (explicitly out of scope for this task).

## Summary

The Phase 6 flow **shipped complete** against the API as it stands today — save, unsave, the Saved
Items page, correctness across a refresh, and the pending-duplicate guard all work without a backend
change. So nothing was "stopped".

What the gaps below cost is **efficiency and precision, not function**: because the artwork payload
carries no saved flag and the saved list can't be queried by artwork, the frontend has to read the
collector's *entire* saved set once per session (`SavedController.fetchAll()`, walking
`?page=&per_page=100`) and index it client-side. That is fine for the saved-list sizes this app
expects — `docs/API_GAP_ANALYSIS.md` G12 already calls the list "small" — and it is still
**server-derived state, not `localStorage`**. It stops being fine as saved lists grow.

Gap IDs continue the `G…` series in `docs/API_GAP_ANALYSIS.md`.

---

## G-P6-1 — `ArtworkCollector` has no `is_saved` flag

**Current API behavior.** `GET /api/catalog/artworks/` and `GET /api/catalog/artworks/{id}/`
return `ArtworkCollector`: `id, artist, title, year, medium, material, dimensions, edition, city,
price_amount, currency, price_type, availability_status, public_description, tags, images[]`
(`src/api/schema.d.ts:3649-3668`). Nothing in that payload says whether the requesting collector has
saved the work — even though the endpoint is collector-authenticated and the server already knows.

**Missing field or endpoint.** A per-collector `is_saved: boolean` (and ideally `saved_at:
datetime|null`) on `ArtworkCollector`, for collector-principal requests.

**Expected behavior.** A catalogue page or an artwork detail response tells the client, in the same
round trip, which of those works the current collector has saved.

**Affected frontend screens.** `CataloguePage` (`/`), `ArtworkDetailPage` (`/artwork/:id`),
`ArtistDetailPage` (`/artists/:id`) — every screen that renders `ArtworkCard`, which now carries a
save control.

**Example request and response.**

Today:

```http
GET /api/catalog/artworks/?page=1 HTTP/1.1
Authorization: Bearer <collector access token>
```
```json
{
  "success": true,
  "data": {
    "results": [
      { "id": "0f0d…", "title": "Untitled", "availability_status": "available" }
    ],
    "pagination": { "page": 1, "per_page": 20, "total_pages": 3, "total_count": 47,
                    "has_next": true, "has_previous": false }
  },
  "message": "OK",
  "timestamp": "2026-09-04T17:00:00Z"
}
```

Wanted — one extra key per row:

```json
{ "id": "0f0d…", "title": "Untitled", "availability_status": "available", "is_saved": true }
```

**Why the change is needed.** Without it the client cannot render a correct save state from the
catalogue response alone, so it must fetch the whole saved set separately and join client-side. That
is one extra request per session at best, and `ceil(total_saved / 100)` requests at worst, for a
fact the server computes for free. It is also the only reason `SavedController` has to hold the full
set in memory at all — with `is_saved`, the registry could shrink to just the writes.

---

## G-P6-2 — `GET /api/crm/saved/` documents no query parameters

**Current API behavior.** The generated schema declares `crm_saved_list: { parameters: { query?:
never } }` (`src/api/schema.d.ts:9083-9101`) — no `page`, no `per_page`, no filter, no ordering. In
practice the global `CustomPagination` *does* honour `?page=` and `?per_page=`, exactly as the
catalogue endpoints do (Phase 4 relies on the same undocumented-but-real params), and the response
carries a full `pagination` block. So the params work; the contract doesn't admit they exist.

**Missing field or endpoint.**
1. `page` / `per_page` declared in the OpenAPI schema for this operation (and, consistently, for
   every paginated list operation — `catalog_artworks_list` omits them too).
2. `?artwork=<uuid>` (repeatable) so the client can ask about specific works.
3. `?ordering=` — this is `docs/API_GAP_ANALYSIS.md` **G12**, still unanswered.

**Expected behavior.** `GET /api/crm/saved/?artwork=<id>&artwork=<id>` returns only those rows, and
the schema declares the pagination parameters the endpoint already accepts, so the typed client can
express them without a hand-written type.

**Affected frontend screen.** `SavedItemsPage` (`/saved`) and, indirectly, every screen with a save
control — this is the endpoint `SavedController` walks.

**Example request and response.**

Wanted:

```http
GET /api/crm/saved/?artwork=0f0d…&artwork=71ab… HTTP/1.1
Authorization: Bearer <collector access token>
```
```json
{
  "success": true,
  "data": {
    "results": [
      { "id": "s-1", "created_at": "2026-09-03T09:12:00Z",
        "artwork": { "id": "0f0d…", "title": "Untitled" } }
    ],
    "pagination": { "page": 1, "per_page": 20, "total_pages": 1, "total_count": 1,
                    "has_next": false, "has_previous": false }
  },
  "message": "OK",
  "timestamp": "2026-09-04T17:00:00Z"
}
```

**Why the change is needed.** The undeclared pagination params are the more serious half: the
client currently passes `page`/`per_page` that the published contract says do not exist, so a future
backend change could remove them without any schema diff to catch it. `?artwork=` would let a single
artwork detail page answer "is this saved?" in one small request instead of loading the whole set.
`?ordering=` makes the Saved page's newest-first order a guarantee rather than an observation
(see G-P6-4).

---

## G-P6-3 — `POST /api/crm/saved/` does not report created-vs-restored

**Current API behavior.** The endpoint is documented as idempotent: "saving an already-saved artwork
is a no-op; re-saving a previously unsaved one restores it (soft-delete, never a hard delete)"
(`src/api/schema.d.ts:1109`). It is declared as returning `201` with the `SavedArtwork` row. The
success envelope carries `{success, data, message, timestamp}` and `HttpClient.unwrap()` returns
only `data` — the HTTP status is not surfaced on success (`src/api/HttpClient.ts:109-115`) — so the
client cannot distinguish "newly saved", "restored", and "already saved" at all.

**Missing field or endpoint.** Either a `created: boolean` (or `restored: boolean`) on the
`SavedArtwork` response, or a documented `200` vs `201` split for this operation.

**Expected behavior.** The response says which of the three things happened, so the confirmation can
be accurate.

**Affected frontend screens.** `SaveButton` (both variants) and `SavedToast` — the confirmation
copy after a save, anywhere in the app.

**Example request and response.**

```http
POST /api/crm/saved/ HTTP/1.1
Authorization: Bearer <collector access token>
Content-Type: application/json

{"artwork": "0f0d…"}
```

Wanted:

```json
{
  "success": true,
  "data": {
    "id": "s-1",
    "created_at": "2026-09-03T09:12:00Z",
    "created": false,
    "artwork": { "id": "0f0d…", "title": "Untitled" }
  },
  "message": "Already saved.",
  "timestamp": "2026-09-04T17:00:00Z"
}
```

**Why the change is needed.** Low severity, and the UI is honest today (it says "Saved.", which is
true in all three cases). It matters only if the owner wants the distinct wording the old app may
have used. Flagged rather than guessed.

---

## G-P6-4 — no documented order on the saved list

**Current API behavior.** `GET /api/crm/saved/` returns rows in whatever order the queryset
produces; no `ordering` param, and the schema documents no default. Observed behaviour is
newest-first, but nothing in the contract promises it. (This is `docs/API_GAP_ANALYSIS.md` **G12**,
restated here because Phase 6 is the phase that actually consumes it.)

**Missing field or endpoint.** A documented deterministic default (`-created_at`) plus an optional
`?ordering=created_at|-created_at`.

**Expected behavior.** The saved list is stably newest-first across pages, and the client can say so
in the UI without qualifying it.

**Affected frontend screen.** `SavedItemsPage` (`/saved`).

**Example request and response.**

```http
GET /api/crm/saved/?ordering=-created_at&page=1&per_page=100
```

**Why the change is needed.** Without a deterministic `ORDER BY`, a paginated read can return the
same row twice, or skip one, across page boundaries. `SavedController` walks every page, so an
unstable order shows up directly as a duplicated or missing card. Same class of bug the backend
already fixed for the collector catalogue queryset (see G2 in `docs/API_GAP_ANALYSIS.md`).

---

## Open question for the owner (not a gap)

`POST /api/crm/activity/` accepts `kind: "save"` (`ChoiceRegistry['crm.activity_kind']`). Phase 6
does **not** post an activity row on save, because `POST /api/crm/saved/` already records the same
event server-side and double-logging would inflate the funnel. If the analytics side expects a
`save` activity row distinct from the `SavedArtwork` row, say so and it is a two-line change in
`SavedController.save()`.
