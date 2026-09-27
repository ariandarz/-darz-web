import { describe, expect, it } from 'vitest';
import { houseOptions, REC_KNOWN_HOUSES } from './recordHouses';

describe('houseOptions — the old "standard houses + any in the data" rule', () => {
  it('offers the standard houses alone before the data arrives, A–Z', () => {
    const list = houseOptions([]);
    expect(list).toHaveLength(REC_KNOWN_HOUSES.length);
    expect(list).toEqual([...list].sort((a, b) => a.localeCompare(b)));
  });

  it('adds stored houses, de-duplicated on a normalised name', () => {
    const list = houseOptions(['Artcurial', 'artcurial ', null, '', 'Phillips']);
    expect(list.filter((h) => h.toLowerCase().trim() === 'artcurial')).toHaveLength(1);
    expect(list.filter((h) => h === 'Phillips')).toHaveLength(1);
  });

  it('prefers the stored spelling, since the server filter is exact', () => {
    const list = houseOptions(["Christie's"], ['Christie’s', 'Bonhams']);
    expect(list).toEqual(['Bonhams', "Christie's"]);
  });
});
