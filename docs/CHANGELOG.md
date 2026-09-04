# Changelog — Darz Market Web

Format rule: **one entry per task/step, at most 3 lines.** Line 1 = date + what was done.
Newest first. Add an entry whenever a task in `docs/TASKLIST.md` moves to done (`[x]`).

---

## 2026-09-04 — Phase 6: collector saved / favorites

`src/features/saved/`: `SavedController` (OOP) is the one **server-derived** source of truth for the
saved set — reads `GET /api/crm/saved/`, wraps `crm.save()`/`crm.unsave()`, refuses a second write
for an artwork while one is in flight, and holds nothing in `localStorage` (owner call: offline =
NO), so the state is still right after a refresh. `SaveButton` (icon on `ArtworkCard`, `.actions`
row on `ArtworkDetailPage`), `/saved` + `SavedItemsPage` reusing the catalogue's card/grid chrome,
and one `Toast` for every confirmation and failure. New shared `Observable` base — `ListController`
and `SavedController` extend it rather than duplicating snapshot/listener plumbing. 14 new tests
(31 total); typecheck/test/lint/format/build green; every screen screenshot-verified, including the
pending, error and after-refresh states. **No backend, API-contract or `schema.d.ts` change** — the
four gaps found (`is_saved`, `saved/` query params, created-vs-restored, ordering) are written up in
`docs/PHASE_6_API_GAPS.md`, and none of them blocked the flow. Flagged: `app.html` was unreachable
from this session, so the control reuses already-ported chrome instead of a fresh line-by-line diff.
Branch `claude/phase-6-saved-favorites-gy70nd`.

## 2026-09-04 — Phase 4b/c: artist pages + login-gate design fidelity

Artist list/detail (`ArtistListPage`/`ArtistDetailPage`) over the backend's `ArtistFilterSet` — no
backend change needed. New `src/features/shared/ListController` abstract base; `CatalogueController`
and `ArtistListController` both extend it instead of duplicating the pagination/stale-response state
machine. `.dz-page`/`.dz-state` promoted to `src/design/components.css` (shared across features).

Login gate rebuilt across three screenshot-compared passes into an exact copy of `app.html`'s
`#dzGate`: landing (wordmark/chroma/eyebrow/"Enter the Room"/beta caption) then "Private Access"
form in the existing `Sheet`, with every field the old modal has (First name, access key w/
show-hide eye + `.code` styling, "Request access"). `Input` gained `trailing`/`inputClassName`
props. New CLAUDE.md rule: verify every new screen against a real screenshot before calling it
done — the first two passes missed the logo/chroma, then missed fields/links, because that
never happened.

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
