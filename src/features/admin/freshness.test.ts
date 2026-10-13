/**
 * The pure half of the source-freshness loop (G-CAT-9): the old Artwork
 * Sources controls mapped onto the server's filters, and the old copy.
 */
import { describe, expect, it } from 'vitest';
import {
  confirmAsOptions,
  confirmAsStatus,
  freshnessFilterOf,
  freshnessQuery,
  freshTitle,
  hideDayChoices,
  isSourceLinked,
  marketRemindParts,
  remindParts,
  takesPart,
} from './freshness';

describe('freshnessQuery — the confirmation select onto the server', () => {
  it('"Confirmation: all" asks for every band, which is "every source-linked work"', () => {
    expect(freshnessQuery(undefined)).toEqual({
      freshness: ['fresh', 'new', 'due', 'stale', 'risky'],
      needs_reconfirmation: undefined,
    });
  });
  it('"Needs attention" is needs_reconfirmation, and clears the band list', () => {
    expect(freshnessQuery('attention')).toEqual({
      freshness: undefined,
      needs_reconfirmation: true,
    });
  });
  it('one band is that band', () => {
    expect(freshnessQuery('stale')).toEqual({
      freshness: 'stale',
      needs_reconfirmation: undefined,
    });
  });
  it('reads back the filter a query is on', () => {
    expect(freshnessFilterOf(freshnessQuery(undefined))).toBeUndefined();
    expect(freshnessFilterOf(freshnessQuery('attention'))).toBe('attention');
    expect(freshnessFilterOf(freshnessQuery('new'))).toBe('new');
  });
});

describe('the reminder copy', () => {
  it('spRemindBanner — worst first, with the day counts, zero bands left out', () => {
    expect(remindParts({ risky: 2, stale: 0, due: 3 })).toBe('2 risky (90d+) · 3 due (30d+)');
  });
  it('the Market App alert — the same bands without the day counts', () => {
    expect(marketRemindParts({ risky: 1, stale: 4, due: 0 })).toBe('1 risky · 4 stale');
  });
  it('the pill tooltip', () => {
    expect(freshTitle(null)).toBe('Never confirmed by its source');
    expect(freshTitle('2026-10-01T09:00:00Z')).toBe('Last confirmed 01/10/2026');
  });
});

describe('which works take part', () => {
  it('a sold / withdrawn / archived work takes no part', () => {
    expect(takesPart({ availability_status: 'available' })).toBe(true);
    expect(takesPart({ availability_status: 'on_hold' })).toBe(true);
    for (const s of ['sold', 'withdrawn', 'archived'])
      expect(takesPart({ availability_status: s as never })).toBe(false);
  });
  it('source-linked = a source name or a source type', () => {
    expect(isSourceLinked({ source_name: 'Galerie X', source_type: '' as never })).toBe(true);
    expect(isSourceLinked({ source_name: '  ', source_type: 'dealer' as never })).toBe(true);
    expect(isSourceLinked({ source_name: ' ', source_type: '' as never })).toBe(false);
  });
});

describe('the Update… picker', () => {
  it('offers only the own status (a re-confirm) or a legal move — never a 400', () => {
    const v = (s: string) => confirmAsOptions(s).map((o) => o.value);
    expect(v('available')).toEqual(['available', 'reserved', 'sold', 'price', 'remove']);
    // reserved → available | sold; withdrawn is not a legal move from reserved
    expect(v('reserved')).toEqual(['available', 'reserved', 'sold', 'price']);
    // on_hold → available | reserved
    expect(v('on_hold')).toEqual(['available', 'reserved', 'price']);
  });
  it('"Remove from market" is withdrawn; "Price changed" sends no status', () => {
    expect(confirmAsStatus('remove')).toBe('withdrawn');
    expect(confirmAsStatus('price')).toBeUndefined();
  });
});

describe('hideDayChoices', () => {
  it('is the old 60/90/120, plus a stored value that is something else', () => {
    expect(hideDayChoices(90)).toEqual([60, 90, 120]);
    expect(hideDayChoices(45)).toEqual([45, 60, 90, 120]);
    expect(hideDayChoices(undefined)).toEqual([60, 90, 120]);
  });
});
