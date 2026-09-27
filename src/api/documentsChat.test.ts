/**
 * Phase 6 wire formats — what the thread reply, the message archive and the
 * document share actually put on the wire. Asserted on the REQUEST the client
 * sends (the `optimisticLock.test.ts` pattern), because the signature is what
 * can look right while the body is wrong.
 */
import { describe, expect, it } from 'vitest';
import { CrmService, DocumentsAdminService, messagePayload } from './services';

function spyClient() {
  const sent: Array<{ method: string; path: string; body: unknown }> = [];
  const client = {
    send: (method: string, path: string, opts?: { body?: unknown }) => {
      sent.push({ method, path, body: opts?.body });
      return Promise.resolve({});
    },
  };
  return { client, sent };
}

describe('messagePayload — the composer body (D19 document_refs)', () => {
  it('a plain reply is exactly what it was before D19: no document_refs key', () => {
    expect(messagePayload('Hello')).toEqual({ body: 'Hello', artwork_refs: [] });
    expect(messagePayload('Hello', { documentRefs: [] })).not.toHaveProperty('document_refs');
  });

  it('attached documents go as a bare uuid list, de-duplicated', () => {
    expect(messagePayload('Your invoice', { documentRefs: ['d1', 'd1', 'd2'] })).toEqual({
      body: 'Your invoice',
      artwork_refs: [],
      document_refs: ['d1', 'd2'],
    });
  });
});

describe('the Phase 6 calls on the wire', () => {
  it('adminPostMessage posts document_refs to the admin thread', async () => {
    const { client, sent } = spyClient();
    await new CrmService(client as never).adminPostMessage('r1', 'Here it is', {
      documentRefs: ['d1'],
    });
    expect(sent[0]).toEqual({
      method: 'POST',
      path: '/crm/admin/requests/r1/messages/',
      body: { body: 'Here it is', artwork_refs: [], document_refs: ['d1'] },
    });
  });

  it('adminArchiveMessage sends the flag both ways (a bare POST would only archive)', async () => {
    const { client, sent } = spyClient();
    const crm = new CrmService(client as never);
    await crm.adminArchiveMessage('m1');
    await crm.adminArchiveMessage('m1', false);
    expect(sent.map((s) => [s.method, s.path, s.body])).toEqual([
      ['POST', '/crm/admin/messages/m1/archive/', { archived: true }],
      ['POST', '/crm/admin/messages/m1/archive/', { archived: false }],
    ]);
  });

  it('share POSTs the collector; unshare is a DELETE on the same path', async () => {
    const { client, sent } = spyClient();
    const docs = new DocumentsAdminService(client as never);
    await docs.shareDocument('d1', 'c1');
    await docs.unshareDocument('d1');
    await docs.activity('d1', { per_page: 50 });
    expect(sent.map((s) => [s.method, s.path, s.body])).toEqual([
      ['POST', '/documents/admin/documents/d1/share/', { collector: 'c1' }],
      ['DELETE', '/documents/admin/documents/d1/share/', undefined],
      ['GET', '/documents/admin/documents/d1/activity/', undefined],
    ]);
  });
});
