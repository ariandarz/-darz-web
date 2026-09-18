# Plan — backend Phases 23-35: what this frontend can build now

**Status:** Step 1 DONE (2026-09-18) · Step 2 awaiting the go-ahead ·
**Created:** 2026-09-18 ·
**Sources read:** `ariandarz/darz-backend-api` @ `development` `12988db` ·
`ariandarz/darzstudio.art` @ `development` (`app.html`, `design/market-app/`) ·
this repo @ `development` `8e2a767`.

This is the working contract, the way `docs/PHASE_5_PLAN.md` was. Gaps found on the API side are in
`docs/PHASE_24_35_API_GAPS.md` and **no backend change is proposed for any of them** — the owner's
standing instruction is to build the UI around the gap and document it.

---

## 1 · What changed on the API

The local clone was 24 commits behind. `development` moved `3801786` → `12988db`, merging backend
**Phases 23, 24, 25, 27, 28, 29, 30, 31, 32, 33, 34, 35**. The backend's own `docs/TASKLIST.md` is
dated 2026-09-11 and does not describe any of it, so the inventory below was read from `urls.py`,
views and serializers rather than from its docs.

**191 declared routes now exist. This frontend calls about 20 of them.** The backend is far ahead;
the constraint on what to build next is the *design*, not the API.

Newly available and **collector-facing** (everything else added is an admin desk):

| Backend phase | Endpoint | Frontend today |
|---|---|---|
| **34** | `POST /api/auth/access-requests/` (`AllowAny`) | `LoginPage` shows a **factual note instead of a form**, because there was no endpoint |
| **24** | `GET /api/catalog/artworks/selections/` | nothing — a collector with grants sees **none of them** |
| **25** | `GET`/`POST /api/recommendations/questionnaire/` | nothing; `features.questionnaire` is off in v0.1 |
| **32** | `GET /api/app-theme/` (`AllowAny`) | nothing |
| 30 | `/api/auth/membership/redeem/` (pre-existing) | `AuthService.redeemMembership` exists, no UI; `features.membership` off |
| 13 | push subscribe/unsubscribe | **still blocked** — VAPID public key unpublished (G-P13-1) |

Admin-side, backend Phases 23 and 27-33 add the Collectors / Collector Activity / Dashboard /
Memberships / Team-logins / App-Design / Projects / audit-log / access-key desks. That is the
frontend's **Phase 11b**, it is large, and it is out of scope for this plan — see §5.

---

## 2 · Findings that change what should be built

### 2.1 The "Request access" form is an exact match — and it is the one flagged stub in v0.1

`LoginPage.tsx`'s own header says it: *"'Request access' has no endpoint, so it shows a factual note
instead of a fake form."* That is now false.

The old app's `submitRequest` (`app.html:2554-2566`) sends
`{name, email, phone, city, why, referral_source, ref_code, client_req_id}`. The backend's
`AccessRequestCreateSerializer` accepts `name, email, phone, city, why, referral_source, ref_code`.
Field for field, with one exception (`client_req_id`, G-P34-1). Phase 34 was evidently built from
this form.

The markup and copy are equally settled (`app.html:2544-2552`): heading **"Request access"**, the
sub-line "darzmarket.art is a private collector network. / Tell us a little about you and Darz will
be in touch.", fields **First name** · **Email or phone** · **City · optional** · **What you
collect · optional** · **How you heard of Darz · optional**, CTA **Send request**, footer
"← Back to private access". On success the card is replaced by heading **"Request received"** and
"Thank you, `<first name>`. Darz will be in touch." with a **Close** button.

Validation copy is in the same function and is exact: `"Enter your first name."` and
`"Add an email or phone so Darz can reach you."`

**One field, two backend fields.** The old form has a single "Email or phone" input and splits it on
the `@` character — `var email=/@/.test(em)?em:'', phone=/@/.test(em)?'':em;` (`app.html:2558`).
That is the approved behaviour and it maps cleanly onto the backend's separate `email`/`phone`.
Owner decision **D2**.

**`ref_code`** comes from `?ref=` on the URL or `localStorage.darz_ref` (`app.html:2560`). The
backend accepts it. Porting it keeps referral attribution working.

### 2.2 The curated set is a filter chip, **not** the section a first reading suggests

This one nearly went wrong. `app.html:3432` describes *"kind 'selection' → a 'Private — for you'
section above the Market catalogue"*, which reads like a clear port target. It is not — 5,000 lines
later, at `app.html:8890`:

> *v669 · the old separate "Private selection" homepage section is **REMOVED** — the curated set is
> now a smart filter ("Curated for You") inside the normal catalogue, so the homepage layout is
> unchanged. The container is kept but always emptied.*

So the shipped behaviour is a **"Curated for You" chip sitting with the other filters**
(`app.html:8583-8591`, CSS `:278`, "never a separate section"), and when it is on, the base set
becomes the collector's curated works (`:8871`). Building the section would have shipped something
the old app deliberately deleted — the mirror image of CLAUDE.md's warning about porting a proposal
as if it were shipped.

This maps cleanly onto the API: chip off → `GET /artworks/`, chip on → `GET /artworks/selections/`.
The backend guarantees the two sets never overlap (`ArtworkService.selection_queryset` docstring:
*"a work here never also appears in the main catalogue response"*), which is exactly the old
`club_items` behaviour.

Two pieces of the old feature have no API behind them — the selection's **name** for the chip label
(G-P24-1) and the **"Your curated selection is ready."** notice, which has no change signal to key
on (G-P24-2).

### 2.3 A conflict between the design package and `app.html` that only the owner can settle

CLAUDE.md records an owner instruction (2026-09-11): *where the package and the older `app.html`
reading differ, the package wins.*

The package's `SCREENS.md` §01 describes the gate's second method as *"name + email/phone sign-up
that **generates a password**"*. **This backend cannot do that** — it issues collector keys, and an
access request goes to an admin review queue where a human approves it (`AccessRequestService`:
approve *"mints a real Collector + AccessKey in one action"*). There is no password generation
anywhere in `apps/accounts/`.

`app.html`'s shipped **"Request access"** flow, by contrast, matches the new API exactly.

So the "package wins" rule points at a screen that cannot be built, while the older source points at
one that can and that the backend was clearly designed against. `LoginPage.tsx` already flags this:
*"The name + email/phone sign-up that generates a password … is not ported: the API issues keys, it
does not generate passwords."* Owner decision **D4** — I am not overriding a standing instruction
on my own.

### 2.4 The questionnaire is specced but not buildable as a faithful port

The design package gives it a full screen (§13) and two captures. But the questions are
**owner-editable** in the old app (`qbQuestions`/`qbIntro`), and the API publishes only *answers* —
nothing serves the question set (G-P25-2). A port would have to hardcode the questions, losing the
property that makes the feature what it is. It is also behind `features.questionnaire`, which is off
in v0.1. Owner decision **D7**; my recommendation is to wait.

---

## 3 · Proposed work, in order

Both increments are **v0.1-scope collector surfaces** and both are faithful ports with the source
lines already identified. Neither needs a backend change.

### Step 1 — "Request access" (backend Phase 34)

Replace `LoginPage`'s stub note with the real form.

- The `request` view of the gate card gets the five fields, exact labels, placeholders and
  `· optional` markers from `app.html:2546-2550`, reusing the `Input` component and the gate's
  existing classes — **no new CSS**, same as the team sign-in.
- Submit → `POST /api/auth/access-requests/` through a new `AuthService.requestAccess()`, with the
  `@`-test split (D2), `ref_code` from `?ref=`/`localStorage` and `client_req_id` (D3).
- Success replaces the card with the "Request received" panel, verbatim.
- Validation strings verbatim; the backend's own 400 messages surface on the `.e` line.
- Tests: the transport (endpoint, body, the `@` split both ways, the ref-code fallback chain) in
  `src/api/client.test.ts`, the file's established pattern.
- Verified live against the local backend and screenshotted at 390×844 and 1440×900, per CLAUDE.md
  rule 5.

**Size:** one component view, one service method, ~4 tests. Small.

### Step 2 — "Curated for You" chip (backend Phase 24)

- The chip ports `app.html:8583-8591` into the catalogue toolbar, with `.dz-curl` and the v669
  styling at `:278`; it is a filter, never a section (§2.2).
- On → `CatalogueController` sources from `/artworks/selections/` instead of `/artworks/`.
- The chip is **hidden entirely when the collector has no grants** — an empty curated filter is not
  a state the old app could reach, since a collector with no `club_items` never saw the chip.
- Label always "Curated for You" (G-P24-1, D6). Notice not ported (G-P24-2, D5).
- Tests: controller-level, that the source endpoint switches and that no-grants hides the chip.

**Size:** one chip, one controller branch. Small-to-medium; the risk is in `CatalogueController`'s
existing filter/sort state, not in the chip.

### Not proposed now

**Questionnaire** (§2.4) · **App Design theming** (Phase 32 — large, owner-facing, and it interacts
with `ThemeController`, which is settled design; deserves its own plan) · **push** (G-P13-1, still
blocked) · **membership redeem** (flag off in v0.1; the service method already exists, so it is
cheap whenever the owner wants it) · **auctions Phase 35** (auctions are hidden in v0.1) ·
**admin desks** (§5).

---

## 4 · Owner decisions needed before I start

| | Question | My recommendation |
|---|---|---|
| **D1** | Which steps, in what order? | **Step 1, then Step 2.** Step 1 closes a stub the code itself flags, is exactly specified, and is the smallest. |
| **D2** | "Email or phone": port the old single field + `@` split, or show two fields to match the backend? | **Port the single field.** It is the approved design and the shipped behaviour; the split is one line. |
| **D3** | Send `client_req_id` even though the backend ignores it (G-P34-1)? | **Send it.** Harmless, forward-compatible, and it means the day the backend adds dedupe the client already complies. |
| **D4** | Package §01 says the second gate method generates a password; the backend cannot. Confirm `app.html`'s "Request access" is the port target, overriding "the package wins" here? | **Confirm.** The package describes the pre-API app; the rule cannot require a screen the API makes impossible. Your call to make, not mine. |
| **D5** | "Your curated selection is ready." notice has no API signal (G-P24-2). | **Omit it.** A `localStorage` heuristic would be invention, and would misfire when a work leaves the set. |
| **D6** | Chip label can never be the selection's name (G-P24-1). Accept the generic label? | **Accept.** The alternative is a backend change. |
| **D7** | Build the questionnaire now? | **No** — not faithfully portable while the question set is unpublished (G-P25-2), and the flag is off in v0.1. |
| **D8** | G-P34-2: the public access-request endpoint has **no rate limit**. Raise with the backend? | **Yes** — the one item here I would ask the backend to fix rather than design around. Nothing the frontend does substitutes for it. |

---

## 5 · Phase 11b — the admin desks, deliberately deferred

Backend Phases 23 and 27-33 deliver Collectors, Collector Activity, Dashboard, Memberships,
Team-logins, App Design, Projects/Data-Health/Import, the audit log and access-key extend/revoke —
a whole admin panel's worth of API, none of which has frontend UI.

That is a much larger body of work than this plan, it needs its own design pass against the old
admin (`darz-studio.html`, not `app.html`), and the frontend currently has exactly **one** admin
screen plus the scaffolding bar from the team sign-in. It should get its own plan once the collector
surfaces above are settled. Recorded in `docs/TASKLIST.md` under Phase 11b.

---

## Progress log

_Append one entry per step as it merges. Newest last._

- **2026-09-18 — plan written**, waiting on the owner's confirmation and the D1-D8 answers. Nothing
  implemented.
- **2026-09-18 — owner answered.** D4: keep the credential model as it is — first name + access key
  for a collector, email + password for the team — and **do not** build the package's
  password-generating sign-up; `app.html`'s Request access is the target. D2: **keep the single
  "Email or phone" field** with the old `@` split. D8: **raise the missing rate limit** with the
  backend. D3, D5, D6, D7 taken as recommended.
- **2026-09-18 — Step 1 implemented and verified live.** `LoginPage`'s request view is the real
  form: the five fields with their `· optional` markers, both validation strings, and the "Request
  received" panel, all verbatim from app.html:2544-2565. `AuthService.requestAccess()` posts to
  `/auth/access-requests/`; the `@` split, the `?ref=`/`darz_ref` chain and the `client_req_id` live
  in `features/auth/accessRequest.ts` as pure functions so they are testable without a DOM renderer.
  `Input`'s `label` widened from `string` to `ReactNode` (the marker is inline markup) — extended,
  not bypassed, per CLAUDE.md rule 2.
  Verified against the local backend brought up to `12988db` (10 migrations applied, server
  restarted — the old process was serving pre-Phase-34 code with `--noreload`): every label,
  placeholder and string matches at 390×844 and 1440×900; the two validation messages fire in the
  old order; a submission with an email lands `email` set and `phone` empty, one with a phone number
  lands the reverse, `?ref=live-check` is captured as `ref_code`, and all three optional fields
  round-trip. 137 tests (was 126), 11 added.
