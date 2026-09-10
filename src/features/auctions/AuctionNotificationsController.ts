/**
 * AuctionNotificationsController — the collector's auction notifications
 * (`GET /api/auctions/notifications/`). Pagination/status come from the shared
 * `ListController` base; this adds the poll loop (boot + ~45s interval + on
 * window focus — matching the Phase 5 reply-thread decision; notifications are
 * not on the WebSocket), `markRead`, and the unread helpers the banner needs.
 *
 * Auction-scoped for now; a future global notification centre (Phase 9) can
 * reuse it as-is.
 */
import type { AuctionService } from '../../api/services';
import type { AuctionNotification, Paginated } from '../../api/types';
import { ListController } from '../shared/ListController';

export type { LoadStatus } from '../shared/ListController';

interface NotificationQuery {
  page?: number;
  per_page?: number;
}

const POLL_MS = 45_000;

export class AuctionNotificationsController extends ListController<
  AuctionNotification,
  NotificationQuery
> {
  private readonly auctions: AuctionService;
  private poll: ReturnType<typeof setInterval> | null = null;
  private readonly onFocus = () => void this.reload();

  constructor(auctions: AuctionService) {
    super({ per_page: 50 });
    this.auctions = auctions;
  }

  protected fetchPage(query: NotificationQuery): Promise<Paginated<AuctionNotification>> {
    return this.auctions.notifications(query);
  }

  /** Load once, then poll + refresh on focus. Idempotent. */
  start(): void {
    void this.reload();
    if (this.poll) return;
    this.poll = setInterval(() => void this.reload(), POLL_MS);
    if (typeof window !== 'undefined') window.addEventListener('focus', this.onFocus);
  }

  stop(): void {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    if (typeof window !== 'undefined') window.removeEventListener('focus', this.onFocus);
  }

  /** Drop the loaded set — on logout / collector switch, so a second
   * collector in the same tab never inherits the first one's notifications. */
  reset(): void {
    this.patch({ results: [], pagination: null, status: 'idle', error: null });
  }

  /** Every unread notification, newest first (the list is already newest-first). */
  unread(): AuctionNotification[] {
    return this.getSnapshot().results.filter((n) => n.read_at == null);
  }

  unreadCount(): number {
    return this.unread().length;
  }

  /** The banner shows the newest unread. */
  latestUnread(): AuctionNotification | null {
    return this.unread()[0] ?? null;
  }

  /** Mark one read — optimistic local patch, then the POST; on failure the
   * next poll restores the true state. */
  async markRead(id: string): Promise<void> {
    const now = new Date().toISOString();
    this.patch({
      results: this.getSnapshot().results.map((n) =>
        n.id === id && n.read_at == null ? { ...n, read_at: now } : n,
      ),
    });
    try {
      await this.auctions.markRead(id);
    } catch {
      void this.reload();
    }
  }

  /** Dismiss the banner by marking every currently-unread notification read. */
  async markAllRead(): Promise<void> {
    await Promise.all(this.unread().map((n) => this.markRead(n.id)));
  }
}
