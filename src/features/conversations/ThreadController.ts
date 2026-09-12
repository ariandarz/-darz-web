/**
 * ThreadController — one request's reply thread (`RequestMessage`), oldest
 * first: the messages, posting, and marking the team's messages seen.
 *
 * Ports the behaviour of the old app's `request_thread` (app.html:6459-6541,
 * `dzThreadPull` / `dzThreadSend` / `dzThreadSeen`) over the new backend:
 *   GET  /api/crm/requests/{id}/messages/            → the thread
 *   POST /api/crm/requests/{id}/messages/  {body}    → the collector's message
 *   POST /api/crm/requests/{id}/messages/mark-seen/  → team messages seen
 *
 * Polls while open (boot + ~30s + on focus) — the owner's decision for the
 * reply channel. Posting is guarded: one in-flight send per thread, and the
 * sent message is appended from the server's answer, never from the draft.
 */
import type { CrmService } from '../../api/services';
import type { RequestMessage } from '../../api/types';
import { Observable } from '../shared/Observable';

const POLL_MS = 30_000;
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

export type ThreadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ThreadSnapshot {
  status: ThreadStatus;
  messages: RequestMessage[];
  error: string | null;
  sending: boolean;
  sendError: string | null;
}

const EMPTY: ThreadSnapshot = {
  status: 'idle',
  messages: [],
  error: null,
  sending: false,
  sendError: null,
};

export class ThreadController extends Observable<ThreadSnapshot> {
  readonly requestId: string;
  private readonly crm: CrmService;
  private poll: ReturnType<typeof setInterval> | null = null;
  private token = 0;
  private readonly onFocus = () => void this.reload();
  /** called after the team's messages were marked seen on the server */
  private readonly onSeen: ((requestId: string) => void) | null;

  constructor(
    crm: CrmService,
    requestId: string,
    opts: { onSeen?: (requestId: string) => void } = {},
  ) {
    super(EMPTY);
    this.crm = crm;
    this.requestId = requestId;
    this.onSeen = opts.onSeen ?? null;
  }

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

  async reload(): Promise<void> {
    const mine = ++this.token;
    if (this.getSnapshot().status !== 'ready') this.patch({ status: 'loading', error: null });
    try {
      const all: RequestMessage[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const data = await this.crm.messages(this.requestId, { per_page: PAGE_SIZE, page });
        all.push(...data.results);
        if (!data.pagination.has_next) break;
      }
      if (mine !== this.token) return;
      this.patch({ status: 'ready', messages: all, error: null });
      if (all.some((m) => m.sender === 'team' && !m.seen_by_collector)) await this.markSeen();
    } catch (err: unknown) {
      if (mine !== this.token) return;
      this.patch({
        status: this.getSnapshot().messages.length ? 'ready' : 'error',
        error: (err as Error).message,
      });
    }
  }

  /** Send one message. Resolves true once the server holds it. */
  async send(body: string): Promise<boolean> {
    const text = body.trim();
    if (!text || this.getSnapshot().sending) return false;
    this.patch({ sending: true, sendError: null });
    try {
      const row = await this.crm.postMessage(this.requestId, text);
      const rest = this.getSnapshot().messages.filter((m) => m.id !== row.id);
      this.patch({ messages: [...rest, row], status: 'ready' });
      return true;
    } catch (err: unknown) {
      this.patch({ sendError: (err as Error).message });
      return false;
    } finally {
      this.patch({ sending: false });
    }
  }

  clearSendError(): void {
    if (this.getSnapshot().sendError) this.patch({ sendError: null });
  }

  private async markSeen(): Promise<void> {
    try {
      await this.crm.markSeen(this.requestId);
      this.patch({
        messages: this.getSnapshot().messages.map((m) =>
          m.sender === 'team' && !m.seen_by_collector ? { ...m, seen_by_collector: true } : m,
        ),
      });
      this.onSeen?.(this.requestId);
    } catch {
      /* the next poll will try again */
    }
  }
}
