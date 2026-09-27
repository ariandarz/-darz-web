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
    adminArchiveMessage: vi.fn(),
  } as unknown as CrmService & {
    adminArchiveMessage: ReturnType<typeof vi.fn>;
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
    expect(crm.adminPostMessage).toHaveBeenCalledWith('r1', 'from the draft', {});
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

  it('passes the composer’s attached documents to the post (D19)', async () => {
    const crm = crmWith([]);
    crm.adminPostMessage.mockResolvedValue(msg({ sender: 'team' }));
    const c = new AdminThreadController(crm, 'r1');
    await c.send('Your invoice', { documentRefs: ['d1'] });
    expect(crm.adminPostMessage).toHaveBeenCalledWith('r1', 'Your invoice', {
      documentRefs: ['d1'],
    });
  });
});

describe('AdminThreadController — message archive (G-CHAT-2)', () => {
  it('reads without include_archived by default, and with it once toggled', async () => {
    const crm = crmWith([]);
    const c = new AdminThreadController(crm, 'r1');
    await c.reload();
    expect(crm.adminMessages).toHaveBeenLastCalledWith('r1', { per_page: 100, page: 1 });
    await c.setIncludeArchived(true);
    expect(c.showsArchived).toBe(true);
    expect(crm.adminMessages).toHaveBeenLastCalledWith('r1', {
      per_page: 100,
      page: 1,
      include_archived: true,
    });
  });

  it('an archived message leaves the list while archived ones are hidden', async () => {
    const a = msg({ id: 'm1' });
    const b = msg({ id: 'm2' });
    const crm = crmWith([a, b]);
    crm.adminArchiveMessage.mockResolvedValue({ ...a, archived: true });
    const c = new AdminThreadController(crm, 'r1');
    await c.reload();
    expect(await c.archive('m1')).toBe(true);
    expect(crm.adminArchiveMessage).toHaveBeenCalledWith('m1', true);
    expect(c.getSnapshot().messages.map((m) => m.id)).toEqual(['m2']);
  });

  it('while archived ones are shown, archive/restore marks the row in place', async () => {
    const a = msg({ id: 'm1', archived: true });
    const crm = crmWith([a]);
    crm.adminArchiveMessage.mockResolvedValue({ ...a, archived: false });
    const c = new AdminThreadController(crm, 'r1');
    await c.setIncludeArchived(true);
    expect(await c.archive('m1', false)).toBe(true);
    expect(crm.adminArchiveMessage).toHaveBeenCalledWith('m1', false);
    expect(c.getSnapshot().messages[0].archived).toBe(false);
  });

  it('a failed archive keeps the row and reports the error', async () => {
    const crm = crmWith([msg({ id: 'm1' })]);
    crm.adminArchiveMessage.mockRejectedValue(new Error('refused'));
    const c = new AdminThreadController(crm, 'r1');
    await c.reload();
    expect(await c.archive('m1')).toBe(false);
    expect(c.getSnapshot().messages).toHaveLength(1);
    expect(c.getSnapshot().error).toBe('refused');
  });
});
