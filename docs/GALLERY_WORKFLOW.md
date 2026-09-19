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
| 5   | Gallery | portal › Pricelists                             | Sends a pricelist file.                                                                                          |
| 6   | Gallery | portal › Exhibitions                            | Starts a show, ticks the services it wants, sends it.                                                            |
| 7   | Darz    | the partner page, or Dashboard › Exhibitions    | Sees the request — the dashboard tile links straight to the queue.                                               |
| 8   | Darz    | the composer                                    | The package opens **priced from the service catalogue**, edits it, approves.                                     |
| 9   | Darz    | the composer                                    | Publishes to the portal, then issues the proposal and the invoice (created, rendered and confirmed in one step). |
| 10  | Gallery | portal › Exhibitions                            | Sees the priced package and the documents; accepts/signs by name.                                                |
| 11  | Darz    | the partner page                                | Every document issued to this partner, and every pricelist they sent, in one place.                              |

## Where prices come from

There are two price lists and they are not the same thing, which matters:

- **The portal's starting menu** — `darzmarket-api/apps/gallery/exhibition_catalogue.py`, a Python
  constant. It is what a gallery sees _before_ Darz has composed anything. **Nothing in the panel
  can change it** (G-PORT-12b); that needs the backend.
- **The service catalogue** — `/projects/admin/service-catalog/`, real rows, one click to edit at
  Projects › Packages › Service catalogue. **This is the price list for everything Darz sends.** The
  composer reads it (`priceList.ts`), and the calculator and the package templates already did.

So: edit a price there, and the next package, proposal and invoice follow. The gallery sees Darz's
price the moment a package is composed. Prices are expected to change — the catalogue is where.

Two rules the join keeps, and will not bend:

- **It never converts a currency.** Nothing stores an exchange rate (G-PROJ-9). A list in Toman
  contributes nothing to a package quoted in USD: the line stays blank and the desk says why.
- **It never invents a price.** No catalogue row, or a row at 0, seeds blank — and a 0 row reads
  "not priced yet", because "0 TMN" looks like free and is not.

The join is **by name**, case-folded — the same key the seed uses. Rename a catalogue row and its
price stops reaching the composer, which is why the composer states how many lines carried over
rather than leaving it to be noticed on the invoice.

## What the walk found

|     | Finding                                                                                                                                                              | State                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| F1  | The composer opened **blank** although the gallery had been shown T 700,000 — Darz retyped from memory, and a slip would put a different number on the client's PDF. | **closed** — priced from the catalogue, descriptions too                            |
| F2  | A gallery's **pricelist was invisible** to Darz: the portal uploaded it, the backend stored it, the admin endpoint existed, and nothing here ever asked.             | **closed** — listed on the partner page                                             |
| F3  | No price the gallery sees was editable from the panel.                                                                                                               | **closed for what Darz sends**; the pre-request menu needs the backend (G-PORT-12b) |
| F4  | Inviting a gallery meant copying two boxes and writing the covering note again for every partner.                                                                    | **closed** — the invitation, from the old panel's own templates                     |
| F5  | A **lost portal link is a dead end** — no re-issue, no PATCH.                                                                                                        | **stated** on the record (G-PORT-13); needs the backend                             |
| F6  | The partner list had no search, and showed an internal switch (`feat_funnel`) where the state of the relationship belongs.                                           | **closed** — search + a Waiting column (G-PORT-15)                                  |
| F7  | After issuing, no way into the new partner.                                                                                                                          | **closed**                                                                          |
| F8  | "1 awaiting review" on the dashboard was not a link.                                                                                                                 | **closed** — that tile and four others                                              |
| F9  | Proposals and invoices were buried one show at a time.                                                                                                               | **closed** — gathered on the partner page                                           |
| F10 | Two service catalogues with the same eight services and nothing joining them.                                                                                        | **closed** — the composer joins them                                                |

## What is still owed, and by whom

- **The backend**: an admin read of the exhibition catalogue (or the menu as data, so the _starting_
  prices become editable); a re-issue for a lost link; the pricelist file served to the desk; a
  `description` field on a catalogue line; `?search=` on partners.
- **The owner**: the 23 unpriced coverage services carry no price yet, and three look-alike pairs
  (Installation photography / Exhibition Photo Coverage · Video walkthrough / Video Documentation ·
  Collector network push / Darz Listing) are either one service or two — a business call, not one
  this app should guess.
