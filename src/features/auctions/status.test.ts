/**
 * status.ts — the unified pill/label vocabulary. Pure functions; no network.
 */
import { describe, expect, it } from 'vitest';
import type { AuctionNotification, Lot } from '../../api/types';
import { lotPills, notificationLine, notificationPill } from './status';

const lot = (over: Partial<Lot>): Lot =>
  ({
    status: 'live',
    ends_at: new Date(Date.now() + 3_600_000).toISOString(),
    reserve_met: false,
    bid_count: 2,
    is_leading: false,
    ...over,
  }) as Lot;

describe('lotPills', () => {
  it('live + leading + reserve not met', () => {
    expect(lotPills(lot({ is_leading: true })).map((p) => p.label)).toEqual([
      'Your bid is leading',
      'Reserve not met',
    ]);
  });

  it('closing soon inside the 10-minute window', () => {
    const p = lotPills(lot({ ends_at: new Date(Date.now() + 5 * 60_000).toISOString() }));
    expect(p.map((x) => x.label)).toContain('Closing soon');
  });

  it('no bids on a live lot → no reserve pill', () => {
    expect(lotPills(lot({ bid_count: 0 })).map((p) => p.label)).toEqual([]);
  });

  it('sold → "You won" for the leader, "Sold" otherwise', () => {
    expect(lotPills(lot({ status: 'sold', is_leading: true }))[0].label).toBe('You won');
    expect(lotPills(lot({ status: 'sold', is_leading: false }))[0].label).toBe('Sold');
  });

  it('passed / cancelled', () => {
    expect(lotPills(lot({ status: 'passed' }))[0].label).toBe('Passed');
    expect(lotPills(lot({ status: 'cancelled' }))[0].label).toBe('Withdrawn');
  });
});

describe('notificationPill / notificationLine', () => {
  const note = (over: Partial<AuctionNotification>): AuctionNotification =>
    ({
      kind: 'outbid',
      lot_artwork_title: 'Untitled',
      payload: { amount: '400' },
      ...over,
    }) as AuctionNotification;

  it('maps each kind to a pill', () => {
    expect(notificationPill('outbid').kind).toBe('bad');
    expect(notificationPill('won').kind).toBe('won');
    expect(notificationPill('lost').kind).toBe('neutral');
    expect(notificationPill('closing_soon').kind).toBe('soon');
  });

  it('names the lot and amount in the line', () => {
    expect(notificationLine(note({ kind: 'outbid' }))).toBe(
      'You’ve been outbid on “Untitled” — now 400.',
    );
    expect(notificationLine(note({ kind: 'won' }))).toBe('You won “Untitled” for 400.');
    expect(notificationLine(note({ kind: 'closing_soon', payload: {} }))).toBe(
      '“Untitled” is closing soon.',
    );
  });

  it('falls back when the lot title is missing', () => {
    expect(notificationLine(note({ kind: 'lost', lot_artwork_title: null }))).toBe(
      'a lot you follow sold to another bidder.',
    );
  });
});
