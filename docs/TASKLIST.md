# Darz Market Web — Frontend Task List (source of progress truth)

**Last updated:** 2026-08-28 · **Current focus:** Phase 1 complete (scaffold). Next up: **Phase 2 —
design system tokens/components from the approved design guide.**

> **Status legend:** `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked
> **How to use this file:** when you pick a task, set it `[~]` and update *Current focus* above.
> When you finish it, set `[x]`, add a 3-line entry to `../CHANGELOG.md`, and move focus to the next.
> A blocked task is `[!]` with a one-line reason. This file + `CLAUDE.md` are how any new session
> resumes exactly where we stopped — keep it honest and current.

**Hard constraint (owner, 2026-08-28):** this is a **faithful port** of the old DarzStudio app's
already-approved design and behavior — not a redesign. Every UI/UX decision must trace back to
`../DarzStudio`'s `DARZ_DESIGN_GUIDELINE.md` + `docs/design/DESIGN_SYSTEM.md` (the approved spec)
**and** `app.html`/`darz-studio.html` (the real, already-shipped implementation) — both together,
never one without the other. Do not invent new patterns, copy, or structure. See `CLAUDE.md` for the
full explanation and exact file paths.

**Stack (decided):** React + TypeScript + Vite, component-based. API access via a typed client
generated from `darzmarket-api`'s OpenAPI schema (live-fetch from a locally-running backend — see
`CLAUDE.md`). Component/feature boundaries should mirror the old app's real structure
(`DarzStudio/docs/getting-started/PROJECT_STRUCTURE.md`), not an arbitrary React convention.

**Cross-repo note:** several phases below are blocked on new backend work tracked in
`darzmarket-api/docs/TASKLIST.md` (Phases 10-17 there) — the old app has features (Saved, Auctions,
Gallery Portal, Memberships, Marketing Hub, AI Tagging, Document Builder, Accounting) that the
current backend (V1 core, Phases 1-8) doesn't support yet. Each phase below states its backend
dependency explicitly; don't start a blocked phase's real UI work until its backend phase lands —
build against the real API, not a guessed shape.

---

## Phase 1 — Project scaffold  ✅
- [x] Vite + React + TypeScript scaffold (`npm create vite@latest -- --template react-ts`)
- [x] Separate git repo at `/Users/arya/Work/Projects/darzmarket-web`, local only (no GitHub remote
      yet — owner connects it when ready, same workflow as the backend: owner pushes/merges)

## Phase 2 — Design system
- [ ] Read `DarzStudio/DARZ_DESIGN_GUIDELINE.md` + `docs/design/DESIGN_SYSTEM.md` fully — confirm
      which one is canonical/current vs. supplementary before treating either as final
- [ ] Read `docs/design/VOICE_AND_COPY.md` + `DARZ_TRANSLATION_GLOSSARY.md` — copy/tone rules apply
      too, not just visuals
- [ ] Seed design tokens (palette, type scale, spacing) exactly as specified — no substitutions
- [ ] Base component library (buttons, inputs, cards, etc.) matching the old app's real components
      (cross-check against `app.html`'s actual markup/classes, not just the guideline's description)
- [ ] ESLint/Prettier config, ADR-light folder conventions

## Phase 3 — Typed API client + auth
- [ ] Generate TS types from `darzmarket-api`'s live `/api/schema/` (backend running locally via
      `docker compose up` + `runserver`) — see `CLAUDE.md` for the exact command
- [ ] Thin API client wrapper (base URL, auth header injection, envelope unwrapping — matches
      `apps.core.responses`'s `{success, data, message, timestamp}` shape)
- [ ] Auth/session handling for both principals: team login (`/api/auth/team/login/`) and collector
      login (`/api/auth/collector/login/`) — JWT storage, refresh, the `principal` claim distinction
- [ ] `GET /api/options/` integration — populate every dropdown/select from this, never hardcode a
      label lookup (this endpoint exists specifically so the frontend doesn't have to)

## Phase 4 — Collector: catalogue
Matches backend V1 exactly as it exists today — no search/sort/"Curated for You" personalization yet
(those need backend work not yet planned; don't build UI for filters the API can't serve).
- [ ] Catalogue browse (list + pagination, matching `CustomPagination`'s real response shape)
- [ ] Filters: artist, availability_status, price range, medium, tag (`ArtworkService.apply_filters`
      — these 5 and only these 5 exist today)
- [ ] Artwork detail page
- [ ] Artist list/detail pages

## Phase 5 — Collector: requests + activity
Matches backend V1's `crm` app exactly (8 request kinds, per-kind `detail` shapes).
- [ ] Request creation UI per kind: information/price/availability/hold/offer/viewing/purchase/message
      — each kind's `detail` shape is different, see `apps.crm.serializers.DETAIL_SERIALIZERS`
- [ ] Collector's own request list/detail (`GET/POST /api/crm/requests/`)
- [ ] Activity self-logging (`POST /api/crm/activity/`) — kind is now a closed set
      (`view`/`save`/`search`/`login`, see `ChoiceRegistry['crm.activity_kind']`)

## Phase 6 — Collector: saved/favorites  `[!]` blocked on backend Phase 10 (darzmarket-api)
- [ ] Save/unsave button + saved-items list UI, once the backend endpoint exists

## Phase 7 — Admin: catalog/crm/sales
Matches backend V1 exactly — the only admin surfaces that currently exist.
- [ ] Catalog CRUD (Artist/Artwork/ArtworkImage) — includes the multipart image upload flow
- [ ] Unified CRM request feed (filterable by kind/status/assignee) + transition actions
- [ ] Sales CRUD + transition/payment/delivery-status actions
- [ ] Respect the optimistic-lock pattern everywhere (`expected_version`, handle 409s in the UI)

## Phase 8 — Collector: auctions  `[!]` blocked on backend Phase 11 (darzmarket-api)
Old app's largest single feature (event pages, live server-authoritative bidding, paddle
registration, outbid/won/lost/closing notifications, results archive). Do not start real
implementation until the backend phase's real-time delivery mechanism (WebSocket vs. polling) is
decided and built — the frontend architecture depends on that choice.
- [ ] Event/lot pages, live bid display, place-bid UI (proxy/max), paddle registration flow
- [ ] Notification UI (outbid/won/lost/closing)
- [ ] Results archive view

## Phase 9 — Collector: profile, questionnaire, chat, settings/membership
- [ ] Profile view/edit (partially supported today via `Collector.preferences` JSON — confirm real
      field mapping against the old questionnaire before building)
- [ ] "Chat with Darz" — maps to `crm.Request(kind=message)` unless a distinct channel is decided
- [ ] Settings (language/currency/layout)
- [ ] Membership display/redemption `[!]` blocked on backend Phase 13 (darzmarket-api)
- [ ] PWA install + push opt-in `[!]` blocked on backend Phase 13 (darzmarket-api)

## Phase 10 — Gallery Update Portal (frontend)  `[!]` blocked on backend Phase 12 (darzmarket-api)
- [ ] No-login token+PIN portal: load state, submit updates, pricelist/Q&A
- [ ] Admin review/approve desk UI

## Phase 11 — Admin: Marketing Hub, AI Tagging, Document Builder, Accounting  `[!]` blocked on
backend Phases 14-17 (darzmarket-api)
- [ ] Marketing Hub UI (campaigns/analytics — content generator/asset-library scope TBD, see backend
      Phase 14's open owner-decision)
- [ ] AI Tagging & Recommendations admin desk (working queue, confirm-batch ledger, readiness toggle)
- [ ] Document Builder UI (generic document editor + PDF export)
- [ ] Accounting desk UI (4 ledger books + Private Deals) — real Django permission scope replaces
      the old passkey hack; don't rebuild the passkey pattern in the frontend

## Phase 12 — Testing
- [ ] Component tests for shared/base components
- [ ] E2E on critical flows (login, browse→detail→request, admin CRUD, optimistic-lock conflict)

## Phase 13 — Deploy & cutover — later, owner-gated
- [ ] Build/hosting decision (static hosting vs. SSR — likely static given no server-rendering need)
- [ ] Environment config (API base URL per environment)
- [ ] DNS/hosting cutover plan, coordinated with `darzmarket-api`'s own Phase 18
