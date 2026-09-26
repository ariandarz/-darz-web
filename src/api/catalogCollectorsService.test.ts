/**
 * V1 Phase 4 on the wire: the Database's Phase-5b / G-HEALTH filters reach the
 * list AND the facets call as the server's param names, the artists roster
 * takes server `search` / `ordering`, and the collectors desk reads the
 * G-COL-1 summary and orders by the G-COL-2 rollups.
 */
import { describe, expect, it } from 'vitest';
import { AdminAccountsService, CatalogAdminService } from './services';

function spyClient() {
  const sent: Array<{ method: string; path: string; query: unknown }> = [];
  const client = {
    send: (method: string, path: string, opts?: { query?: unknown }) => {
      sent.push({ method, path, query: opts?.query });
      return Promise.resolve({});
    },
  };
  return { client, sent };
}

describe('CatalogAdminService — Phase 4 params', () => {
  it('sends the new artwork filters to the list and to facets alike', async () => {
    const { client, sent } = spyClient();
    const c = new CatalogAdminService(client as never);
    const q = {
      gallery_portal: false,
      complete: false,
      duplicate_images: true,
      size: 'large' as const,
      source_type: 'gallery',
      created_after: '2026-08-26T12:00:00.000Z',
    };
    await c.artworks(q);
    await c.artworkFacets(q);
    expect(sent.map((r) => [r.path, r.query])).toEqual([
      ['/catalog/admin/artworks/', q],
      ['/catalog/admin/artworks/facets/', q],
    ]);
  });

  it('pages the artists roster with server search and ordering', async () => {
    const { client, sent } = spyClient();
    await new CatalogAdminService(client as never).artists({
      search: 'Tanavoli',
      ordering: 'works',
      page: 2,
      per_page: 100,
    });
    expect(sent[0]).toEqual({
      method: 'GET',
      path: '/catalog/admin/artists/',
      query: { search: 'Tanavoli', ordering: 'works', page: 2, per_page: 100 },
    });
  });
});

describe('AdminAccountsService — Phase 4', () => {
  it('reads the collectors summary and orders the roster by activity', async () => {
    const { client, sent } = spyClient();
    const a = new AdminAccountsService(client as never);
    await a.collectorsSummary();
    await a.collectors({ ordering: '-activity' });
    await a.collectors({ ordering: '-purchases' });
    expect(sent.map((r) => [r.method, r.path, r.query])).toEqual([
      ['GET', '/auth/admin/collectors/summary/', undefined],
      ['GET', '/auth/admin/collectors/', { ordering: '-activity' }],
      ['GET', '/auth/admin/collectors/', { ordering: '-purchases' }],
    ]);
  });
});
