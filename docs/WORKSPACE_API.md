# Team Workspace API — frontend build spec (G-TEAM-1)

**Status: backend COMPLETE (2026-10-01).** The old Team tab's "Executive Workspace"
(`darz-studio.html` `teamView` — My workspace · Team workflow · Contacts, plus the
pricelist-approvals box) was client-local in the old app and had **no backend**. It now
has a real one: Django app `apps.workspace` (+ `accounts.TeamLoginEvent`), backend
branches W1–W4, all merged to `darzmarket-api` `development`.

This doc is the contract the frontend builds the Team desk against. Regenerate
`src/api/schema.d.ts` from a running backend before trusting exact shapes
(`CLAUDE.md` → "API access"); the enums and field names below are stable.

All responses use the standard envelope: `{ success, data, message }`. List endpoints
page under `data.results` with the usual pagination block. Every `PATCH` (and the item
toggle) requires `expected_version` (optimistic lock) and returns **409** when stale —
reuse the existing `ConflictBanner` / `optimisticLock` wiring.

Base path: `/api/workspace/`.

---

## 1 · My workspace — personal tasks/notes (owner-only)

Permission: **owner only** (`IsOwner`) — a standard admin gets 403. This is the owner's
private desk (the old "My workspace" tab).

| Method & path | Purpose |
| --- | --- |
| `GET /items/` | List (paginated). |
| `POST /items/` | Create. |
| `GET /items/{id}/` | Retrieve. |
| `PATCH /items/{id}/` | Update (needs `expected_version`). |
| `DELETE /items/{id}/` | Soft-delete (204). |
| `POST /items/{id}/toggle/` | Set done. Body `{ done: bool, expected_version: int }`. |

**Item shape (read):**
```
{ id, kind, category, title, body, due_date, due_time, done, done_at,
  version, created_at, updated_at }
```
- `kind` ∈ `task · followup · call · meeting · reminder · idea · note · opportunity`
- `category` ∈ `urgent · waiting · followup · ideas · personal · darz · koocheh · team`
- `done_at` is server-managed — set when `done` flips true, cleared when false (use the
  `toggle/` endpoint for the checkbox).

**Write fields (POST / PATCH):** `kind, category, title, body, due_date, due_time, done`
(+ `expected_version` on PATCH). Defaults: `kind=task`, `category=personal`.

**List filters (query params):**
- `kind=`, `category=`, `done=true|false`
- `due=today|week|overdue` — due windows over `due_date` (week = today..+7; overdue = past & not done)
- `search=` — over title + body
- `ordering=due|-due|created|-created`

The old desk's six stat tiles (open / follow-ups / overdue / completed / notes / ideas)
are derived client-side from the list, or re-query with the matching filter per tile.

---

## 2 · Team workflow — tasks, time, performance (admin)

Permission: **admin** (`IsStandardAdminOrOwner`) — matches the old "Team workflow" tab
and the gallery approve/reject desk.

| Method & path | Purpose |
| --- | --- |
| `GET /team-tasks/` | List (paginated). |
| `POST /team-tasks/` | Create. |
| `GET /team-tasks/{id}/` | Retrieve. |
| `PATCH /team-tasks/{id}/` | Update (needs `expected_version`). |
| `DELETE /team-tasks/{id}/` | Soft-delete (204). |
| `POST /team-tasks/{id}/log-time/` | Add time. Body `{ minutes: int ≥ 1 }`. |
| `GET /team-tasks/performance/` | Rollups for the two tables (not paginated). |

**Task shape (read):**
```
{ id, title, assignee: { id, name } | null, status, due_date, done_at,
  minutes_logged, version, created_at, updated_at }
```
- `status` ∈ `todo · doing · done` (labels: To do / In progress / Done)
- `minutes_logged` is **derived** (sum of time logs) — read-only; add time via `log-time/`
  (the old `+15m` button posts `{ minutes: 15 }`).
- `done_at` is server-managed, paired to the `done` status.

**Write fields (POST / PATCH):** `title, assignee` (a TeamUser **uuid**, or `null` =
Unassigned), `status, due_date` (+ `expected_version` on PATCH).

**List filters:** `status=`, `assignee=<uuid>`, `search=` (title), `ordering=due|-due|created|-created`.

**`GET /team-tasks/performance/`** → `data`:
```
{
  performance: [   // old "Performance by person" — includes an "Unassigned" row
    { team_user_id|null, name, open, done, done_last_7d, minutes_logged }
  ],
  behaviour: [     // old "Admin behaviour" — one row per admin account
    { team_user_id, name, total_logins, last_login, tasks_done }
  ]
}
```
`total_logins` / `last_login` are real now: team logins are recorded per sign-in
(`accounts.TeamLoginEvent`, written in `TeamAuthService.login`) — nothing tracked them
before, so counts start accruing from the W2 deploy.

---

## 3 · Contacts & follow-ups — mini-CRM (owner-only)

Permission: **owner only** (`IsOwner`).

| Method & path | Purpose |
| --- | --- |
| `GET /contacts/` | List (paginated, priority-ordered). |
| `POST /contacts/` | Create. |
| `GET /contacts/{id}/` | Retrieve. |
| `PATCH /contacts/{id}/` | Update (needs `expected_version`). |
| `DELETE /contacts/{id}/` | Soft-delete (204). |

**Contact shape (read):**
```
{ id, name, company, phone, email, priority,
  last_contact, next_followup, notes,
  collector: { id, display_name } | null,
  artist:    { id, display_name } | null,
  version, created_at, updated_at }
```
- `priority` ∈ `high · med · low` (default `med`).
- `collector` / `artist` are **optional** links (owner decision: standalone + optional
  link). Set them by posting the party's **uuid**; a contact needs neither. Use them to
  render a "jump to collector/artist" affordance without duplicating the record.

**Write fields:** `name, company, phone, email, priority, last_contact, next_followup,
notes, collector` (uuid|null), `artist` (uuid|null) (+ `expected_version` on PATCH).

**List order:** server sorts high→med→low priority, then soonest `next_followup` — so the
list is render-ready; no client re-sort needed.

**List filters:** `priority=`, `followup_due_soon=N` (next-follow-up within N days, default
7, overdue included), `search=` (name + company + email).

The old desk's three tiles (Contacts / Follow-ups due / High priority) are the list length,
`followup_due_soon=7` count, and `priority=high` count.

---

## 4 · Pricelist approvals inbox (admin, read-only)

The old Team desk's "Pricelist approvals" box. Approve/reject already existed on the
gallery side; this just aggregates the pending queue for the desk.

| Method & path | Purpose |
| --- | --- |
| `GET /pricelist-approvals/` | Pending gallery pricelists across every portal link (paginated). |

**Row shape:**
```
{ id, title, notes, status, submitted_at,
  link: { id, name, source_type, contact_name } }
```
Only `status=submitted` rows appear (rows on soft-deleted links are excluded).

**Acting on one** uses the existing gallery endpoint (NOT a workspace route):
`POST /api/gallery/admin/pricelists/{id}/status/` with the accepted/rejected status
(`GalleryService.set_status`). After acting, re-fetch this inbox.

---

## Frontend work to make the section complete

`src/features/admin/TeamPage.tsx` currently renders only the **logins desk** and states
on screen that the Workspace suite has no backend. With the above, grow it into the old
three-tab desk + approvals box:

1. **My workspace** tab (owner-only) → §1.
2. **Team workflow** tab (admin) → §2, incl. the two performance tables.
3. **Contacts** tab (owner-only) → §3.
4. **Pricelist approvals** box (admin) → §4, acting via the gallery status endpoint.

Gate the owner-only tabs behind `RequireOwner`; the standard-admin view shows Team
workflow + approvals only. Remove the "no backend" copy once wired.
