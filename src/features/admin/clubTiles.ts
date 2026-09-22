/**
 * The Collector Club desk's overview strip — the old panel's three-stat row
 * (`darz-studio.html:33774`), rebuilt from what this backend can count.
 *
 * **G-CLUB-2, decided 2026-09-22 the same way G-4 was**: build the tiles that
 * are answerable, name the one that is not, fake nothing.
 *
 * | old tile (`:33774`) | here |
 * | --- | --- |
 * | **Private selections** | the selections this desk already loads — no second read |
 * | **Private auctions** | **absent.** Invitation-only auctions do not exist in this backend: `auctions.auction_status` is draft/scheduled/live/closed/cancelled and the model has no invited-keys relation, so there is nothing to count. Backend gap **G-CLUB-3**, already recorded on the desk for the "Auction access" section it also blocks |
 * | **Collector keys** | the collector roster's `total_count` |
 *
 * The old panel greys "Private auctions" (`'#9A9A9A'` at its call site) rather
 * than colouring it — a tile it treats as informational. That does not make it
 * optional here; it is simply unanswerable, and a `0` would be the worse lie,
 * since zero private auctions and no such concept read identically on screen
 * and mean different things.
 *
 * **"Collector keys" is the roster count, and that is the old panel's meaning
 * too.** `nKeys` there counts collector records, not issued key strings — a
 * collector IS a key in that model. This backend separates the two
 * (`Collector` has an access key), but the count the tile asks for is the
 * number of people who can be invited, which is the roster.
 *
 * Counts, not an aggregate endpoint, for the reason `collectorTiles.ts` gives:
 * one `per_page: 1` read whose `total_count` comes back in the envelope, and a
 * failed read shows `—` rather than a confident zero.
 */

export interface ClubCounts {
  /** `null` = not loaded yet, or the read failed. */
  selections: number | null;
  keys: number | null;
}

export interface ClubTile {
  key: string;
  label: string;
  value: string;
}

/* No `EMPTY_CLUB_COUNTS` constant, unlike `collectorTiles.ts`: this desk
   already holds the selections list, so its two counts are composed at the
   call site from a list it has and one number it fetches. A shared "nothing
   loaded" object would only be a second place for `null` to be written. */

function show(n: number | null): string {
  return n === null ? '—' : n.toLocaleString('en-US');
}

export function clubTiles(counts: ClubCounts): ClubTile[] {
  return [
    { key: 'selections', label: 'Private selections', value: show(counts.selections) },
    { key: 'keys', label: 'Collector keys', value: show(counts.keys) },
  ];
}
