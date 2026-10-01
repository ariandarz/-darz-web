# Deferred features — frontend implementation plan

**Written 2026-10-01.** Scope: the **eight** features that V1 left unbuilt because they needed an owner
decision, not because anything blocked them. Every one of their APIs is live on `darzmarket-api`
`development` @ `c2eb912` and verified against the generated schema while writing this plan.

This is a **plan, not a commitment** — nothing here is started. It exists so the owner can read what each
feature really costs, decide which to build, and hand the list to a developer.

**Status of these eight:** awaiting an owner decision. They are **not** V2 (that is `TASKLIST.md` § D —
Logistics, Library, Insights & Stories, the Social suite, which are settled out of scope). These eight are
live candidates.

> **Why they are still open, precisely.** Q-5 was put to the owner and answered *"use your
> recommendations."* The recorded recommendation was *"G-P5-11 and G-P25-2(a) yes (no visible change); the
> rest per owner."* So Phase 9a built exactly those two, and the recommendation deliberately declined to
> decide these eight. They have therefore **never been decided by anyone** — they are not "deferred by the
> client". See `V1_IMPLEMENTATION_PLAN.md` § 3j.

---

## 1 · The eight at a glance

| ID | Feature | Old-app UI to port? | API | Owner decision needed | Size |
| --- | --- | --- | --- | --- | --- |
| **G-P24-2** | "Your curated selection is ready" notice | ✅ **Yes — copy and markup exist** | `GET /catalog/selections/`, `POST …/{id}/seen/` | none (port it) | **S** |
| **G-P5-9** | Counter-offer display | ❌ **No old UI, no copy** | `OfferDetail.counter_amount/_currency` (read-only, already served) | **Yes — wording (Q-4)** | **S** |
| **G-P5-12** | Activity read-back on Profile | ✅ **Yes — feed + rules exist** | `GET /crm/activity/` | small: confirm the old exclusions still apply | **M** |
| **G-P13-1** | Push notifications opt-in | ✅ **Yes — full Settings card + copy** | `GET /notifications/vapid-public-key/`, `POST push/subscribe`, `unsubscribe` | **Yes — and there is no send endpoint yet** | **L** |
| **G-P5-5** | Withdraw offer / cancel viewing | ❌ **No old UI** | `POST /crm/requests/{id}/transition/` | **Yes — copy + policy** | **M** |
| **G-P5-4** | Archive a request/conversation | ⚠️ **Old app does something different** | `POST /crm/requests/{id}/archive/`, `collector_archived` | **Yes — model mismatch, see § 2.6** | **M** |
| **G-CLUB-3** | Club "Auction access" section | ✅ **Yes — old admin section + modal** | `POST /auctions/admin/auctions/{id}/invite-only/` | **Yes — it duplicates an existing screen** | **M** |
| **G-P25-2(b)** | Admin question-set editor desk | ✅ **Yes — old admin editor** | `/recommendations/admin/question-sets/` (+ `{id}/`, `{id}/activate/`) | none (port it) | **L** |

**Recommended order**, cheapest-and-safest first: **G-P24-2 → G-P5-9 → G-P5-12 → G-P5-5 → G-P25-2(b) →
G-CLUB-3 → G-P5-4 → G-P13-1.** Rationale in § 3.

Sizes are relative, not hours: **S** = one screen touched, no new route · **M** = one screen plus state and
tests · **L** = a new route/desk or a browser capability.

---

## 2 · Feature by feature

Each section gives: what it is · the old-app source to port (cited, per the `CLAUDE.md` two-sources rule) ·
the exact API · the frontend work · tests · what the owner must decide.

### 2.1 · G-P24-2 — "Your curated selection is ready" notice · **S** · no decision needed

**What it is.** When Darz curates a selection for a collector, the Market page shows an in-flow notice; the
collector taps it to view the selection, and it clears.

**Old app — the copy and markup already exist, so nothing is invented:**
- `app.html:8723-8724` — the box: `<div class="dz-notif-in" id="dzCurIn" role="button" tabindex="0">` with
  `<b>Your curated selection is ready.</b><i id="dzCurInB">Tap to view.</i>`
- `app.html:7267-7272` — the show rule: only on the **Market first page** (`tab==='market' && !currentId`),
  only when a batch is unseen; the `<i>` is replaced with
  `"<N> artworks have been curated for you by Darz."` Explicit comment (v769): the notice lives **only** as
  the in-flow box under the filters — *no floating fallback on other pages*.
- `app.html:10360` — dismiss writes the newest-seen timestamp and removes `.show`.

**API.** `GET /api/catalog/selections/` returns `CollectorSelectionSignal { id, name, changed_at, is_new }` —
`is_new` is the server's version of the old unseen check, so the old `localStorage` seen-timestamp is
replaced by `POST /api/catalog/selections/{id}/seen/`. The curated chip already reads
`/catalog/artworks/selections/` (`services.ts:216`), so only the signal + seen call are new.

**Frontend.** `CatalogueController` (or a small `SelectionSignalController`) reads the signal on Market
mount; render the `.dz-notif-in` box in the Market page above the grid, under the filters; tap → the existing
curated filter (`DZ.toggleCurated` equivalent) **and** fire `seen`. Reuse the `.dz-notif-in` CSS if the
reply-notice box already ported it — check `src/features/catalogue/catalogue.css` first and share one class.

**Tests.** Unit: `is_new` false → nothing rendered; true → box with the N-artworks copy; tapping fires `seen`
once and hides the box. E2E: stub a signal, assert the box on `/` only (not on `/artwork/:id`), tap, assert
the POST and that a reload keeps it hidden.

**Owner decision:** none. The copy is the old app's own.

---

### 2.2 · G-P5-9 — Counter-offer display · **S** · **needs wording (Q-4)**

**What it is.** When Darz counters a collector's offer, the collector currently **cannot see it**. The number
is already served to them and nothing renders it.

**Old app: there is no UI and no copy.** A full-text search of `app.html` for "counter" returns two hits,
both unrelated (a questionnaire step counter, a theme message). This is the one feature in this document
with **nothing to port**, which is exactly why it is Q-4.

**API — already served, no backend work:** `OfferDetail.counter_amount: string | null` and
`counter_currency` are **read-only** fields on the collector's own request detail
(`RequestCollector.detail`). The admin write side (`RequestTransition.counter_amount/_currency`) already
exists and the admin desk already uses it. So this is purely a display task.

**Frontend.** One meta row on the collector's request/chat detail, shown only when `counter_amount` is
non-null. Reuse the existing meta-row markup of that screen — do not introduce a new card.

**Tests.** Unit: null → no row; a value → one row with the served currency label (from `/api/options/`,
never a hardcoded map). E2E: stub a countered offer, assert the row.

**Owner decision — the wording.** The recorded recommendation was a single row reading
`Darz's counter · 11,000 USD`. The owner supplies the final words. Options to choose between:
- `Darz's counter · 11,000 USD` (recommendation)
- `Counter-offer from Darz · 11,000 USD`
- `Darz replied with 11,000 USD`

**Why I would build this first among the decisions:** right now a collector can make an offer and never see
the reply to it. That is a visible hole in the request loop, and the data is already on the wire.

---

### 2.3 · G-P5-12 — Activity read-back on Profile · **M** · tiny decision

**What it is.** Profile shows the collector their own activity. The frontend already **writes** activity
(`services.ts:384 logActivity`) and never reads it back; `src/features/profile/` has no Activity surface.

**Old app — the feed and its rules exist:**
- `app.html:7516-7545` — `dzActivityItems()`, and its **exclusion rules are the thing to port**, each with a
  recorded reason: `view` (passive, admin-only signal) · `save` (lives in the Saved tab) · `message` (lives
  in Messages) · auction kinds (live in Profile › Auctions). Activity = **market actions + Darz's replies**.
- Same function: accidental duplicates collapse on `kind|artwork|amount` within one hour; genuinely later
  actions stay separate.
- `app.html:7549-7551` — a single last-seen timestamp drives the Profile nav dot; it clears on opening the
  tab. Rendered at `app.html:9534, 9619, 9687, 9720`.

**API.** `GET /api/crm/activity/` (paginated) → `CollectorActivity { id, kind, artwork, metadata,
created_at }`. `kind` labels come from `ActivityKindEnum` via `/api/options/`.

**Frontend.** An `ActivityController` extending `ListController` (the house base-class rule — do **not**
hand-roll pagination), an `Activity.tsx` section in `ProfilePage`, with loading / empty / error through
`.dz-state`. Filter the served kinds with the old exclusion list, in one named helper with the reasons as
comments, so the rule is reviewable.

**Tests.** Unit: the exclusion filter (one case per excluded kind), the one-hour duplicate collapse, label
resolution from options. E2E: the Activity section renders, paginates, and shows the empty state.

**Owner decision.** Only this: keep the old app's exclusions (recommended — the Saved/Messages/Auctions tabs
all exist here too, so without them the feed duplicates three screens), or show everything the server sends.
The nav dot is optional and can be left out of a first cut.

---

### 2.4 · G-P13-1 — Push notifications opt-in · **L** · **needs a decision, and has a hard limit**

**⚠️ Read this first: there is no way to send a push.** The backend serves the VAPID key and stores
subscriptions, but it has **no push-send endpoint** (`TASKLIST.md` § D records "Notify collectors" as
having none). Building this collects subscriptions that nothing can use. **My recommendation is to not
build it until the send side exists** — otherwise the toggle promises alerts that cannot arrive.

**Old app — the whole Settings card exists, with exact copy** (`app.html:9900-9916`), a NOTIFICATIONS card
with four rows:
- `New arrivals` — "When fresh works are listed" (local toggle `nNew`)
- `Auction reminders` — "Before a lot you follow closes" (local toggle `nAuc`)
- `Offer & request updates` — "Replies on your offers and requests" (local toggle `nOffers`)
- `Push to this device`, whose sub-copy is state-dependent and worth porting verbatim:
  - on → `Alerts are on for this device`
  - iOS, not installed → `On iPhone: add to your Home Screen, open from there, then turn on`
  - supported → `Get push alerts on this device`
  - unsupported → `This browser does not support push notifications`
- `app.html:9824` `dzPushSupported()` = `serviceWorker in navigator && PushManager in window && Notification
  in window`; `app.html:11450-11462` `enablePush` / `disablePush`, the latter toasting
  `Notifications off for this device`; `app.html:12155` registers `/sw.js` with `updateViaCache:'none'`.

**API.** `GET /api/notifications/vapid-public-key/` → `POST /api/notifications/push/subscribe/` with
`PushSubscribe { endpoint, p256dh, auth, name, platform }` → `POST …/push/unsubscribe/`.

**Frontend.** A **service worker** is new ground for this repo: `public/sw.js`, registration on boot, a
`PushController` holding permission + subscription state, and the Settings card. Note the first three rows
are *local* preferences in the old app — port them as such; only "Push to this device" talks to the server.

**Tests.** Unit: the four copy states from a mocked capability matrix; subscribe payload shape; unsubscribe.
E2E: the card renders each state (push APIs stubbed); the toggle posts once. A real end-to-end push cannot be
tested without the send endpoint — say so in the PR rather than implying coverage.

**Owner decision.** Build now and accept that nothing can be sent, or wait for the backend send endpoint
(recommended). If building now, confirm the three local toggles should persist per-device as the old app did.

---

### 2.5 · G-P5-5 — Withdraw an offer / cancel a viewing · **M** · **needs copy and a policy**

**What it is.** A collector can make an offer or request a viewing and then has no way to take it back.

**Old app: no such control.** Searching `app.html` for withdraw/cancel returns only artwork *status* words
(`withdrawn` as an availability state) and the auction terms text — no collector action. So the control and
its copy are new, which is why it needs the owner.

**API.** `POST /api/crm/requests/{id}/transition/` with `CollectorRequestTransition { to_status, note }`.
The collector's own request already carries `allowed_transitions`, so **the UI must offer exactly what the
server allows** rather than a hardcoded list — same rule the admin desk follows.

**Frontend.** An action on the collector's request detail (and possibly the chat thread header), gated on
`allowed_transitions`; a `ConfirmDialog`-style confirmation; optimistic-lock rules do not apply (this is a
POST action, not a versioned PATCH) — but re-read the request after it succeeds.

**Tests.** Unit: the action appears only for the statuses the server allows; the posted body; the re-read.
E2E: withdraw an offer, assert the status word changes and the action disappears.

**Owner decisions.**
1. **Copy** for the action and its confirmation — e.g. "Withdraw this offer" / "Cancel this viewing", and
   what the confirmation says.
2. **Policy:** may a collector withdraw an offer **after Darz has countered it?** This interacts with
   G-P5-9 — if both are built, a collector could see a counter and withdraw. The server's
   `allowed_transitions` is the authority; confirm it matches the intent you want.

---

### 2.6 · G-P5-4 — Archive a request / conversation · **M** · **model mismatch, read carefully**

**What it is.** A durable, per-request archive so a collector's list does not grow forever.

**⚠️ The old app does something different, and this is the finding that matters.** The old app has no
per-request archive button. What it has is `dzChatCutoff()` (`app.html:7142`): a **theme-driven, global**
cutoff — `chatRenew` policy plus a `chatArchiveBefore` timestamp set by the gallery in Admin → App Design,
hiding everything older than that date for everyone. The backend instead offers a **per-request, per-
collector** flag: `POST /api/crm/requests/{id}/archive/` with `RequestArchive { archived: boolean }`, read
back as `RequestCollector.collector_archived`, listed with `?archived=`.

So this is **not a port** — it is a new model. Per the `CLAUDE.md` hard constraint that is a flag for the
owner, not a decision for a developer. Three ways to go:

| Option | What it means |
| --- | --- |
| **A — build the backend's model** (recommended if you want it) | A collector archives individual threads; an "Include archived" view, mirroring the admin chat's existing archive/restore. Consistent with the admin side, which already works this way. |
| **B — port the old model instead** | A gallery-set global cutoff. Needs a theme key the new backend does not have — so it needs backend work, not just frontend. |
| **C — leave it unbuilt** | The collector list grows. Acceptable while volumes are small. |

**Frontend (option A).** Archive/restore on the request row and detail, an "Include archived" toggle on the
list, `?archived=` in `RequestController`. The admin chat already has exactly this pattern
(`services.ts:313 adminArchiveMessage`) — follow it rather than inventing a second idiom.

**Tests.** Unit: the archived request leaves the default list and returns with the toggle; the posted body.
E2E: archive, assert it disappears, toggle, assert it returns, restore.

---

### 2.7 · G-CLUB-3 — Club "Auction access" section · **M** · **needs a decision: it may be redundant**

**What it is.** A section in the admin Club desk for granting named collectors access to invite-only
auctions.

**Old app — the section and its modal exist** in the old admin (`darz-studio.html`):
- `:33665` — the Club desk's `Auction access` section header (the old eyebrow style).
- `:37289-37292` — the modal `Auction access — <auction title>`, with a `Save auction access` button
  (`clubAucSave`).
- Collector side already handled: `app.html:3463` `aucVisible()` hides an auction unless the collector's key
  is in its private-key list — the new app already implements this behaviour.

**API.** `POST /api/auctions/admin/auctions/{id}/invite-only/`. **This endpoint is already bound and already
has a UI** — the auction page manages invite-only today. `ClubPage.tsx` exists and shows selections.

**The decision.** This would be a **second place to do a thing that already works**, moved next to the
Club's collector lists rather than onto the auction. Build it if you manage access collector-first ("which
auctions can this collector see?"); skip it if you manage it auction-first ("who can see this auction?"),
which is what exists. **My recommendation: skip**, and revisit if the owner finds themselves going
auction-by-auction to grant one collector access.

**Frontend if built.** A section in `ClubPage.tsx` listing auctions with an access editor per auction; reuse
`Picker` for collector selection and the existing invite-only call. No new service method needed.

---

### 2.8 · G-P25-2(b) — Admin question-set editor desk · **L** · no decision needed

**What it is.** An admin desk to write and activate the questionnaire's question set. Today the collector
questionnaire **runs on the served set** (built in Phase 9a, G-P25-2(a)) but the set can only be changed in
the database.

**Old app — the editor exists** in the old admin (`darz-studio.html:30028-30045`): the question bank editor,
with `QB_ADMIN_DEFAULT` as the built-in bank, a `custom` flag that is true when `qbQuestions` is set, and the
documented rule that `qbQuestions=null` makes the app fall back to its own hardcoded copy — which is exactly
the fallback precedence the new frontend already implements (served set → theme → `QB_DEFAULT`). Intro copy
at `:7297` (`qbTitle`/`qbHead`/`qbIntro`/`qbPrivacy`/`qbThanks`).

**API.** `GET/POST /api/recommendations/admin/question-sets/`, `GET/PATCH /…/{id}/` (versioned — so
`expected_version` is **required** on the PATCH since backend #75), `POST /…/{id}/activate/`.

**Frontend.** A new owner-or-team desk: route in `src/routes.tsx` (lazy, as every admin page is), a
`DeskPage` + `DeskList` list of sets, an editor for `title`/`intro`/questions (`prompt`, `question_type`,
`options`, `order`), activate with a `ConfirmDialog`, `ConflictBanner` for the 409, `adminNav` entry.

**Known gaps to carry as flags, not fixes** (both recorded in Phase 9a):
- The served `Question` has **no section name**, so a served step's eyebrow is blank. Inventing one is new
  copy; giving it one needs a **backend field**.
- The served question types have **no multi-select** ("Select all"), so every served choice step is
  single-select; the old bank's multi-select steps exist only in the built-in fallback.

**Tests.** Unit: the editor's payload, `expected_version` on PATCH (extend `optimisticLock.test.ts` — the
wire format is pinned there for every locking call), activate switching the active set. E2E: create, edit,
activate, and assert the collector questionnaire then serves the new set.

---

## 3 · How to run this

**One feature per branch, one PR each** — `post-v1/<slug>` (e.g. `post-v1/curated-notice`). Do not batch
them; they are independent and the owner may want only some.

**Every PR carries the full gate** (`npm run typecheck && npm run lint && npm run format:check &&
npm run test && npm run build`, plus the E2E tier) and, per `CLAUDE.md` rule 5, **a screenshot of the
changed screen** compared against the old app's capture or the rendered markup — source-reading alone is not
enough. Stub additions go in the same PR as the feature.

**Recommended order and why:**

1. **G-P24-2** — pure port, copy exists, no decision. Visible win.
2. **G-P5-9** — closes a real hole (a counter-offer the collector cannot see); needs only one line of copy.
3. **G-P5-12** — port with clear rules; adds the Profile surface the write path already feeds.
4. **G-P5-5** — completes the request loop with G-P5-9; needs copy and one policy answer.
5. **G-P25-2(b)** — largest pure port; removes a database-only workflow.
6. **G-CLUB-3** — only if the owner wants collector-first access management.
7. **G-P5-4** — only after the owner picks a model (§ 2.6).
8. **G-P13-1** — last, and ideally not until the backend can actually send a push.

**Before the first one starts:** regenerate `src/api/schema.d.ts` against `darzmarket-api` @ `c2eb912` (the
committed copy is from 2026-09-25 and predates the eight merged fix PRs). Verified while writing this plan:
the regeneration is **non-breaking** — identical 323-operation surface, no new type errors, 837 unit tests
still pass.

## 4 · Owner decisions this plan needs

| # | Decision | Blocks | Recommendation |
| --- | --- | --- | --- |
| 1 | Which of the eight to build at all | everything | 1–4 yes; 5 if you want it; 6 skip; 7 needs a model; 8 wait |
| 2 | **G-P5-9** counter-offer wording (Q-4) | G-P5-9 | `Darz's counter · 11,000 USD` |
| 3 | **G-P5-5** copy, and may a collector withdraw after a counter? | G-P5-5 | follow the server's `allowed_transitions` |
| 4 | **G-P5-4** which archive model — A (per-request), B (global cutoff, needs backend), C (none) | G-P5-4 | **A** |
| 5 | **G-CLUB-3** collector-first access management, or leave it auction-first? | G-CLUB-3 | leave it; skip the feature |
| 6 | **G-P13-1** build before a push-send endpoint exists? | G-P13-1 | **No** — wait |
| 7 | **G-P5-12** keep the old exclusions (view/save/message/auction)? | G-P5-12 | **Yes** |

Anything not decided here stays unbuilt. A feature the owner declines should be recorded the way
`TASKLIST.md` § D records the V2 set — as a closed decision, so it stops resurfacing as open work.
