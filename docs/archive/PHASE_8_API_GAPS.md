# Phase 8 — API gaps

> **2026-09-11:** G-P8-1's backend half (BE-R1…BE-R6, the widened `AuctionRecord` + import command)
> is done — see `docs/API_INTEGRATION_GAPS.md`. The frontend half (FE-R1…FE-R4 — admin Records
> desk, highlight curation, collector sub-tabs) is still open, its own follow-up PR.

Gaps found while building the collector auction surfaces (Phase 8). None blocked
a step; each is a **flag for an owner decision**, not a silent omission.

## G-P8-1 — Records archive: the backend `AuctionRecord` is much leaner than the old "Records" tab

**Endpoint:** `GET /api/auctions/records/` + `/{id}/` (added in backend Phase 11.4,
`IsCollectorPrincipal`, read-only). Fields returned: `id`, `artist` (uuid|null),
`artist_display_name` (computed), `artist_name_raw`, `house`, `lot_title`,
`sale_date`, `price_amount`, `currency`, `lot_reference`, `source_url`, `notes`,
`version`, `created_at`, `updated_at`.

**The old app's Records tab** (`../DarzStudio/app.html` `recordsView()` ~4760+,
`_recArcMap` ~4724) showed a substantially richer row — its cloud `records` table
carried, and the UI rendered:

| Old-app column                                                                    | In `AuctionRecord`?            |
| --------------------------------------------------------------------------------- | ------------------------------ |
| artist, house, sale date, price, currency, lot reference, source URL, notes       | ✅ (this endpoint)             |
| **image / `image_url`**                                                           | ❌ — cards render text-only    |
| **`year`** (work's year, often imprecise e.g. "c. 1971")                          | ❌                             |
| **`medium`**, **`dimensions`**                                                    | ❌                             |
| **low / high estimate**                                                           | ❌                             |
| **hammer vs. realized** (the old app shows both; we have one `price_amount`)      | ❌ (single figure)             |
| **`sale_name`** (e.g. "Modern & Contemporary Middle Eastern Art")                 | ❌                             |
| **provenance / literature / exhibition / house notes / previous record**          | ❌                             |
| **`section`** — Past / Upcoming / Live, driving the old sub-tabs                  | ❌ (no lifecycle on the model) |
| **`is_highlight` / highlight order** — the "Auction highlights" strip + home rail | ❌                             |

**Owner call (2026-09-10, recorded in `docs/PHASE_8_PLAN.md`):** ship the lean
collector view against the fields we have; the widened model + the admin Records
desk that maintains it (bulk import, highlight curation, the Past/Upcoming/Live
sub-tabs, rich record detail, per-artist rollup, and restoring `showRecordsTab`
as a real setting) are **deferred to frontend Phase 11 / backend Phase 11-admin**.
See `docs/PHASE_8_PLAN.md` § "Deferred — admin Records desk" for the full item
list (BE-R1…BE-R6, FE-R1…FE-R4).

**Frontend consequence today:** the `/records` list shows house + sale-month,
artist, lot title, and price realised only; no images, no estimates, no
sub-tabs, no highlights. The "Records" nav entry is always on (the old
`showRecordsTab: 'Hidden'` default is not reproduced) — flag to the owner if it
should be gated.
