/**
 * Unit tests for SavedController — save/unsave, the duplicate-action guard,
 * the local write-override (`isSaved()` layered on `artwork.is_saved`),
 * unsave's idempotent 404, error surfacing, and reset.
 * `CrmService` is a fake; no network, no browser storage.
 */
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../api/errors';
import type { SavedArtwork } from '../../api/types';
import { SavedController } from './SavedController';

function row(artworkId: string, created = true, savedId = `s-${artworkId}`): SavedArtwork {
  return {
    id: savedId,
    created,
    created_at: '2026-09-04T00:00:00Z',
    artwork: { id: artworkId, title: `Work ${artworkId}` },
  } as unknown as SavedArtwork;
}

/** An `Artwork`-shaped object carrying only what `isSaved()`/`toggle()` need. */
function artwork(id: string, isSaved = false) {
  return { id, is_saved: isSaved };
}

interface FakeCrm {
  save: ReturnType<typeof vi.fn>;
  unsave: ReturnType<typeof vi.fn>;
}

function fakeCrm(over: Partial<FakeCrm> = {}): FakeCrm {
  return {
    save: vi.fn(async (id: string) => row(id)),
    unsave: vi.fn(async () => undefined),
    ...over,
  };
}

const make = (crm: FakeCrm) => new SavedController(crm as never);
/** let a pending microtask chain settle */
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('SavedController — reading saved state', () => {
  it('defers to artwork.is_saved when this tab has no override', () => {
    const c = make(fakeCrm());
    expect(c.isSaved(artwork('a', true))).toBe(true);
    expect(c.isSaved(artwork('a', false))).toBe(false);
    expect(c.isSaved({ id: 'a' })).toBe(false); // is_saved absent -> false
  });

  it("a write this session overrides the artwork's own is_saved", async () => {
    const c = make(fakeCrm());
    await c.save('a');

    // Even if a stale prop still says false, this tab knows better.
    expect(c.isSaved(artwork('a', false))).toBe(true);
  });

  it('reset() clears every override (logout / a different collector)', async () => {
    const c = make(fakeCrm());
    await c.save('a');
    expect(c.isSaved(artwork('a', false))).toBe(true);

    c.reset();

    expect(c.isSaved(artwork('a', false))).toBe(false);
    expect(c.getSnapshot().pending.size).toBe(0);
  });
});

describe('SavedController — saving and unsaving', () => {
  it('save() posts once, overrides to saved, and reports created', async () => {
    const crm = fakeCrm({ save: vi.fn(async (id: string) => row(id, true)) });
    const c = make(crm);

    await c.save('a');

    expect(crm.save).toHaveBeenCalledWith('a');
    expect(c.isSaved(artwork('a', false))).toBe(true);
    expect(c.getSnapshot().lastAction).toEqual(
      expect.objectContaining({ artworkId: 'a', op: 'save', created: true }),
    );
  });

  it('save() on an already-saved work reports created=false', async () => {
    const crm = fakeCrm({ save: vi.fn(async (id: string) => row(id, false)) });
    const c = make(crm);

    await c.save('a');

    expect(c.getSnapshot().lastAction?.created).toBe(false);
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
    await c.toggle(artwork('a', false));
    expect(crm.save).toHaveBeenCalledTimes(1);
    expect(crm.unsave).not.toHaveBeenCalled();

    release(row('a'));
    await first;
    expect(c.isPending('a')).toBe(false);
    expect(c.isSaved(artwork('a', false))).toBe(true);
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
    expect(c.isSaved(artwork('a', false))).toBe(true);
    expect(c.isSaved(artwork('b', false))).toBe(true);
  });

  it('unsave() overrides to not-saved', async () => {
    const c = make(fakeCrm());

    await c.unsave('a');

    expect(c.getSnapshot().pending.has('a')).toBe(false);
    expect(c.isSaved(artwork('a', true))).toBe(false);
    expect(c.getSnapshot().lastAction?.op).toBe('unsave');
  });

  it('treats a 404 on unsave as done — the work is not saved either way', async () => {
    const crm = fakeCrm({
      unsave: vi.fn(async () => {
        throw new HttpError(404, 'not_found', 'No saved row.', null);
      }),
    });
    const c = make(crm);

    await c.unsave('a');

    expect(c.isSaved(artwork('a', true))).toBe(false);
    expect(c.getSnapshot().actionError).toBeNull();
  });

  it('reports a failed save and leaves state untouched', async () => {
    const crm = fakeCrm({
      save: vi.fn(async () => {
        throw new Error('Could not reach the server.');
      }),
    });
    const c = make(crm);

    await c.save('a');

    expect(c.isSaved(artwork('a', false))).toBe(false);
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

  it('toggle() flips against the current isSaved() answer', async () => {
    const c = make(fakeCrm());

    await c.toggle(artwork('a', true));
    expect(c.getSnapshot().pending.has('a')).toBe(false);

    // toggle() should have called unsave, not save, since is_saved was true
    // (verified indirectly: the override now reads false)
    expect(c.isSaved(artwork('a', true))).toBe(false);
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
