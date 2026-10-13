/**
 * The project Proposal + Invoice builder on the wire (backend 2026-10-01):
 * the project-scoped documents routes, `doc_type` (not `kind`) on create, the
 * PDF as a multipart `file`, and the bare confirm / sign POSTs.
 */
import { describe, expect, it } from 'vitest';
import { ProjectsAdminService } from './services';

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

const P = '00000000-0000-4000-8000-0000000000p1';
const D = '00000000-0000-4000-8000-0000000000d1';

describe('ProjectsAdminService — proposal / invoice documents', () => {
  it('lists, creates, uploads, confirms and signs under the project', async () => {
    const { client, sent } = spyClient();
    const s = new ProjectsAdminService(client as never);
    await s.documents(P, { page: 2, per_page: 100 });
    await s.createDocument(P, {
      doc_type: 'project_invoice',
      title: 'Winter show — Invoice',
      fields: { reference: 'DARZ-SINV-2026-0001' },
    });
    await s.uploadDocumentPdf(P, D, new Blob(['%PDF']), 'DARZ-SINV-2026-0001.pdf');
    await s.confirmDocument(P, D);
    await s.signDocument(P, D);
    expect(sent.map((r) => [r.method, r.path])).toEqual([
      ['GET', `/projects/admin/projects/${P}/documents/`],
      ['POST', `/projects/admin/projects/${P}/documents/`],
      ['POST', `/projects/admin/projects/${P}/documents/${D}/upload/`],
      ['POST', `/projects/admin/projects/${P}/documents/${D}/confirm/`],
      ['POST', `/projects/admin/projects/${P}/documents/${D}/sign/`],
    ]);
    expect(sent[0].query).toEqual({ page: 2, per_page: 100 });
    expect(sent[1].body).toEqual({
      doc_type: 'project_invoice',
      title: 'Winter show — Invoice',
      fields: { reference: 'DARZ-SINV-2026-0001' },
    });
    const form = sent[2].body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect((form.get('file') as File).name).toBe('DARZ-SINV-2026-0001.pdf');
  });
});
