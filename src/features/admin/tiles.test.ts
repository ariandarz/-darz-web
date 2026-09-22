/**
 * The two strips built for G-CLUB-2 and G-MEMB-1.
 *
 * What is worth testing about a tile row is not the arithmetic — there is none
 * — but the **absences**. Both strips deliberately have fewer tiles than the
 * old panel's, and a later change that quietly adds a "Premium" or a "Private
 * auctions" tile would be reintroducing a number this backend cannot answer.
 * These cases pin the count and the labels so that cannot happen silently.
 *
 * The other rule they pin: a failed read shows `—`, never `0`. "I could not
 * find out" and "there are none" are different facts, and the confident zero
 * is the worse lie.
 */
import { describe, expect, it } from 'vitest';
import { clubTiles } from './clubTiles';
import { EMPTY_MEMBERSHIP_COUNTS, membershipTiles } from './membershipTiles';

describe('clubTiles', () => {
  it('is the old row minus the tile nothing can count', () => {
    const labels = clubTiles({ selections: 3, keys: 12 }).map((t) => t.label);
    // The old row is Private selections · Private auctions · Collector keys
    // (`darz-studio.html:33774`). Invitation-only auctions do not exist in
    // this backend at all (G-CLUB-3), so that tile is absent by design.
    expect(labels).toEqual(['Private selections', 'Collector keys']);
    expect(labels).not.toContain('Private auctions');
  });

  it('shows the counts it has', () => {
    expect(clubTiles({ selections: 3, keys: 1234 }).map((t) => t.value)).toEqual([
      '3',
      '1,234',
    ]);
  });

  it('shows an em dash for a read that failed, never a zero', () => {
    expect(clubTiles({ selections: null, keys: null }).map((t) => t.value)).toEqual([
      '—',
      '—',
    ]);
    // A real zero still reads as zero — the two are distinguishable.
    expect(clubTiles({ selections: 0, keys: 0 }).map((t) => t.value)).toEqual(['0', '0']);
  });
});

describe('membershipTiles', () => {
  it('is the old row minus the two tiles this backend cannot answer', () => {
    const labels = membershipTiles({ total: 40, active: 31 }).map((t) => t.label);
    // Old row: Total members · Active · Premium · Expiring ≤ 7d (`:33342`).
    // Premium is a plan vocabulary this backend does not have; "Expiring ≤ 7d"
    // needs an `expires_before=` filter it does not offer (G-MEMB-7).
    expect(labels).toEqual(['Total members', 'Active']);
    expect(labels).not.toContain('Premium');
    expect(labels.some((l) => /expir/i.test(l))).toBe(false);
  });

  it('shows an em dash before anything has loaded', () => {
    expect(membershipTiles(EMPTY_MEMBERSHIP_COUNTS).map((t) => t.value)).toEqual(['—', '—']);
  });

  it('groups thousands', () => {
    expect(membershipTiles({ total: 1234, active: 999 }).map((t) => t.value)).toEqual([
      '1,234',
      '999',
    ]);
  });
});
