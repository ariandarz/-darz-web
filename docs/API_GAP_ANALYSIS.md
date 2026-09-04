# API gap analysis — old app vs. backend V1

**Date:** 2026-09-04 · **Phase:** 3 · **Status:** decided — see "Decisions" below.

## Decisions (owner, 2026-09-04)

Implemented on `darzmarket-api` branch `phase-19-auth-session` (backend TASKLIST §19.1 / §19.2):

- **A1 / A2 / A3** — full auth flow: `POST /api/auth/token/refresh/`, `POST /api/auth/logout/`
  (SimpleJWT `token_blacklist`), `GET /api/auth/me/`. **Done.**
- **G4 / G5 / G6** — `?currency=`, `?price_type=`, repeatable `?tag=` (AND) on `artworks/`;
  plus a deterministic default order on the collector queryset. **Done.** Built on a new
  `apps/core/filters.py` `FilterSet` abstraction (the "inheritance + global config" ask).

**G1 / G2 / G3 / G9 / G11 — done** (`darzmarket-api` branch `phase-19.2-catalogue-query`, merged to
that repo's `development`): `?search=` + `?ordering=` on `artworks/`; `artists/` gets `?search=` +
`?ordering=` (`name`/`-name`/`works`); collector's own `GET /api/crm/requests/` gets `?kind=` /
`?status=`. Consumed by frontend Phase 4 (`CatalogueToolbar`, `CatalogueController`).

Still deferred (logged in the backend TASKLIST §19.2 so the backlog is visible):

- **G7** "Refine" smart dimensions — frontend Phase 12+ (needs dimension-keyed tag storage).
- **G8** "Curated for You" — frontend Phase 12+ (already planned; backend Phase 24).
- **G9 (partial)** `artists/` `records` / `top-price` sorts — need auction-record joins; add with
  the Records surface.

Frontend token storage (**A / decision**): access token in memory, refresh token in
`localStorage['dz-refresh']`. Page size: 20 (the API default).

---

**Original research (kept for the reasoning):**

Compares what the shipped collector app (`../DarzStudio/app.html` @ `main`) does against what
`darzmarket-api` (`origin/development` @ `4132f0a` — Phases 1-17 merged) can actually serve today.
Every row marked **DECISION** needs an owner call: (a) ask backend to add it, (b) do it client-side,
(c) cut it for V1 (faithful-port exception), or (d) defer to a later frontend phase.

---

## What the API gives us today (collector-facing)

### Auth — `/api/auth/`

| Endpoint | Body | Returns |
|---|---|---|
| `POST team/login/` | `{email, password}` | `{access, refresh}` — JWT, `principal=team` |
| `POST collector/login/` | `{access_key}` (≤32 chars) | `{access, refresh}` — JWT, `principal=collector` |
| `POST membership/redeem/` | `{code}` | `{plan, tier, redeemed_at}` |

JWT config: access **30 min**, refresh **7 days**, `ROTATE_REFRESH_TOKENS=True`.

### Catalogue — `/api/catalog/`

| Endpoint | Query params |
|---|---|
| `GET artworks/` | `artist` (id), `availability_status` (exact), `price_min`, `price_max`, `medium` (icontains), `tag` (**one** value, list-contains), `per_page` (≤100, default 20) |
| `GET artworks/{id}/` | — |
| `GET artists/` | **none** |
| `GET artists/{id}/` | — |

Collector artwork fields: `id, artist{id,display_name,name_variants,bio,birth_year,nationality},
title, year, medium, material, dimensions, edition, city, price_amount, currency, price_type,
availability_status, public_description, tags, images[]`.

### CRM — `/api/crm/`

| Endpoint | Notes |
|---|---|
| `GET/POST requests/` | collector's own only; **GET takes no filters** |
| `POST activity/` | kinds: `view` / `save` / `search` / `login` |
| `GET/POST saved/`, `DELETE saved/{artwork_id}/` | idempotent save; soft-delete unsave; **GET takes no filters** |

### Recommendations — `/api/recommendations/`

`GET published/`, `POST published/{id}/dismiss/` — the admin-curated "Selected for you" batches.

### Core

`GET options/` — every choice field as `{value, label}` (build all dropdowns from this).
`GET health/`.

---

## What the old app does that the API can't serve

### Catalogue browse (`app.html` `market()` / `apply()`)

| # | Old-app feature (exact) | API today | Gap | DECISION |
|---|---|---|---|---|
| **G1** | **Free-text search** — one box, `"Search artist, title, medium…"`; matches a lowercased substring across `artist + title + medium + year + dimensions` | no `search`/`q` param anywhere | **Missing** | ? |
| **G2** | **Sort:** Recently added · Year — newest · Year — oldest · Artist A–Z | no `ordering`/`sort` param; `collector_queryset` has **no `.order_by()`** → undefined DB order | **Missing** (incl. a stable default) | ? |
| **G3** | **Sort:** Price — low→high · Price — high→low (within one chosen currency) | no ordering param | **Missing** | ? |
| **G4** | **Currency filter** (`curf`) — "All currencies" + each currency present; needed to make price-sort meaningful ("Toman and USD don't compare") | no `currency` param (only raw `price_min/max`) | **Missing** | ? |
| **G5** | **"Price on request"** filter (`curSort==='req'` → only request works) | no `price_type` filter | **Missing** | ? |
| **G6** | **Tag filter** — old app AND-combines several | `tag` accepts **one** value | **Partial** | ? |
| **G7** | **"Refine" smart filters** — up to 11 dimensions (subject, style, colour, medium, scale, priceRange, decade, mood, visualLanguage, artistType, collectingValue), AND-combined, each owner-gated via `FeatureSettings` | only the flat `tags` list; no per-dimension query params; `FeatureSettings` is admin-only | **Missing** as structured dimensions | ? |
| **G8** | **"Curated for You"** — toggles the grid to the collector's private selection(s) (`club_items` kind=`selection`) + unseen-batch pulse | `collector_queryset` **explicitly excludes** curation; `in_app`/`selected` deferred (both repos' tasklists) | **Missing** | already flagged: FE Phase 12+, BE "later phase" |
| **G9** | **Artist list** — own search box ("Search an artist…") + sort (Name A–Z · Most works · Most records · Top price) | `artists/` takes no params | **Missing** | ? |
| **G10** | **Artist filter by name** on the catalogue | `artist` = **id only** | Minor (resolve name→id client-side, but blocked by G9) | ? |
| **G11** | (old app) collector can review their own requests | `GET requests/` has **no kind/status filter** (the admin feed does) | **Missing** for the collector view | ? |
| **G12** | Saved list shows newest-first | no `ordering` param | Minor (list is small) | ? |
| **G13** | Old app paginates at **10/page**; API default **20** | `per_page` override exists | Not a gap — pick a page size | pick: 10 / 20 / other |

### Auth / session

| # | Need | API today | Gap | DECISION |
|---|---|---|---|---|
| **A1** | Refresh the 30-min access token | login returns a `refresh` token but there is **no `/api/auth/token/refresh/` route** | **Missing** — collector is forced to re-login every 30 min | ? (blocks Phase 3 design) |
| **A2** | Logout / invalidate a refresh token | none | Missing — client can just drop tokens (no blacklist) | ? |
| **A3** | "Who am I" — the logged-in collector's name, tier, preferences | **no `/me/` endpoint** anywhere; only `membership/redeem/` echoes `tier` | **Missing** — can't show the collector's name or gate tier features | ? (affects Phase 3 + Phase 9) |
| **A4** | Collector self-signup | none — access keys are admin-issued | Expected (invite-only V1) — **not a gap**, noted | — |

---

## Recommended default (my read, for you to override)

- **A1 token refresh** — ask backend to add `POST /api/auth/token/refresh/` (standard SimpleJWT
  `TokenRefreshView`; `ROTATE_REFRESH_TOKENS` is already on). Small backend change, unblocks a
  usable session. Until then the client treats any 401 as "session expired → back to login".
- **A3 `/me`** — ask backend for `GET /api/auth/me/` returning the current principal
  (collector: `{id, display_name, tier, preferences}`). Needed for Phase 9 anyway.
- **G1 search + G2/G3 sort + G4 currency + G5 price_type** — ask backend to add these as
  `artworks/` query params (`search`, `ordering`, `currency`, `price_type`). They're the core of a
  usable catalogue, they're cheap (all queryset-level), and the client brief's "build Artwork list"
  can't really ship without at least search + a stable sort. **Not** client-side: the catalogue
  can be hundreds of works across many pages — fetch-all-and-filter breaks pagination and perf.
- **G6 multi-tag** — ask backend to let `tag` repeat (AND).
- **G7 smart "Refine" dimensions** — **defer** (frontend Phase 12+ / needs backend dimension
  storage). Ship the single `tag` filter for V1.
- **G8 "Curated for You"** — **defer**, already planned (FE Phase 12+).
- **G9 artist search/sort** — ask backend for `search` + `ordering` on `artists/` (cheap), or
  **defer** the Artists page polish.
- **G11 own-request filters** — **defer** to frontend Phase 5 (which is already backend-blocked).
- **G13 page size** — use **20** (the API default) unless you want to match the old 10.
