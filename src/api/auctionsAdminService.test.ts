/**
 * V1 Phase 3 — the auction admin calls on the wire (G-AUC-1…4, G-REC-1):
 * the archive toggle's body (a bare POST archives, `{archived:false}`
 * restores), the list params, the multipart cover, and the reset.
 */
import { describe, expect, it } from 'vitest';
import { AuctionsAdminService } from './services';

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

describe('AuctionsAdminService — Phase 3 calls', () => {
  it('passes `archived` through on the list; omitted means the working list', async () => {
    const { client, sent } = spyClient();
    const s = new AuctionsAdminService(client as never);
    await s.auctions({ per_page: 100 });
    await s.auctions({ page: 2, per_page: 100, archived: true });
    expect(sent.map((r) => [r.method, r.path, r.query])).toEqual([
      ['GET', '/auctions/admin/auctions/', { per_page: 100 }],
      ['GET', '/auctions/admin/auctions/', { page: 2, per_page: 100, archived: true }],
    ]);
  });

  it('archives with archived:true and restores with archived:false', async () => {
    const { client, sent } = spyClient();
    const s = new AuctionsAdminService(client as never);
    await s.archiveAuction(ID);
    await s.archiveAuction(ID, true);
    expect(sent.map((r) => [r.method, r.path, r.body])).toEqual([
      ['POST', `/auctions/admin/auctions/${ID}/archive/`, { archived: true }],
      ['POST', `/auctions/admin/auctions/${ID}/archive/`, { archived: false }],
    ]);
  });

  it('uploads the cover as multipart `file`, and removes it with DELETE', async () => {
    const { client, sent } = spyClient();
    const s = new AuctionsAdminService(client as never);
    const file = new File(['x'], 'poster.png', { type: 'image/png' });
    await s.uploadCover(ID, file);
    await s.removeCover(ID);
    expect(sent[0].method).toBe('POST');
    expect(sent[0].path).toBe(`/auctions/admin/auctions/${ID}/cover-image/`);
    expect(sent[0].body).toBeInstanceOf(FormData);
    expect((sent[0].body as FormData).get('file')).toBeInstanceOf(File);
    expect([sent[1].method, sent[1].path]).toEqual([
      'DELETE',
      `/auctions/admin/auctions/${ID}/cover-image/`,
    ]);
  });

  it('resets a registration with a bodiless POST', async () => {
    const { client, sent } = spyClient();
    await new AuctionsAdminService(client as never).resetRegistration(ID);
    expect(sent).toEqual([
      {
        method: 'POST',
        path: `/auctions/admin/registrations/${ID}/reset/`,
        body: undefined,
        query: undefined,
      },
    ]);
  });

  it('sends `house` on the records list (G-REC-1)', async () => {
    const { client, sent } = spyClient();
    await new AuctionsAdminService(client as never).records({
      house: 'Christie’s',
      section: 'past',
    });
    expect(sent[0].query).toEqual({ house: 'Christie’s', section: 'past' });
  });

  it('PATCHes the lot on the admin lot path', async () => {
    const { client, sent } = spyClient();
    await new AuctionsAdminService(client as never).updateLot(ID, {
      low_estimate: '100',
      expected_version: 2,
    });
    expect([sent[0].method, sent[0].path]).toEqual(['PATCH', `/auctions/admin/lots/${ID}/`]);
  });
});
