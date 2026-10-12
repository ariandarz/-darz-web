/**
 * G-TEAM-1 — the Team Workspace calls on the wire (`docs/WORKSPACE_API.md`).
 *
 * The ones that matter most:
 *  - time is append-only: `+15m` is a POST of `{minutes: 15}` to `log-time/`,
 *    never a PATCH of `minutes_logged` (that field is derived server-side);
 *  - the checkbox goes through `toggle/` with the lock, not a PATCH of `done`;
 *  - contacts link a collector/artist by **uuid** and clear with `null`;
 *  - the approvals inbox is read-only — approving is the gallery route,
 *    `POST /gallery/admin/pricelists/{id}/status/`, never a workspace one.
 * The lock's field name on every PATCH is pinned in `optimisticLock.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { GalleryAdminService, WorkspaceService } from './services';

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
const USER = '00000000-0000-4000-8000-0000000000aa';

describe('WorkspaceService — My workspace (items)', () => {
  it('lists with the filters, creates, patches, toggles and deletes', async () => {
    const { client, sent } = spyClient();
    const s = new WorkspaceService(client as never);
    await s.items({ per_page: 100, done: false, due: 'overdue', ordering: 'due' });
    await s.createItem({ title: 'Call the framer', kind: 'call', category: 'darz' });
    await s.updateItem(ID, { title: 'Call the framer back', expected_version: 3 });
    await s.toggleItem(ID, true, 4);
    await s.deleteItem(ID);
    expect(sent.map((r) => [r.method, r.path])).toEqual([
      ['GET', '/workspace/items/'],
      ['POST', '/workspace/items/'],
      ['PATCH', `/workspace/items/${ID}/`],
      ['POST', `/workspace/items/${ID}/toggle/`],
      ['DELETE', `/workspace/items/${ID}/`],
    ]);
    expect(sent[0].query).toEqual({
      per_page: 100,
      done: false,
      due: 'overdue',
      ordering: 'due',
    });
    expect(sent[1].body).toEqual({ title: 'Call the framer', kind: 'call', category: 'darz' });
    expect(sent[3].body).toEqual({ done: true, expected_version: 4 });
  });
});

describe('WorkspaceService — Team workflow (team tasks)', () => {
  it('assigns by uuid, unassigns with null, and logs time as an append', async () => {
    const { client, sent } = spyClient();
    const s = new WorkspaceService(client as never);
    await s.teamTasks({
      status: 'doing',
      assignee: USER,
      ordering: '-created',
      per_page: 100,
    });
    await s.createTeamTask({ title: 'Photograph the new works', assignee: USER });
    await s.updateTeamTask(ID, { assignee: null, expected_version: 2 });
    await s.logTime(ID, 15);
    await s.teamPerformance();
    await s.deleteTeamTask(ID);
    expect(sent.map((r) => [r.method, r.path])).toEqual([
      ['GET', '/workspace/team-tasks/'],
      ['POST', '/workspace/team-tasks/'],
      ['PATCH', `/workspace/team-tasks/${ID}/`],
      ['POST', `/workspace/team-tasks/${ID}/log-time/`],
      ['GET', '/workspace/team-tasks/performance/'],
      ['DELETE', `/workspace/team-tasks/${ID}/`],
    ]);
    expect(sent[0].query).toEqual({
      status: 'doing',
      assignee: USER,
      ordering: '-created',
      per_page: 100,
    });
    expect(sent[1].body).toEqual({ title: 'Photograph the new works', assignee: USER });
    // `null` must reach the wire — dropping the key would leave the assignee.
    expect(sent[2].body).toEqual({ assignee: null, expected_version: 2 });
    // The old `+15m` — minutes, nothing else; no lock on an append.
    expect(sent[3].body).toEqual({ minutes: 15 });
  });
});

describe('WorkspaceService — Contacts', () => {
  it('links by uuid, clears a link with null, and filters server-side', async () => {
    const { client, sent } = spyClient();
    const s = new WorkspaceService(client as never);
    await s.contacts({ followup_due_soon: 7, per_page: 1 });
    await s.contacts({ priority: 'high', per_page: 1 });
    await s.createContact({ name: 'Leila', company: 'Gallery X', collector: USER });
    await s.updateContact(ID, { artist: null, expected_version: 5 });
    await s.deleteContact(ID);
    expect(sent.map((r) => [r.method, r.path, r.query])).toEqual([
      ['GET', '/workspace/contacts/', { followup_due_soon: 7, per_page: 1 }],
      ['GET', '/workspace/contacts/', { priority: 'high', per_page: 1 }],
      ['POST', '/workspace/contacts/', undefined],
      ['PATCH', `/workspace/contacts/${ID}/`, undefined],
      ['DELETE', `/workspace/contacts/${ID}/`, undefined],
    ]);
    expect(sent[2].body).toEqual({ name: 'Leila', company: 'Gallery X', collector: USER });
    expect(sent[3].body).toEqual({ artist: null, expected_version: 5 });
  });
});

describe('Pricelist approvals', () => {
  it('reads the workspace inbox and acts through the gallery status route', async () => {
    const { client, sent } = spyClient();
    await new WorkspaceService(client as never).pricelistApprovals({ per_page: 100 });
    const gallery = new GalleryAdminService(client as never);
    await gallery.setPricelistStatus(ID, 'accepted');
    await gallery.setPricelistStatus(ID, 'rejected'); // G-TEAM-2
    expect(sent.map((r) => [r.method, r.path, r.body])).toEqual([
      ['GET', '/workspace/pricelist-approvals/', undefined],
      ['POST', `/gallery/admin/pricelists/${ID}/status/`, { status: 'accepted' }],
      ['POST', `/gallery/admin/pricelists/${ID}/status/`, { status: 'rejected' }],
    ]);
    expect(sent[0].query).toEqual({ per_page: 100 });
  });
});
