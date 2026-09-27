/**
 * AdminThreadController — the **team's** end of one request's thread:
 *   GET  /api/crm/admin/requests/{id}/messages/[?include_archived=true] → the thread
 *   POST /api/crm/admin/requests/{id}/messages/  {body, document_refs?}  → the team's reply
 *   POST /api/crm/admin/requests/{id}/messages/mark-seen/                → collector msgs seen
 *   POST /api/crm/admin/messages/{id}/archive/   {archived}              → hide / restore one
 *
 * The machine is `MessageThreadController`, shared with the collector's
 * `ThreadController`; this binds the admin endpoints and flips the seen
 * direction — the "other side" here is the **collector**, which is exactly what
 * the old panel's `_chatSeen` marked (`darz-studio.html:40547`:
 * `m.sender==='collector' && !m.seenAdmin`).
 *
 * **Archive (G-CHAT-2) is the admin end's alone.** The old panel hid older
 * messages with a panel-wide renewal cutoff (`_chatCutoff` / `_threadVisible`,
 * `:40246-40247`; "Messages are hidden from the active chat (not deleted …)",
 * `chatArchiveNow` `:40258`). The backend turned that into a per-message flag
 * that only the desk honours — the collector's thread lists every message
 * whatever the flag says — so the controller owns the desk's two moves: the
 * `include_archived` read, and archive/restore of one message.
 */
import type { CrmService } from '../../api/services';
import type { MessageAttachments, RequestMessage } from '../../api/types';
import { MessageThreadController } from '../conversations/MessageThreadController';

export class AdminThreadController extends MessageThreadController {
  private readonly crm: CrmService;
  private includeArchived = false;

  constructor(
    crm: CrmService,
    requestId: string,
    opts: { onSeen?: (requestId: string) => void } = {},
  ) {
    super(requestId, opts);
    this.crm = crm;
  }

  /** Whether the thread currently lists archived messages too. */
  get showsArchived(): boolean {
    return this.includeArchived;
  }

  /** The "Include archived" toggle: re-reads the thread with or without them. */
  setIncludeArchived(on: boolean): Promise<void> {
    if (on === this.includeArchived) return Promise.resolve();
    this.includeArchived = on;
    return this.reload();
  }

  /**
   * Archive (or restore) one message. The server's answer replaces the row;
   * an archived row leaves the list unless archived messages are being shown.
   * Resolves true once the server holds the change.
   */
  async archive(messageId: string, archived = true): Promise<boolean> {
    try {
      const row = await this.crm.adminArchiveMessage(messageId, archived);
      const messages = this.getSnapshot().messages;
      this.patch({
        messages:
          row.archived && !this.includeArchived
            ? messages.filter((m) => m.id !== messageId)
            : messages.map((m) => (m.id === messageId ? { ...m, ...row } : m)),
        error: null,
      });
      return true;
    } catch (err: unknown) {
      this.patch({ error: (err as Error).message });
      return false;
    }
  }

  protected fetchPage(page: number, perPage: number) {
    return this.crm.adminMessages(this.requestId, {
      per_page: perPage,
      page,
      ...(this.includeArchived ? { include_archived: true } : {}),
    });
  }
  protected post(body: string, attach: MessageAttachments) {
    return this.crm.adminPostMessage(this.requestId, body, attach);
  }
  protected markSeenRemote() {
    return this.crm.adminMarkSeen(this.requestId);
  }
  protected isUnseenIncoming(m: RequestMessage): boolean {
    return m.sender === 'collector' && !m.seen_by_team;
  }
  protected withSeen(m: RequestMessage): RequestMessage {
    return { ...m, seen_by_team: true };
  }
}
