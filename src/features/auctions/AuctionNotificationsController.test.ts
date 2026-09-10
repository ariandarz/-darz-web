/**
 * AuctionNotificationsController — the poll loop, unread helpers and the
 * optimistic markRead. Fake AuctionService, fake timers; no network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuctionNotification, Paginated } from '../../api/types';
import { AuctionNotificationsController } from './AuctionNotificationsController';

function n(over: Partial<AuctionNotification> = {}): AuctionNotification {
  return {
    id: over.id ?? 'x1',
    kind: 'outbid',
    lot: 'lot-1',
    lot_artwork_title: 'A Study',
    lot_number: 1,
    payload: { amount: '300' },
    read_at: null,
    created_at: new Date().toISOString(),
    ...over,
  } as AuctionNotification;
}

function page(results: AuctionNotification[]): Paginated<AuctionNotification> {
  return {
    results,
    pagination: {
      page: 1,
      per_page: 50,
      total_pages: 1,
      total_count: results.length,
      has_next: false,
      has_previous: false,
    },
  };
}

function make() {
  const state = { rows: [n({ id: 'a' }), n({ id: 'b', read_at: '2026-01-01T00:00:00Z' })] };
  const auctions = {
    notifications: vi.fn(async () => page(state.rows)),
    markRead: vi.fn(async (id: string) => {
      state.rows = state.rows.map((r) => (r.id === id ? { ...r, read_at: 'srv' } : r));
      return n({ id });
    }),
  };
  return { c: new AuctionNotificationsController(auctions as never), auctions, state };
}
const tick = () => Promise.resolve().then(() => Promise.resolve());

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('AuctionNotificationsController', () => {
  it('start() loads once then polls; unread helpers reflect read_at', async () => {
    const { c, auctions } = make();
    c.start();
    await tick();
    expect(auctions.notifications).toHaveBeenCalledTimes(1);
    expect(c.unreadCount()).toBe(1);
    expect(c.latestUnread()?.id).toBe('a');

    await vi.advanceTimersByTimeAsync(45_000);
    await tick();
    expect(auctions.notifications).toHaveBeenCalledTimes(2);

    c.stop();
    await vi.advanceTimersByTimeAsync(90_000);
    expect(auctions.notifications).toHaveBeenCalledTimes(2);
  });

  it('markRead is optimistic and then POSTs', async () => {
    const { c, auctions } = make();
    c.start();
    await tick();

    await c.markRead('a');

    expect(auctions.markRead).toHaveBeenCalledWith('a');
    expect(c.getSnapshot().results.find((r) => r.id === 'a')?.read_at).not.toBeNull();
    expect(c.unreadCount()).toBe(0);
    c.stop();
  });

  it('markAllRead clears every unread', async () => {
    const { c, auctions } = make();
    c.start();
    await tick();
    await c.markAllRead();
    expect(auctions.markRead).toHaveBeenCalledTimes(1); // only 'a' was unread
    expect(c.unreadCount()).toBe(0);
    c.stop();
  });

  it('reset() drops the loaded set', async () => {
    const { c } = make();
    c.start();
    await tick();
    expect(c.getSnapshot().results).toHaveLength(2);
    c.reset();
    expect(c.getSnapshot().results).toHaveLength(0);
    expect(c.getSnapshot().status).toBe('idle');
    c.stop();
  });
});
