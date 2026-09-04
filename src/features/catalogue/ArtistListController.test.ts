/**
 * ArtistListController — the state machine itself is covered generically by
 * CatalogueController.test.ts (both extend ListController); this only checks
 * the artist-specific wiring: it calls CatalogService.artists, not artworks.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Artist, ArtistQuery, Paginated } from '../../api/types';
import { ArtistListController } from './ArtistListController';

function page(results: Artist[]): Paginated<Artist> {
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

describe('ArtistListController', () => {
  it('fetches via CatalogService.artists, not artworks', async () => {
    const artists = vi.fn(async (_q: ArtistQuery) =>
      page([{ id: 'a1', display_name: 'Someone' } as Artist]),
    );
    const artworks = vi.fn();
    const c = new ArtistListController({ artists, artworks } as never, { search: 'someone' });

    await c.reload();

    expect(artists).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'someone', page: 1 }),
    );
    expect(artworks).not.toHaveBeenCalled();
    expect(c.getSnapshot().results).toEqual([{ id: 'a1', display_name: 'Someone' }]);
  });

  it('setQuery(ordering) resets to page 1, same as the artwork list', async () => {
    const artists = vi.fn(async () => page([]));
    const c = new ArtistListController({ artists } as never);
    await c.reload();

    c.setPage(2);
    c.setQuery({ ordering: 'works' });

    expect(c.getSnapshot().query).toMatchObject({ page: 1, ordering: 'works' });
  });
});
