/**
 * The Auction Records desk's "All auction houses" options (G-REC-1).
 *
 * The old desk built its house list as **the standard houses plus any house
 * in the data**, de-duplicated on a normalised name and sorted A–Z
 * (`recHouseMS`, `darz-studio.html:20303-20305`; the standard list is
 * `REC_KNOWN_HOUSES`, `:19950`). The backend has no house facet endpoint —
 * `?house=` is an EXACT match on the free-text field — so the data half comes
 * from walking the records list once, and where a standard name and a stored
 * spelling normalise the same, **the stored spelling wins** (the old list
 * kept the standard one first; here that would offer an option whose exact
 * filter matches nothing).
 *
 * The old control was a multi-select popover; the API filters on one house,
 * so this is a single select with the old placeholder.
 */

/** `REC_KNOWN_HOUSES` (`:19950`), verbatim. */
export const REC_KNOWN_HOUSES: readonly string[] = [
  'Christie’s',
  'Sotheby’s',
  'Phillips',
  'Bonhams',
  'Tehran Auction',
  'Millon',
  'Millennium',
  'Bonhams Skinner',
  'Hindman',
  'Heritage',
];

/** The old `_recnm`: case- and whitespace-insensitive, apostrophes folded. */
function norm(name: string): string {
  return name.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
}

export function houseOptions(
  stored: ReadonlyArray<string | null | undefined>,
  known: readonly string[] = REC_KNOWN_HOUSES,
): string[] {
  const byKey = new Map<string, string>();
  for (const h of known) {
    const name = h.trim();
    if (name) byKey.set(norm(name), name);
  }
  for (const h of stored) {
    const name = (h ?? '').trim();
    if (name) byKey.set(norm(name), name); // the stored spelling wins
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}
