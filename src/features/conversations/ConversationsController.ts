/**
 * ConversationsController — the collector's own requests, read as
 * conversations. One controller serves Chat (the conversation list + unread
 * counts), Profile (previous inquiries, activity) and the artwork detail
 * ("you already asked about this work"), so they never disagree.
 *
 * Backend (Phase 19.3): every request carries a reply thread
 * (`RequestMessage`, `GET/POST /api/crm/requests/{id}/messages/`) and an
 * `unread_count` of unseen team messages. The general "Chat with Darz" is a
 * `Request(kind=message, artwork=null)` — the same unified surface as the old
 * app (`DZ_CHAT_X`, app.html:6456), no separate table. An artwork inquiry is
 * a `Request(kind=information, artwork=<id>)` with the message in `detail`.
 *
 * Delivery is polling (owner decision 2026-09-04, `docs/TASKLIST.md`):
 * boot + ~45s + on window focus, like `AuctionNotificationsController`.
 * Nothing is read from `localStorage` (offline = NO).
 */
import type { CrmService } from '../../api/services';
import type { CollectorRequest, CreatedRequest } from '../../api/types';
import { Observable } from '../shared/Observable';

const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const POLL_MS = 45_000;
/** The stable idempotency key of the collector's one general conversation:
 * the backend dedupes `(collector, client_req_id)`, so a second tap, a retry
 * or a second device all land on the SAME request. */
export const GENERAL_CHAT_CLIENT_ID = 'chat-with-darz';

export type ConversationsStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Requests whose status means the conversation is over. */
const CLOSED = new Set([
  'closed',
  'declined',
  'withdrawn',
  'expired',
  'released',
  'cancelled',
]);

export interface ConversationsSnapshot {
  status: ConversationsStatus;
  /** every request the collector has filed, newest first (the API order) */
  requests: CollectorRequest[];
  error: string | null;
}

const EMPTY: ConversationsSnapshot = { status: 'idle', requests: [], error: null };

export class ConversationsController extends Observable<ConversationsSnapshot> {
  private readonly crm: CrmService;
  private inflight: Promise<void> | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private readonly onFocus = () => void this.reload();

  constructor(crm: CrmService) {
    super(EMPTY);
    this.crm = crm;
  }

  /** Load once, then poll + refresh on focus. Idempotent. */
  start(): void {
    void this.ensureLoaded();
    if (this.poll) return;
    this.poll = setInterval(() => void this.reload(), POLL_MS);
    if (typeof window !== 'undefined') window.addEventListener('focus', this.onFocus);
  }

  stop(): void {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    if (typeof window !== 'undefined') window.removeEventListener('focus', this.onFocus);
  }

  /** Drop everything on logout / collector switch. */
  reset(): void {
    this.stop();
    this.replace(EMPTY);
  }

  ensureLoaded(): Promise<void> {
    if (this.getSnapshot().status === 'ready') return Promise.resolve();
    return this.reload();
  }

  reload(): Promise<void> {
    if (this.inflight) return this.inflight;
    const run = this.load().finally(() => {
      this.inflight = null;
    });
    this.inflight = run;
    return run;
  }

  private async load(): Promise<void> {
    if (this.getSnapshot().status !== 'ready') this.patch({ status: 'loading', error: null });
    try {
      const all: CollectorRequest[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const data = await this.crm.requests({ per_page: PAGE_SIZE, page });
        all.push(...data.results);
        if (!data.pagination.has_next) break;
      }
      this.patch({ status: 'ready', requests: all, error: null });
    } catch (err: unknown) {
      this.patch({
        status: this.getSnapshot().requests.length ? 'ready' : 'error',
        error: (err as Error).message,
      });
    }
  }

  // --- derived reads ---------------------------------------------------------

  /** Requests that are conversations: artwork inquiries and the general chat. */
  conversations(): CollectorRequest[] {
    return this.getSnapshot().requests.filter(
      (r) => r.kind === 'information' || r.kind === 'message',
    );
  }

  /** Artwork inquiries only (`information` with an artwork), newest first. */
  inquiries(): CollectorRequest[] {
    return this.getSnapshot().requests.filter((r) => r.kind === 'information' && r.artwork);
  }

  /** The general "Chat with Darz" request, if it exists. */
  general(): CollectorRequest | null {
    return this.getSnapshot().requests.find((r) => r.kind === 'message' && !r.artwork) ?? null;
  }

  /** The open inquiry on `artworkId`, if the collector already sent one — the
   * duplicate guard the detail page shows instead of a second Send. */
  openInquiryFor(artworkId: string): CollectorRequest | null {
    return (
      this.inquiries().find((r) => r.artwork === artworkId && !CLOSED.has(r.status)) ?? null
    );
  }

  byId(id: string): CollectorRequest | null {
    return this.getSnapshot().requests.find((r) => r.id === id) ?? null;
  }

  /** Unseen team messages across every conversation — the nav dot. */
  unreadTotal(): number {
    return this.conversations().reduce((n, r) => n + (r.unread_count || 0), 0);
  }

  /** Every request that is not a conversation — the Market activity list
   * (purchase / hold / offer / viewing / price / availability). */
  activity(): CollectorRequest[] {
    return this.getSnapshot().requests.filter(
      (r) => r.kind !== 'information' && r.kind !== 'message',
    );
  }

  // --- writes ----------------------------------------------------------------

  /** Fold a request another controller just created into the list, so the
   * detail page and Chat reflect it without waiting for the next poll. */
  absorb(row: CollectorRequest): void {
    const rest = this.getSnapshot().requests.filter((r) => r.id !== row.id);
    this.patch({ requests: [row, ...rest], status: 'ready' });
  }

  /** Locally clear a thread's unread count (after `mark-seen`). */
  markSeenLocally(requestId: string): void {
    this.patch({
      requests: this.getSnapshot().requests.map((r) =>
        r.id === requestId && r.unread_count ? { ...r, unread_count: 0 } : r,
      ),
    });
  }

  /** The general conversation, created on first use with the stable
   * idempotency key so it can never be duplicated. */
  async ensureGeneral(): Promise<CollectorRequest> {
    const existing = this.general();
    if (existing) return existing;
    const created: CreatedRequest = await this.crm.createRequest({
      kind: 'message',
      artwork: null,
      client_req_id: GENERAL_CHAT_CLIENT_ID,
    });
    this.absorb(created.row);
    return created.row;
  }
}
