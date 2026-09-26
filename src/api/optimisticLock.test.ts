/**
 * The optimistic lock's field name, pinned at the service layer.
 *
 * ## The bug this exists for
 *
 * `updateCollector`, `updateTeamUser` and `updateMembershipCode` took a
 * `version` property and sent it as `version`. The API field is
 * **`expected_version`** (`PatchedCollectorUpdate` and friends), and it is
 * **optional** — so the server did not reject the wrong name, it simply saw no
 * lock and applied the write. Three of the panel's editors were last-write-wins
 * with no 409, no warning and nothing on screen to suggest it: two admins
 * editing the same collector, membership or TEAM LOGIN silently overwrote each
 * other. On the Team desk the field being raced is `role`.
 *
 * TypeScript could not catch it, because both spellings are a `number` on a
 * `Partial<T> &` intersection — which is exactly why it survived from whenever
 * those methods were written until 2026-09-22.
 *
 * ## What is asserted
 *
 * Every mutating call that carries a lock puts it on the wire as
 * `expected_version`, and never as `version`. The assertion is on the REQUEST
 * BODY the client sends, not on the method's signature, because the signature
 * is what was wrong and looked right.
 */
import { describe, expect, it } from 'vitest';
import {
  AccountingAdminService,
  AdminAccountsService,
  AuctionsAdminService,
  CatalogAdminService,
  GalleryAdminService,
  ProjectsAdminService,
  SalesAdminService,
} from './services';

/** Captures the body of the one request the call makes. */
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

const ID = '00000000-0000-4000-8000-00000000beef';

describe('the lock reaches the wire as `expected_version`', () => {
  const cases: Array<[string, (c: never) => Promise<unknown>]> = [
    [
      'updateCollector',
      (c) =>
        new AdminAccountsService(c).updateCollector(ID, {
          display_name: 'Ada',
          expected_version: 7,
        }),
    ],
    [
      'updateTeamUser',
      (c) =>
        new AdminAccountsService(c).updateTeamUser(ID, {
          role: 'standard_admin',
          expected_version: 7,
        }),
    ],
    [
      'updateMembershipCode',
      (c) =>
        new AdminAccountsService(c).updateMembershipCode(ID, {
          code: 'DZ-V-ABC123',
          expected_version: 7,
        }),
    ],
    [
      'updateArtwork',
      (c) => new CatalogAdminService(c).updateArtwork(ID, { title: 'A', expected_version: 7 }),
    ],
    [
      'updateArtist',
      (c) => new CatalogAdminService(c).updateArtist(ID, { bio: 'B', expected_version: 7 }),
    ],
    ['updateSale', (c) => new SalesAdminService(c).updateSale(ID, { expected_version: 7 })],
    // G-LOCK-1 (2026-09-25): these two were last-write-wins until the backend
    // made the lock mandatory on them — an unlocked PATCH now fails server-side.
    [
      'updateEntry',
      (c) => new AccountingAdminService(c).updateEntry(ID, { note: 'N', expected_version: 7 }),
    ],
    [
      'updateRecord',
      (c) =>
        new AuctionsAdminService(c).updateRecord(ID, { lot_title: 'L', expected_version: 7 }),
    ],
    // V1 Phase 3 (G-AUC-1/2): the auction and lot editors. Both PATCHes 500
    // without the lock (C-6) and 409 on a stale one.
    [
      'updateAuction',
      (c) =>
        new AuctionsAdminService(c).updateAuction(ID, { title: 'T', expected_version: 7 }),
    ],
    [
      'updateLot',
      (c) =>
        new AuctionsAdminService(c).updateLot(ID, {
          opening_amount: '10',
          expected_version: 7,
        }),
    ],
    // V1 Phase 5 (G-PORT-12b): the portal's Exhibition Services menu.
    [
      'updateExhibitionCatalogueItem',
      (c) =>
        new GalleryAdminService(c).updateExhibitionCatalogueItem(ID, {
          title: 'Photo',
          expected_version: 7,
        }),
    ],
    // V1 Phase 7 (G-PROJ-2/3/9): the project record's PATCH now carries
    // `status`, the `stages` sub-state and the manual FX fields.
    [
      'updateProject',
      (c) =>
        new ProjectsAdminService(c).updateProject(ID, {
          status: 'Negotiation',
          stages: { lead: { doneTs: 1 } },
          deal_fx_rate: '700000',
          expected_version: 7,
        }),
    ],
  ];

  for (const [name, call] of cases) {
    it(`${name} sends expected_version, not version`, async () => {
      const { client, sent } = spyClient();
      await call(client as never);
      expect(sent).toHaveLength(1);
      const body = sent[0].body as Record<string, unknown>;
      expect(body.expected_version, `${name} dropped the lock`).toBe(7);
      // The failure mode: the right value under the wrong key. The server
      // ignores it and writes anyway.
      expect(body, `${name} sent the lock under the old wrong key`).not.toHaveProperty(
        'version',
      );
    });
  }
});
