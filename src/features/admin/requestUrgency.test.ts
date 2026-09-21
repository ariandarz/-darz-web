/**
 * The urgency rule. The cases that matter are the fail-safe ones: this decides
 * whether a row turns red, and a rule that cries wolf is worse than no rule.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { AdminRequest } from '../../api/types';
import { __resetOwnerSettings, applyOwnerSettings } from '../shell/ownerSettings';
import {
  DEFAULT_WAIT_HOURS,
  ageHours,
  ageLabel,
  countWaiting,
  requestUrgency,
  waitHours,
} from './requestUrgency';

const NOW = Date.parse('2026-09-21T12:00:00Z');
const hoursAgo = (n: number) => new Date(NOW - n * 3_600_000).toISOString();

const INITIAL = { message: 'new', offer: 'submitted', hold: 'requested' };

const row = (over: Partial<AdminRequest> = {}): AdminRequest =>
  ({
    id: 'r1',
    kind: 'message',
    status: 'new',
    allowed_transitions: ['assigned'],
    created_at: hoursAgo(1),
    ...over,
  }) as AdminRequest;

beforeEach(() => __resetOwnerSettings());

describe('requestUrgency', () => {
  it('a fresh row at its initial status is New', () => {
    expect(requestUrgency(row(), INITIAL, NOW)).toEqual({ key: 'new', label: 'New' });
  });

  it('the same row past the threshold is Waiting, with the old desk’s wording', () => {
    expect(requestUrgency(row({ created_at: hoursAgo(19) }), INITIAL, NOW)).toEqual({
      key: 'waiting',
      label: 'Waiting — needs attention',
    });
  });

  it('exactly at the threshold is not yet waiting — the old rule is strictly greater', () => {
    expect(requestUrgency(row({ created_at: hoursAgo(18) }), INITIAL, NOW).key).toBe('new');
    expect(requestUrgency(row({ created_at: hoursAgo(18.01) }), INITIAL, NOW).key).toBe(
      'waiting',
    );
  });

  it('a row moved off its initial status is In progress, however old it is', () => {
    const moved = row({ status: 'assigned', created_at: hoursAgo(500) });
    expect(requestUrgency(moved, INITIAL, NOW).key).toBe('progress');
  });

  it('a row with nothing left to move to is Resolved, however old it is', () => {
    const done = row({ status: 'closed', allowed_transitions: [], created_at: hoursAgo(500) });
    expect(requestUrgency(done, INITIAL, NOW).key).toBe('resolved');
  });

  it('resolved wins over everything — it is checked before the age', () => {
    const odd = row({ status: 'new', allowed_transitions: [], created_at: hoursAgo(999) });
    expect(requestUrgency(odd, INITIAL, NOW).key).toBe('resolved');
  });

  it('reads each kind’s OWN initial status, not a shared one', () => {
    // `submitted` is new for an offer but meaningless for a message.
    const offer = row({ kind: 'offer', status: 'submitted', created_at: hoursAgo(19) });
    expect(requestUrgency(offer, INITIAL, NOW).key).toBe('waiting');
    const msg = row({ kind: 'message', status: 'submitted', created_at: hoursAgo(19) });
    expect(requestUrgency(msg, INITIAL, NOW).key).toBe('progress');
  });

  describe('fail-safe: it must never raise a false alarm', () => {
    it('no options yet → In progress, never Waiting', () => {
      const old = row({ created_at: hoursAgo(999) });
      expect(requestUrgency(old, null, NOW).key).toBe('progress');
      expect(requestUrgency(old, {}, NOW).key).toBe('progress');
    });

    it('a kind missing from the map → In progress', () => {
      expect(requestUrgency(row({ kind: 'viewing' }), INITIAL, NOW).key).toBe('progress');
    });

    it('an unparseable or future created_at never turns a row red', () => {
      expect(requestUrgency(row({ created_at: 'nonsense' }), INITIAL, NOW).key).toBe('new');
      expect(requestUrgency(row({ created_at: hoursAgo(-50) }), INITIAL, NOW).key).toBe('new');
    });

    it('a missing allowed_transitions is treated as resolved, not as new-and-waiting', () => {
      const bare = { ...row({ created_at: hoursAgo(999) }) } as AdminRequest;
      delete (bare as { allowed_transitions?: unknown }).allowed_transitions;
      expect(requestUrgency(bare, INITIAL, NOW).key).toBe('resolved');
    });
  });
});

describe('waitHours', () => {
  it('defaults to the old app’s 18 hours', () => {
    expect(waitHours()).toBe(DEFAULT_WAIT_HOURS);
  });

  it('the owner can change it from the theme', () => {
    applyOwnerSettings({ requestWaitHours: 4 });
    expect(waitHours()).toBe(4);
    expect(requestUrgency(row({ created_at: hoursAgo(5) }), INITIAL, NOW).key).toBe('waiting');
  });

  it('a hand-typed string of digits is accepted — the realistic wrong type', () => {
    applyOwnerSettings({ requestWaitHours: '6' });
    expect(waitHours()).toBe(6);
  });

  it('zero, negative and nonsense fall back rather than making everything overdue', () => {
    for (const bad of [0, -1, 'soon', null, {}, NaN]) {
      applyOwnerSettings({ requestWaitHours: bad });
      expect(waitHours(), String(bad)).toBe(DEFAULT_WAIT_HOURS);
    }
  });
});

describe('ageLabel', () => {
  it('reads as the desk’s glance value', () => {
    expect(ageLabel(hoursAgo(0.5), NOW)).toBe('just now');
    expect(ageLabel(hoursAgo(3), NOW)).toBe('3h');
    expect(ageLabel(hoursAgo(47), NOW)).toBe('47h');
    expect(ageLabel(hoursAgo(50), NOW)).toBe('2d');
  });
});

describe('countWaiting', () => {
  it('counts only the waiting rows — the old banner’s number', () => {
    const rows = [
      row({ id: 'a', created_at: hoursAgo(20) }),
      row({ id: 'b', created_at: hoursAgo(1) }),
      row({ id: 'c', created_at: hoursAgo(99), status: 'assigned' }),
      row({ id: 'd', created_at: hoursAgo(99), allowed_transitions: [] }),
    ];
    expect(countWaiting(rows, INITIAL, NOW)).toBe(1);
    expect(countWaiting([], INITIAL, NOW)).toBe(0);
  });
});

describe('ageHours', () => {
  it('is zero for a bad or future timestamp, never negative', () => {
    expect(ageHours('nope', NOW)).toBe(0);
    expect(ageHours(hoursAgo(-5), NOW)).toBe(0);
    expect(ageHours(hoursAgo(2), NOW)).toBe(2);
  });
});
