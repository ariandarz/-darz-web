# Phase 11c — Projects: the plan

**Status: BUILT 2026-09-19 (all four steps in one pass, on the owner's "go ahead with the
projects").** Written 2026-09-19 as the plan the architecture doc (§6 row 9) requires; what
changed in the build is recorded under "As built" at the end — the map below held, with three
API facts found on the way (G-PROJ-2/3: `status` and the stage sub-state are not writable).

## What it is

The old panel's Projects group: eight sub-tabs (`projDash…projReports`,
`darz-studio.html:13580-13587`) over one client-local store — a services-business CRM for
exhibitions, publications and commissions run WITH partners, priced from a rate card, driven
through a 17-stage pipeline, and reported on. Backend Phase 31 rebuilt the whole store
server-side (`apps/projects`): projects CRUD + the stage machine, partner orgs, a service
catalog, packages, checklists, per-project attachments, a dashboard and a reports roll-up.
Everything below maps old tab → new route → served endpoint; the API is complete — no G-gaps
are known going in (the first build step will confirm).

## The map

| Old tab (`:13580`)        | New route                                | Serves from                                                      |
| ------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| Dashboard (`projDash`)    | `/admin/projects`                        | `GET /projects/admin/projects/dashboard/`                        |
| Projects (`projList`)     | `/admin/projects/list` (+`/new`, `/:id`) | projects CRUD                                                    |
| Pipeline (`projPipeline`) | `/admin/projects/pipeline`               | projects list grouped by `stage`; moves via `POST …/{id}/stage/` |
| Packages (`projPackages`) | `/admin/projects/packages`               | packages CRUD                                                    |
| Proposal (`projProposal`) | `/admin/projects/:id` § proposal         | the project's own fields + applied package                       |
| Calculator (`projCalc`)   | `/admin/projects/calculator`             | service catalog (the rate card)                                  |
| Partners (`projPartners`) | `/admin/projects/partners`               | partner orgs CRUD                                                |
| Reports (`projReports`)   | `/admin/projects/reports`                | `GET /projects/admin/projects/reports/`                          |

## Hybrid-rule calls (content vs mechanics)

- **The 17 stage names are content** — and already server truth (`projects.stage` options;
  the nav note "the status label is derived server-side" recorded at Step 0). The pipeline
  board's columns are those stages in order; the old board (`:13685`) ports as a
  kanban-by-stage list where a card's move calls the real `/stage/` endpoint.
- **The calculator (`calcInit`, `:13257`) is the delicate one.** The old CALCV priced from
  hardcoded client-side dimensions (hours · production · scale · discount → approved price →
  deposit %). The backend's service catalog IS the rate card now — the calculator must price
  FROM `service-catalog` rows, never from constants in the bundle. **D21 (owner):** confirm
  the catalog's seeded rates match the old CALCV table before the calculator ships, or seed
  them as part of the build (`accounting.position_seed`-style, already a backend pattern).
- **`projSeedIfEmpty` does not port** — demo-seeding on first open was the client-local
  store's onboarding; a server DB starts honest and empty.
- The old per-tab CSS (`projCss`) folds into `admin.css` under the kit like every desk since.

## Build steps (each one PR, each live-verified per CLAUDE.md rule 5)

1. **List + record + stage machine** — the roster with category/status/stage filters, the
   project page (the model's ~30 fields grouped: identity · parties · scope & deliverables ·
   dates & deadlines · team & suppliers · money JSON · links · results), stage moves, and
   attachments (the moto-S3 path is proven). The JSON-shaped fields (`deliverables`, `team`,
   `suppliers`, `money`, `partner_roles`, `links`) get the Documents desk's validated-JSON
   editor first; purpose-built editors come only where a step below needs one.
2. **Pipeline + Dashboard** — the kanban over the same list; the dashboard tiles from the
   served summary. Reports view from the reports roll-up.
3. **Partners + Service catalog + Packages + Checklists** — four plain CRUD desks on the
   established kit patterns (Records/Memberships shapes).
4. **Proposal + Calculator** — the calculator prices from the catalog (D21 resolved first);
   its output writes the project's `money`/`applied_package`; the proposal renders from the
   project and hands off to the Documents desk (kind `proposal`) — where D18's studio will
   eventually generate the PDF, and until then the upload path stands.

## Verification

Each step's walk on the real backend, the established way: create a project → drive it through
three stages on the board → attach a file → apply a package → the dashboard and reports
reflect it → a standard admin sees whatever the old panel's role rules said (confirm whether
Projects was `OWNER_ONLY` in `:11800` — the build must match, and the backend's permission
class is the truth to mirror).

## Open questions for the owner

- ~~**D21** — the calculator's rate card provenance.~~ **Resolved 2026-09-19:** the catalogue carries Darz's
  real services in Toman (the 8 priced exhibition services + the 19 other coverage services, unpriced; four coverage lines were merged into the priced service they named, on the owner's ruling of 2026-09-19),
  loaded by an owner-only action; the old demo figures were invented and do not port.
- Whether Projects outranks the **Gallery Portal surface** in build order — the portal closes
  a loop whose admin half already shipped; Projects is a whole new territory. The §6 order
  says portal (row 7) before projects (row 9); this plan does not change that, it only makes
  Projects ready to start.

## As built (2026-09-19)

- Steps 1-4 landed together as one PR: `/admin/projects` (dashboard) · `/list` (+ `?quick=`) ·
  `/new` · `/:id` (the record: stage rail, nine sections, attachments, the Proposal section) ·
  `/:id/report` (`?client=1`) · `/pipeline` · `/packages` (+ the service catalogue panel, the
  package editor at `/packages/new|:id`) · `/calculator` · `/partners` · `/reports` (roll-up +
  per-project reports + checklist templates).
- **Calculator (D21):** prices from catalogue rows × quantities (cost, recommended, discount,
  approved, gross, margin, deposit/on delivery; client-quote view). The old rate-card editor
  (hours × rates, contingency, multipliers, `:15359`) is not ported — no backend holds a rate
  card. Seeding the catalogue with the old rates is the owner's call (G-PROJ-4).
- **Proposal:** issues from the record's Proposal section once a package is applied — a
  `documents.Document` (kind `proposal`, ref = the project no) rendered client-side with the
  Phase 10b renderer, one `DARZ-PRO-YYYY-NNNN` series shared with exhibition proposals. The old
  Proposal Builder (`builder`, `:14647` — the free-form themed document editor) is not ported.
- **Not writable on the API, stated on screen:** `status` (G-PROJ-2) and the per-stage
  sub-state (G-PROJ-3) — so the Delayed / Awaiting-approval tiles stay 0, checklists are not
  applied on a move, and the scope gate keys on pipeline order.
- `projSeedIfEmpty` did not port (as planned); `projCss` folded into `admin.css` as the
  `.dzp-*` block. Verified live per CLAUDE.md rule 5 (see the PR).
