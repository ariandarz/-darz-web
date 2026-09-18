# The admin panel — one system

**Status:** living document · **Created:** 2026-09-18 ·
**Sources:** `darzstudio.art` `darz-studio.html` (the old admin app — *not* `app.html`) ·
`darz-backend-api` @ `development` `12988db` · this repo @ `development`.

The panel is **14 groups and 55 tabs**. `docs/PHASE_11B_PLAN.md` covers 11 of those tabs; this
document covers all of them, and the shared decisions that make them one system rather than 55
pages. It is the answer to "is this accounted for, and how does it fit together".

---

## 1 · The rule: port the content, modernise the mechanics

Owner decision, 2026-09-18. CLAUDE.md's hard constraint (faithful port, invent nothing) and the
instruction to build "modern, easy-to-use workflows... one coherent system" are reconciled like this,
and the line is drawn at a test you can apply to any single question:

> **Content is what the desk is about. Mechanics is how you operate it.**
>
> A field, a status, a rule, a label, a confirmation's wording, which action exists, who may do it —
> **content. Ported, never invented, never dropped.**
>
> How a table scrolls, where a filter's label sits, whether an error is a toast or a banner, how a
> page is addressed, whether a control is reachable by keyboard — **mechanics. Rebuilt to one
> pattern.**

And one carve-out, which is the same call backend Phase 23 already made with Data Health:

> A pattern that exists **only because of the old app's architecture** does not port. The old panel
> is a 4.8 MB single file with a client-local snapshot mirrored to the cloud; it has device-drift
> diagnostics, tombstone reconciliation, a "Confirmed & Saved" global commit and a
> "not connected to the cloud" banner. **None of that exists here** — one Postgres, one request per
> action. Porting those would be porting a problem we do not have.

Every desk's PR names what it changed under this rule. Nothing is dropped silently (CLAUDE.md
rule 6): a field the backend cannot serve stays visible and says so.

---

## 2 · The map

Source: `src/features/admin/adminNav.ts`, ported from `ADGROUPS` (`darz-studio.html:11721-11779`).
**That file is the map** — it carries every tab's route, API state, owning phase and blocking note,
so this table cannot drift away from what the navbar does. Tests assert the counts.

`✅` API ready · `◐` partly served · `✗` no API.

| Group | Tabs | API | Owns it |
|---|---|---|---|
| *(no group)* | **Dashboard** `:11088` | ✅ | 11b·1 |
| *(no group)* | **Chat** `:11099` — the admin end of the collector conversation | ✅ | 11b·3 |
| **Artworks** | Database · Import | ✅ ✅ | 7 · 11b·6 |
| **Artists** | Artists | ✅ | 7 |
| **Galleries** | Galleries · Sources & Partners | ✅ ✅ | 10 |
| **Market App** | Published works · **App Design** | ✅ ✅ | 7 · 11b·5 |
| **Documents** | Proposals · Invoices · Library · History · Pricelists & saved items · Document Builder | ✅✅✅✅ ✗ ✅ | 11 · *(Pricelists: backend P21)* |
| **Auctions** | Live Auctions · Auction Records · Register to Bid | ✅ ✅ ✅ | 7 |
| **Collectors** *(More)* | Collectors · Requests & Activity · Collector Club | ✅ ✅ ✅ | 11b·2-3 |
| **Sales** *(More)* | Market Sales · Auction Sales | ✅ ✅ | 7 |
| **Projects** *(More)* | Dashboard · Projects · Pipeline · Packages · Proposal · Calculator · Partners · Reports | ✅×7, ✗ Proposal | 11c |
| **Intelligence** *(More)* | Overview · Tagging & Review · Smart Filters · Recommendations · History | ✅×5 | 11 |
| **Operations** *(More)* | **App Design** · Logistics & Payments · Analytics · Data Health | ✅ ✗ ✗ ◐ | 11b·5-6 · *(P20; no analytics API)* |
| **Social** 🔒 | Instagram · **Insights & Stories** · Content Calendar · AI Settings | ✗ ✗ ✗ ✗ | *(backend deliberately unscoped; Stories = P22)* |
| **Owner** 🔒 | Access · Team · Strategy · Marketing · Accounting · Automations · Settings · Languages · Market Portal | ✅✅ ✗ ✅✅ ✗ ◐ ✗ ✅ | 11b·2-4 · 11 · 10 |
| **Access Management** 🔒 | Memberships · Access Request | ✅ ✅ | 11b·4 · 11b·2 |

🔒 = owner-only (`OWNER_ONLY`, `:11800`). **The owner always sees every tab** (`:11794`, verbatim).

Three structural facts that are easy to get wrong, all ported:

- **App Design is in two groups** (Market App *and* Operations). One screen, two entry points.
- **Dashboard and Chat belong to no group**, which is why neither opens a second row (`:11832`).
- **`more` is not a group** — it is the menu for the five folded ones (`AD_FOLDED`, `:11781`).

**"News" is not a desk in this system.** The nearest thing is **Insights & Stories** (owner decision,
2026-09-18), an editorial desk in the Social group; backend Phase 22 is unbuilt.

### What is genuinely blocked on the backend

Everything else is waiting on UI only — **141 admin routes exist and this frontend calls ~20.**

| Blocked | Why |
|---|---|
| Logistics & Payments | backend Phase 20 not built |
| Pricelists & saved items | backend Phase 21 not built |
| Insights & Stories | backend Phase 22 not built |
| Languages / white-label | backend Phase 26 not built |
| Analytics | no analytics API; the Dashboard summary is the only aggregate |
| Instagram · Content Calendar · AI Settings · Strategy · Automations | **deliberately unscoped** by the backend, awaiting an owner decision there |
| Projects › Proposal | Proposal Builder composition unbuilt on both sides |

### Gaps found while building (the frontend designs around these; none blocks a desk)

| Id | Gap | What the frontend does |
|---|---|---|
| **G-CHAT-1** | **No `GET /api/crm/admin/requests/{id}/`** — the unified list is the only admin read of a request, and its query takes no id. A conversation opened by URL alone has nothing to name the collector with. | The Chat list passes its row as router state; on a pasted link the thread header says "Conversation" and the thread itself is complete. Worth a detail endpoint when the backend next touches crm. |
| **G-CHAT-2** | **No text search on the admin request list** — the old Chat's search box was client-side over its in-memory store; this list is paginated server-side. | No search box (a fake one that only searched the loaded page would lie). Raise `?q=` with the backend when Chat gets heavy use. |
| **G-DASH-1** | **`KIND_INITIAL_STATUS` is not published.** The Dashboard's per-kind counts are taken at each kind's "just arrived" status, but `/api/options/` serves only the full per-kind vocabulary — nothing marks which status is the initial one, so the tile → filtered-list link (":21349"'s counter-equals-list rule) has no served value to filter by. | The first entry of `crm.request_status_by_kind[kind]` is used — the builder lists source states in definition order and every machine is written initial-first, so it is right today, and a future reorder mis-filters **visibly** rather than silently. Publish `KIND_INITIAL_STATUS` (or put the status in the summary payload) to close it. |
| **G-COL-1** | **No roster aggregates** — the old Collectors overview strip (Collectors · VIP · Active 30d · Engaged, `:32634`) was computed client-side from the full in-memory roster; the roster here is paginated and nothing serves those numbers. | The strip is not ported; the Dashboard's Collectors section carries the total/active that Phase 29 chose to serve. |
| **G-COL-2** | **No activity/purchase rollups on the collector list** — the old "Recently active" / "Most purchases" sorts ranked by rollups the list endpoint does not carry; `ordering` serves name/created only. | The two sorts are absent, not faked. |
| **G-KEY-1** | **No roster-wide access-key list** — keys are served per collector only, so the old owner "Access" desk (every key, expiring-soon review, logins today, `:33029`) cannot be built faithfully. | The per-collector half lives in the Collectors workspace; the standalone desk waits on a `GET /admin/access-keys/` list. |
| **G-DOC-1** | *(see §5)* no document ref on `RequestMessage`. | Share by link. |

---

## 3 · The desk kit — why a new desk is assembly, not invention

`src/features/admin/kit/`. Sixteen desks writing their own table is how a panel drifts into sixteen
looks; the kit is the shared vocabulary that stops it.

| Piece | What it owns |
|---|---|
| `DeskPage` | heading, the desk's primary action, the filter toolbar, the body |
| `DeskList` | the four-way body — **loading / error / empty / rows** — plus the banner and pager |
| `DataTable` + `Column<T>` | the one table (`.ad-card > .ad-scroll > .ad-tbl`) |
| `SelectFilter` · `SearchFilter` · `ToggleFilter` | the toolbar controls; empty means *no filter*, sent as `undefined` |
| `ConfirmDialog` | the old `dzConfirm(message, {okLabel})` shape, plus `danger` |
| `ShownOnceSecret` | the credential four endpoints return once and never again |
| `deskState.ts` | the two rules below — pure, and the only part with tests |

Two rules the kit fixes once for the whole panel, both easy to get wrong alone:

- **A reload never flashes the table away.** Rows win over `loading`, so filtering a desk does not
  blink.
- **An error never hides rows.** A failed refresh leaves the last good page usable; the failure is a
  banner. A failed row action wins over a failed load, because it is what the person just did.

### Adding a desk

1. A `ListController` subclass for its endpoint (extend the base — a second subclass duplicating a
   first one's state machine is a bug, per CLAUDE.md).
2. A page: `<DeskPage>` + filters + `<DeskList>` + a `Column<T>[]`. The desk supplies its columns,
   its filters' vocabulary and its actions — nothing else.
3. Its route in `src/routes.tsx`.
4. **Its `path` in `adminNav.ts`** — until then the navbar does not know it exists.

`AdminRequestsPage` is the worked example: after moving onto the kit it is columns, filters and one
transition action, and nothing about chrome.

---

## 4 · The owner controls the collector app from the panel

Owner instruction, 2026-09-18. This is architecturally the most important thread in the panel, and
the pieces for it already exist on both sides.

**The old app already worked this way.** Its owner settings were a theme blob:
`theme.navOff` (which nav sections show), `theme.detailBtns` (which collector actions the artwork
detail renders), `theme.showQ`, `theme.chatAI`, `theme.storiesShow`. `src/features/shell/features.ts`
was ported from exactly those and says so in its own header — including the line that is now out of
date: *"There is no runtime/owner toggle yet... the new backend has no equivalent."*

**It has one.** Backend Phase 32's `core.AppTheme` is a **freeform JSON singleton** with:

- `GET /api/app-theme/` — **`AllowAny`, readable before sign-in**
- `GET/PUT /api/admin/app-theme/` + `POST .../reset/`
- named version checkpoints: `GET/POST .../versions/`, `POST .../versions/{id}/activate/`, `DELETE`

with **no fixed schema on either side** — the backend stores and versions, the app decides what the
keys mean. So:

```
theme.features    -> the FeatureFlags table, owner-switchable at runtime
theme.contact     -> the WhatsApp number
theme.copy        -> hero, About, shipNote, Terms, Privacy
theme.social      -> the social links
theme.design      -> colours, layout, stats strip, per-page buttons
```

**How it lands** (Phase 11b Step 5, both halves):

- `features.ts` gains a runtime source: read `GET /api/app-theme/` at boot, merge `theme.features`
  over the built-in defaults. `VITE_FEATURE_SET` stays as the **fallback** when the fetch fails, so
  a dead theme endpoint can never dark-screen the app. The flags stay one typed table read by the
  nav, the route table, the artwork detail and the profile — only their *source* changes.
- The App Design desk edits them as **real switches, not raw JSON** — the desk knows the schema even
  though the store does not.
- Versions give the owner *try it, revert it*: publish, look, `activate` the previous checkpoint.

**This also closes several open items in `docs/API_INTEGRATION_GAPS.md` at once** — the WhatsApp
number, hero copy, About text, social links, `shipNote` and Terms/Privacy are hardcoded today and
have nowhere to live; `theme.copy` is that home.

One thing to decide before building it (**D17**): the key names. My recommendation is to take them
from the old panel's own `app_theme` payload rather than invent a scheme, so a migration of the real
production theme is a copy rather than a translation.

---

## 5 · Documents: one studio, not five builders

Owner instruction, 2026-09-18 — *"find the best and easiest solution for getting them generated easy
in admin and share with users"*.

**The backend was designed for exactly this, and it says so.** `apps/documents/models.py`'s own
docstring:

> *"PDF rendering stays client-side (owner decision, 2026-09-03) — this backend stores the finished
> PDF + versions it... all UI/rendering work lives in the separate frontend repo."*

And `Document` is deliberately generic: `{kind, title, fields (JSON), status, visibility, pdf_path}`
with **`kind` freeform, not a choice list** — the docstring notes legal Terms/Privacy are just a
`Document` with `kind="legal_terms"`.

So the easy solution is **not** an invoice builder plus a proposal builder plus a pricelist builder.
It is **one Document Studio** and a template registry:

```
template = { kind, title, fields: FieldSchema[], layout: React component }
```

- **Generate**: pick a template → fill the fields (a generated form from `FieldSchema`) → live
  preview beside the form → `POST /admin/documents/` saves the draft (`fields` is the JSON, so a
  draft is editable forever) → `confirm/` freezes it → render the PDF → `upload/` stores the bytes.
- **Reuse**: a new proposal is a copy of the last one with fields changed. Because `fields` is data,
  duplicating a document is a data copy, not a re-typing.
- **Share**: `visibility` chooses the storage folder — `public` yields a link anyone can open,
  `private` a presigned one.

Adding a document type is then **one template object**, not a new desk. Proposals, Invoices,
Library, History and the Document Builder tabs all become views over one store, filtered by `kind` —
which is what the old panel's own sticky `docsTab` sub-tab already was.

**One decision (D18): how the PDF is produced.** `@media print` + `window.print()` is free and uses
the browser's own engine, but it cannot hand you the bytes that `upload/` needs.
My recommendation is **`@react-pdf/renderer`**: templates stay React, the output is real
text-selectable vector PDF (not a screenshot, which `html2canvas` gives), and the same component
tree renders the on-screen preview. Cost: roughly half a megabyte, and it is worth confirming
against the current 424 kB bundle before committing.

**One real gap (G-DOC-1), flagged not designed around.** A document can reach a *gallery* — the
portal serves exhibition documents and takes signatures
(`portal/{token}/exhibitions/{id}/documents/{id}/sign/`). It cannot reach a **collector**:
`RequestMessage` carries `artwork_refs` but has **no document ref**, so there is no way to attach a
proposal or invoice to a collector's thread. Until the backend adds one, the panel shares a
collector document by pasting its link into the thread — which works, and is worth saying out loud
rather than pretending the attach exists.

---

## 6 · Build order

Everything below assumes the desk kit, which is done.

| | | Why here |
|---|---|---|
| **1** | Dashboard · Chat | The two group-less tabs. Fills the top row; Chat is the other half of a collector loop that already half-exists. |
| **2** | Collectors group + Access keys + Access Requests | The "who gets in" cluster. Closes a live hole — requests submitted through the form we shipped are invisible outside Django admin. |
| **3** | **App Design, both halves** | Promoted. Once `theme.features` is live the owner controls the collector app, and several hardcoded strings get a home. Everything after it can be switched on and off by the owner rather than by a deploy. |
| **4** | Owner + Access Management (Memberships, Team, Accounting, Marketing, Settings/Audit) | Owner-only, mostly small CRUD, all shown-once-secret shaped. Accounting is the biggest (15 routes, 4 ledgers + Private Deals). |
| **5** | Artworks · Artists · Market App · Sales | The catalogue core — the largest API surface and the most-used desks. |
| **6** | Documents studio | §5. After the catalogue, because a pricelist and a proposal both reference works. |
| **7** | Galleries + Sources & Partners + Market Portal | The gallery loop, including the no-login portal. |
| **8** | Auctions admin · Intelligence · Data Health · Import | |
| **9** | Projects (Phase 11c) | Its own plan — ~2,300 lines of old source, eight sub-tabs. |
| — | Social · Logistics · Analytics · Languages · Strategy · Automations | Blocked on the backend. UI-only work is possible for **Insights & Stories** if the owner wants it ahead of its API. |

---

## Open decisions

| # | Question | Recommendation |
|---|---|---|
| **D17** | `theme.*` key names for the owner-controlled flags and copy | Take them from the old panel's own `app_theme` payload, so migrating the real production theme is a copy not a translation |
| **D18** | How the Document Studio renders a PDF | `@react-pdf/renderer` — real vector PDF, React templates, same tree for preview; confirm the ~0.5 MB against the current bundle first |
| **D19** | G-DOC-1 — no way to attach a document to a collector's thread | Share by link for now; raise a `document_refs` field on `RequestMessage` with the backend, as `artwork_refs` already is |
| **D20** | Build Insights & Stories UI ahead of backend Phase 22? | Only if you want it soon — otherwise it sits with the other backend-blocked desks |
