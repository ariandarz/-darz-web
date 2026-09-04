/**
 * Unit tests for SavedController — the saved-set read (page walk), the
 * duplicate-action guard, unsave (incl. the idempotent 404), error surfacing,
 * and reset. `CrmService` is a fake; no network, no browser storage.
 */
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../api/errors';
import type { Paginated, SavedArtwork } from '../../api/types';
import { SavedController } from './SavedController';

function row(artworkId: string, savedId = `s-${artworkId}`): SavedArtwork {
  return {
    id: savedId,
    created_at: '2026-09-04T00:00:00Z',
    artwork: { id: artworkId, title: `Work ${artworkId}` },
  } as unknown as SavedArtwork;
}

function page(results: SavedArtwork[], hasNext = false, p = 1): Paginated<SavedArtwork> {
  return {
    results,
    pagination: {
      page: p,
      per_page: 100,
      total_pages: hasNext ? p + 1 : p,
      total_count: results.length,
      has_next: hasNext,
      has_previous: p > 1,
    },
  };
}

interface FakeCrm {
  saved: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  unsave: ReturnType<typeof vi.fn>;
}

function fakeCrm(over: Partial<FakeCrm> = {}): FakeCrm {
  return {
    saved: vi.fn(async () => page([])),
    save: vi.fn(async (id: string) => row(id)),
    unsave: vi.fn(async () => undefined),
    ...over,
  };
}

const make = (crm: FakeCrm) => new SavedController(crm as never);
/** let a pending microtask chain settle */
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('SavedController — reading the saved set', () => {
  it('does not fetch on construction', () => {
    const crm = fakeCrm();
    const c = make(crm);
    expect(crm.saved).not.toHaveBeenCalled();
    expect(c.getSnapshot().status).toBe('idle');
  });

  it('ensureLoaded() reads every page and indexes the artwork ids', async () => {
    const crm = fakeCrm({
      saved: vi.fn(async ({ page: p }: { page?: number }) =>
        p === 1 ? page([row('a'), row('b')], true, 1) : page([row('c')], false, 2),
      ),
    });
    const c = make(crm);

    await c.ensureLoaded();

    expect(crm.saved).toHaveBeenCalledTimes(2);
    const s = c.getSnapshot();
    expect(s.status).toBe('ready');
    expect(s.items).toHaveLength(3);
    expect([...s.ids]).toEqual(['a', 'b', 'c']);
    expect(c.isSaved('b')).toBe(true);
    expect(c.isSaved('zzz')).toBe(false);
  });

  it('ensureLoaded() reads once — concurrent callers share the same request', async () => {
    const crm = fakeCrm({ saved: vi.fn(async () => page([row('a')])) });
    const c = make(crm);

    await Promise.all([c.ensureLoaded(), c.ensureLoaded(), c.ensureLoaded()]);
    await c.ensureLoaded(); // already ready — still no second read

    expect(crm.saved).toHaveBeenCalledTimes(1);
  });

  it('surfaces a read failure without pretending the set is empty-but-ready', async () => {
    const crm = fakeCrm({
      saved: vi.fn(async () => {
        throw new Error('Could not reach the server.');
      }),
    });
    const c = make(crm);

    await c.ensureLoaded();

    expect(c.getSnapshot().status).toBe('error');
    expect(c.getSnapshot().error).toBe('Could not reach the server.');
  });

  it('reset() clears the set (logout / a different collector)', async () => {
    const crm = fakeCrm({ saved: vi.fn(async () => page([row('a')])) });
    const c = make(crm);
    await c.ensureLoaded();
    expect(c.isSaved('a')).toBe(true);

    c.reset();

    expect(c.getSnapshot().status).toBe('idle');
    expect(c.getSnapshot().items).toEqual([]);
    expect(c.isSaved('a')).toBe(false);
  });
});

describe('SavedController — saving and unsaving', () => {
  it('save() posts once and adds the work to the set', async () => {
    const crm = fakeCrm();
    const c = make(crm);

    await c.save('a');

    expect(crm.save).toHaveBeenCalledWith('a');
    expect(c.isSaved('a')).toBe(true);
    expect(c.getSnapshot().lastAction?.op).toBe('save');
  });

  it('never lists the same work twice when a re-save returns the existing row', async () => {
    const crm = fakeCrm({ saved: vi.fn(async () => page([row('a')])) });
    const c = make(crm);
    await c.ensureLoaded();

    await c.save('a');

    expect(c.getSnapshot().items).toHaveLength(1);
  });

  it('ignores a second action for the same artwork while one is in flight', async () => {
    let release!: (v: SavedArtwork) => void;
    const crm = fakeCrm({
      save: vi.fn(
        () =>
          new Promise<SavedArtwork>((res) => {
            release = res;
          }),
      ),
    });
    const c = make(crm);

    const first = c.save('a');
    await flush();
    expect(c.isPending('a')).toBe(true);

    // the double-tap: both a repeat save and a toggle must be refused
    await c.save('a');
    await c.toggle('a');
    expect(crm.save).toHaveBeenCalledTimes(1);
    expect(crm.unsave).not.toHaveBeenCalled();

    release(row('a'));
    await first;
    expect(c.isPending('a')).toBe(false);
    expect(c.isSaved('a')).toBe(true);
  });

  it('lets a different artwork be saved while one is pending', async () => {
    const crm = fakeCrm({
      save: vi.fn(async (id: string) => {
        await flush();
        return row(id);
      }),
    });
    const c = make(crm);

    await Promise.all([c.save('a'), c.save('b')]);

    expect(crm.save).toHaveBeenCalledTimes(2);
    expect([...c.getSnapshot().ids].sort()).toEqual(['a', 'b']);
  });

  it('unsave() removes the work from the set', async () => {
    const crm = fakeCrm({ saved: vi.fn(async () => page([row('a'), row('b')])) });
    const c = make(crm);
    await c.ensureLoaded();

    await c.unsave('a');

    expect(crm.unsave).toHaveBeenCalledWith('a');
    expect(c.isSaved('a')).toBe(false);
    expect(c.isSaved('b')).toBe(true);
    expect(c.getSnapshot().lastAction?.op).toBe('unsave');
  });

  it('treats a 404 on unsave as done — the work is not saved either way', async () => {
    const crm = fakeCrm({
      saved: vi.fn(async () => page([row('a')])),
      unsave: vi.fn(async () => {
        throw new HttpError(404, 'not_found', 'No saved row.', null);
      }),
    });
    const c = make(crm);
    await c.ensureLoaded();

    await c.unsave('a');

    expect(c.isSaved('a')).toBe(false);
    expect(c.getSnapshot().actionError).toBeNull();
  });

  it('reports a failed save and leaves the set untouched', async () => {
    const crm = fakeCrm({
      save: vi.fn(async () => {
        throw new Error('Could not reach the server.');
      }),
    });
    const c = make(crm);

    await c.save('a');

    expect(c.isSaved('a')).toBe(false);
    expect(c.isPending('a')).toBe(false);
    expect(c.getSnapshot().actionError).toEqual(
      expect.objectContaining({
        artworkId: 'a',
        op: 'save',
        message: 'Could not reach the server.',
      }),
    );
    expect(c.getSnapshot().lastAction).toBeNull();

    c.clearActionError();
    expect(c.getSnapshot().actionError).toBeNull();
  });

  it('toggle() flips against the server-derived state', async () => {
    const crm = fakeCrm({ saved: vi.fn(async () => page([row('a')])) });
    const c = make(crm);
    await c.ensureLoaded();

    await c.toggle('a');
    expect(crm.unsave).toHaveBeenCalledWith('a');
    expect(c.isSaved('a')).toBe(false);

    await c.toggle('a');
    expect(crm.save).toHaveBeenCalledWith('a');
    expect(c.isSaved('a')).toBe(true);
  });

  it('notifies subscribers on every state change', async () => {
    const crm = fakeCrm();
    const c = make(crm);
    const seen = vi.fn();
    const off = c.subscribe(seen);

    await c.save('a');
    expect(seen).toHaveBeenCalled();

    off();
    const before = seen.mock.calls.length;
    await c.unsave('a');
    expect(seen.mock.calls.length).toBe(before);
  });
});
