/**
 * LotController — REST snapshot + live-frame merge + reconnect/poll fallback.
 * Fake AuctionService, fake session, injected fake WebSocket, fake timers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Lot, LotStateFrame } from '../../api/types';
import { LotController } from './LotController';
import type { WebSocketLike } from './LotSocket';

class FakeWs implements WebSocketLike {
  onopen: ((ev?: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: ((ev?: unknown) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  url: string;
  constructor(url: string) {
    this.url = url;
  }
  close() {}
}

const LOT = 'lot-1';
const ME = 'c-me';

const baseLot = (): Lot =>
  ({
    id: LOT,
    auction: 'a1',
    artwork: { id: 'w1', title: 'W', artist: null, images: [] },
    lot_number: 1,
    low_estimate: null,
    high_estimate: null,
    premium_pct: '20',
    currency: 'USD',
    starts_at: new Date().toISOString(),
    ends_at: new Date().toISOString(),
    status: 'live',
    current_amount: '100',
    bid_count: 1,
    reserve_met: false,
    is_leading: false,
    version: 1,
    created_at: '',
    updated_at: '',
  }) as unknown as Lot;

const frame = (over: Partial<LotStateFrame>): LotStateFrame => ({
  lot_id: LOT,
  status: 'live',
  current_amount: '300',
  bid_count: 3,
  leading_bidder_id: null,
  reserve_met: true,
  ends_at: new Date().toISOString(),
  ...over,
});

function make(myId: string | null = ME) {
  const sockets: FakeWs[] = [];
  const auctions = { lot: vi.fn(async () => baseLot()) };
  const session = { currentAccessToken: () => 'tok', refresh: vi.fn(async () => {}) };
  const c = new LotController(
    auctions as never,
    session as never,
    'ws://x',
    LOT,
    myId,
    (url) => {
      const w = new FakeWs(url);
      sockets.push(w);
      return w;
    },
  );
  return { c, sockets, auctions };
}
const tick = () => Promise.resolve().then(() => Promise.resolve());

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('LotController', () => {
  it('start() loads the lot over REST', async () => {
    const { c, auctions } = make();
    c.start();
    await tick();
    expect(auctions.lot).toHaveBeenCalled();
    expect(c.getSnapshot().status).toBe('ready');
    expect(c.getSnapshot().lot?.current_amount).toBe('100');
    c.stop();
  });

  it('merges a live frame over the REST snapshot and recomputes is_leading', async () => {
    const { c, sockets } = make(ME);
    c.start();
    await tick();
    sockets[0].onopen!();
    sockets[0].onmessage!({
      data: JSON.stringify(frame({ current_amount: '500', leading_bidder_id: ME })),
    });

    const lot = c.getSnapshot().lot!;
    expect(lot.current_amount).toBe('500');
    expect(lot.bid_count).toBe(3);
    expect(lot.reserve_met).toBe(true);
    expect(lot.is_leading).toBe(true);
    c.stop();
  });

  it('is_leading stays false when the leader is someone else', async () => {
    const { c, sockets } = make(ME);
    c.start();
    await tick();
    sockets[0].onopen!();
    sockets[0].onmessage!({
      data: JSON.stringify(frame({ leading_bidder_id: 'someone-else' })),
    });
    expect(c.getSnapshot().lot?.is_leading).toBe(false);
    c.stop();
  });

  it('re-fetches REST when the socket (re)connects', async () => {
    const { c, sockets, auctions } = make();
    c.start();
    await tick();
    const afterStart = auctions.lot.mock.calls.length;
    sockets[0].onopen!();
    await tick();
    expect(auctions.lot.mock.calls.length).toBeGreaterThan(afterStart);
    c.stop();
  });

  it('polls REST while the socket is failed, and stops polling after stop()', async () => {
    const { c, sockets, auctions } = make();
    c.start();
    await tick();

    // drive the socket to `failed` (6 unclean closes past the retry cap)
    for (let i = 0; i < 6; i++) {
      sockets[sockets.length - 1].onclose!({ code: 1006 });
      await vi.runOnlyPendingTimersAsync();
    }
    expect(c.getSnapshot().live).toBe('failed');

    const beforePoll = auctions.lot.mock.calls.length;
    await vi.advanceTimersByTimeAsync(8000);
    expect(auctions.lot.mock.calls.length).toBeGreaterThan(beforePoll);

    c.stop();
    const afterStop = auctions.lot.mock.calls.length;
    await vi.advanceTimersByTimeAsync(16000);
    expect(auctions.lot.mock.calls.length).toBe(afterStop);
  });
});
