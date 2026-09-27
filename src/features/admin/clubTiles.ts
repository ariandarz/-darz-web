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
 * | **Private auctions** | **not built yet — Phase 9.** Invite-only auctions exist now (G-CLUB-3 closed, `Auction.invite_only`) and are managed on the auction's own page; the Club's tile and its "Auction access" section are an owner-gated Phase 9 item (Q-5), see `ClubPage.tsx` |
 * | **Collector keys** | the collector roster's `total_count` |
 *
 * The old panel greys "Private auctions" (`'#9A9A9A'` at its call site) — a tile
 * it treats as informational; it returns with the section it summarises.
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
