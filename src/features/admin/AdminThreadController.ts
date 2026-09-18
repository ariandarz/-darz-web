/**
 * AdminThreadController — the **team's** end of one request's thread:
 *   GET  /api/crm/admin/requests/{id}/messages/            → the thread
 *   POST /api/crm/admin/requests/{id}/messages/  {body}    → the team's reply
 *   POST /api/crm/admin/requests/{id}/messages/mark-seen/  → collector msgs seen
 *
 * The machine is `MessageThreadController`, shared with the collector's
 * `ThreadController`; this binds the admin endpoints and flips the seen
 * direction — the "other side" here is the **collector**, which is exactly what
 * the old panel's `_chatSeen` marked (`darz-studio.html:40547`:
 * `m.sender==='collector' && !m.seenAdmin`).
 */
import type { CrmService } from '../../api/services';
import type { RequestMessage } from '../../api/types';
import { MessageThreadController } from '../conversations/MessageThreadController';

export class AdminThreadController extends MessageThreadController {
  private readonly crm: CrmService;

  constructor(
    crm: CrmService,
    requestId: string,
    opts: { onSeen?: (requestId: string) => void } = {},
  ) {
    super(requestId, opts);
    this.crm = crm;
  }

  protected fetchPage(page: number, perPage: number) {
    return this.crm.adminMessages(this.requestId, { per_page: perPage, page });
  }
  protected post(body: string) {
    return this.crm.adminPostMessage(this.requestId, body);
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
