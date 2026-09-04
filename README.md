# Darz Market — web frontend

React + TypeScript + Vite frontend for Darz Market. Separate repo from the backend
(`../darzmarket-api`) and the old app (`../DarzStudio`).

## Hard constraint

This is a **faithful port** of the old DarzStudio app's already-approved design and behaviour,
**not a redesign**. Every UI/UX decision must trace back to both:

1. the approved design spec (`../DarzStudio/DARZ_DESIGN_GUIDELINE.md` + `docs/design/`), and
2. the real shipped implementation (`../DarzStudio/app.html` on `main`).

Where the two disagree, flag it — don't silently pick. On the token layer the owner has already
ruled: **`app.html` wins over the guide** (see `docs/adr/0001-styling-and-oop.md`).

See `CLAUDE.md` for the full cross-repo context and `docs/TASKLIST.md` for the phase plan
(the source of progress truth).

## Stack

- **React + TypeScript + Vite** — component-based views over a class-based domain layer
  (design system, and later the API client + services). See the ADR.
- **Styling:** plain CSS + CSS custom properties, one global sheet, `app.html`'s own semantic
  class names — so the port diffs 1:1 against the original. No CSS Modules / Tailwind.
- **Lint:** oxlint. **Format:** Prettier.
- **API (Phase 3):** an OOP client in `src/api/` (`HttpClient` → `ApiClient`; `AuthSession`;
  `ResourceService` subclasses; `DarzApi` facade; `useApi()` / `useSession()`). Types in
  `src/api/schema.d.ts` are generated from a locally-running `darzmarket-api` — never a committed
  snapshot. See `docs/API_GAP_ANALYSIS.md` for the backend-gap decisions.

## Setup

```bash
npm install
cp .env.example .env.local     # then set VITE_API_BASE_URL (no hardcoded fallback)
```

Every env var the app reads is listed in `.env.example`. The API client needs a running backend:
`cd ../darzmarket-api && docker compose -f docker-compose-local.yml up -d && python manage.py runserver`.
Regenerate types after any backend API change:
`npx openapi-typescript "http://localhost:8000/api/schema/?format=json" -o src/api/schema.d.ts`.

## Commands

```bash
npm run dev           # Vite dev server
npm run build         # tsc -b && vite build
npm run typecheck     # tsc -b --noEmit
npm run test          # vitest run
npm run lint          # oxlint
npm run format        # prettier --write (src + config; not docs/)
npm run format:check  # prettier --check
npm run preview       # serve the production build
```

## Layout

```
src/
  design/           Design system (Phase 2)
    tokens.css        :root + html.dz-bw, ported verbatim from app.html (line-cited)
    tokens/index.ts   the same values, typed — keep in lockstep with tokens.css
    base.css          reset + document rules + .chroma / .eyebrow
    components.css     base-component skins (app.html class names)
    global.css        the single stylesheet main.tsx imports
    Theme.ts          immutable value object for one surface theme
    ThemeController.ts runtime theme: Paper<->Black, dz-theme persist, observers
    README.md         design-system conventions
  components/        Base component library — one typed module per component
    index.ts          the only public entry
  lib/              small framework-free helpers
  App.tsx           currently the Phase 2 design-system showcase
docs/
  TASKLIST.md       phase plan + status (source of progress truth)
  CHANGELOG.md      one entry per completed task
  adr/              architecture decision records
```

## Workflow

Each `docs/TASKLIST.md` phase is built on its own branch cut from `development`
(`phase-N-<slug>`). The repo owner pushes and merges.
