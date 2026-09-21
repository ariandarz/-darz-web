# API gaps — backend Phases 23-35

What the newly-merged backend phases do **not** give the frontend, found by reading
`ariandarz/darz-backend-api` @ `development` `12988db` (2026-09-18) against the old app's shipped
behaviour in `ariandarz/darzstudio.art` @ `development`.

Same rule as `docs/PHASE_5_API_GAPS.md` and the owner's standing instruction: **no backend change is
made for any of these.** The UI is built around the gap and the gap is recorded here.

Ids are `G-P<backend phase>-<n>`.

---

## Phase 34 — public "Request access"

`POST /api/auth/access-requests/` · `AllowAny` · 201 `"Request received."`
(`apps/accounts/views.py::access_request_create`)

The field set is an exact match for the old app's form — `name`, `email`, `phone`, `city`, `why`,
`referral_source`, `ref_code` (`apps/accounts/serializers.py::AccessRequestCreateSerializer`) are
precisely what `submitRequest` sends (`app.html:2554-2566`). Two things it drops.

| Id | Gap | What the frontend does |
|---|---|---|
| **G-P34-1** | **Also raised in `darz-backend-api` #28**, as the smaller half. **No `client_req_id` / no dedupe.** The old app sends one (`app.html:2559`, `'ar_'+…`) precisely because it queues submissions over a hostile network; `AccessRequestService.create` is a plain `objects.create` with no uniqueness, and DRF drops the unknown field silently. A double-tap, a reload mid-submit, or a queue resend creates **two pending rows** for one person. The backend already solved this for `POST /api/crm/requests/` (G-P5 `client_req_id`, 201-vs-200 replay), so the pattern exists — it just is not applied here. | Send `client_req_id` anyway (forward-compatible, ignored today — owner decision D3) and disable the submit button while in flight, which narrows but does not close the window. The duplicate lands in the admin review queue, where a human sees two identical rows. |
| **G-P34-2** | **Raised with the backend 2026-09-18 as `ariandarz/darz-backend-api` issue #28** (owner decision D8). **No rate limit on a public unauthenticated write.** `DEFAULT_THROTTLE_CLASSES` is unset globally (`config/settings.py:193-197` says so explicitly — only `gallery_portal` has a scoped rate), and neither the view nor the URL adds one. Anyone can POST this endpoint in a loop and fill the review queue. | Nothing the frontend can do — a client-side guard is not a rate limit. **Flagged for the backend owner**; this is the one gap here worth fixing server-side rather than designing around. |

---

## Phase 24 — curated selections ("Curated for You")

`GET /api/catalog/artworks/selections/` · `IsCollectorPrincipal` ·
`ArtworkSelectionSerializer` = the collector artwork shape plus `visibility`.

The backend deliberately replaced the old system's **named** selection (`club_items`, a JSON
`artwork_ids`/`keys` blob per named selection) with a flat per-`(artwork, collector)` grant
(`apps/crm/models.py::ArtworkSelectionGrant`). That is a cleaner model, and it costs two things the
old UI used.

| Id | Gap | What the frontend does |
|---|---|---|
| **G-P24-1** | **No selection name on the collector endpoint.** The old chip labels itself from the selection's own name, falling back to the generic string only when there isn't one (`app.html:3458`: `return (s[0]&&s[0].name)||'Curated for You'`). **Re-checked 2026-09-18 against backend Phase 35, and the gap is narrower than first recorded — still open.** Phase 35 added `crm.CollectorSelection` (`{name, note, artworks, collectors}`, admin-managed, syncing the underlying `ArtworkSelectionGrant` rows), so a name now *exists* in the data. It is just not published to the collector: `ArtworkSelectionSerializer` is `ArtworkCollectorSerializer` + `visibility` and nothing else, and one grant can legitimately be wanted by several named selections, so there is no single name to attach even in principle without the backend choosing one. | Unchanged — the chip always reads **"Curated for You"**. Still a real (small) loss of fidelity, but the fix is now a serializer field rather than a model change. Owner decision D6. |
| **G-P24-2** | **No change signal, so the "ready" notice has nothing to key on.** The old app shows "Your curated selection is ready. · Tap to view." once per **new batch** (`app.html:8751`, checked by `dzCuratedNotifCheck` :3079, dismissal marks the batch seen :10386), keyed on `club_items.updated_at`. There are no batches here, and the collector-facing `ArtworkSelectionSerializer` does not expose the grant's `created_at` at all — only the artwork plus `visibility`. The frontend cannot tell *that* the selection changed, let alone when. | The notice is **not ported** (owner decision D5). Inventing a client-side heuristic — remembering a count or an id set in `localStorage` — would be a new behaviour, not a port, and would fire wrongly whenever a work leaves the set. Recorded rather than faked. |

---

## Phase 25 — collector questionnaire

`GET`/`POST /api/recommendations/questionnaire/` · `IsCollectorPrincipal`
(`apps/recommendations/views.py::my_questionnaire`)

| Id | Gap | What the frontend does |
|---|---|---|
| **G-P25-1** | **`GET` 404s for a collector who has never submitted.** The handler is `get_object_or_404(CollectorQuestionnaireResponse, collector=collector)`. Never-answered is the *normal first-run state* for every collector, not an error, so the screen's own opening state arrives as a 404 that is indistinguishable at the transport layer from a genuinely missing resource. | Treat 404 on this one endpoint as "no answers yet" and render the intro. That means special-casing a status code that the client cannot otherwise distinguish from a real error — noted so it is a deliberate choice and not a silent swallow. |
| **G-P25-2** | **The questions themselves are not served.** The old app's questionnaire is owner-editable — the questions and the intro live in `qbQuestions` / `qbIntro` (design package `SCREENS.md` §13), and a live-synced copy goes to Admin → Collectors. The API stores and returns *answers*; nothing publishes the question set. | The question set would have to be hardcoded in the frontend, which breaks the old app's owner-editability. This is the main reason the questionnaire is **not** proposed for this round (owner decision D7). |

---

## Phase 13 — web push (unchanged, still blocked)

| Id | Gap | Status |
|---|---|---|
| **G-P13-1** | **The VAPID public key is still not published by any endpoint.** `VAPID_PUBLIC_KEY` exists as a setting (`config/settings.py:359`) and is used only for sending; grepping `apps/` finds no reference outside settings and tests. A browser cannot call `pushManager.subscribe()` without it. | Push opt-in stays `[!]` in `docs/TASKLIST.md`. Re-checked 2026-09-18 against `12988db` — unchanged since the last check. |
