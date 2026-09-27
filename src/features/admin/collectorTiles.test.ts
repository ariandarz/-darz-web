/** The overview strip reads the G-COL-1 summary, label for label with the old
 * `ovItems` — and an unknown count and a count of zero stay different facts. */
import { describe, expect, it } from 'vitest';
import { collectorTiles, lastActiveLine } from './collectorTiles';

describe('collectorTiles', () => {
  it('is the old four tiles, equal to the summary', () => {
    const tiles = collectorTiles({ collectors: 128, vip: 9, active_30d: 41, engaged: 77 });
    expect(tiles.map((t) => [t.label, t.value])).toEqual([
      ['Collectors', '128'],
      ['VIP', '9'],
      ['Active 30d', '41'],
      ['Engaged', '77'],
    ]);
  });

  it('shows an em dash on every tile while the summary is pending or failed', () => {
    expect(collectorTiles(null).map((t) => t.value)).toEqual(['—', '—', '—', '—']);
  });

  it('a real zero is shown as zero, not as unknown', () => {
    const tiles = collectorTiles({ collectors: 0, vip: 0, active_30d: 0, engaged: 0 });
    expect(tiles.map((t) => t.value)).toEqual(['0', '0', '0', '0']);
  });

  it('a field that is not a number is dashed, not trusted', () => {
    const bad = { collectors: 5, vip: 'x', active_30d: null, engaged: 2 } as never;
    expect(collectorTiles(bad).map((t) => t.value)).toEqual(['5', '—', '—', '2']);
  });

  it('groups thousands, so a large roster stays readable', () => {
    expect(
      collectorTiles({ collectors: 12345, vip: 0, active_30d: 0, engaged: 0 })[0].value,
    ).toBe('12,345');
  });
});

describe('lastActiveLine', () => {
  it('is the old card line: "Last active <d Mon yyyy>"', () => {
    expect(lastActiveLine('2026-03-12T10:00:00Z')).toBe('Last active 12 Mar 2026');
  });

  it('says "No activity yet" for a collector with no rollup (or a null on detail, C-16)', () => {
    expect(lastActiveLine(null)).toBe('No activity yet');
    expect(lastActiveLine(undefined)).toBe('No activity yet');
    expect(lastActiveLine('not a date')).toBe('No activity yet');
  });
});
