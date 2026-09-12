# Darz Market v0.1 — scope, ownership and verification

**Written 2026-09-11 · branch `claude/darz-market-v0-1-hpy1xy`.** v0.1 is a **visibility
reduction, not a rebuild**: every future feature stays in this codebase and is switched off by one
typed table, `src/features/shell/features.ts` (`VITE_FEATURE_SET=v0.1` | `full`, default `v0.1`).

**Final goal of v0.1:** Discover → Research → Save → Inquire → Talk to Darz.

## 1. Ownership map

| Feature | Repo that owns it | v0.1 | API dependency (darz-backend-api) |
|---|---|---|---|
| Market — catalogue, artwork detail, artists | `-darz-web` (impl) · `darzstudio.art` (design: `app.html` `market()`, `detail()`) | **Visible** | `GET /api/catalog/artworks/`, `/{id}/`, `/api/catalog/artists/` |
| Save / unsave | `-darz-web` | **Visible** | `POST/DELETE /api/crm/saved/`, `is_saved` on the artwork |
| **Send Inquiry** (the only contact CTA) | `-darz-web` | **Visible** | `POST /api/crm/requests/` `{kind: information, artwork, detail:{message}, client_req_id}` |
| Chat — collector ↔ Darz Admin | `-darz-web` | **Visible** | `GET/POST /api/crm/requests/{id}/messages/`, `…/mark-seen/`; general chat = `Request(kind=message)` |
| Records — artist auction records, Cards/List, insights | `-darz-web` | **Visible** (5 houses) | `GET /api/auctions/records/` (+`/{id}/`); insights computed client-side |
| Profile — saved, inquiries, activity, account | `-darz-web` | **Visible** | `GET /api/crm/requests/`, `/api/crm/saved/`, `/api/auth/me/` |
| Settings (v0.1 set) | `-darz-web` | **Visible** | `GET /api/auth/me/`, `POST /api/auth/logout/` |
| Admin request feed (`/admin/requests`) | `-darz-web` | URL-only (team principal) | `GET /api/crm/admin/requests/`, `…/messages/` |
| Buy now · 24h hold · Request viewing · Make an offer · Request price | `-darz-web` (built, Phase 5) | **Hidden** `commerceActions` | `POST /api/crm/requests/` other kinds |
| Auctions — events, lots, bidding, registration, countdowns, notifications | `-darz-web` (built, Phase 8) | **Hidden** `auctions` | `/api/auctions/*`, WS |
| Questionnaire | neither yet (backend Phase 25) | **Hidden** `questionnaire` | — |
| AI chat, gallery/artist chat | old app only / does not exist | **Hidden** `aiChat`, `galleryChat` | — |
| Insights & Stories | old app only (DEC-6) | **Hidden** `stories` | — |
| Recommendations, membership, push | backend ready, no UI | **Hidden** | `/api/recommendations/*`, `/api/auth/membership/redeem/`, `/api/notifications/push/*` |
| Availability check · Submissions · Artwork requests · Matching · Admin CRM · Publication | `darzstudio.art` (Phase 2 preparation: `packages/domain/availability-check.js`, `collector-loop.js`, `audit-trail.js`, `docs/darz-market/15-post-launch-collector-loop.md`) | **Future** — not in `-darz-web` | none yet |

## 2. What v0.1 shows, and where it came from

- **Nav** — `Market → Records → Chat → Profile → Settings`, one `<nav id="nav">` (bottom bar on a
  phone, editorial top bar on desktop), ported from `app.html:2685-2693` + `:445-466` / `:1462-1471`.
  Auctions / Insights buttons are rendered only when their flag is on. Hidden routes redirect to
  Market (`isHiddenPath`), so deep links, bookmarks and typed URLs cannot reach them.
- **Artwork detail** — artist · title · year · medium · size · price · availability pill (when not
  available) · Save · **Send Inquiry**. The sheet is the old "Request Price & Availability" sheet
  (`DZ._reqPriceDo`, `app.html:11046`) in the offer-sheet chrome; success shows only after the
  backend confirmed (201 created, or 200 replayed on the same `client_req_id`). A work with an open
  inquiry shows "Inquiry sent · Open the conversation" instead of a second Send.
- **Inquiry → Admin → Chat → Profile** — the request lands in the admin feed with a `New` chip
  (`unread_count`); the admin reply arrives on the thread (`/chat/:id`, polling ~30s + on focus);
  the inquiry is listed under Profile › Market and Overview › Recent activity, linked to the
  collector, the artwork, the message, the timestamp and the status.
- **Records** — artist landing (`recordsView` "Artist" sub-tab, `app.html:5004-5025`) with
  Cards / List; per-artist page with the `.dza-stat2` metric grid (`artistView`, `:5341-5381`)
  and results over time; record detail with the full `.rec2-dl` spec list. Only Sotheby's,
  Christie's, Bonhams, Tehran Auction and Millon (`insights.V0_1_HOUSES`); everything is computed
  inside one currency from sold results; a block with too little data does not render.
- **Images** — one rule everywhere: the work is absolutely fitted into a definite 4/5 box and
  `object-fit: contain` letterboxes it (`app.html:1585, :1599`; the universal card in
  `darzstudio.art/packages/ui/artwork-card.js`). Catalogue, Saved, Profile, artist works, Records
  cards/rows/detail, Chat thumbnails and the thread header all show the whole work.

## 3. Verified end to end (2026-09-11, local backend + seeded data, Playwright at 390px and 1440px)

| Flow | Result |
|---|---|
| Market → Save | saved; `/saved` and Profile › Market list it; unsave removes it |
| Market → Send Inquiry → Admin → Chat → Profile | `POST` 201 → admin feed row (kind information, status new, collector + artwork names, unread 1, message in detail) → admin reply `POST …/messages/` 201 → collector thread shows the reply and marks it seen → Profile shows the inquiry |
| Artist → Records → Insights | artist page links to `/records/artist/:id`; metrics + results-over-time render from the seeded records; Phillips records are excluded |
| Profile → Saved / Inquiries / Activity | Overview tiles + Recent activity; Market anchor with filter chips; Account |
| Chat | general "Chat with Darz" created once (idempotent `client_req_id`), thread posts and polls |
| Settings | Appearance Paper/Black, links, Leave the Room |
| Hidden deep links | `/auctions`, `/auctions/lots/x`, `/auctions/notifications` → `/` |

Gates: `tsc -b --noEmit` clean · `oxlint` clean (one pre-existing warning) · `vitest` 98/98 (17 files) ·
`vite build` ok.

## 4. Flags for the owner (decisions, not omissions)

1. **Nav "Chat" tab** — the old app opened chat from a floating pill and Profile; v0.1 gives it a
   nav tab and real routes per the brief.
2. **Frame width 480px** on a phone (old: 430px) — matches every already-approved screen in this
   repo. Change in `shell.css` if the old width is wanted.
3. **Settings › Appearance** — the old app's moon toggle lived in the header; this port has no
   header, so the Paper/Black choice sits under DISPLAY. Notifications, Membership and "Get the
   app" rows are behind flags (no backend / no service worker yet).
4. **Profile › Account is read-only** — the backend has no profile-update or password endpoint;
   the copy says to write to Darz in Chat.
5. **Records house filter is client-side** — the API has no `?house=`; the archive is read once
   per session (≤ 2,000 rows). A server-side house filter would remove that read.
6. **Legal links** point at `darzmarket.art/terms` etc. — the old app rendered inline legal
   sheets (`DZ.legal`); the texts were not ported.
7. **Underlined link text on cards** — pre-existing (`base.css` sets no `text-decoration`),
   flagged in `TASKLIST.md`, not changed.
8. **Admin reply UI** — `/admin/requests` shows the inquiry and its unread state; replying from
   the web admin needs a team sign-in screen (Phase 7). The loop was verified with the admin API.
