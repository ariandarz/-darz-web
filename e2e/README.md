# Phase 13 — the E2E suite

Two tiers, deliberately different in what they claim:

## 1 · The stub tier (`smoke.spec.ts` + `desks.spec.ts`) — runs in CI

`npm run e2e` (builds first — `e2e:build` — then tests). Playwright boots
the **production build** against
`stub-server.mjs` — a no-state node server speaking the backend's one
envelope for exactly the routes the walk needs (boot theme, team sign-in,
options, the Dashboard summary) and an **empty paginated list for anything
else**, so every desk must survive an empty backend.

It proves: the app boots (providers, theme fetch, session resume), the
collector gate renders, a team session reaches the panel, the shell and a
desk render. It proves nothing about behaviour against real data — that is
the point; it needs no backend and cannot rot with one.

`desks.spec.ts` is the breadth half (TD-9): **every** built admin desk that
needs no id — 35 of them — signs in once and is walked, each asserting its own
heading, a surviving shell, and no thrown error. Worth knowing what the first
run of it found, since it is the argument for keeping it: **three desks
rendered a completely blank page**, two of them already released to `main` —
`/admin/accounting` (`.length` on an undefined `currencies`), `/admin/projects`
(`responsibility_by_member is not iterable`) and `/admin/accounting/deals/new`
(a `<Route>` nested inside another route's `element`, which had also left
`/admin/accounting/entries/:id` unregistered). 443 logic tests saw none of it.

Adding a desk means adding its row to `DESKS`. If a desk's heading changes, the
row is the one place to change.

Locally, the pre-installed Chromium may not match `@playwright/test`'s
pinned revision — point `PW_CHROMIUM` at it:

```bash
PW_CHROMIUM=/opt/pw-browsers/chromium npm run e2e
```

## 2 · The real-backend tier — local only, by design

The per-step verification scripts this suite grew from (Phase 11b/12
records in `docs/TASKLIST.md`): a real Django + Postgres + object storage,
real sign-ins, real writes — image uploads, publish toggles, sale
transitions, document lifecycles. Run against `docker compose` per
CLAUDE.md "API access", or the session-local equivalent. Not in CI: this
repo's CI has no backend checkout, and pretending with a stub would claim
what the stub tier already claims.

Rule of thumb: **a new desk gets its real-backend walk before it ships**
(CLAUDE.md rule 5 — screenshots included), and the stub smoke only grows a
line when the app's boot/shell contract itself grows.
