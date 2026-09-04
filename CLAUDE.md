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

## Stack (locked in — Phases 2-4)

React + TypeScript + Vite, component-based. Decisions below were made by checking what the old app
actually needs, not by default preference; see `docs/adr/` for the full reasoning.

- **Styling:** plain CSS + custom properties, one stylesheet per layer (`src/design/*.css` global,
  `src/features/*/*.css` per feature), **the same class names as `app.html`** — never CSS Modules,
  never Tailwind. See "Reusing the design system" below.
- **Routing:** `react-router-dom`. Real URLs (`/`, `/artwork/:id`, `/artists`, `/login`, …), not the
  old app's in-memory tab switcher — this is a proper web app, deep links matter.
- **Domain/logic layer — OOP with inheritance, always:** `Theme`/`ThemeController`, `AuthSession`,
  `ApiClient`/`HttpClient`, `ListController` (base) → `CatalogueController`/`ArtistListController`,
  `ResourceService` (base) → `AuthService`/`CatalogService`/etc. Shared state-machine behaviour goes
  in a base class (see `src/features/shared/ListController.ts`) — a second subclass duplicating a
  first one's logic instead of extending a shared base is a bug, not a shortcut. React **views**
  stay function components — the framework's own idiom, not the OOP layer.
- **Env config:** every value the app reads comes from `.env`/`.env.local` — **no hardcoded
  fallbacks in code.** `src/api/index.ts::resolveBaseUrl()` throws if `VITE_API_BASE_URL` is unset;
  follow that pattern for every new env-driven value. `.env.example` documents each one.
- **Testing:** `vitest` (`vitest.config.ts`, kept separate from `vite.config.ts` — importing
  `vitest/config`'s `defineConfig` into the app's own Vite config clashes with vite 8's types).

## Reusing the design system — do not freehand a new screen

Before writing a new page/screen:

1. **Find the old screen first.** Search `../DarzStudio/app.html` (grep for the feature name, a
   visible copy string, or a `#id`/`.class` you'd expect) *before* writing any markup. Port its
   real class names, copy, and structure — see the Hard Constraint above. A screen built from
   description alone (no source lines cited) is not a faithful port.
2. **Reuse `src/components/` for every brand element** — `Logo`, `Wordmark`, `Chroma`, `Eyebrow`,
   `Button`, `Input`, `Card`, `Pill`, `Avatar`, `Toast`, `Sheet`. Never freehand a wordmark, an
   inline chroma bar, or a raw `<input>` where one of these already exists — that's how a screen
   ends up unbranded (see git history: the first `LoginPage` had no logo, no chroma, ad-hoc inline
   styles, because it skipped both steps above). If the component doesn't support what you need
   (e.g. a trailing icon in a field), **extend it** (add an optional prop) rather than bypassing it.
3. **Generic layout/status primitives belong in `src/design/`, not a feature folder.** `.dz-page`
   (page shell) and `.dz-state` (loading/error text) live in `src/design/components.css` because
   more than one feature uses them — a feature's own `*.css` is only for that feature's specific
   markup (`.card`, `.dza-*`, `.dz-gate-*`, …).
4. **Cite the source.** Every ported CSS block/component should say which `app.html` lines it came
   from, the way `src/design/tokens.css` and `src/features/catalogue/catalogue.css` do — so a
   reviewer (or a later session) can re-check it against the original without redoing the search.
5. **Verify against a real screenshot before calling a screen done — always.** Reading `app.html`
   source is necessary but not sufficient: it describes structure, not the actual rendered result
   (a live production screenshot once caught a missing logo, missing chroma, a dropped field, and a
   dropped link that source-reading alone had missed). Screenshot the new screen yourself
   (`mcp__Claude_Browser__computer` against the local dev server) and compare it side by side
   against either a screenshot the owner supplies or your own reading of the rendered markup — every
   field, button, and link the old screen has should be traceable in the new one, or explicitly
   flagged as a scope decision (never silently dropped). Do this for every new screen, not just when
   asked.
6. **A field/link the old screen has but the new backend doesn't support yet is a flag, not a
   deletion.** Keep it in the UI if the owner wants an exact copy; say plainly what it does and
   doesn't do right now (in a code comment and, in your reply, to the owner) rather than quietly
   omitting it because it's inconvenient to wire up.
