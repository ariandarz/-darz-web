/**
 * LotController — one lot's live state for the lot-detail screen.
 *
 * Owns the REST `Lot` snapshot (`GET /api/auctions/lots/{id}/`) and a
 * `LotSocket`. Live `LotStateFrame`s are merged over the REST snapshot; the
 * REST lot is re-fetched on every (re)connect and on window focus so a missed
 * frame self-corrects, and a `failed` socket falls back to an ~8s REST poll
 * (the "lean resync" — not a full WS-plus-polling stack).
 *
 * Snapshot + observer plumbing comes from the shared `Observable` base, same
 * as `SavedController` / `ListController`.
 */
import type { AuctionService, AuthSession } from '../../api';
import type { Lot } from '../../api/types';
import { Observable } from '../shared/Observable';
import type { LotSocketStatus, WebSocketFactory } from './LotSocket';
import { LotSocket } from './LotSocket';

export type LotLoadStatus = 'loading' | 'ready' | 'error';

export interface LotControllerSnapshot {
  lot: Lot | null;
  status: LotLoadStatus;
  error: string | null;
  /** connection state of the live socket, surfaced for a subtle UI hint */
  live: LotSocketStatus;
  /** a place-bid POST is in flight — the double-tap / key-repeat guard */
  bidding: boolean;
  /** the server's rejection message for the last bid, or null (below-floor,
   * "your new max must be higher", 403 not-approved, lot-not-live …) */
  bidError: string | null;
  /** set once a bid is accepted, for the confirmation toast; cleared by the UI */
  bidAccepted: boolean;
}

const POLL_MS = 8000;

export class LotController extends Observable<LotControllerSnapshot> {
  private socket: LotSocket;
  private unsubSocket: (() => void) | null = null;
  private lastFrameSeen: unknown = null;
  private lastLiveStatus: LotSocketStatus = 'idle';
  private poll: ReturnType<typeof setInterval> | null = null;
  private token = 0;
  private readonly onFocus = () => void this.refetch();

  private readonly auctions: AuctionService;
  private readonly lotId: string;
  /** the signed-in collector's id, so a live frame can recompute `is_leading` */
  private readonly myCollectorId: string | null;

  constructor(
    auctions: AuctionService,
    session: Pick<AuthSession, 'currentAccessToken' | 'refresh'>,
    wsBaseUrl: string,
    lotId: string,
    myCollectorId: string | null,
    wsFactory?: WebSocketFactory,
  ) {
    super({
      lot: null,
      status: 'loading',
      error: null,
      live: 'idle',
      bidding: false,
      bidError: null,
      bidAccepted: false,
    });
    this.auctions = auctions;
    this.lotId = lotId;
    this.myCollectorId = myCollectorId;
    this.socket = new LotSocket(wsBaseUrl, lotId, session, wsFactory);
  }

  start(): void {
    void this.refetch();
    this.socket.start();
    this.unsubSocket = this.socket.subscribe(() => this.onSocketChange());
    if (typeof window !== 'undefined') window.addEventListener('focus', this.onFocus);
  }

  stop(): void {
    this.socket.stop();
    this.unsubSocket?.();
    this.unsubSocket = null;
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    if (typeof window !== 'undefined') window.removeEventListener('focus', this.onFocus);
  }

  reload(): Promise<void> {
    return this.refetch();
  }

  /** Place a proxy/max bid. Refuses a second call while one is in flight
   * (`app.html`'s `dzGuard('bid:'+lot)` double-tap guard). On success the
   * server returns the updated lot — merge it exactly like a live frame, so
   * the price / count / `is_leading` update immediately even before the WS
   * frame arrives. On failure, surface the server's own message verbatim
   * (the floor / must-increase / not-approved / not-live rejections). */
  async placeBid(maxAmount: number | string): Promise<boolean> {
    if (this.getSnapshot().bidding) return false;
    this.patch({ bidding: true, bidError: null, bidAccepted: false });
    try {
      const lot = await this.auctions.placeBid(this.lotId, maxAmount);
      this.patch({ lot, bidding: false, bidAccepted: true });
      return true;
    } catch (err) {
      this.patch({ bidding: false, bidError: (err as Error).message });
      return false;
    }
  }

  clearBidState(): void {
    const s = this.getSnapshot();
    if (s.bidError || s.bidAccepted) this.patch({ bidError: null, bidAccepted: false });
  }

  private async refetch(): Promise<void> {
    const mine = ++this.token;
    if (!this.getSnapshot().lot) this.patch({ status: 'loading', error: null });
    try {
      const lot = await this.auctions.lot(this.lotId);
      if (mine !== this.token) return;
      this.patch({ lot, status: 'ready', error: null });
    } catch (err) {
      if (mine !== this.token) return;
      if (!this.getSnapshot().lot)
        this.patch({ status: 'error', error: (err as Error).message });
    }
  }

  private onSocketChange(): void {
    const snap = this.socket.getSnapshot();

    // A reconnect (reconnecting/failed → open) may have skipped frames — pull
    // the authoritative REST state once we're back.
    if (snap.status === 'open' && this.lastLiveStatus !== 'open') void this.refetch();

    // Socket gave up → poll REST until it recovers; stop polling once it does.
    if (snap.status === 'failed' && !this.poll) {
      this.poll = setInterval(() => void this.refetch(), POLL_MS);
    } else if (snap.status !== 'failed' && this.poll) {
      clearInterval(this.poll);
      this.poll = null;
    }
    this.lastLiveStatus = snap.status;

    if (snap.lastFrame && snap.lastFrame !== this.lastFrameSeen) {
      this.lastFrameSeen = snap.lastFrame;
      this.mergeFrame();
    }
    this.patch({ live: snap.status });
  }

  private mergeFrame(): void {
    const frame = this.socket.getSnapshot().lastFrame;
    const lot = this.getSnapshot().lot;
    if (!frame || !lot) return;
    this.patch({
      lot: {
        ...lot,
        status: frame.status,
        current_amount: frame.current_amount,
        bid_count: frame.bid_count,
        reserve_met: frame.reserve_met,
        ends_at: frame.ends_at,
        is_leading:
          this.myCollectorId !== null && frame.leading_bidder_id === this.myCollectorId,
      },
    });
  }
}
