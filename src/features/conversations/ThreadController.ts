/**
 * ThreadController — the **collector's** end of one request's reply thread:
 *   GET  /api/crm/requests/{id}/messages/            → the thread
 *   POST /api/crm/requests/{id}/messages/  {body}    → the collector's message
 *   POST /api/crm/requests/{id}/messages/mark-seen/  → team messages seen
 *
 * The whole machine (paged load, polling, guarded send, seen-marking) lives in
 * `MessageThreadController`, shared with the admin's `AdminThreadController` —
 * this class only binds the collector endpoints and the collector's seen
 * direction: the "other side" here is the **team**.
 */
import type { CrmService } from '../../api/services';
import type { RequestMessage } from '../../api/types';
import { MessageThreadController } from './MessageThreadController';

export type { ThreadSnapshot, ThreadStatus } from './MessageThreadController';

export class ThreadController extends MessageThreadController {
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
    return this.crm.messages(this.requestId, { per_page: perPage, page });
  }
  protected post(body: string) {
    return this.crm.postMessage(this.requestId, body);
  }
  protected markSeenRemote() {
    return this.crm.markSeen(this.requestId);
  }
  protected isUnseenIncoming(m: RequestMessage): boolean {
    return m.sender === 'team' && !m.seen_by_collector;
  }
  protected withSeen(m: RequestMessage): RequestMessage {
    return { ...m, seen_by_collector: true };
  }
}
