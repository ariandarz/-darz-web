/**
 * LotSocket — frame relay + reconnect policy. A fake WebSocket is injected
 * (no network); timers are faked so backoff is instant.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LotStateFrame } from '../../api/types';
import { LotSocket, type WebSocketLike } from './LotSocket';

class FakeWs implements WebSocketLike {
  onopen: ((ev?: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: ((ev?: unknown) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  closed = false;
  url: string;
  constructor(url: string) {
    this.url = url;
  }
  close() {
    this.closed = true;
  }
}

const LOT = 'lot-1';
const frame = (over: Partial<LotStateFrame> = {}): LotStateFrame => ({
  lot_id: LOT,
  status: 'live',
  current_amount: '300',
  bid_count: 2,
  leading_bidder_id: 'c-9',
  reserve_met: true,
  ends_at: new Date().toISOString(),
  ...over,
});

function make() {
  const sockets: FakeWs[] = [];
  const session = { currentAccessToken: vi.fn(() => 'tok'), refresh: vi.fn(async () => {}) };
  const socket = new LotSocket('ws://x', LOT, session as never, (url) => {
    const w = new FakeWs(url);
    sockets.push(w);
    return w;
  });
  return { socket, sockets, session };
}
const tick = () => Promise.resolve().then(() => Promise.resolve());

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('LotSocket', () => {
  it('opens, relays a matching frame, ignores a frame for another lot', () => {
    const { socket, sockets } = make();
    const seen = vi.fn();
    socket.subscribe(seen);
    socket.start();

    sockets[0].onopen!();
    expect(socket.getSnapshot().status).toBe('open');

    sockets[0].onmessage!({ data: JSON.stringify(frame({ current_amount: '400' })) });
    expect(socket.getSnapshot().lastFrame?.current_amount).toBe('400');

    sockets[0].onmessage!({
      data: JSON.stringify(frame({ lot_id: 'other', current_amount: '9' })),
    });
    expect(socket.getSnapshot().lastFrame?.current_amount).toBe('400');
    expect(seen).toHaveBeenCalled();
  });

  it('on close 4003 refreshes the token once and reconnects', async () => {
    const { socket, sockets, session } = make();
    socket.start();
    sockets[0].onclose!({ code: 4003 });
    await tick();

    expect(session.refresh).toHaveBeenCalledTimes(1);
    expect(sockets).toHaveLength(2); // reconnected
  });

  it('gives up (failed) if the refresh after a 4003 throws', async () => {
    const { socket, sockets, session } = make();
    session.refresh.mockRejectedValueOnce(new Error('no'));
    socket.start();
    sockets[0].onclose!({ code: 4003 });
    await tick();

    expect(socket.getSnapshot().status).toBe('failed');
  });

  it('backs off and retries an unclean close, then fails after the cap', async () => {
    const { socket, sockets } = make();
    socket.start();

    for (let i = 0; i < 5; i++) {
      sockets[sockets.length - 1].onclose!({ code: 1006 });
      await vi.runOnlyPendingTimersAsync();
    }
    expect(sockets.length).toBe(6); // initial + 5 retries

    sockets[sockets.length - 1].onclose!({ code: 1006 });
    await tick();
    expect(socket.getSnapshot().status).toBe('failed');
  });

  it('stop() closes the socket and does not reconnect on the close event', () => {
    const { socket, sockets } = make();
    socket.start();
    socket.stop();
    expect(sockets[0].closed).toBe(true);
    expect(socket.getSnapshot().status).toBe('idle');
    expect(sockets).toHaveLength(1);
  });
});
