/**
 * Unit tests for CatalogueController — query merging, page-reset-on-filter,
 * stale-response dropping, and error handling. `CatalogService` is a fake;
 * no network.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Artwork, CatalogueQuery, Paginated } from '../../api/types';
import { CatalogueController } from './CatalogueController';

function page(results: Artwork[], page = 1): Paginated<Artwork> {
  return {
    results,
    pagination: {
      page,
      per_page: 20,
      total_pages: 3,
      total_count: 50,
      has_next: page < 3,
      has_previous: page > 1,
    },
  };
}

function fakeCatalog(impl: (q: CatalogueQuery) => Promise<Paginated<Artwork>>) {
  return { artworks: vi.fn(impl) } as unknown as {
    artworks: (q: CatalogueQuery) => Promise<Paginated<Artwork>>;
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('CatalogueController', () => {
  it('loads on construction is NOT automatic — reload() must be called', () => {
    const catalog = fakeCatalog(async () => page([]));
    const c = new CatalogueController(catalog as never);
    expect(catalog.artworks).not.toHaveBeenCalled();
    expect(c.getSnapshot().status).toBe('idle');
  });

  it('reload() fetches with the current query and updates the snapshot', async () => {
    const catalog = fakeCatalog(async () => page([{ id: '1' } as Artwork]));
    const c = new CatalogueController(catalog as never, { medium: 'oil' });

    await c.reload();

    expect(catalog.artworks).toHaveBeenCalledWith(
      expect.objectContaining({ medium: 'oil', page: 1 }),
    );
    expect(c.getSnapshot().results).toHaveLength(1);
    expect(c.getSnapshot().status).toBe('idle');
  });

  it('setQuery resets to page 1 except when only page is patched', async () => {
    const catalog = fakeCatalog(async () => page([]));
    const c = new CatalogueController(catalog as never);
    await c.reload();

    c.setPage(3);
    await flush();
    expect(c.getSnapshot().query.page).toBe(3);

    c.setQuery({ search: 'x' });
    await flush();
    expect(c.getSnapshot().query).toMatchObject({ page: 1, search: 'x' });
  });

  it('drops a response from a superseded (stale) request', async () => {
    const resolvers: Array<(v: Paginated<Artwork>) => void> = [];
    const catalog = fakeCatalog(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const c = new CatalogueController(catalog as never);

    const first = c.reload(); // in flight — resolvers[0]
    c.setQuery({ search: 'second' }); // supersedes it, synchronously starts resolvers[1]

    resolvers[1]?.(page([{ id: 'fresh' } as Artwork])); // the current request settles
    resolvers[0]?.(page([{ id: 'stale' } as Artwork])); // the superseded one settles after
    await first;
    await flush();

    // the stale response never overwrites the fresh one
    expect(c.getSnapshot().results).toEqual([{ id: 'fresh' }]);
  });

  it('surfaces a fetch error via status/error', async () => {
    const catalog = fakeCatalog(async () => {
      throw new Error('Network down.');
    });
    const c = new CatalogueController(catalog as never);

    await c.reload();

    expect(c.getSnapshot().status).toBe('error');
    expect(c.getSnapshot().error).toBe('Network down.');
  });

  it('notifies subscribers on every state change', async () => {
    const catalog = fakeCatalog(async () => page([]));
    const c = new CatalogueController(catalog as never);
    const fn = vi.fn();
    c.subscribe(fn);

    await c.reload();

    expect(fn).toHaveBeenCalled();
  });
});
