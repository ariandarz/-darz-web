# Admin screens — which reference capture each desk is compared against

The admin panel is a faithful port of `darz-studio.html`'s, and until 2026-09-21 every fidelity
claim in this repo was a **line citation** rather than a picture — there was no design package for
the panel the way `DarzStudio/design/market-app/` is one for the collector app
(`docs/archive/ADMIN_V1_AUDIT.md` §6.3). There is now:

> **`../DarzStudio/design/admin-panel/`** — 52 screens of the live old panel, each in
> desktop/mobile × dark/light, captured offline by a Playwright harness that can be re-run.
> Read its `README.md` before using the captures; four things about them are not obvious.

**This file is the map between the two.** It exists so "does this desk match?" is answered by
opening one named file, not by searching 43,789 lines of HTML.

## How to compare a desk

**Shoot this panel first** — `e2e/capture-desks.mjs` (added 2026-09-22) walks every built desk
at the reference harness's own settings (1440x900, dark, deviceScaleFactor 1) and writes
`dist-desk-shots/<capture-id>.png`, named so it sits next to the capture it is compared
against:

```bash
node e2e/stub-server.mjs &
npx vite preview --outDir dist-e2e --host 127.0.0.1 --port 4173 &
node e2e/capture-desks.mjs            # all of them
ONLY=31-accounting node e2e/capture-desks.mjs   # just one
```

It runs against the E2E stub, so every desk is in its EMPTY state while the reference is
seeded. That supports the comparison that matters for a port — headings, sub-lines, sub-tabs,
filters, toolbar actions, column headers, empty copy — and not a populated row, a chart with
bars in it, or anything whose shape depends on data. Those stay the real-backend tier's job
(`e2e/README.md`).

1. Find the desk below and note its capture id.
2. Open `../DarzStudio/design/admin-panel/screenshots/desktop/dark/<id>.jpg` — **dark first**: the
   old panel ships dark and *locked* (`forceDarkAdmin` defaults on), so that is what an admin
   actually saw. Then `light/`, then the two `mobile/` sets.
3. Where a `-full` variant exists, use it for anything below the fold.
4. Run the new desk at the same viewport and compare.
5. **A difference is not automatically a bug.** `docs/archive/ADMIN_V1_AUDIT.md` §6.2 lists seven divergences
   that are already recorded and accepted. Add to that list rather than silently closing a gap —
   the faithful-port rule in `CLAUDE.md` cuts both ways.

## The map

Every row is a tab in `src/features/admin/adminNav.ts`, in that file's own order, with its capture.
A route of — means the desk is not built; the capture still exists for when it is.

| Desk (`adminNav.ts` key) | Route | Reference capture | Page-length |
| --- | --- | --- | --- |
| Dashboard (`dashboard`) | `/admin` | `01-dashboard` | — |
| Chat (`chat`) | `/admin/chat` | `17-chat` | — |
| **Artworks** | | | |
| Database (`database`) | `/admin/artworks` | `02-artworks-database` | ✅ |
| Import (`import`) | `/admin/import` | `18-import` | — |
| **Artists** | | | |
| Artists (`artists`) | `/admin/artists` | `03-artists` | ✅ |
| **Galleries** | | | |
| Galleries (`galleries`) | `/admin/sources?type=gallery` | `04-galleries` | — |
| Sources & Partners (`sources`) | `/admin/sources` | `05-sources-partners` | — |
| Exhibition Services (`exhservices`) | `/admin/exhibition-services` | **none** | — |
| Issue a document (`issue`) | `/admin/issue` | **none** | — |
| **Market App** | | | |
| Published works (`market`) | `/admin/published` | `06-market-published` | — |
| App Design (`design`) | `/admin/design` | `07-app-design` | ✅ |
| **Documents** | | | |
| Create (`issue`) | `/admin/issue` | `42-documents-create` | — |
| Proposals (`docProposals`) | `/admin/documents?kind=proposal` | `43-documents-proposals` | — |
| Invoices (`docInvoices`) | `/admin/documents?kind=invoice` | `44-documents-invoices` | — |
| Library (`docFiles`) | `/admin/documents` | `45-documents-library` | — |
| History (`docHistory`) | — | `45-documents-library` | — |
| Pricelists & saved items (`library`) | — | `33-library` | — |
| Document Builder (`archive`) | — | `34-document-builder` | — |
| **Auctions** | | | |
| Live Auctions (`auctions`) | `/admin/auctions` | `09-auctions` | — |
| Auction Records (`records`) | `/admin/auction-records` | `10-auction-records` | ✅ |
| Register to Bid (`aucReg`) | `/admin/auction-registrations` | `46-auction-registrations` | — |
| **Collectors** | | | |
| Collectors (`users`) | `/admin/collectors` | `11-collectors` | ✅ |
| Requests & Activity (`activity`) | `/admin/requests` | `13-requests` | ✅ |
| Collector Club (`club`) | `/admin/club` | `14-collector-club` | — |
| **Sales** | | | |
| Market Sales (`marketSales`) | `/admin/sales` | `15-market-sales` | ✅ |
| Auction Sales (`auctionSales`) | — | `16-auction-sales` | — |
| **Projects** | | | |
| Dashboard (`projDash`) | `/admin/projects` | `35-projects-dashboard` | — |
| Projects (`projList`) | `/admin/projects/list` | `36-projects-list` | — |
| Pipeline (`projPipeline`) | `/admin/projects/pipeline` | `37-projects-pipeline` | — |
| Packages (`projPackages`) | `/admin/projects/packages` | `38-projects-packages` | ✅ |
| Proposal (`projProposal`) | — | **none** | — |
| Calculator (`projCalc`) | `/admin/projects/calculator` | `39-projects-calculator` | — |
| Partners (`projPartners`) | `/admin/projects/partners` | `40-projects-partners` | — |
| Reports (`projReports`) | `/admin/projects/reports` | `41-projects-reports` | — |
| **Intelligence** | | | |
| Overview (`recoOverview`) | — | `47-intelligence-overview` | ✅ |
| Tagging & Review (`recoTag`) | — | `48-intelligence-tagging` | ✅ |
| Smart Filters (`recoFilters`) | — | `49-intelligence-filters` | ✅ |
| Recommendations (`recoReco`) | — | `50-intelligence-reco` | ✅ |
| History (`recoHistory`) | — | `51-intelligence-history` | — |
| **Operations** | | | |
| App Design (`design`) | `/admin/design` | `07-app-design` | ✅ |
| Logistics & Payments (`logistics`) | — | `20-logistics` | — |
| Analytics (`analytics`) | — | `21-analytics` | — |
| Data Health (`health`) | `/admin/data-health` | `19-data-health` | ✅ |
| **Social** | | | |
| Instagram (`igStudio`) | — | **none** | — |
| Insights & Stories (`stories`) | — | `27-stories` | — |
| Content Calendar (`socialCal`) | — | **none** | — |
| AI Settings (`socialAi`) | — | **none** | — |
| **Owner** | | | |
| Access (`access`) | — | `22-access` | — |
| Team (`team`) | `/admin/team` | `23-team` | — |
| Strategy (`strategy`) | — | **none** | — |
| Marketing (`marketing`) | — | `24-marketing` | — |
| Accounting (`accounting`) | `/admin/accounting` | `31-accounting` | ✅ |
| Automations (`automations`) | — | **none** | — |
| Settings (`settings`) | — | `25-settings` | ✅ |
| Languages (`languages`) | — | **none** | — |
| Market Portal (`portal`) | — | `26-portal` | — |
| **Access Management** | | | |
| Memberships (`memberships`) | `/admin/memberships` | `28-memberships` | — |
| Access Request (`system`) | `/admin/access-requests` | `29-access-requests` | — |

## The nine rows with no capture, and why

| Desk | Why there is no reference |
| --- | --- |
| **Exhibition Services** (`exhservices`) | No old-panel page. The old exhibition service list lives in `gallery-update.html`'s `EXH_SVC` (:733-741) and was promoted to its own section here on the owner's instruction, 2026-09-19. Compare against that file, not the panel. |
| **Issue a document** (`issue`) | No old-panel page under that name — but the old **Documents → Create** tab is the same job, and `42-documents-create` is its capture, so this row is no longer reference-less (corrected 2026-09-22). The desk collapses the old Documents → Create → Builder path into one route; `08-documents` and `34-document-builder` are the other two thirds. It is listed in both the Galleries group (this row) and the Documents group, as Create. |
| **History** (`docHistory`) | Not a separate old page either — its issued half **is** the Library list, so it points at `45-documents-library`. |
| **Proposal** (`projProposal`) | Deliberately not ported: the old free-form Proposal Builder (:14647) is a document editor, and the port issues a proposal from the project record instead. |
| **Instagram · Content Calendar · AI Settings** (`igStudio`, `socialCal`, `socialAi`) | The old desks exist, but the backend deliberately left them unscoped, so there is nothing to build against yet. Ask for a capture when they are scoped. |
| **Strategy** (`strategy`) · **Automations** (`automations`) · **Languages** (`languages`) | Same: old desk exists, no backend, not V1. |

## Keeping this honest

The capture ids come from `screenshots/manifest.json`, whose `page` field is the old panel's own
page key — the same string `adminNav.ts` stores as `key`. So a desk greps to its reference and back
in one step, and a new desk gets its row here at the same time it gets its route.

Re-run the harness after any visual change to the old panel (it will not change again, but the rule
is the same one `design/market-app/` carries) or when a desk listed above as having no capture
gains one.
