/**
 * The G-SALE-1/5 calls on the wire. The one that matters most is the clear:
 * `follow_up_at` is a **required** key on `POST …/follow-up/`
 * (`SaleFollowUpSerializer`, `allow_null=True`), so clearing must send an
 * explicit `null` — dropping the key would be a 400, not a clear.
 */
import { describe, expect, it } from 'vitest';
import { SalesAdminService } from './services';

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

describe('SalesAdminService — summary, follow-up, notes, delete', () => {
  it('sets and clears the follow-up with the key always present', async () => {
    const { client, sent } = spyClient();
    const s = new SalesAdminService(client as never);
    await s.followUp(ID, '2026-10-02');
    await s.followUp(ID, null);
    expect(sent.map((r) => [r.method, r.path, r.body])).toEqual([
      ['POST', `/sales/admin/sales/${ID}/follow-up/`, { follow_up_at: '2026-10-02' }],
      ['POST', `/sales/admin/sales/${ID}/follow-up/`, { follow_up_at: null }],
    ]);
  });

  it('reads the summary, the notes page, and posts a note body', async () => {
    const { client, sent } = spyClient();
    const s = new SalesAdminService(client as never);
    await s.summary();
    await s.notes(ID, { page: 2, per_page: 100 });
    await s.addNote(ID, 'Called — wants a viewing.');
    await s.deleteSale(ID);
    expect(sent.map((r) => [r.method, r.path])).toEqual([
      ['GET', '/sales/admin/sales/summary/'],
      ['GET', `/sales/admin/sales/${ID}/notes/`],
      ['POST', `/sales/admin/sales/${ID}/notes/`],
      ['DELETE', `/sales/admin/sales/${ID}/`],
    ]);
    expect(sent[1].query).toEqual({ page: 2, per_page: 100 });
    expect(sent[2].body).toEqual({ body: 'Called — wants a viewing.' });
  });
});
