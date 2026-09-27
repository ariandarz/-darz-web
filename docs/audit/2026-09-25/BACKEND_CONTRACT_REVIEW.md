# Backend V1 API contract review (frontend-facing)

Backend: `/home/user/darz-backend-api`, branch `development` @ `df0421f` (merge of PR #70, P3b pricelist builder).
Schema checked: `the generated schema.json` (it includes `pricelists/build/`, so it is current with HEAD).
Tests: **not run.** `config/settings.py:127-140` hard-requires Postgres ("no SQLite fallback"), so the suite
can't run without it. I did run a no-DB serializer check with the scratchpad venv (`chk.py`, env from
`.env.example`), covered in section 1.

Severity labels: **Blocker for FE** / **Should fix** (backend) / **Note** (FE must know; no backend change strictly needed).

---

## 1. `partial=True` + `validated.pop("expected_version")`: 500 instead of 400

**Still present on development. Severity: Should fix (backend). The FE workaround is to always send `expected_version`. Verified.**

Each view below builds its update serializer with `partial=True`. That makes DRF skip the `required` check on
`expected_version = IntegerField(write_only=True)`, and the view then runs `validated.pop("expected_version")`.
If the body has no lock, that pop raises `KeyError`. The handler (`apps/core/exceptions.py:139-204`) turns it into
**HTTP 500 `{success:false,error:{code:"INTERNAL_ERROR",message:"An unexpected error occurred."}}`** and logs it
as an incident.

I checked this at runtime. `LotUpdateSerializer`, `AuctionUpdateSerializer` and `LedgerEntryUpdateSerializer` with
`data={}, partial=True` all come back `is_valid() == True` with `validated_data == {}`.

The full list is 18 occurrences, all on `development`:

| Endpoint (PATCH) | view file:line (the pop) |
| --- | --- |
| `/api/catalog/admin/artworks/{id}/` | `apps/catalog/views.py:437` |
| `/api/catalog/admin/artists/{id}/` | `apps/catalog/views.py:653` |
| `/api/sales/admin/sales/{id}/` | `apps/sales/views.py:118` |
| `/api/projects/admin/projects/{id}/` | `apps/projects/views.py:124` |
| `/api/projects/admin/partners/{id}/` | `apps/projects/views.py:289` |
| `/api/projects/admin/service-catalog/{id}/` | `apps/projects/views.py:351` |
| `/api/projects/admin/packages/{id}/` | `apps/projects/views.py:408` |
| `/api/projects/admin/checklists/{id}/` | `apps/projects/views.py:465` |
| `/api/crm/admin/selections/{id}/` | `apps/crm/views.py:602` |
| `/api/accounting/admin/ledger/{id}/` | `apps/accounting/views.py:136` |
| `/api/gallery/admin/exhibition-catalogue/{id}/` (new 09-25) | `apps/gallery/views.py:957` |
| `/api/recommendations/admin/question-sets/{id}/` | `apps/recommendations/views.py:411` |
| `/api/auth/admin/collectors/{id}/` | `apps/accounts/views.py:343` |
| `/api/auth/admin/membership-codes/{id}/` | `apps/accounts/views.py:559` |
| `/api/auth/admin/team-users/{id}/` | `apps/accounts/views.py:666` |
| `/api/auctions/admin/auctions/{id}/` (new 09-25) | `apps/auctions/views.py:469` |
| `/api/auctions/admin/lots/{id}/` (new 09-25) | `apps/auctions/views.py:554` |
| `/api/auctions/admin/records/{id}/` | `apps/auctions/views.py:727` |

`POST /api/projects/admin/projects/{id}/stage/` (`apps/projects/views.py:163`) reads
`validated_data["expected_version"]`, but that serializer is **not** partial, so a missing lock correctly 400s.

**The schema makes this worse (Blocker for FE type safety). Verified from schema.json.** Every PATCH body is a
drf-spectacular `Patched*` component with `required: []`. So `openapi-typescript` types `expected_version` as
**optional** on all 18 bodies (`PatchedLotUpdate`, `PatchedAuctionUpdate`, `PatchedSaleUpdate`, …). The generated
types won't catch a missing lock, and the server answers with a 500. Every new desk editor (auction, lot,
exhibition-catalogue, project, sale) must send `expected_version` by hand. It's worth a shared FE helper type that
makes it required.

Suggested backend fix, any of these: `validated.pop("expected_version", None)` plus a service check that raises
400; an explicit `validate()` that requires the key even when partial; or `extra_kwargs`/a custom
`required=True` enforced in `validate`.

**No optimistic lock at all (Note):** `PATCH /api/accounting/admin/deals/{id}/` (`apps/accounting/views.py:297-300`),
`PATCH /api/documents/admin/documents/{id}/` (`apps/documents/views.py:82-84`),
`PATCH /api/gallery/admin/exhibitions/{id}/` (`apps/gallery/views.py:805-808`) and
`PATCH /api/marketing/admin/campaigns/{id}/` are last-write-wins. Their bodies have no `expected_version`. Verified.

---

## 2. `HoldDetailSerializer` has no fields, so the schema has no hold member

**Still present. Severity: Should fix (backend; FE workaround is the existing hand-typed `HoldDetail`). Verified.**

- `apps/crm/serializers.py:24-25` defines `HoldDetailSerializer` with an empty body (docstring only).
- The service writes `detail["expires_at"]` server-side (`apps/crm/services.py:116`), and the model reads it
  back (`apps/crm/models.py:288-295`).
- The generated `RequestDetail` in schema.json is `oneOf [OfferDetail, ViewingDetail, SimpleDetail ×4,
  PurchaseIntentDetail]`. **There is no hold branch.** drf-spectacular drops the field-less serializer.
- Fix: `expires_at = serializers.DateTimeField(read_only=True, required=False)` on `HoldDetailSerializer`.
  Read-only fields are ignored on input, so create validation doesn't change.

**Related Note (verified, schema.json `RequestDetail`):** the union lists the **same `SimpleDetail` ref 4 times**
and has **no discriminator** (`resource_type_field_name=None`, `apps/crm/serializers.py:78-82`). That is
technically an invalid `oneOf`, since any SimpleDetail payload matches 4 branches, and a `{}` detail also matches
SimpleDetail and PurchaseIntentDetail. TypeScript gets a plain untagged union, so narrowing has to go through the
request's `kind`, not the detail shape.

---

## 3. Response envelope consistency

### 3a. Success envelope: consistent. **Note. Verified.**
- Every view in `apps/*/views.py` is a function view wrapped in `@format_api_response()`
  (`apps/core/responses.py:23-78`). No view returns a raw `Response(...)` of its own
  (grep: the only `return Response(` outside core is none). Paginated lists return
  `CustomPagination.get_paginated_response` (`apps/core/pagination.py:20-40`), which is already enveloped and
  passes straight through the decorator.
- Django-level 404/500 (outside DRF) are enveloped too (`apps/core/handlers.py:28,32`).
- DELETE returns **204 with no body** (`responses.py:61-62`). A `None` payload becomes `data: {}` (`responses.py:66`).

### 3b. Paginated vs bare array: **declared shape matches the code everywhere. Verified.**
I scripted a check of every view's `extend_schema` (paginated vs not) against whether the body paginates. There
were no mismatches (the only hits were false positives from the helper sitting next to `health`/`options`). The FE
does need to know which lists **aren't** paginated. `data` is a **bare array** (no `results`/`pagination`) on:
- `GET /api/catalog/admin/artworks/{artwork_pk}/images/` (`catalog/views.py:516`)
- `GET /api/catalog/admin/artworks/{artwork_pk}/selection-grants/` (`catalog/views.py:565`)
- `GET /api/catalog/selections/` (collector, `catalog/views.py:242`)
- `POST /api/recommendations/admin/artworks/{id}/tags/auto/` and `/tags/ai/`,
  `POST …/collectors/{id}/preferences/rebuild/` and `POST …/recommendations/generate/` (`recommendations/views.py:81,99,154,186`)

Lists wrapped in a keyed object (neither paginated nor a bare array):
- `GET /api/gallery/portal/{token}/exhibitions/` returns `data: {exhibitions: [...]}` (`gallery/views.py:673`)
- `GET /api/gallery/portal/{token}/exhibitions/catalogue/` returns `data: {services: [...]}` (`gallery/views.py:653`)
- `GET /api/projects/admin/projects/reports/` returns `data: {deliverables: [...]}` (`projects/views.py:204`)
- `GET /api/gallery/portal/{token}/` embeds **unpaginated** `assigned_artworks`, `pricelists`, `messages` and
  `updates` arrays (`gallery/views.py:97-113`). The paginated thread is separate, at `/portal/{token}/messages/`.

**Note:** `Project` has a real field called **`results`** (`projects/serializers.py:99`). Any FE heuristic that spots
pagination by `'results' in data` will misread a single project (GET/POST/PATCH/stage) as a page. Branch on the
endpoint, not the shape.

### 3c. Declared schema vs actual payload

| Finding | Severity | Status |
| --- | --- | --- |
| **`GET /api/gallery/portal/{token}/` is declared as `GalleryLinkSerializer`** (`gallery/views.py:89`), but the view also adds `assigned_artworks`, `pricelists`, `messages`, `updates`, `cover` and per-item `funnel` (`gallery/views.py:97-114`). None of these are in the generated type, and they're the whole point of the P1/P3b work. | **Blocker for FE** (hand-type or backend fix) | Verified |
| **`ErrorResponse` schema has no `details`** (`apps/core/schema.py:63-75`), but the handler sends `error.details` for every field-level 400 (`exceptions.py:147-150,203-204`). The publish gate's `missing` list (§6) and all per-field form errors are untyped. | **Should fix** | Verified |
| `POST /api/catalog/admin/artworks/{id}/publish/` declares only 200/404 (`catalog/views.py:462-467`). The new 400 gate (§6) isn't declared, and the description doesn't mention it. | Should fix | Verified |
| Untyped `data` (a free-form object in the schema). The FE must hand-type: `GET/POST portal/{token}/exhibitions/`, `GET/PATCH portal/{token}/exhibitions/{event_id}/`, `POST …/submit/`, `GET portal/{token}/exhibitions/catalogue/`, `GET portal/{token}/status/`, `GET /api/options/`, `GET /api/dashboard/admin/summary/`, `GET /api/projects/admin/projects/reports/`, the accounting ledger/deal summaries, catalog facets/data-health, push subscribe/unsubscribe, logout and mark-seen. | Should fix (Note for FE) | Verified (schema scan) |
| The portal exhibition dict (`gallery/views.py:605-632`) is hand-built, not from a serializer. Its `documents` use the **admin-tier** `DocumentSerializer`, which exposes `object_key`, `fields`, `created_by`, `confirmed_by` and `collector` to the anonymous portal. | Note | Verified |

### 3d. Error `code` is `INTERNAL_ERROR` on ordinary 4xx
**Severity: Should fix (backend). The FE must not treat `code === "INTERNAL_ERROR"` as a server fault; branch on the HTTP status. Verified.**
`ERROR_CODE_MAP` (`apps/core/exceptions.py:37-52`) falls back to `"INTERNAL_ERROR"` for any unmapped
`default_code`. These custom exceptions aren't mapped, so they reach the FE as **HTTP 400/403 with
`code:"INTERNAL_ERROR"`**:
- `invalid_bid` (`auctions/services.py:79-82`, `BidValidationError`). It's raised by bid placement **and by the
  new auction PATCH ("Only a draft or scheduled auction can be edited.", `services.py:190`) and lot PATCH ("Only a
  scheduled lot can be edited.", `services.py:274`)**.
- `invalid_lot_transition`, `invalid_registration_transition` (`auctions/lifecycle.py:30,36`). The second one
  covers the new registration **reset** on a non-rejected registration.
- `invalid_update_transition` (`gallery/lifecycle.py:19`), for approve/reject of an already-reviewed portal update.
- `collector_transition_not_allowed` (`crm/services.py:57`).

---

## 4. Permissions

**Classes (Verified, `apps/core/permissions.py`):** `IsTeamPrincipal`, `IsCollectorPrincipal`, `IsOwner`,
`IsStandardAdminOrOwner`, plus DRF `IsAuthenticated`/`AllowAny`. The default is `IsAuthenticated`
(`config/settings.py:186-188`).

The decorators across views break down as 126× `IsStandardAdminOrOwner`, 16× `ADMIN_PERM` (an alias of the same
class, `projects/views.py:49`), 32× `IsCollectorPrincipal`, 21× `IsOwner`, 23× `AllowAny` and 1× `IsAuthenticated`
(`/api/auth/me/`, team or collector).

**Role distinction owner vs standard_admin: yes, it's enforced (Note). Verified.** The following are `IsOwner` only,
so a `standard_admin` gets **403 `FORBIDDEN`**:
- All of `/api/accounting/admin/**` (15 views, `apps/accounting/views.py:80…384`).
- `/api/auth/admin/membership-codes/**` (`accounts/views.py:508,544,575`).
- `/api/auth/admin/team-users/**` (`accounts/views.py:615,651`).
- `/api/admin/audit-log/` (`core/views.py:201`).

Everything else admin-side, including app-theme, the access-key roster and summary, sales, projects and gallery,
is either role. The FE must hide or guard the owner-only desks by `role` from `/api/auth/me/`.

**Unverified question:** the roster docstring calls it "the old owner 'Access' desk" (`accounts/views.py:352-353`),
but it's `IsStandardAdminOrOwner` (`:367`, likewise extend/revoke). If the old panel's `OWNER_ONLY` list included
Access, this is a divergence. I couldn't check it (DarzStudio isn't on disk).

**AllowAny endpoints (Verified):** `GET /api/health/`, `GET /api/options/`, `GET /api/app-theme/`,
`GET /api/catalog/legacy-lookup/`, `GET /api/notifications/vapid-public-key/`, `POST /api/auth/team/login/`,
`POST /api/auth/collector/login/`, `POST /api/auth/token/refresh/`, `POST /api/auth/logout/`,
`POST /api/auth/access-requests/`, `GET /api/documents/public/{kind}/`, and all 12 gallery portal views
(token+PIN gated, `gallery/views.py:92…729`).

Surprises:
| Finding | Severity | Status |
| --- | --- | --- |
| **Portal reads are completely unthrottled.** `GalleryPortalThrottle` exempts GET/HEAD/OPTIONS (`gallery/views.py:71-79`), and its comment and the CHANGELOG say a "per-IP `anon` scope still bounds a read flood". **There is no `anon` rate and no `DEFAULT_THROTTLE_CLASSES`** (`config/settings.py:193-201`). Anyone holding a portal token can brute-force the 6-digit PIN (`gallery/keys.py:12`, 10^6 space) via `GET /portal/{token}/?pin=` with no limit. | Should fix (security) | Verified |
| `team/login` and `collector/login` have **no throttle** (`accounts/views.py:95-120`). Only access-request is throttled (`:699`). The FE's "Too many attempts" 429 copy will never fire on login. | Should fix / Note | Verified |
| **Anonymous portal uploads have no type or size validation.** Image replace and pricelist upload use a plain `FileField` (`gallery/serializers.py:91-96,174-177`), and `PrivateFileStorageService.upload` (`core/files.py:39`) doesn't check either. There's no `DATA_UPLOAD_MAX`/`FILE_UPLOAD_MAX` in settings. | Should fix | Verified |
| `GET /api/documents/public/{kind}/` returns the admin `DocumentSerializer` (with `created_by`, `confirmed_by`, `object_key`, `fields`). It's filtered to public+confirmed, so the exposure is team-user UUIDs only. | Note | Verified (`documents/views.py:204-223`) |
| `GET /api/options/` is public. It's metadata only, but it includes accounting vocabularies (the `accounting.arian_*` and `position_seed` keys). | Note | Verified (`accounting/apps.py:19-47`) |
| A portal source can submit **any** `GalleryUpdate` kind through `POST portal/{token}/updates/`, including `image`, `invoice_signed` and `exhibition`, with a free-form `payload` (`gallery/serializers.py:132-135`). | Note | Verified |
| The pricelist builder accepts **any** non-deleted artwork UUID on a line, not just works assigned to that link (`gallery/serializers.py:187-189`, `services.py:238-257`). | Should fix | Verified |

---

## 5. Branch `origin/claude/phase-18-deploy-prep` (commit `c9d8a18`, 2026-09-19)

**Severity: Note. Verified.**
- **What it contains:** `.env.production.example` (+129), `docker-compose.prod.yml` (+127), `docs/DEPLOY.md` (+168) and
  `.gitignore` (+4). **There are no Python, app or API changes**, so it has no effect on the API contract.
- **It's already on development.** It was squash-merged as PR #29 (`74c9326`, "Merged on the owner's explicit
  instruction"). `git diff 74c9326 c9d8a18` on all four files is empty. The branch only reads as "1 ahead" because
  of the squash.
- **Don't merge it.** On 2026-09-24, `3472f8c` ("remove: no docker-compose.prod file is needed") deliberately
  deleted `docker-compose.prod.yml` from development. Merging the branch would try to bring that file back. The
  branch can be deleted.
- **FE-relevant leftovers on development (Should fix, Verified):**
  - `docs/DEPLOY.md` still refers to `docker-compose.prod.yml` 3 times.
  - The removed compose file was the thing that **overrode the Dockerfile's `gunicorn config.wsgi` entrypoint with
    daphne** (DEPLOY.md:39-64). `Dockerfile:28` still starts gunicorn/WSGI, and WSGI can't carry the auction
    **WebSocket** (`config/asgi.py`).
  - So unless the platform's start command is overridden by hand, **live auction updates won't work in prod**. The
    FE auction room should degrade gracefully (poll or show a stale state) when the socket fails.

---

## 6. New 2026-09-25 endpoints: FE contract notes

Everything below is enveloped, and errors use the standard error envelope. "Lock" means the body must include
`expected_version` (a missing lock is a 500, see §1; a stale one is 409 `CONFLICT`).

### Gallery portal (anonymous; token in the path; **PIN rules**)
**Blocker for FE (docs mismatch). Verified at `gallery/views.py:59-60`.**
`_portal_pin` reads the PIN from **`?pin=` on GET** but from the **request body (`pin` field) on every non-GET**.
- The schema declares `pin` as a **query** param on `POST …/artworks/{id}/image/` (`:121`) and `POST …/pricelists/build/` (`:216`). **Sending it there gets 401 "Incorrect PIN."**
- On the other POST/PATCH portal endpoints `pin` isn't documented at all, and no request serializer has a `pin`
  field, so the generated body types omit it.
- **So on every portal write, put `pin` in the JSON body, or as a multipart form field for uploads.**

Portal error cases:
- Unknown token: **404** `NOT_FOUND`.
- Disabled or expired link: **401** `UNAUTHORIZED` "This portal link is no longer active."
- Wrong or missing PIN: **401** "Incorrect PIN." (`gallery/services.py:107-117`)
- Writes over 30/hour per IP: **429** (`settings.py:196`). A bulk "confirm all" on a large portal can hit this.

| Endpoint | Request | Response `data` | Errors / gotchas |
| --- | --- | --- | --- |
| **P1** `GET portal/{token}/?pin=` | – | GalleryLink fields **+** `assigned_artworks[]` (each with `image_url` (presigned, nullable) and `funnel` when `feat_funnel`), `pricelists[]` (now with `status`, `file_url`, `lines[]`), `messages[]`, `updates[]` (PortalUpdate: `id,kind,artwork,payload,status,review_note,created_at`), `cover` (url or null) | Schema only declares GalleryLink (§3c). Verified `views.py:95-114` |
| **P1** `POST portal/{token}/artworks/{artwork_pk}/image/` | **multipart**: `file`, `pin` | 201 PortalUpdate (`kind:"image"`, `payload:{image_key}`) | 404 if the work isn't assigned to this link. **Admin can't view the submitted image**: `GalleryUpdateSerializer` returns the raw `payload.image_key` with no presigned URL (`serializers.py:122-129`, `services.py:161-171`), and approving an `image` update applies nothing (`services.py:202-205`). **Should fix** before building the admin review UI for image updates. |
| **P4** `POST portal/{token}/updates/` | JSON `{kind, artwork?, payload?, pin}` | 201 GalleryUpdate (admin shape, includes `reviewed_by`) | `kind` ∈ `gallery.update_kind` (now has `ask`, `withdraw`). `ask`/`withdraw` without `artwork` → 400 "A '<kind>' update must reference an assigned artwork." An artwork not assigned → 400. `payload` is free-form. **Keys that are actually applied on approve:** availability `{availability_status}`, price `{price_amount,currency,price_type}`, correction `{title,year,medium,material,dimensions,edition,city}` (`services.py:20-21,178-190`). An approved `withdraw` unassigns the work. `ask` is a record only, and the answer comes back via `review_note` or the thread. **The 201 is the admin serializer, not PortalUpdate.** That's inconsistent with the `updates[]` items in portal state (Note). |
| **P3b** `POST portal/{token}/pricelists/build/` | JSON `{title?, notes?, lines:[{artwork?, work_title?, price?, currency?, availability?, note?}], pin}` | 201 GalleryPricelist (`status:"submitted"`, `object_key:""`, `file_url:null`, `lines[]` with `position`) | `lines` must have ≥1 entry (400). Each line needs `artwork` or `work_title` (400 "Each line needs an artwork or a work_title."). `currency` is a **free 3-char string, not validated** against ISO choices (`serializers.py:192`). `availability` is **free text (≤60), not a choice** (`models.py:252`). `price` is a decimal string. Artwork isn't restricted to the link (§4). Line errors come back nested under `details.lines[i]`. |
| `POST portal/{token}/pricelists/` (upload) | **multipart** `file`, `title?`, `notes?`, `pin` | 201 GalleryPricelist | No size/type check (§4). |
| **P3a** `POST /api/gallery/admin/pricelists/{id}/status/` | `{status}` ∈ submitted, accepted, superseded | GalleryPricelist | **No transition guard**: any status can be set from any status (`services.py:268-281`). Setting `accepted` silently flips the link's other accepted pricelist to `superseded`, so re-fetch the list afterwards. No lock. |
| **P3a** `GET /api/gallery/admin/links/{link_pk}/pricelists/cap/` | – | `{count, cap, over_cap}` | Advisory only; it never blocks. `count` covers **every** non-deleted pricelist, including superseded ones. `over_cap` is `count > cap` (strict), and `cap` defaults to 10 (`services.py:259-265`). |
| `POST /api/gallery/admin/links/{id}/reissue/` | no body | `{link, token, pin}` (plaintext, shown once; same shape as issue) | Status is untouched: a disabled or expired link stays unusable until enable/extend. The old token and PIN stop working immediately. 200 (not 201). |
| `GET /api/gallery/admin/links/?search=&source_type=` | – | paginated GalleryLink | – |
| Exhibition catalogue CRUD `GET/POST /api/gallery/admin/exhibition-catalogue/`, `GET/PATCH/DELETE …/{id}/` | POST `{key, title, description?, default_price?, position?, is_active?}`; PATCH **lock** + any of those except `key` (read-only) | item `{id,key,title,description,default_price,position,is_active,version,created_at,updated_at}`; the list is paginated | `key` is a **unique** slug that also counts soft-deleted rows (`models.py:399`), so re-creating a deleted key gets 400 "already exists". `default_price:null` means "on request". The portal catalogue only shows `is_active` items. **`/api/options/`'s `gallery.exhibition_service` still comes from the old Python constant**, so it doesn't reflect desk edits (§7). |
| Portal exhibitions (`/portal/{token}/exhibitions/…`) | JSON + `pin` in the body on writes | untyped dicts (§3c) | An unknown `event_id` returns **400** "No such exhibition on this portal.", not 404 (`views.py:635-639`). `submit` `service_keys` doesn't appear to be checked against the catalogue (`exhibitions.py:129-131`; Unverified beyond those lines). |

### Catalog
| Endpoint | Notes | Status |
| --- | --- | --- |
| **Publish gate** `POST /api/catalog/admin/artworks/{id}/publish/` (no body) | **400** when incomplete: `{success:false, error:{code:"VALIDATION_ERROR", message:"Validation failed: Cannot publish an incomplete listing.; missing: title; missing: size; …", details:{non_field_errors:["Cannot publish an incomplete listing."], missing:["title","size","medium","artist","price","image"]}}}`. `missing` holds a subset in exactly that order. The tokens are **`size`** (meaning `dimensions`), `artist` (no FK and no `artist_name_raw`), and `price` (only when `price_type` is fixed or estimate and there's no amount). **`details` isn't in the generated error type** (§3c). Success returns the admin artwork. | Verified `catalog/services.py:154-169`, `health.py:91-113`, `exceptions.py:147-150` |
| Admin artworks/artists lists | New fields: `thumb` and `artist_name` on the artwork; `works_count` on the artist. **`works_count` is `null` on artist detail, create and PATCH** (annotation only on the list, `catalog/serializers.py:55-56`), so don't overwrite a list row with a detail response. | Verified |

### Sales
| Endpoint | Notes |
| --- | --- |
| `GET /api/sales/admin/sales/summary/` | `{total, by_status{}, by_payment_status{}, by_delivery_status{}, by_source{}}`, with every choice seeded to 0. **Labels for `by_source` aren't in `/api/options/`** (§7). |
| `GET /api/sales/admin/sales/?search=&status=&payment_status=&delivery_status=&source=&ordering=created\|-created\|price\|-price` | Rows are now **nested**: `artwork:{id,title}`, `collector:{id,display_name}`, `responsible:{id,name}\|null`. `lot` and `source_request` are still bare uuids. **Input** (POST/PATCH) still takes **plain ids** for artwork, collector and responsible (`sales/serializers.py`). The read and write shapes differ on purpose. |
| `POST …/sales/{id}/follow-up/` | `{follow_up_at: "YYYY-MM-DD" \| null}`. The key is **required** (send `null` to clear). Returns the sale with `follow_up_at` and `follow_up_overdue`. No lock, and it works after confirm. |
| `GET/POST …/sales/{id}/notes/` | GET is paginated `{id, body, author, author_name, created_at}`. POST `{body}` returns 201. Append-only (no edit or delete endpoint). |
| `PATCH …/sales/{id}/` | **Lock** required. Draft-only (the service rejects confirmed sales). |

### Projects
| Endpoint | Notes |
| --- | --- |
| `GET …/projects/{id}/totals/` | `{by_currency: {<CUR>: {internal,external,fee,client,paid,due}}, fx: null \| {source_currency,target_currency,rate,rate_date,converted:{…same six…},unconvertible_currencies[]}}`. Decimals are **strings**. A money line with no currency lands in the `deal_currency` bucket, or **the literal key `"unknown"`** (`projects/services.py:322-326`). An unparsable amount such as `"1,000"` is **silently counted as 0** (`:311-319`). `fx` is null unless `deal_fx_rate`, `deal_currency` and `deal_fx_target_currency` are all set. If `deal_currency == deal_fx_target_currency`, the converted totals double-count (`:388-392`, Note). |
| FX fields on PATCH (lock) | `deal_currency` (ISO choice), `deal_fx_target_currency` (**any 3 chars, no choices**, `models.py:282`), `deal_fx_rate` (decimal, 8dp; 1 source = N target), `deal_fx_rate_date`. Also newly writable: `status` (reset by the next stage move) and `stages` (JSON). |
| `GET …/projects/?quick=active\|delayed\|awaiting_approval\|unpaid&partner=<org id>` | An unknown `quick` is silently ignored. `quick` is evaluated in Python over the whole filtered queryset (`services.py:206-224`), which is fine at current scale. |

### Documents, collectors, access keys, auctions
| Endpoint | Notes |
| --- | --- |
| `GET /api/documents/admin/documents/{id}/activity/` | Paginated `{id, action, changes, at, actor, actor_name}`, newest first. **The CHANGELOG says `actor {id, name}`, but the real shape is flat**: `actor` (uuid\|null) plus `actor_name` (`documents/serializers.py:87-95`). Code wins. |
| `GET /api/auth/admin/collectors/summary/` | `{collectors, vip, active_30d, engaged}`. The roster list adds `last_activity_at` and `purchase_count`, with `?ordering=activity\|-activity\|purchases\|-purchases`. **Both are `null` on detail, create and PATCH** (`accounts/serializers.py:115-124`). |
| `GET /api/auth/admin/access-keys/?status=&collector=&expiring_soon=&search=` plus `…/summary/` | Rows are `{id, collector:{…}, status, is_expired, issued_at, expires_at, last_used_at, activity:{saved,holds,offers,requests,auction,logins}, created_at}`. **`status` is the stored value and lags**: a lapsed key still reads `active` until a login attempt. The `?status=` filter is computed, so show `locked` if `status==="locked"`, else `expired` if `is_expired`, else `active`. `is_expired` can be true on a locked key. |
| `PATCH /api/auctions/admin/auctions/{id}/` | **Lock**, plus any of `title, description, currency, starts_at, ends_at, terms, terms_required`. Only allowed while draft or scheduled; otherwise **400 with code `INTERNAL_ERROR`** (§3d). **No `starts_at < ends_at` check** on either create or update (no `validate()` in `auctions/serializers.py`). Changing the auction window **doesn't move its lots' windows**. |
| `PATCH /api/auctions/admin/lots/{id}/` | **Lock**, plus any of `lot_number, opening_amount, reserve_amount, low_estimate, high_estimate, premium_pct, currency, starts_at, ends_at, soft_close_sec`. Scheduled lots only (400 `INTERNAL_ERROR` otherwise). No cross-field checks (window, estimates). A duplicate `lot_number` returns 400 "This record already exists…" (IntegrityError path). |
| `POST /api/auctions/admin/registrations/{id}/reset/` | No body. Only `rejected → pending`; anything else is 400 `INTERNAL_ERROR` (§3d). |
| Auction → Sale automation | A won lot's close auto-creates a draft `Sale(source="auction", lot=<id>)`. Treat it as read-only in the FE lot flow and refresh the Sales desk. |

---

## 7. Choice coverage in `GET /api/options/`

Registry: `apps/*/apps.py`. I compared it against every `choices=` field in `apps/*/models.py`. **Severity: Should fix. Verified.**

| Field | In options? | Where |
| --- | --- | --- |
| Sale `source` (market/auction) | **Missing** | `sales/models.py:59-70`; `sales/apps.py:12-14` registers only status, payment and delivery |
| Gallery pricelist `status` (submitted/accepted/superseded) | **Missing** | `gallery/models.py:214-224`; not in `gallery/apps.py:20-28` |
| Pricelist line `availability` | **No choice set exists.** It's free text (≤60). The FE must decide whether to offer `catalog.availability_status` values as suggestions (owner question). | `gallery/models.py:252` |
| Gallery update kinds incl. `ask`, `withdraw` | Present (`gallery.update_kind`, registered from `KIND_CHOICES`) | `gallery/apps.py:22`, `models.py:161-173` |
| Project `status` | Present (`projects.status`) | `projects/apps.py:13` |
| Access key computed status | `accounts.access_key_status` is present and uses the same vocabulary (active/locked/expired). There's no separate computed field; see §6. | `accounts/apps.py:17` |
| `gallery.exhibition_service` | Present but **stale**: it registers the Python constant `SERVICE_CHOICES`, not the now-editable `ExhibitionServiceCatalogItem` table. Use `/portal/{token}/exhibitions/catalogue/` or the admin catalogue list instead. | `gallery/apps.py:26`, `exhibition_catalogue.py:67` |
| Other unregistered choices, not new but noted | Missing: `accounts` Collector `preferred_language` (`LANGUAGE_CHOICES`, `accounts/models.py:79-91`); `catalog` Artwork `source_type` (`catalog/models.py:130-138`); import batch `source`/`status` and import row `status` (`catalog/models.py:218-270`); `recommendations` Question `question_type` (`recommendations/models.py:123-132`); `accounts` AccessRequest `status` (`accounts/models.py:258-274`). | Verified |

---

## 8. Broken, unfinished, TODO; tests

- **TODO/FIXME grep:** none in `apps/`/`config/` outside tests and migrations. The only `NotImplementedError` is an
  abstract base (`core/filters.py:73`). Verified.
- **Effectively broken paths (Verified):**
  - The 18 lock-less PATCHes that 500 (§1).
  - Admin can't open a portal replacement image (§6 P1).
  - Anonymous portal PIN brute-force because reads aren't throttled (§4).
  - WebSocket under the shipped Dockerfile (§5).
- **Unfinished by design (Note):** approving `image`/`note`/`new`/`exhibition`/`invoice_*`/`status`/`ask` updates is a
  record of intent only; the admin follows through by hand (`gallery/services.py:202-205`, "Phase 16 … not built
  yet").
- **Unverified risk:** approving a portal `price`/`correction` update passes the free-form `payload` values straight
  into `ArtworkService.update` (`gallery/services.py:182-189`). A malformed value, e.g. non-numeric `price_amount`,
  could surface as a 500 rather than a 400. I didn't exercise it.
- **Tests:** not run. They need Postgres (settings hard-require it), which I was told not to set up. The CHANGELOG
  entries each claim "schema 0/0" (no drf-spectacular warnings). That's consistent with the schema generating, but
  not with its accuracy (§3c).
