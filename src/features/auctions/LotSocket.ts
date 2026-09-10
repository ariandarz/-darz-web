/**
 * LotSocket — a thin `Observable` around the read-only auction lot WebSocket
 * (`apps.auctions.consumers.LotConsumer`, `ws://…/ws/auctions/lots/{id}/?token=<jwt>`).
 *
 * Its only job is to hand `LotController` the latest `LotStateFrame` and a
 * connection status. It does NOT place bids (those go over REST) and does NOT
 * merge frames into a lot — that is `LotController`'s job.
 *
 * Reconnect policy:
 *  - close `4003` (token expired/invalid — see the consumer): refresh the
 *    access token once, then reconnect immediately. If the refresh fails, or
 *    a second `4003` follows, give up (`failed`) — the session is over.
 *  - any other unclean close: exponential backoff (1s → 2s → 4s → 8s, capped),
 *    up to `MAX_RETRIES`, then `failed`. `LotController` falls back to REST
 *    polling on `failed`.
 *  - `stop()` (component unmount / navigate away) is a clean shutdown, never a
 *    retry.
 */
import type { AuthSession } from '../../api';
import type { LotStateFrame } from '../../api/types';
import { Observable } from '../shared/Observable';

export type LotSocketStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'failed';

export interface LotSocketSnapshot {
  status: LotSocketStatus;
  lastFrame: LotStateFrame | null;
}

const MAX_RETRIES = 5;
const BACKOFF_MS = [1000, 2000, 4000, 8000, 8000];

/** The slice of the `WebSocket` API `LotSocket` uses — so a test can inject a
 * fake without a real network. */
export interface WebSocketLike {
  onopen: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
  onclose: ((ev: { code: number }) => void) | null;
  close(): void;
}
export type WebSocketFactory = (url: string) => WebSocketLike;

const defaultFactory: WebSocketFactory = (url) =>
  new WebSocket(url) as unknown as WebSocketLike;

export class LotSocket extends Observable<LotSocketSnapshot> {
  private ws: WebSocketLike | null = null;
  private retries = 0;
  private refreshedForAuth = false;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  private readonly wsBaseUrl: string;
  private readonly lotId: string;
  private readonly session: Pick<AuthSession, 'currentAccessToken' | 'refresh'>;
  private readonly makeSocket: WebSocketFactory;

  constructor(
    wsBaseUrl: string,
    lotId: string,
    session: Pick<AuthSession, 'currentAccessToken' | 'refresh'>,
    makeSocket: WebSocketFactory = defaultFactory,
  ) {
    super({ status: 'idle', lastFrame: null });
    this.wsBaseUrl = wsBaseUrl;
    this.lotId = lotId;
    this.session = session;
    this.makeSocket = makeSocket;
  }

  /** `LotController` calls this once. Safe to call again after `stop()`. */
  start(): void {
    this.stopped = false;
    void this.open();
  }

  /** Clean shutdown — no reconnect. */
  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.teardown();
    this.patch({ status: 'idle' });
  }

  private teardown(): void {
    if (!this.ws) return;
    this.ws.onopen = this.ws.onmessage = this.ws.onerror = this.ws.onclose = null;
    try {
      this.ws.close();
    } catch {
      /* already closing */
    }
    this.ws = null;
  }

  private async open(): Promise<void> {
    if (this.stopped) return;
    this.patch({ status: this.retries === 0 ? 'connecting' : 'reconnecting' });

    let token = this.session.currentAccessToken();
    if (!token) {
      // No in-memory access token yet (e.g. straight after a silent resume) —
      // mint one before dialing.
      try {
        await this.session.refresh();
        token = this.session.currentAccessToken();
      } catch {
        this.patch({ status: 'failed' });
        return;
      }
    }
    if (this.stopped) return;
    if (!token) {
      this.patch({ status: 'failed' });
      return;
    }

    const url = `${this.wsBaseUrl}/ws/auctions/lots/${this.lotId}/?token=${encodeURIComponent(token)}`;
    const ws = this.makeSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.retries = 0;
      this.refreshedForAuth = false;
      this.patch({ status: 'open' });
    };

    ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data as string) as LotStateFrame;
        if (frame && frame.lot_id === this.lotId) this.patch({ lastFrame: frame });
      } catch {
        /* ignore a malformed frame — the next one, or a REST refetch, corrects it */
      }
    };

    ws.onerror = () => {
      /* onclose always follows — handle the retry there */
    };

    ws.onclose = (event) => {
      this.ws = null;
      if (this.stopped) return;
      void this.onClose(event.code);
    };
  }

  private async onClose(code: number): Promise<void> {
    // 4003 = token rejected. Refresh once and retry now; a second 4003 or a
    // failed refresh means the session is gone.
    if (code === 4003 && !this.refreshedForAuth) {
      this.refreshedForAuth = true;
      try {
        await this.session.refresh();
      } catch {
        this.patch({ status: 'failed' });
        return;
      }
      if (!this.stopped) void this.open();
      return;
    }

    if (this.retries >= MAX_RETRIES) {
      this.patch({ status: 'failed' });
      return;
    }
    const wait = BACKOFF_MS[Math.min(this.retries, BACKOFF_MS.length - 1)];
    this.retries += 1;
    this.patch({ status: 'reconnecting' });
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.stopped) void this.open();
    }, wait);
  }
}
