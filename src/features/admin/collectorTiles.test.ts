/** The overview strip's one rule that matters: an unknown count and a count
 * of zero are different facts, and the tile must not conflate them. */
import { describe, expect, it } from 'vitest';
import { EMPTY_COUNTS, collectorTiles } from './collectorTiles';

describe('collectorTiles', () => {
  it('renders the three tiles this backend can answer', () => {
    const tiles = collectorTiles({ total: 128, vip: 9, active: 96 });
    expect(tiles.map((t) => [t.label, t.value])).toEqual([
      ['Collectors', '128'],
      ['VIP', '9'],
      ['Active', '96'],
    ]);
  });

  it('shows an em dash for a count that has not arrived or failed', () => {
    expect(collectorTiles(EMPTY_COUNTS).map((t) => t.value)).toEqual(['—', '—', '—']);
  });

  it('a real zero is shown as zero, not as unknown', () => {
    const tiles = collectorTiles({ total: 0, vip: 0, active: 0 });
    expect(tiles.map((t) => t.value)).toEqual(['0', '0', '0']);
  });

  it('a partial load shows what it knows and dashes the rest', () => {
    const tiles = collectorTiles({ total: 40, vip: null, active: 12 });
    expect(tiles.map((t) => t.value)).toEqual(['40', '—', '12']);
  });

  it('groups thousands, so a large roster stays readable', () => {
    expect(collectorTiles({ total: 12345, vip: null, active: null })[0].value).toBe('12,345');
  });

  it('the Active tile carries its caveat — it is access, not the old "Active 30d"', () => {
    expect(collectorTiles(EMPTY_COUNTS).find((t) => t.key === 'active')?.note).toBe(
      'access is open',
    );
  });
});
