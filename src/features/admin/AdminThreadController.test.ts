/**
 * The admin end of the thread machine — chiefly that the **seen direction is
 * flipped** from the collector's. Both subclasses share every line of the
 * machine (`MessageThreadController`), so what needs proving here is exactly
 * the seam: which endpoints are called and whose messages get marked.
 *
 * The old panel's `_chatSeen` is the behaviour being kept
 * (`darz-studio.html:40547`: `m.sender==='collector' && !m.seenAdmin`).
 */
import { describe, expect, it, vi } from 'vitest';
import type { CrmService } from '../../api/services';
import type { Paginated, RequestMessage } from '../../api/types';
import { AdminThreadController } from './AdminThreadController';

function msg(over: Partial<RequestMessage>): RequestMessage {
  return {
    id: Math.random().toString(36).slice(2),
    request: 'r1',
    sender: 'collector',
    body: 'hello',
    artwork_refs: [],
    seen_by_collector: false,
    seen_by_team: false,
    created_at: '2026-09-18T12:00:00Z',
    ...over,
  } as RequestMessage;
}

function page(results: RequestMessage[]): Paginated<RequestMessage> {
  return {
    results,
    pagination: {
      page: 1,
      per_page: 100,
      total_pages: 1,
      total_count: results.length,
      has_next: false,
      has_previous: false,
    },
  };
}

function crmWith(messages: RequestMessage[]) {
  return {
    adminMessages: vi.fn().mockResolvedValue(page(messages)),
    adminPostMessage: vi.fn(),
    adminMarkSeen: vi.fn().mockResolvedValue({ unread_count: 0 }),
  } as unknown as CrmService & {
    adminMessages: ReturnType<typeof vi.fn>;
    adminPostMessage: ReturnType<typeof vi.fn>;
    adminMarkSeen: ReturnType<typeof vi.fn>;
  };
}

describe('AdminThreadController — the team end of the shared machine', () => {
  it('loads through the ADMIN endpoints, never the collector ones', async () => {
    const crm = crmWith([msg({})]);
    const c = new AdminThreadController(crm, 'r1');
    await c.reload();
    expect(crm.adminMessages).toHaveBeenCalledWith('r1', { per_page: 100, page: 1 });
  });

  it('marks unseen COLLECTOR messages seen on load — :40547, flipped from the collector end', async () => {
    const unseen = msg({ sender: 'collector', seen_by_team: false });
    const crm = crmWith([unseen]);
    const c = new AdminThreadController(crm, 'r1');
    await c.reload();
    expect(crm.adminMarkSeen).toHaveBeenCalledWith('r1');
    expect(c.getSnapshot().messages[0].seen_by_team).toBe(true);
  });

  it('does not call mark-seen when nothing incoming is unseen', async () => {
    const crm = crmWith([
      msg({ sender: 'collector', seen_by_team: true }),
      // the TEAM's own unseen-by-collector message is not this end's to mark
      msg({ sender: 'team', seen_by_collector: false }),
    ]);
    const c = new AdminThreadController(crm, 'r1');
    await c.reload();
    expect(crm.adminMarkSeen).not.toHaveBeenCalled();
  });

  it('sends through the admin endpoint and appends the SERVER row, not the draft', async () => {
    const crm = crmWith([]);
    const serverRow = msg({ sender: 'team', body: 'from the server' });
    crm.adminPostMessage.mockResolvedValue(serverRow);
    const c = new AdminThreadController(crm, 'r1');
    await c.reload();
    const ok = await c.send('  from the draft  ');
    expect(ok).toBe(true);
    expect(crm.adminPostMessage).toHaveBeenCalledWith('r1', 'from the draft');
    expect(c.getSnapshot().messages.at(-1)?.body).toBe('from the server');
  });

  it('one in-flight send at a time; a failure lands in sendError, not a throw', async () => {
    const crm = crmWith([]);
    crm.adminPostMessage.mockRejectedValue(new Error('nope'));
    const c = new AdminThreadController(crm, 'r1');
    expect(await c.send('x')).toBe(false);
    expect(c.getSnapshot().sendError).toBe('nope');
    expect(c.getSnapshot().sending).toBe(false);
  });

  it('an empty draft never reaches the wire', async () => {
    const crm = crmWith([]);
    const c = new AdminThreadController(crm, 'r1');
    expect(await c.send('   ')).toBe(false);
    expect(crm.adminPostMessage).not.toHaveBeenCalled();
  });
});
