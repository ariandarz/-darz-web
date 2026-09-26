/**
 * The portal PIN's wire format, pinned per call (C-9).
 *
 * `views.py::_portal_pin` reads `?pin=` on a GET and the BODY on every other
 * method — a JSON field, or a multipart form part on an upload. The generated
 * schema documents `pin` as a query param on the image and build endpoints,
 * and a client that followed it would 401 on both. So every write is asserted
 * here on the request it actually sends: `pin` inside the body/form, and never
 * in the query.
 */
import { describe, expect, it } from 'vitest';
import { GalleryAdminService, GalleryPortalService } from './services';

type Sent = {
  method: string;
  path: string;
  query?: Record<string, unknown>;
  body?: unknown;
};

function spyClient() {
  const sent: Sent[] = [];
  const client = {
    send: (
      method: string,
      path: string,
      opts: { query?: Record<string, unknown>; body?: unknown } = {},
    ) => {
      sent.push({ method, path, query: opts.query, body: opts.body });
      return Promise.resolve({});
    },
  };
  return { client, sent };
}

const TOKEN = 'tok-abc';
const PIN = '123456';
const ART = '00000000-0000-4000-8000-0000000000a1';

function pinOf(body: unknown): unknown {
  if (body instanceof FormData) return body.get('pin');
  return (body as Record<string, unknown> | undefined)?.pin;
}

describe('GalleryPortalService — PIN in the body on every write (C-9)', () => {
  const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
  const writes: Array<
    [string, (s: GalleryPortalService) => Promise<unknown>, 'json' | 'form']
  > = [
    [
      'submitUpdate',
      (s) => s.submitUpdate(TOKEN, PIN, { kind: 'ask', artwork: ART, payload: {} }),
      'json',
    ],
    ['uploadPricelist', (s) => s.uploadPricelist(TOKEN, PIN, file, 'List'), 'form'],
    ['replaceImage', (s) => s.replaceImage(TOKEN, PIN, ART, file), 'form'],
    [
      'buildPricelist',
      (s) => s.buildPricelist(TOKEN, PIN, { lines: [{ work_title: 'A' }] }),
      'json',
    ],
    ['sendMessage', (s) => s.sendMessage(TOKEN, PIN, 'Hello'), 'json'],
    ['createExhibition', (s) => s.createExhibition(TOKEN, PIN, { title: 'S' }), 'json'],
    ['updateExhibition', (s) => s.updateExhibition(TOKEN, PIN, 'e1', { title: 'S' }), 'json'],
    ['submitExhibition', (s) => s.submitExhibition(TOKEN, PIN, 'e1', ['photo']), 'json'],
    [
      'signExhibitionDocument',
      (s) => s.signExhibitionDocument(TOKEN, PIN, 'e1', 'd1', 'Ada'),
      'json',
    ],
  ];

  for (const [name, call, shape] of writes) {
    it(`${name} carries the PIN in the ${shape === 'form' ? 'form' : 'JSON body'}, never the query`, async () => {
      const { client, sent } = spyClient();
      await call(new GalleryPortalService(client as never));
      expect(sent).toHaveLength(1);
      expect(sent[0].method).not.toBe('GET');
      expect(pinOf(sent[0].body), `${name} lost the PIN`).toBe(PIN);
      expect(sent[0].body instanceof FormData).toBe(shape === 'form');
      expect(sent[0].query?.pin, `${name} put the PIN in the query`).toBeUndefined();
      expect(sent[0].path).not.toContain('pin=');
    });
  }

  it('reads carry the PIN as ?pin= (GET has no body)', async () => {
    const { client, sent } = spyClient();
    const s = new GalleryPortalService(client as never);
    await s.state(TOKEN, PIN);
    await s.exhibitions(TOKEN, PIN);
    await s.exhibitionCatalogue(TOKEN, PIN);
    for (const r of sent) {
      expect(r.method).toBe('GET');
      expect(r.query?.pin).toBe(PIN);
      expect(r.body).toBeUndefined();
    }
  });

  it('replaceImage posts the file as `file` to the assigned work’s image endpoint', async () => {
    const { client, sent } = spyClient();
    await new GalleryPortalService(client as never).replaceImage(TOKEN, PIN, ART, file);
    expect(sent[0].path).toBe(`/gallery/portal/${TOKEN}/artworks/${ART}/image/`);
    expect((sent[0].body as FormData).get('file')).toBeInstanceOf(File);
  });

  it('buildPricelist posts its lines to …/pricelists/build/', async () => {
    const { client, sent } = spyClient();
    await new GalleryPortalService(client as never).buildPricelist(TOKEN, PIN, {
      lines: [{ artwork: ART, price: '1200', currency: 'USD', availability: 'available' }],
    });
    expect(sent[0].path).toBe(`/gallery/portal/${TOKEN}/pricelists/build/`);
    expect((sent[0].body as { lines: unknown[] }).lines).toHaveLength(1);
  });
});

describe('GalleryAdminService — the Phase 5 desk calls', () => {
  it('searches partners server-side (G-PORT-15)', async () => {
    const { client, sent } = spyClient();
    await new GalleryAdminService(client as never).links({ search: 'aria', per_page: 100 });
    expect(sent[0].path).toBe('/gallery/admin/links/');
    expect(sent[0].query).toMatchObject({ search: 'aria', per_page: 100 });
  });

  it('re-issues a link’s credentials with a bare POST (G-PORT-13)', async () => {
    const { client, sent } = spyClient();
    await new GalleryAdminService(client as never).reissueLink('l1');
    expect(sent[0]).toMatchObject({
      method: 'POST',
      path: '/gallery/admin/links/l1/reissue/',
    });
  });

  it('sets a pricelist status and reads the soft cap (P3a)', async () => {
    const { client, sent } = spyClient();
    const s = new GalleryAdminService(client as never);
    await s.setPricelistStatus('p1', 'accepted');
    await s.pricelistCap('l1');
    expect(sent[0]).toMatchObject({
      method: 'POST',
      path: '/gallery/admin/pricelists/p1/status/',
      body: { status: 'accepted' },
    });
    expect(sent[1]).toMatchObject({
      method: 'GET',
      path: '/gallery/admin/links/l1/pricelists/cap/',
    });
  });

  it('keeps the exhibition catalogue CRUD on its own route (G-PORT-12b)', async () => {
    const { client, sent } = spyClient();
    const s = new GalleryAdminService(client as never);
    await s.exhibitionCatalogue({ page: 2, per_page: 25 });
    await s.createExhibitionCatalogueItem({
      key: 'photo',
      title: 'Photo',
      description: '',
      default_price: null,
      position: 0,
      is_active: true,
    });
    await s.deleteExhibitionCatalogueItem('c1');
    expect(sent.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /gallery/admin/exhibition-catalogue/',
      'POST /gallery/admin/exhibition-catalogue/',
      'DELETE /gallery/admin/exhibition-catalogue/c1/',
    ]);
    expect(sent[0].query).toMatchObject({ page: 2, per_page: 25 });
  });
});
