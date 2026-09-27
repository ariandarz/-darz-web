/**
 * MessageThreadController — the message-thread state machine, shared by the
 * collector's `ThreadController` and the admin's `AdminThreadController`.
 *
 * Both ends of a conversation are the same machine: load the whole thread
 * oldest-first (paged), poll while open (boot + ~30s + on focus), post with a
 * one-in-flight guard appending the server's answer never the draft, and mark
 * the *other side's* messages seen. The only differences are which endpoints
 * serve it and which side's messages count as unseen — so those are the
 * abstract seam, and the machine lives here once (CLAUDE.md: a second subclass
 * duplicating a first one's logic instead of extending a shared base is a bug).
 *
 * The machine itself ports the old app's `request_thread` behaviour
 * (app.html:6459-6541, `dzThreadPull` / `dzThreadSend` / `dzThreadSeen`); the
 * admin end of the same table is what `DarzAdmin.chatSend` / `_chatSeen` wrote
 * (`darz-studio.html:40546-40547`) — one thread store, two writers, exactly as
 * here.
 */
import type { MessageAttachments, Paginated, RequestMessage } from '../../api/types';
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

export abstract class MessageThreadController extends Observable<ThreadSnapshot> {
  readonly requestId: string;
  private poll: ReturnType<typeof setInterval> | null = null;
  private token = 0;
  private readonly onFocus = () => void this.reload();
  /** called after the other side's messages were marked seen on the server */
  private readonly onSeen: ((requestId: string) => void) | null;

  protected constructor(
    requestId: string,
    opts: { onSeen?: (requestId: string) => void } = {},
  ) {
    super(EMPTY);
    this.requestId = requestId;
    this.onSeen = opts.onSeen ?? null;
  }

  // ---- the seam: which endpoints, and which side is "the other side" -------

  /** One page of the thread. */
  protected abstract fetchPage(
    page: number,
    perPage: number,
  ): Promise<Paginated<RequestMessage>>;
  /** Post this end's message. `attach` is what the composer attached (the
   * team's documents, D19); an end that attaches nothing ignores it. */
  protected abstract post(body: string, attach: MessageAttachments): Promise<RequestMessage>;
  /** Tell the server every unseen message from the other side is now seen. */
  protected abstract markSeenRemote(): Promise<unknown>;
  /** True for a message from the other side this end has not seen. */
  protected abstract isUnseenIncoming(m: RequestMessage): boolean;
  /** The same message, marked seen from this end. */
  protected abstract withSeen(m: RequestMessage): RequestMessage;

  // ---- the machine ---------------------------------------------------------

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
        const data = await this.fetchPage(page, PAGE_SIZE);
        all.push(...data.results);
        if (!data.pagination.has_next) break;
      }
      if (mine !== this.token) return;
      this.patch({ status: 'ready', messages: all, error: null });
      if (all.some((m) => this.isUnseenIncoming(m))) await this.markSeen();
    } catch (err: unknown) {
      if (mine !== this.token) return;
      this.patch({
        status: this.getSnapshot().messages.length ? 'ready' : 'error',
        error: (err as Error).message,
      });
    }
  }

  /** Send one message. Resolves true once the server holds it. */
  async send(body: string, attach: MessageAttachments = {}): Promise<boolean> {
    const text = body.trim();
    if (!text || this.getSnapshot().sending) return false;
    this.patch({ sending: true, sendError: null });
    try {
      const row = await this.post(text, attach);
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
      await this.markSeenRemote();
      this.patch({
        messages: this.getSnapshot().messages.map((m) =>
          this.isUnseenIncoming(m) ? this.withSeen(m) : m,
        ),
      });
      this.onSeen?.(this.requestId);
    } catch {
      /* the next poll will try again */
    }
  }
}
