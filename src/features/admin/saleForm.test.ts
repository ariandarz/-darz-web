import { describe, expect, it } from 'vitest';
import { saleNextStep, saleTone, saleTransitionTargets, SALE_TRANSITIONS } from './saleForm';

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
