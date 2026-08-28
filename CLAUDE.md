# Darz Market Web — project context

React + TypeScript + Vite frontend for Darz Market. Separate repo from the backend
(`darzmarket-api`) and the old app (`DarzStudio`) — see below for how the three relate.

## Hard constraint — read this before building any UI

This is a **faithful port** of the old DarzStudio app's already-approved design and behavior, not a
redesign. Do not invent new UI patterns, component structures, copy, or visual choices that aren't
already present in the old implementation. If something seems like it could be improved, flag it as
a question — don't just change it.

Two sources are required **together** for every feature — neither alone is enough:

1. **The approved design spec** — what it's supposed to look like and read like.
2. **The actual old code** — how it really behaves: interactions, edge cases, exact copy/wording.

## Where things live

- **This repo**: the new frontend. Local git only for now — no GitHub remote yet (owner connects it
  when ready, same workflow as the backend: owner pushes/merges, not Claude).
- **`../darzmarket-api`**: the Django/DRF backend — the only data source. See its own
  `docs/TASKLIST.md` for what's actually implemented (Phases 1-8, V1 core) vs. planned (Phases
  10-17, feature-parity gaps like Auctions/Gallery Portal/Accounting — see that file for the full
  list and their owner-decision flags).
- **`../DarzStudio`**: the old app — design/logic reference only, never copied into this repo (would
  go stale). Its `main` branch is production/canonical (confirmed via its own `docs/INDEX.md` status
  labels — Canonical/Current/Proposal/Draft/Historical). Its `development` branch is a separate,
  older working line — not necessarily approved; don't treat it as the reference by default.

## Key reference files in `../DarzStudio` (read before building each feature)

1. `DARZ_DESIGN_GUIDELINE.md` (repo root) — palette, type, logo.
2. `docs/design/DESIGN_SYSTEM.md` — more detailed design-system doc; check `docs/INDEX.md`'s status
   label to see which of these two is canonical vs. supplementary before treating either as final.
3. `docs/design/VOICE_AND_COPY.md` + `DARZ_TRANSLATION_GLOSSARY.md` — exact wording/tone rules.
4. `app.html` (repo root) — the real collector-facing app implementation: component structure,
   interaction logic, edge cases. Check `DarzStudioAllInOne.html`/`darz-studio.html` too — confirm
   which file is the real collector app vs. an admin/all-in-one bundle before assuming `app.html` is
   the only source.
5. `docs/getting-started/PROJECT_STRUCTURE.md` + `docs/engineering/ARCHITECTURE.md` — the old app's
   real module/feature boundaries; mirror these for React component boundaries rather than inventing
   a fresh structure.
6. `docs/product/FEATURES_AND_ROADMAP.md` — implemented-vs-proposed inventory, so a proposal/roadmap
   item never gets ported as if it were already shipped.

## API access

The backend (Phase 8 of `darzmarket-api`) fully documents its OpenAPI schema — every endpoint has a
summary and an accurate response schema. Generate the typed client from a **locally running
backend**, not a committed snapshot:

```bash
# 1. Start the backend (from ../darzmarket-api)
cd ../darzmarket-api && docker compose -f docker-compose-local.yml up -d
source venv/bin/activate && python manage.py runserver

# 2. Generate types (from this repo)
npx openapi-typescript http://localhost:8000/api/schema/?format=json -o src/api/schema.d.ts
```

Rerun step 2 whenever the backend's API shape changes. The response envelope is always
`{success, data, message, timestamp}` on success and `{success, error: {code, message}, timestamp}`
on failure (see `darzmarket-api/apps/core/responses.py` and `exceptions.py`) — build the API client
wrapper around that shape once, don't re-parse it per call site.

`GET /api/options/` returns every choice field (currency, statuses, request kinds, etc.) as
human-readable `{value, label}` pairs — use it to populate dropdowns, never hardcode a label lookup.

## Stack

React + TypeScript + Vite, component-based. No other framework/library choices are locked in yet —
decide those (state management, routing, styling approach) by checking what the old app actually
needs, not by default preference. See `docs/TASKLIST.md` for the full phase breakdown.
