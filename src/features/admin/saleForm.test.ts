import { describe, expect, it } from 'vitest';
import {
  choices,
  countByStatus,
  countOverdue,
  followUpIn,
  label,
  noteStamp,
  SALE_SORTS,
  saleNextStep,
  salesTab,
  saleTiles,
  saleTone,
  saleTransitionTargets,
  SALE_TRANSITIONS,
} from './saleForm';

describe('SALE_TRANSITIONS', () => {
  it('is the backend chain: linear + lost from every non-terminal state', () => {
    expect(saleTransitionTargets('draft')).toEqual(['confirmed', 'lost']);
    expect(saleTransitionTargets('completed')).toEqual(['archived', 'lost']);
    expect(saleTransitionTargets('archived')).toEqual([]);
    expect(saleTransitionTargets('lost')).toEqual([]);
    // every non-terminal state can be lost
    for (const [from, targets] of Object.entries(SALE_TRANSITIONS)) {
      if (from !== 'archived' && from !== 'lost') expect(targets).toContain('lost');
    }
  });
});

describe('saleNextStep', () => {
  it('names the forward step, never lost', () => {
    expect(saleNextStep('draft')).toBe('confirmed');
    expect(saleNextStep('paid')).toBe('delivered');
    expect(saleNextStep('lost')).toBeNull();
  });
});

describe('saleTone', () => {
  it('maps the chain onto the pill vocabulary', () => {
    expect(saleTone('draft')).toBe('ok');
    expect(saleTone('invoiced')).toBe('res');
    expect(saleTone('lost')).toBe('gone');
    expect(saleTone('archived')).toBe('neut');
  });
});

describe('saleTiles', () => {
  it('reads the strip off a per-status map (the summary’s by_status)', () => {
    const t = saleTiles({
      draft: 2,
      confirmed: 1,
      invoiced: 3,
      paid: 1,
      delivered: 1,
      completed: 4,
      archived: 9,
      lost: 5,
    });
    // open = everything not closed; archived is closed, like completed
    expect(t).toEqual({ open: 8, payPending: 4, completed: 4, lost: 5 });
  });

  it('reads a missing status as 0 rather than NaN', () => {
    expect(saleTiles({})).toEqual({ open: 0, payPending: 0, completed: 0, lost: 0 });
  });
});

describe('countByStatus / countOverdue', () => {
  it('counts rows the way the summary would', () => {
    const rows = [
      { status: 'draft', follow_up_overdue: true },
      { status: 'draft', follow_up_overdue: false },
      { status: 'lost', follow_up_overdue: false },
    ];
    expect(countByStatus(rows)).toEqual({ draft: 2, lost: 1 });
    expect(countOverdue(rows)).toBe(1);
  });
});

describe('followUpIn', () => {
  it('is the old salesToDate(now + N days) — a UTC YYYY-MM-DD', () => {
    const now = Date.UTC(2026, 8, 25, 12, 0);
    expect(followUpIn(3, now)).toBe('2026-09-28');
    expect(followUpIn(7, now)).toBe('2026-10-02');
    expect(followUpIn(14, now)).toBe('2026-10-09');
  });
});

describe('noteStamp', () => {
  it('prints the old note meta stamp, and nothing for a bad date', () => {
    expect(noteStamp('2026-09-25T08:05:59Z')).toBe('2026-09-25 08:05');
    expect(noteStamp('not a date')).toBe('');
  });
});

describe('labels', () => {
  it('falls back to the raw value when options has no key (C-14: sale source)', () => {
    expect(label(choices(null, 'sales.source'), 'auction')).toBe('auction');
    const opts = { 'sales.status': [{ value: 'draft', label: 'Draft' }] };
    expect(label(choices(opts as never, 'sales.status'), 'draft')).toBe('Draft');
  });
});

describe('salesTab / SALE_SORTS', () => {
  it('picks the Auction tab only for ?source=auction', () => {
    expect(salesTab('auction')).toBe('auction');
    expect(salesTab(null)).toBe('market');
    expect(salesTab('market')).toBe('market');
  });

  it('offers only orderings the server accepts', () => {
    for (const s of SALE_SORTS)
      expect(['created', '-created', 'price', '-price']).toContain(s.value);
  });
});
