/**
 * The owner Access desk's rules (V1 Phase 8, G-KEY-1): the computed status
 * (C-17), the query mapping, the tiles, the review banner and the extend
 * toast. Node project — no DOM.
 */
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../api/errors';
import type { AccessKeyRoster, Paginated } from '../../api/types';
import { AccessDeskController } from './AccessDeskController';
import {
  accessTiles,
  actionFailure,
  attentionHeading,
  attentionLine,
  attentionRows,
  canAct,
  displayStatus,
  extendToast,
  rosterQuery,
} from './accessDesk';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 26, 12);

const key = (id: string, over: Partial<AccessKeyRoster> = {}): AccessKeyRoster =>
  ({
    id,
    collector: { id: `c-${id}`, display_name: `Collector ${id}` },
    status: 'active',
    is_expired: false,
    issued_at: '2026-09-01T00:00:00Z',
    expires_at: null,
    last_used_at: null,
    activity: { saved: 0, holds: 0, offers: 0, requests: 0, auction: 0, logins: 0 },
    created_at: '2026-09-01T00:00:00Z',
    ...over,
  }) as AccessKeyRoster;

describe('displayStatus — C-17, the stored status lags expiry', () => {
  it('reads a lapsed key whose stored status is still active as expired', () => {
    expect(displayStatus({ status: 'active', is_expired: true })).toBe('expired');
  });
  it('lets locked win over expiry', () => {
    expect(displayStatus({ status: 'locked', is_expired: true })).toBe('locked');
    expect(displayStatus({ status: 'locked', is_expired: false })).toBe('locked');
  });
  it('keeps a live key active', () => {
    expect(displayStatus({ status: 'active', is_expired: false })).toBe('active');
  });
  it('follows the server’s computed rule for a stored expired key since extended (C-25)', () => {
    expect(displayStatus({ status: 'expired', is_expired: false })).toBe('active');
    expect(displayStatus({ status: 'expired', is_expired: true })).toBe('expired');
  });
  it('offers extend/revoke on every key that is not locked', () => {
    expect(canAct({ status: 'active', is_expired: true })).toBe(true);
    expect(canAct({ status: 'locked', is_expired: false })).toBe(false);
  });
});

describe('rosterQuery — each control is one query param', () => {
  it('drops everything that is off', () => {
    expect(rosterQuery({ search: '  ', expiring_soon: false, page: 1 })).toEqual({ page: 1 });
    expect(rosterQuery({})).toEqual({});
  });
  it('sends search trimmed, the computed status, and expiring_soon only when on', () => {
    expect(
      rosterQuery({ search: ' Leila ', status: 'expired', expiring_soon: true, page: 2 }),
    ).toEqual({ search: 'Leila', status: 'expired', expiring_soon: true, page: 2 });
  });
  it('refuses a status the server does not compute', () => {
    expect(rosterQuery({ status: 'inactive' as never })).toEqual({});
  });
  it('reaches the service through the controller', async () => {
    const empty: Paginated<AccessKeyRoster> = {
      results: [],
      pagination: {
        page: 1,
        per_page: 25,
        total_pages: 1,
        total_count: 0,
        has_next: false,
        has_previous: false,
      },
    };
    const accessKeysRoster = vi.fn(async () => empty);
    const c = new AccessDeskController({ accessKeysRoster });
    c.setQuery({ expiring_soon: true, search: '' });
    await new Promise((r) => setTimeout(r, 0));
    expect(accessKeysRoster).toHaveBeenLastCalledWith({ expiring_soon: true, page: 1 });
  });
});

describe('accessTiles — the old stat row', () => {
  const summary = {
    total_keys: 5,
    active_keys: 3,
    locked_keys: 1,
    expired_keys: 1,
    expiring_soon: 2,
    logins_today: 4,
    total_collectors: 3,
    active_collectors: 2,
  };
  it('lists the four portable tiles in the old order with the old labels', () => {
    expect(accessTiles(summary).map((t) => [t.label, t.value])).toEqual([
      ['Total Collectors', '3'],
      ['Active Collectors', '2'],
      ['Expiring ≤ 7d', '2'],
      ['Logins today', '4'],
    ]);
  });
  it('colours Expiring amber only when non-zero', () => {
    expect(accessTiles(summary)[2].tone).toBe('soon');
    expect(accessTiles({ ...summary, expiring_soon: 0 })[2].tone).toBe('muted');
  });
  it('shows a dash, never a zero, before the read lands', () => {
    expect(accessTiles(null).every((t) => t.value === '—')).toBe(true);
  });
});

describe('the review banner', () => {
  it('merges expired then soon, soonest first, without duplicates or locked keys', () => {
    const a = key('a', { is_expired: true, expires_at: '2026-09-20T00:00:00Z' });
    const b = key('b', { expires_at: '2026-09-28T00:00:00Z' });
    const c = key('c', { expires_at: '2026-09-27T00:00:00Z' });
    const l = key('l', { status: 'locked', expires_at: '2026-09-27T00:00:00Z' });
    expect(attentionRows([a], [b, c, a, l]).map((k) => k.id)).toEqual(['a', 'c', 'b']);
  });
  it('says the old heading, singular and plural', () => {
    expect(attentionHeading(1)).toBe('1 key needs a decision — extend or let expire');
    expect(attentionHeading(3)).toBe('3 keys need a decision — extend or let expire');
  });
  it('words each row the old way, rounded as the Access period cell rounds', () => {
    expect(attentionLine(new Date(NOW - DAY).toISOString(), NOW)).toMatch(/^Expired /);
    expect(attentionLine(new Date(NOW + 3_600_000).toISOString(), NOW)).toBe('Expires today');
    expect(attentionLine(new Date(NOW + 1.5 * DAY).toISOString(), NOW)).toBe(
      'Expires in 1 day',
    );
    expect(attentionLine(new Date(NOW + 3 * DAY - 1000).toISOString(), NOW)).toBe(
      'Expires in 2 days',
    );
    expect(attentionLine(null, NOW)).toBe('');
  });
});

describe('extend + failures', () => {
  it('toasts the old accessExtend wording from the server’s new expiry', () => {
    const until = new Date('2026-10-03T00:00:00Z');
    expect(extendToast('Leila', '1w', until.toISOString())).toBe(
      `Leila extended by 1 week — until ${until.toLocaleDateString('en-GB')}`,
    );
    expect(extendToast('Leila', 'none', null)).toBe('Leila — now permanent');
    expect(extendToast(null, 'none', null)).toBe('Key — now permanent');
  });
  it('branches on the HTTP status, not the code (C-11)', () => {
    const gone = new HttpError(404, 'NOT_FOUND', 'No AccessKey matches.', null);
    expect(actionFailure(gone)).toEqual({ message: 'No AccessKey matches.', reload: true });
    const refused = new HttpError(400, 'INTERNAL_ERROR', 'Refused.', null);
    expect(actionFailure(refused)).toEqual({ message: 'Refused.', reload: false });
    expect(actionFailure('x')).toEqual({ message: 'The action failed.', reload: false });
  });
});
