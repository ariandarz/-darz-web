/**
 * The Data Health counts panel — all nine catalogue boxes of the old grid
 * since V1 Phase 4 (G-HEALTH-1…4).
 *
 * Worth pinning: the old order and bands, which read comes from where (the
 * report vs a `per_page: 1` list count and its exact query), where each tile
 * links, and the **`—` rule** — "0 incomplete records" is the screen saying
 * everything is fine, so a failed read must never render as a zero.
 */
import { describe, expect, it } from 'vitest';
import type { DataHealthReport } from '../../api/types';
import {
  ARCHIVED_STATUSES,
  EMPTY_HEALTH_COUNTS,
  healthBands,
  healthCountQueries,
  healthTiles,
  type HealthCounts,
} from './healthCounts';

const SINCE = '2026-08-26T12:00:00.000Z';

const report = (incomplete: number, duplicates: number, deleted = 0): DataHealthReport => ({
  duplicate_images: { count: duplicates, items: [] },
  incomplete_records: { count: incomplete, items: [] },
  published_but_hidden: { count: 0, items: [] },
  deleted_records: { count: deleted },
  healthy: incomplete === 0 && duplicates === 0,
});

const counts: HealthCounts = {
  published: 10,
  archived: 2,
  recent: 4,
  sourced: { gallery: 5, dealer: 6, artist: 7 },
};

describe('healthBands', () => {
  it('is the old three bands, with the old nine boxes in the old order', () => {
    const bands = healthBands(counts, report(0, 0), SINCE);
    expect(bands.map((b) => [b.title, b.tiles.map((t) => t.title)])).toEqual([
      ['Storage & visibility', ['Market App Artworks']],
      ['Where artworks come from', ['Gallery-Sourced', 'Dealer-Sourced', 'Artist-Sourced']],
      [
        'Quality & lifecycle',
        [
          'Incomplete Records',
          'Duplicate Artworks',
          'Deleted (permanent)',
          'Recently Added',
          'Archived / Unavailable',
        ],
      ],
    ]);
  });

  it('reads the counts: list counts from `counts`, three from the report', () => {
    const tiles = healthTiles(counts, report(3, 8, 238), SINCE);
    const v = (k: string) => tiles.find((t) => t.key === k)?.value;
    expect(v('published')).toBe('10');
    expect(v('sourced-gallery')).toBe('5');
    expect(v('sourced-dealer')).toBe('6');
    expect(v('sourced-artist')).toBe('7');
    expect(v('incomplete')).toBe('3');
    expect(v('duplicates')).toBe('8');
    expect(v('deleted')).toBe('238');
    expect(v('recent')).toBe('4');
    expect(v('archived')).toBe('2');
  });

  it('links each box the old panel made clickable to the list it counted', () => {
    const tiles = healthTiles(counts, report(0, 0), SINCE);
    const to = (k: string) => tiles.find((t) => t.key === k)?.to;
    expect(to('published')).toBe('/admin/artworks?published=true');
    expect(to('sourced-dealer')).toBe('/admin/artworks?source_type=dealer');
    expect(to('incomplete')).toBe('/admin/artworks?complete=false');
    expect(to('duplicates')).toBe('/admin/artworks?duplicate_images=true');
    expect(to('recent')).toBe(`/admin/artworks?created_after=${encodeURIComponent(SINCE)}`);
    // no single list equals these two
    expect(to('deleted')).toBeUndefined();
    expect(to('archived')).toBeUndefined();
  });

  it('switches the explanation line with the number, as the old boxes do', () => {
    const clean = healthTiles(EMPTY_HEALTH_COUNTS, report(0, 0), SINCE);
    expect(clean.find((t) => t.key === 'incomplete')?.exp).toBe('All records complete');
    expect(clean.find((t) => t.key === 'duplicates')?.exp).toBe('No duplicates found');
    expect(clean.find((t) => t.key === 'incomplete')?.tone).toBeUndefined();

    const dirty = healthTiles(EMPTY_HEALTH_COUNTS, report(3, 7), SINCE);
    expect(dirty.find((t) => t.key === 'incomplete')?.exp).toBe('Missing required fields');
    expect(dirty.find((t) => t.key === 'duplicates')?.exp).toBe('Same image — extra copies');
    expect(dirty.find((t) => t.key === 'incomplete')?.tone).toBe('warn');
  });

  it('shows an em dash, never a zero, when nothing has loaded', () => {
    const tiles = healthTiles(EMPTY_HEALTH_COUNTS, null, SINCE);
    expect(tiles.map((t) => t.value)).toEqual(Array(9).fill('—'));
  });

  it('dashes Deleted when an older report carries no deleted_records', () => {
    const { deleted_records: _d, ...old } = report(0, 0, 5);
    expect(healthTiles(counts, old, SINCE).find((t) => t.key === 'deleted')?.value).toBe('—');
  });

  it('survives a report whose count field is not a number', () => {
    const bad = { ...report(0, 0), incomplete_records: { count: 'lots' } } as never;
    expect(() => healthTiles(EMPTY_HEALTH_COUNTS, bad, SINCE)).not.toThrow();
    expect(
      healthTiles(EMPTY_HEALTH_COUNTS, bad, SINCE).find((t) => t.key === 'incomplete')?.value,
    ).toBe('—');
  });
});

describe('healthCountQueries', () => {
  it('asks the admin list exactly the question each tile answers', () => {
    const q = healthCountQueries(SINCE);
    expect(q.published).toEqual({ published: true });
    expect(q.recent).toEqual({ created_after: SINCE });
    expect(q.sourced).toEqual({
      gallery: { source_type: 'gallery' },
      dealer: { source_type: 'dealer' },
      artist: { source_type: 'artist' },
    });
    expect(q.archived).toEqual([
      { availability_status: 'sold' },
      { availability_status: 'archived' },
      { availability_status: 'withdrawn' },
    ]);
  });

  it('counts only the archival statuses this enum really has', () => {
    // A held or reserved work is still being offered.
    expect([...ARCHIVED_STATUSES]).toEqual(['sold', 'archived', 'withdrawn']);
  });
});
