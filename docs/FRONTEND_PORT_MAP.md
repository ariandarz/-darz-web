# Old frontend → new API map

**Date:** 2026-09-05 · **Reference:** `ariandarz/darzstudio.art` @ `main` (`c46d96d`, PR #841),
read-only. **Destination:** this repo. **Backend:** 129 endpoints across 13 apps in
`src/api/schema.d.ts`.

The old repo is a **design and behaviour reference only**. Nothing is copied from it: not the
direct Supabase calls (the collector app embeds a project URL and anon key inline around
`app.html:11103` — deliberately not carried over, and not reproduced here), not its OTP auth
(`DZ.otpGate`), not its `localStorage` persistence (`darz_user`, `darz_conn`, the `saved`/`deleted`
pair, `darz_save_edit`), and none of its env files or generated assets.

## Status legend

`[x]` built here · `[~]` partially built · `[ ]` not started · `[!]` blocked on an API gap

---

## Flow 1 — Collector login → list → detail → save/request/offer → admin inbox

| Old screen / behaviour (source) | New API | New frontend | Status |
|---|---|---|---|
| `#dzGate` private-access gate (`app.html:2556-2560`) | `POST /api/auth/collector/login/` | `features/auth/LoginPage` | `[x]` Phase 3/4 |
| `market()` catalogue grid + toolbar (`app.html:9100+`) | `GET /api/catalog/artworks/` | `features/catalogue/CataloguePage` | `[x]` Phase 4 |
| Artwork detail template A (`app.html:9200+`) | `GET /api/catalog/artworks/{id}/` | `features/catalogue/ArtworkDetailPage` | `[x]` Phase 4 |
| Save / unsave (`Lib.addAction('save')`) | `GET/POST /api/crm/saved/`, `DELETE .../{artwork_id}/` | `features/saved/*` | `[x]` Phase 6 (PR #1) |
| `.act-primary` Buy now (`app.html:9236`) | `POST /api/crm/requests/` `kind=purchase` | `features/requests/ActionButtons` | `[x]` |
| `.act-box` 24h hold (`DZ.act(id,'hold')`, `:10462`) | `POST /api/crm/requests/` `kind=hold` | `features/requests/ActionButtons` | `[x]` |
| `.act-box` Request viewing (`DZ.act(id,'visit')`) | `POST /api/crm/requests/` `kind=viewing` | `features/requests/ActionButtons` | `[x]` |
| Make an Offer sheet (`DZ.offer`/`DZ.submit`, `:11074-11106`) | `POST /api/crm/requests/` `kind=offer` | `features/requests/OfferSheet` | `[~]` detail shape unverified (G-F1-1); floor not enforced (G-F1-2) |
| `dzActConfirm` confirmation sheet (`:10181`) | — | `features/requests/ConfirmSheet` | `[x]` |
| `dzGuard` double-tap guard (v576) | — (client-side) | `RequestController` | `[x]` server key still missing (G-F1-5) |
| Admin actions feed (`darz-studio.html`) | `GET /api/crm/admin/requests/` + `POST .../transition/` | `features/admin/AdminRequestsPage` | `[~]` shows UUIDs, not names (G-F1-7) |
| Price-on-request → single entry point (`app.html:9245`) | `POST /api/crm/requests/` `kind=price` | `ActionButtons` primary swaps to "Request price" | `[x]` |
| Per-artwork action allow-list (`DZ._actAllows`, v1131) | — none | — | `[!]` G-F1-3 |
| Request reply thread (`request_thread`, v754+) | — none | — | `[!]` G-F1-6 |

---

## Remaining flows — API availability (not yet built)

Every row below is backend-ready unless marked. This is the build order the endpoints support.

| Flow | Endpoints available | Status |
|---|---|---|
| **Collector: own request list** | `GET /api/crm/requests/` (`kind`/`status` filters) | `[ ]` ready |
| **Collector: activity self-logging** | `POST /api/crm/activity/` (`view`/`save`/`search`/`login`) | `[ ]` ready — see the open question in `docs/PHASE_6_API_GAPS.md` |
| **Collector: recommendations** ("Curated for You") | `GET /api/recommendations/published/`, `POST .../{id}/dismiss/` | `[ ]` ready |
| **Collector: membership** | `POST /api/auth/membership/redeem/` | `[ ]` ready |
| **Collector: push notifications** | `POST /api/notifications/push/{subscribe,unsubscribe}/` | `[ ]` ready |
| **Collector: auctions** (events, lots, bidding, registration, notifications) | 19 paths under `/api/auctions/` incl. `POST /api/auctions/lots/{id}/bids/`, `GET/POST /api/auctions/registrations/`, `GET /api/auctions/notifications/` | `[ ]` ready — largest single old-app feature |
| **Admin: catalog CRUD** | 9 paths under `/api/catalog/admin/` incl. multipart image upload, `publish`/`unpublish`/`transition` | `[ ]` ready |
| **Admin: sales** | 5 paths under `/api/sales/admin/` incl. `transition`, `payment-status`, `delivery-status` | `[ ]` ready |
| **Admin: auctions desk** | `/api/auctions/admin/*` incl. `go-live`, `close`, registration approve/reject, records | `[ ]` ready |
| **Admin: recommendations & AI tagging** | 16 paths under `/api/recommendations/admin/` incl. tag `ai`/`auto`, approve, lock, batch publish, preferences rebuild | `[ ]` ready |
| **Admin: marketing hub** | 5 paths under `/api/marketing/admin/` incl. `generate-copy` | `[ ]` ready |
| **Admin: accounting** | 15 paths under `/api/accounting/admin/` — deals, ledger, attachments, review, settlement + versions | `[ ]` ready |
| **Admin: document builder** | 8 paths under `/api/documents/` incl. `sign`, `confirm`, `upload`, `versions` | `[ ]` ready |
| **Gallery portal (no-login, token)** | 11 paths under `/api/gallery/portal/{token}/` — status, exhibitions, catalogue, pricelists, messages, updates, document sign | `[ ]` ready — maps to the old `gallery-update.html` / `darz-market-portal.html` |
| **Admin: gallery links & update review** | 21 paths under `/api/gallery/admin/` — links, features, enable/disable, artworks + funnel, exhibitions, compose/publish, update approve/reject | `[ ]` ready |
| **Studio: pricelist builder** | `GET /api/gallery/admin/links/{link_pk}/pricelists/`, `POST /api/gallery/portal/{token}/pricelists/` | `[ ]` ready — old `darz-pricelist-builder.html` / `pricelist.html` |
| **Studio: settlement** | `GET/PUT /api/accounting/admin/settlement/` + `versions` | `[ ]` ready — old `settlement.html` |

### Old surfaces with no backend model at all

From `docs/TASKLIST.md` Phases 12+ — listed so they are never ported as if they were shippable:
curated `in_app` set, collector questionnaire, logistics & payment desk, library builder,
insights & stories, projects / data-health / import desks, i18n + white-label. Each is blocked on
its own backend phase.
