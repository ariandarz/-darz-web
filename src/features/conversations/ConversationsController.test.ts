/**
 * ConversationsController — the derived reads Profile, Chat and the reply
 * notice all share, and the session-local clear (owner decision D4): the
 * backend has no collector-side delete or archive
 * (`docs/PHASE_5_API_GAPS.md` G-P5-4), so a clear hides rows for this session
 * and never touches the server.
 */
import { describe, expect, it, vi } from 'vitest';
import type { CollectorRequest } from '../../api/types';
import { ConversationsController } from './ConversationsController';

function row(over: Partial<CollectorRequest>): CollectorRequest {
  return {
    id: 'r',
    kind: 'offer',
    status: 'submitted',
    // nested, as the backend serves it (G-P5-2) — not a bare uuid
    artwork: { id: 'aw1', title: 'Untitled', artist: null, image: null },
    detail: {},
    unread_count: 0,
    created_at: '2026-09-17T12:00:00Z',
    ...over,
  } as unknown as CollectorRequest;
}

/** newest first, as `GET /api/crm/requests/` returns them */
const ROWS = [
  row({ id: 'offer1', kind: 'offer', created_at: '2026-09-18T12:00:00Z' }),
  row({
    id: 'inq1',
    kind: 'information',
    unread_count: 2,
    created_at: '2026-09-17T12:00:00Z',
  }),
  row({ id: 'hold1', kind: 'hold', status: 'active', created_at: '2026-09-16T12:00:00Z' }),
  row({ id: 'chat', kind: 'message', artwork: null, created_at: '2026-09-15T12:00:00Z' }),
];

function loaded(rows: CollectorRequest[] = ROWS) {
  const crm = {
    requests: vi.fn(async () => ({
      results: rows,
      pagination: {
        page: 1,
        per_page: 100,
        total_pages: 1,
        total_count: rows.length,
        has_next: false,
        has_previous: false,
      },
    })),
  };
  const c = new ConversationsController(crm as never);
  return { c, crm };
}

describe('ConversationsController — derived reads', () => {
  it('splits conversations from activity', async () => {
    const { c } = loaded();
    await c.reload();
    expect(c.conversations().map((r) => r.id)).toEqual(['inq1', 'chat']);
    expect(c.activity().map((r) => r.id)).toEqual(['offer1', 'hold1']);
    expect(c.unreadTotal()).toBe(2);
  });

  it('finds the open inquiry by the nested artwork id', async () => {
    const { c } = loaded();
    await c.reload();
    expect(c.openInquiryFor('aw1')?.id).toBe('inq1');
    expect(c.openInquiryFor('aw2')).toBeNull();
  });
});

describe('ConversationsController — clearing activity (D4 · G-P5-4)', () => {
  it('hides the activity rows without touching the server, and keeps conversations', async () => {
    const { c, crm } = loaded();
    await c.reload();
    const callsBefore = crm.requests.mock.calls.length;

    c.clearActivity();

    expect(c.activity()).toEqual([]);
    expect(c.conversations().map((r) => r.id)).toEqual(['inq1', 'chat']);
    // nothing was sent: the backend has no collector archive
    expect(crm.requests.mock.calls.length).toBe(callsBefore);
  });

  it('hides one row on request, leaving the rest', async () => {
    const { c } = loaded();
    await c.reload();

    c.hide('offer1');

    expect(c.activity().map((r) => r.id)).toEqual(['hold1']);
  });

  it('brings everything back on the next load — the hide is this session only', async () => {
    const { c } = loaded();
    await c.reload();
    c.clearActivity();
    expect(c.activity()).toEqual([]);

    // a later poll still carries the rows; they stay hidden for this session
    await c.reload();
    expect(c.getSnapshot().requests).toHaveLength(4);
  });
});

describe('ConversationsController — the reply notice', () => {
  it('points at the newest request with an unseen reply, of any kind', async () => {
    const { c } = loaded([
      row({
        id: 'offer1',
        kind: 'offer',
        unread_count: 1,
        created_at: '2026-09-18T12:00:00Z',
      }),
      row({ id: 'inq1', kind: 'information', unread_count: 3 }),
    ]);
    await c.reload();

    expect(c.newestUnread()?.id).toBe('offer1');
  });

  it('announces nothing when there is no unseen reply, or the row was cleared', async () => {
    const { c } = loaded([row({ id: 'offer1', kind: 'offer', unread_count: 1 })]);
    await c.reload();
    expect(c.newestUnread()?.id).toBe('offer1');

    c.hide('offer1');
    expect(c.newestUnread()).toBeNull();
  });
});
