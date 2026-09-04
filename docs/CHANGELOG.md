# Changelog — Darz Market Web

Format rule: **one entry per task/step, at most 3 lines.** Line 1 = date + what was done.
Newest first. Add an entry whenever a task in `docs/TASKLIST.md` moves to done (`[x]`).

---

## 2026-09-04 — Phase 4: collector catalogue + artwork detail

`src/features/catalogue/`: `CatalogueController` (OOP, same shape as `AuthSession`) + `useCatalogue`
— query state, fetch, pagination, stale-response guard. `CataloguePage` (hero/toolbar/grid/pager),
`ArtworkCard`, `CatalogueToolbar` (debounced search + sort + currency-gated price sort),
`ArtworkDetailPage` (Template A port: hero/status/fields/price/about — no action buttons yet, those
need Phase 5/6). Added `react-router-dom`: `/login`, `/` (catalogue), `/artwork/:id`, `/_design`
(Phase 2 showcase moved off root); `RequireAuth` guard + a minimal collector `LoginPage` (the API's
default permission is `IsAuthenticated`). Found + fixed live: `Artwork.artist` is nullable
(`on_delete=SET_NULL`) though the generated type omits it. Verified end-to-end against real seeded
data. 6 new tests. Backend companion: `darzmarket-api` `phase-19.2-catalogue-query` (merged) added
`?search=`/`?ordering=` + `ArtistFilterSet` + `CollectorRequestFilterSet`. Branch
`phase-4-catalogue` (based on unmerged `phase-3-api-client`).

## 2026-09-04 — Phase 3: typed API client + auth

`src/api/`: OOP client (hard rule) — `HttpError` hierarchy → `HttpClient` (fetch + `{success,data}`
envelope unwrap) → `ApiClient` (auth header + one 401→refresh→retry). `AuthSession` holds the
access token in memory + the refresh token in `localStorage['dz-refresh']` (owner call);
`abstract ResourceService` → `Auth`/`Catalog`/`Crm`/`Recommendation`/`Options` services; `DarzApi`
facade + `api` singleton; `ApiProvider` + `useApi`/`useSession`. `schema.d.ts` generated from the
live backend. `VITE_API_BASE_URL` from `.env` only (no hardcoded fallback). `vitest` + 9 client
tests; verified live against the running backend. Backend half: `darzmarket-api` branch
`phase-19-auth-session` (token refresh / logout / me + `currency`/`price_type`/multi-tag +
`core.filters`). Gap analysis + decisions in `docs/API_GAP_ANALYSIS.md`. Branch `phase-3-api-client`.

## 2026-09-04 — Phase 2: design system

Ported the shipped collector app's tokens + base components to React/TS (owner call: match
`app.html` `:root` over the stale guideline — warm palette, Cormorant body). `src/design/`:
`tokens.css`/`tokens/` (verbatim, line-cited), `Theme` + `ThemeController` classes (OOP core,
Paper⇄Black, `dz-theme` persist). `src/components/`: Logo/Wordmark, Chroma, Eyebrow, Button, Input,
Textarea, Card, Pill, Avatar, Toast, Sheet. Prettier added; `src/App.tsx` is now the showcase.
See `docs/adr/0001-styling-and-oop.md`. Branch `phase-2-design-system`; build + typecheck + lint green.

## 2026-08-28 — Phase 1: project scaffold

Vite + React + TypeScript scaffold in a new, separate git repo (local only, no GitHub remote yet).
Design/planning groundwork: confirmed the design-reference approach (DarzStudio `main`, not copied
in), the API-client strategy (live OpenAPI fetch), and wrote the full cross-repo phase breakdown.
