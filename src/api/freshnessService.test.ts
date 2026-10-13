/**
 * G-CAT-9 — the source-freshness calls on the wire (backend 2026-10-01).
 *
 * The ones that matter:
 *  - a plain "Confirm" posts an EMPTY body — a `status` key, even blank, is
 *    what the server reads as "also record what the source said";
 *  - "Confirm all available" targets ONE source by its name;
 *  - the hide-stale PATCH carries no lock field (the serializer has none);
 *  - the list's freshness bands repeat the key (OR), and
 *    `needs_reconfirmation` is a real boolean on the query.
 */
import { describe, expect, it } from 'vitest';
import { CatalogAdminService } from './services';

function spyClient() {
  const sent: Array<{ method: string; path: string; body: unknown; query: unknown }> = [];
  const client = {
    send: (method: string, path: string, opts?: { body?: unknown; query?: unknown }) => {
      sent.push({ method, path, body: opts?.body, query: opts?.query });
      return Promise.resolve({});
    },
  };
  return { client, sent };
}

const ID = '00000000-0000-4000-8000-00000000beef';

describe('CatalogAdminService — source freshness (G-CAT-9)', () => {
  it('confirms one work, plainly or with the status the source reported', async () => {
    const { client, sent } = spyClient();
    const s = new CatalogAdminService(client as never);
    await s.confirmAvailable(ID);
    await s.confirmAvailable(ID, 'reserved');
    expect(sent.map((r) => [r.method, r.path, r.body])).toEqual([
      ['POST', `/catalog/admin/artworks/${ID}/confirm-available/`, {}],
      ['POST', `/catalog/admin/artworks/${ID}/confirm-available/`, { status: 'reserved' }],
    ]);
  });

  it('confirms a whole source by name, and reads the summary + settings', async () => {
    const { client, sent } = spyClient();
    const s = new CatalogAdminService(client as never);
    await s.confirmSource({ source_name: 'Galerie X' });
    await s.freshnessSummary();
    await s.freshnessSettings();
    await s.updateFreshnessSettings({ hide_unconfirmed: true });
    expect(sent.map((r) => [r.method, r.path, r.body])).toEqual([
      ['POST', '/catalog/admin/sources/confirm/', { source_name: 'Galerie X' }],
      ['GET', '/catalog/admin/sources/freshness-summary/', undefined],
      ['GET', '/catalog/admin/sources/freshness-settings/', undefined],
      ['PATCH', '/catalog/admin/sources/freshness-settings/', { hide_unconfirmed: true }],
    ]);
    expect(sent[3].body).not.toHaveProperty('expected_version');
  });

  it('passes the freshness filters through to the admin list', async () => {
    const { client, sent } = spyClient();
    const s = new CatalogAdminService(client as never);
    await s.artworks({ freshness: ['due', 'stale'], per_page: 24 });
    await s.artworks({ published: true, needs_reconfirmation: true, per_page: 1 });
    expect(sent[0].query).toEqual({ freshness: ['due', 'stale'], per_page: 24 });
    expect(sent[1].query).toEqual({
      published: true,
      needs_reconfirmation: true,
      per_page: 1,
    });
  });
});
