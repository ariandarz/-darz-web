/**
 * `WorkspaceListController` — the two guarantees an inline-edit desk leans on:
 * a write's answer lands on its row at once (so the next edit sends the new
 * version), and a reload that started before the write cannot roll the row
 * back. Plus the whole-list read across pages.
 */
import { describe, expect, it } from 'vitest';
import type { WorkspaceService } from '../../../api/services';
import type { Paginated, WorkspaceItem } from '../../../api/types';
import { WorkspaceItemsController } from './controllers';

function row(id: string, version: number, title = id): WorkspaceItem {
  return {
    id,
    version,
    title,
    kind: 'task',
    category: 'personal',
    body: '',
    due_date: null,
    due_time: null,
    done: false,
    done_at: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  };
}

function page(results: WorkspaceItem[], has_next = false): Paginated<WorkspaceItem> {
  return {
    results,
    pagination: {
      page: 1,
      per_page: 100,
      total_pages: has_next ? 2 : 1,
      total_count: results.length,
      has_next,
      has_previous: false,
    },
  };
}

/** A service whose `items()` answers from a queue of pages. */
function fake(pages: Array<() => Promise<Paginated<WorkspaceItem>>>) {
  const calls: unknown[] = [];
  const svc = {
    items: (q: unknown) => {
      calls.push(q);
      const next = pages.shift();
      if (!next) throw new Error('unexpected read');
      return next();
    },
  } as unknown as WorkspaceService;
  return { svc, calls };
}

describe('WorkspaceListController', () => {
  it('reads every page at the backend’s page ceiling', async () => {
    const { svc, calls } = fake([
      () => Promise.resolve(page([row('a', 1)], true)),
      () => Promise.resolve(page([row('b', 1)])),
    ]);
    const c = new WorkspaceItemsController(svc);
    await c.reload();
    expect(c.getSnapshot().results.map((r) => r.id)).toEqual(['a', 'b']);
    expect(calls).toEqual([
      { page: 1, per_page: 100 },
      { page: 2, per_page: 100 },
    ]);
  });

  it('puts a saved row in place, and a new one first', async () => {
    const { svc } = fake([() => Promise.resolve(page([row('a', 1), row('b', 1)]))]);
    const c = new WorkspaceItemsController(svc);
    await c.reload();
    c.put(row('b', 2, 'renamed'));
    c.put(row('n', 1));
    expect(c.getSnapshot().results.map((r) => [r.id, r.version, r.title])).toEqual([
      ['n', 1, 'n'],
      ['a', 1, 'a'],
      ['b', 2, 'renamed'],
    ]);
  });

  it('never replaces a row with an older version', async () => {
    const { svc } = fake([() => Promise.resolve(page([row('a', 3)]))]);
    const c = new WorkspaceItemsController(svc);
    await c.reload();
    c.put(row('a', 2, 'stale'));
    expect(c.getSnapshot().results[0].version).toBe(3);
  });

  it('keeps a write that landed while a reload was in flight', async () => {
    let answer!: (p: Paginated<WorkspaceItem>) => void;
    const { svc } = fake([
      () => Promise.resolve(page([row('a', 1)])),
      () => new Promise((resolve) => (answer = resolve)),
    ]);
    const c = new WorkspaceItemsController(svc);
    await c.reload();
    const inFlight = c.reload(); // reads version 1 …
    c.put(row('a', 2, 'saved')); // … while the PATCH answers version 2
    answer(page([row('a', 1)]));
    await inFlight;
    expect(c.getSnapshot().results[0]).toMatchObject({ version: 2, title: 'saved' });
  });

  it('drops a deleted row', async () => {
    const { svc } = fake([() => Promise.resolve(page([row('a', 1), row('b', 1)]))]);
    const c = new WorkspaceItemsController(svc);
    await c.reload();
    c.drop('a');
    expect(c.getSnapshot().results.map((r) => r.id)).toEqual(['b']);
  });
});
