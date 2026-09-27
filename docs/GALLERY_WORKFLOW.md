# The gallery workflow — how the pieces actually connect

**Written 2026-09-19** after walking the whole chain live, once as Darz and once as a gallery. It
records what the loop _is_, the ten things the walk found, and which of them are closed.

The shape to keep in mind: Darz is a small gallery-services business, and the app is the place a
gallery relationship lives. One partner record, one no-login portal for them, one price list for
everything Darz quotes, and a paper trail either side can point at.

## The loop, in the order it happens

| #   | Who     | Where                                           | What                                                                                                             |
| --- | ------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Darz    | Galleries › Sources & Partners › ＋ New partner | The record, and the portal sign-in (token + PIN) — **shown once**.                                               |
| 2   | Darz    | the issue card                                  | Copies the **invitation** — the message already carries the link and the code.                                   |
| 3   | Gallery | `/portal/{token}`                               | Enters the six-digit code. No account, no password.                                                              |
| 4   | Gallery | portal › Your works                             | Confirms availability, corrects a price, adds a work. Nothing publishes — every update is reviewed.              |
| 5   | Gallery | portal › Pricelists                             | Sends a pricelist file, or builds one line by line; sees each one's status (V1 Phase 5).                        |
| 6   | Gallery | portal › Exhibitions                            | Starts a show, ticks the services it wants, sends it.                                                            |
| 7   | Darz    | the partner page, or Dashboard › Exhibitions    | Sees the request — the dashboard tile links straight to the queue.                                               |
| 8 | Darz | the composer | The package opens **priced from the Exhibition Services menu** (Service checklist), with a quantity per line; edits it, approves, publishes to the portal. |
| 9 | Darz | **Issue a document** | One page: the show, proposal or invoice, services from the library, quantity and terms, the document on screen as it will be read, one button to issue it. |
| 10  | Gallery | portal › Exhibitions                            | Sees the priced package and the documents; accepts/signs by name.                                                |
| 11  | Darz    | the partner page                                | Every document issued to this partner, and every pricelist they sent, in one place.                              |

## Where prices come from

**Updated by V1 Phase 5 (2026-09-25).** Two price lists, still not the same thing:

- **The Exhibition Services menu** — the editable table the portal reads before Darz composes
  (`/gallery/admin/exhibition-catalogue/`, G-PORT-12b), edited at **Galleries › Service checklist**.
  The composer seeds a request's lines from it too (its Toman defaults), so what the gallery was
  shown is what the desk starts from. (The old name-join onto the Projects list, `priceList.ts`,
  is gone.)
- **The service catalogue** — **Galleries › Exhibition Services** (the Projects desk reads the same
  rows). The issue page and the calculator build from it; each row now has its own `description`
  (G-PROJ-8).

## What the walk found

|     | Finding                                                                                                                                                              | State                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| F1  | The composer opened **blank** although the gallery had been shown T 700,000 — Darz retyped from memory, and a slip would put a different number on the client's PDF. | **closed** — priced from the catalogue, descriptions too                            |
| F2  | A gallery's **pricelist was invisible** to Darz: the portal uploaded it, the backend stored it, the admin endpoint existed, and nothing here ever asked.             | **closed** — listed on the partner page                                             |
| F3  | No price the gallery sees was editable from the panel.                                                                                                               | **closed** — the pre-request menu is the Service checklist desk (Phase 5, G-PORT-12b)       |
| F4  | Inviting a gallery meant copying two boxes and writing the covering note again for every partner.                                                                    | **closed** — the invitation, from the old panel's own templates                     |
| F5  | A **lost portal link is a dead end** — no re-issue, no PATCH.                                                                                                        | **closed** — Regenerate on the partner page (Phase 5, G-PORT-13)                    |
| F6  | The partner list had no search, and showed an internal switch (`feat_funnel`) where the state of the relationship belongs.                                           | **closed** — search + a Waiting column (G-PORT-15)                                  |
| F7  | After issuing, no way into the new partner.                                                                                                                          | **closed**                                                                          |
| F8  | "1 awaiting review" on the dashboard was not a link.                                                                                                                 | **closed** — that tile and four others                                              |
| F9  | Proposals and invoices were buried one show at a time.                                                                                                               | **closed** — gathered on the partner page                                           |
| F10 | Two service catalogues with the same eight services and nothing joining them.                                                                                        | **closed** — the composer joins them                                                |

## What is still owed, and by whom

- **The backend**: a URL for a submitted replacement photo, so the desk can show it (C-12); the
  security items in C-13 before any real link is issued; a pricelist `status` entry in
  `/api/options/` (C-14).
- **The owner**: the 20 unpriced coverage services carry no price yet — they read "quoted per show"
  until one is set. **Darz's own coverage menus carry no prices at all** (`coverage-packages.html`,
  `darz-studio.html`'s `COV_CHK`), so there is nothing real to seed them from and no figure this app
  should invent. **Galleries › Exhibition Services › "Price them all in one pass"** puts every one
  of them in a single column to type down.

**Ruled 2026-09-19:** the four look-alike pairs (Installation photography / Exhibition Photo
Coverage · Video walkthrough / Video Documentation · Artist interview / Artist Interview ·
Collector network push / Darz Listing) **are one service each**. Each is a single catalogue row on
the exhibition side, which is both the name the gallery's portal shows and the name the composer
joins prices by. No price was invented by the merge. A workspace seeded before the ruling still
holds the folded rows; the Packages desk names them and **"Tidy them up"** re-points the
programmes onto the merged services and then deletes the rows, in that order (`tidyUp.ts`).
