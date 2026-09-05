/**
 * Unit tests for AdminRequestsController — the filter query reaching the admin
 * feed endpoint, and the transition-then-reload behaviour. `CrmService` is a
 * fake; no network.
 */
import { describe, expect, it, vi } from 'vitest';
import type { AdminRequest, Paginated } from '../../api/types';
import { AdminRequestsController } from './AdminRequestsController';

function page(results: AdminRequest[]): Paginated<AdminRequest> {
  return {
    results,
    pagination: {
      page: 1,
      per_page: 20,
      total_pages: 1,
      total_count: results.length,
      has_next: false,
      has_previous: false,
    },
  };
}

const row = (id: string, over: Partial<AdminRequest> = {}) =>
  ({
    id,
    kind: 'offer',
    status: 'new',
    collector: 'c1',
    artwork: 'aw1',
    ...over,
  }) as AdminRequest;

function fakeCrm(over: Record<string, unknown> = {}) {
  return {
    adminRequests: vi.fn(async () => page([row('r1')])),
    transitionRequest: vi.fn(async () => row('r1', { status: 'in_review' })),
    ...over,
  };
}

describe('AdminRequestsController', () => {
  it('does not fetch until reload()', () => {
    const crm = fakeCrm();
    const c = new AdminRequestsController(crm as never);
    expect(crm.adminRequests).not.toHaveBeenCalled();
    expect(c.getSnapshot().status).toBe('idle');
  });

  it('passes kind/status/assignee filters through to the admin feed', async () => {
    const crm = fakeCrm();
    const c = new AdminRequestsController(crm as never);

    c.setQuery({ kind: 'offer', status: 'new' });
    await new Promise((r) => setTimeout(r, 0));

    expect(crm.adminRequests).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'offer', status: 'new', page: 1 }),
    );
    expect(c.getSnapshot().results).toHaveLength(1);
  });

  it('re-reads the page after a transition rather than guessing the new state', async () => {
    const crm = fakeCrm();
    const c = new AdminRequestsController(crm as never);
    await c.reload();
    const before = crm.adminRequests.mock.calls.length;

    await c.transition('r1', 'in_review', 'looks good');

    expect(crm.transitionRequest).toHaveBeenCalledWith('r1', 'in_review', 'looks good');
    expect(crm.adminRequests.mock.calls.length).toBe(before + 1);
  });

  it('surfaces a failed feed read as the list error', async () => {
    const crm = fakeCrm({
      adminRequests: vi.fn(async () => {
        throw new Error('Forbidden.');
      }),
    });
    const c = new AdminRequestsController(crm as never);

    await c.reload();

    expect(c.getSnapshot().status).toBe('error');
    expect(c.getSnapshot().error).toBe('Forbidden.');
  });
});
