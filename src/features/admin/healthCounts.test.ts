/**
 * The Data Health counts panel (G-HEALTH-1).
 *
 * Two things are worth pinning. The **absences**: four of the old panel's
 * eight are not built, each for a named backend reason, and a later change
 * that quietly adds a "Recently Added" tile would be inventing a number
 * nothing can answer. And the **`—` rule**, which matters more on this desk
 * than anywhere else in the panel: "0 incomplete records" is the screen saying
 * everything is fine, so a failed read must never render as a zero.
 */
import { describe, expect, it } from 'vitest';
import type { DataHealthReport } from '../../api/types';
import { ARCHIVED_STATUSES, EMPTY_HEALTH_COUNTS, healthTiles } from './healthCounts';

const report = (incomplete: number, duplicates: number): DataHealthReport => ({
  duplicate_images: { count: duplicates, items: [] },
  incomplete_records: { count: incomplete, items: [] },
  published_but_hidden: { count: 0, items: [] },
  healthy: incomplete === 0 && duplicates === 0,
});

describe('healthTiles', () => {
  it('is the four of the old eight this backend can answer', () => {
    const titles = healthTiles({ published: 10, archived: 2 }, report(0, 0)).map(
      (t) => t.title,
    );
    expect(titles).toEqual([
      'Market App Artworks',
      'Incomplete Records',
      'Duplicate Artworks',
      'Archived / Unavailable',
    ]);
  });

  it('does not invent the four it cannot answer', () => {
    const titles = healthTiles({ published: 10, archived: 2 }, report(0, 0)).map(
      (t) => t.title,
    );
    // G-HEALTH-2 (no source_type on an artwork), G-HEALTH-3 (no deleted
    // count), G-HEALTH-4 (no created_after filter).
    for (const absent of [
      'Gallery-Sourced',
      'Dealer-Sourced',
      'Artist-Sourced',
      'Deleted (permanent)',
      'Recently Added',
    ]) {
      expect(titles).not.toContain(absent);
    }
  });

  it('reads the two counts straight off the report', () => {
    const tiles = healthTiles({ published: null, archived: null }, report(3, 7));
    expect(tiles.find((t) => t.key === 'incomplete')?.value).toBe('3');
    expect(tiles.find((t) => t.key === 'duplicates')?.value).toBe('7');
  });

  it('switches the explanation line with the number, as the old boxes do', () => {
    const clean = healthTiles(EMPTY_HEALTH_COUNTS, report(0, 0));
    expect(clean.find((t) => t.key === 'incomplete')?.exp).toBe('All records complete');
    expect(clean.find((t) => t.key === 'duplicates')?.exp).toBe('No duplicates found');
    expect(clean.find((t) => t.key === 'incomplete')?.tone).toBeUndefined();

    const dirty = healthTiles(EMPTY_HEALTH_COUNTS, report(3, 7));
    expect(dirty.find((t) => t.key === 'incomplete')?.exp).toBe('Missing required fields');
    expect(dirty.find((t) => t.key === 'duplicates')?.exp).toBe('Same image — extra copies');
    expect(dirty.find((t) => t.key === 'incomplete')?.tone).toBe('warn');
  });

  it('shows an em dash, never a zero, when nothing has loaded', () => {
    // The report is null before the checks land, and both read tiles have to
    // survive that — this desk has been bitten by a response's shape before.
    const tiles = healthTiles(EMPTY_HEALTH_COUNTS, null);
    expect(tiles.map((t) => t.value)).toEqual(['—', '—', '—', '—']);
    // And no tile claims to be healthy on the strength of a missing number.
    expect(tiles.find((t) => t.key === 'incomplete')?.exp).toBe('All records complete');
  });

  it('survives a report whose count field is not a number', () => {
    const bad = { ...report(0, 0), incomplete_records: { count: 'lots' } } as never;
    expect(() => healthTiles(EMPTY_HEALTH_COUNTS, bad)).not.toThrow();
    expect(healthTiles(EMPTY_HEALTH_COUNTS, bad)[1].value).toBe('—');
  });

  it('counts only the archival statuses this enum really has', () => {
    // `ArtworkAvailabilityStatusEnum` is available · on_hold · reserved · sold
    // · archived · withdrawn. A held or reserved work is still being offered.
    expect([...ARCHIVED_STATUSES]).toEqual(['sold', 'archived', 'withdrawn']);
    expect(ARCHIVED_STATUSES).not.toContain('on_hold');
    expect(ARCHIVED_STATUSES).not.toContain('reserved');
  });
});
