/**
 * The membership states (app.html:10275-10281) read off
 * `GET /api/auth/my-membership/`, and the Settings row's sub-line (:9925).
 */
import { describe, expect, it } from 'vitest';
import { formatUntil, membershipState, membershipSubline } from './membership';

const NOW = new Date('2026-09-25T12:00:00');

describe('membershipState', () => {
  it('is none without a summary or a tier', () => {
    expect(membershipState(null, NOW)).toEqual({ kind: 'none' });
    expect(membershipState({ tier: null, status: 'active', active_until: null }, NOW)).toEqual(
      {
        kind: 'none',
      },
    );
  });

  it('is active for an active collector with a tier, with or without an end date', () => {
    expect(
      membershipState({ tier: 'vip', status: 'active', active_until: '2027-03-12' }, NOW),
    ).toEqual({ kind: 'active', tier: 'vip', until: '2027-03-12' });
    expect(
      membershipState({ tier: 'vip', status: 'active', active_until: null }, NOW),
    ).toEqual({
      kind: 'active',
      tier: 'vip',
      until: null,
    });
  });

  it('counts the whole last day, then ends', () => {
    const today = { tier: 'vip', status: 'active', active_until: '2026-09-25' };
    expect(membershipState(today, NOW).kind).toBe('active');
    expect(membershipState({ ...today, active_until: '2026-09-24' }, NOW)).toEqual({
      kind: 'ended',
      tier: 'vip',
      until: '2026-09-24',
    });
  });

  it('is not active while access is invited or locked', () => {
    expect(
      membershipState({ tier: 'new', status: 'invited', active_until: null }, NOW).kind,
    ).toBe('none');
    expect(
      membershipState({ tier: 'vip', status: 'locked', active_until: null }, NOW).kind,
    ).toBe('none');
  });
});

describe('membershipSubline', () => {
  it('prints the old row’s three forms verbatim', () => {
    const until = new Date('2027-03-12T00:00:00').toLocaleDateString();
    expect(
      membershipSubline({ kind: 'active', tier: 'vip', until: '2027-03-12' }, 'VIP'),
    ).toBe(`VIP · active until ${until}`);
    expect(membershipSubline({ kind: 'active', tier: 'vip', until: null }, 'VIP')).toBe(
      'VIP · active',
    );
    expect(membershipSubline({ kind: 'ended', tier: 'vip', until: '2026-01-01' }, 'VIP')).toBe(
      'Membership ended · renew to continue',
    );
    expect(membershipSubline({ kind: 'none' }, '')).toBe(
      'View plans and your access to the private room',
    );
  });

  it('never prints an unparsable date', () => {
    expect(formatUntil('garbage')).toBeNull();
  });
});
