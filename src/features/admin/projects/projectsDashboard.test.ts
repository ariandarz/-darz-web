/**
 * Regression tests for the third of the same crash: an unexpected dashboard
 * response blanked the whole Projects desk with
 * `responsibility_by_member is not iterable`. Siblings:
 * `artworkFacets.test.ts`, `ledgerSummary.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import type { ProjectDashboard } from '../../../api/types';
import { cardCount, readMembers } from './projectsDashboard';

/** The tests feed shapes the endpoint could really answer, which is the whole
 * point — so the cast is the honest way to say "not the declared shape". */
const dash = (raw: unknown) => raw as ProjectDashboard;

describe('readMembers', () => {
  it('reads, sorts by active count and keeps the top five', () => {
    const out = readMembers(
      dash({
        responsibility_by_member: [
          { member: 'Ari', active_count: 2 },
          { member: 'Bea', active_count: 9 },
          { member: 'Cy', active_count: 5 },
          { member: 'Dee', active_count: 1 },
          { member: 'Eli', active_count: 7 },
          { member: 'Fay', active_count: 3 },
        ],
      }),
    );
    expect(out.map((m) => m.member)).toEqual(['Bea', 'Eli', 'Cy', 'Fay', 'Ari']);
    expect(out).toHaveLength(5);
  });

  it('survives the paginated envelope the E2E stub answers for an unknown GET', () => {
    // The exact shape that took the desk down.
    expect(readMembers(dash({ results: [], pagination: { page: 1 } }))).toEqual([]);
  });

  it.each([null, undefined, 'a string', 42, {}])(
    'survives responsibility_by_member being %p',
    (raw) => {
      expect(readMembers(dash({ responsibility_by_member: raw }))).toEqual([]);
    },
  );

  it('drops a row with no member name rather than rendering a blank one', () => {
    const out = readMembers(
      dash({
        responsibility_by_member: [
          { member: '   ', active_count: 4 },
          { member: null, active_count: 3 },
          { member: 'Ari', active_count: 1 },
        ],
      }),
    );
    expect(out).toEqual([{ member: 'Ari', active: 1 }]);
  });

  it('reads a missing or unusable active_count as 0, never NaN', () => {
    const out = readMembers(
      dash({
        responsibility_by_member: [{ member: 'Ari' }, { member: 'Bea', active_count: 'x' }],
      }),
    );
    expect(out.every((m) => Number.isFinite(m.active))).toBe(true);
    expect(out.map((m) => m.active)).toEqual([0, 0]);
  });
});

describe('cardCount', () => {
  it('reads each card from its own field', () => {
    const d = dash({
      active_count: 3,
      delayed_count: 1,
      awaiting_approval_count: 4,
      next_deliverables_count: 1,
      unpaid_count: 5,
    });
    expect(cardCount(d, 'active')).toBe(3);
    expect(cardCount(d, 'delayed')).toBe(1);
    expect(cardCount(d, 'approval')).toBe(4);
    expect(cardCount(d, 'deliverables')).toBe(1);
    expect(cardCount(d, 'unpaid')).toBe(5);
  });

  it('reads a missing count as 0 — a card must never print "undefined"', () => {
    const d = dash({});
    for (const q of ['active', 'delayed', 'approval', 'deliverables', 'unpaid'] as const) {
      expect(cardCount(d, q)).toBe(0);
    }
  });
});
