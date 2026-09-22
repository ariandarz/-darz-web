/**
 * Regression tests for a crash the route walk caught: an unexpected ledger
 * summary blanked the whole of `/admin/accounting`, because render read
 * `.length` on `undefined`. Every case here is a shape the endpoint could
 * actually answer — the sibling of `artworkFacets.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
  EMPTY_LEDGER_SUMMARY,
  normaliseDealsSummary,
  normaliseLedgerSummary,
} from './ledgerSummary';

const WELL_FORMED = {
  book: 'darz',
  month: '2026-09',
  currencies: ['USD', 'IRR'],
  by_currency: {
    USD: {
      currency: 'USD',
      income: '1200.00',
      expense: '300.00',
      salaries: '0.00',
      pending: '50.00',
      net: '900.00',
      count: 4,
    },
    IRR: {
      currency: 'IRR',
      income: '0',
      expense: '0',
      salaries: '0',
      pending: '0',
      net: '0',
      count: 0,
    },
  },
  converted_income: { USD: '1200.00' },
};

describe('normaliseLedgerSummary', () => {
  it('passes a well-formed response through', () => {
    expect(normaliseLedgerSummary(WELL_FORMED)).toEqual(WELL_FORMED);
  });

  it('survives the paginated envelope the E2E stub answers for an unknown GET', () => {
    // This is the exact shape that took the desk down.
    expect(
      normaliseLedgerSummary({ results: [], pagination: { page: 1, total_count: 0 } }),
    ).toEqual(EMPTY_LEDGER_SUMMARY);
  });

  it.each([null, undefined, 'a string', 42, []])('survives %p', (raw) => {
    expect(normaliseLedgerSummary(raw)).toEqual(EMPTY_LEDGER_SUMMARY);
  });

  it('drops a currency entry that is not a non-empty string', () => {
    const out = normaliseLedgerSummary({ ...WELL_FORMED, currencies: ['USD', '', null, 7] });
    expect(out.currencies).toEqual(['USD']);
  });

  it('gives a listed currency a bucket even when by_currency omits it', () => {
    const out = normaliseLedgerSummary({ currencies: ['USD'], by_currency: {} });
    expect(out.by_currency.USD).toEqual({
      currency: 'USD',
      income: '0',
      expense: '0',
      salaries: '0',
      pending: '0',
      net: '0',
      count: 0,
    });
  });

  it('never keeps a bucket for a currency the response did not list', () => {
    const out = normaliseLedgerSummary({
      currencies: ['USD'],
      by_currency: { USD: WELL_FORMED.by_currency.USD, GBP: WELL_FORMED.by_currency.USD },
    });
    expect(Object.keys(out.by_currency)).toEqual(['USD']);
  });

  it('turns a missing or unusable money field into "0", never NaN', () => {
    const out = normaliseLedgerSummary({
      currencies: ['USD'],
      by_currency: { USD: { income: null, expense: 'abc', net: 900, count: '4' } },
    });
    const usd = out.by_currency.USD;
    expect(usd.income).toBe('0');
    expect(usd.expense).toBe('0');
    expect(usd.net).toBe('900');
    expect(usd.count).toBe(0);
    // the thing the desk must never print
    expect(Number(usd.income).toLocaleString('en-US')).not.toBe('NaN');
  });

  it('keeps a genuine zero in converted_income but drops an unusable one', () => {
    const out = normaliseLedgerSummary({
      currencies: [],
      converted_income: { USD: '0', EUR: null, GBP: 'nonsense' },
    });
    expect(out.converted_income).toEqual({ USD: '0' });
  });
});

/**
 * The same guard, one desk over. `normaliseDealsSummary` exists because the
 * Private Deals view had §9a's bug still live after §9a: `summary &&
 * summary.currencies.length` passed its null check against the empty
 * paginated envelope and threw on the `.length`.
 */
describe('normaliseDealsSummary', () => {
  it('survives the exact response that broke the view — an empty page envelope', () => {
    const out = normaliseDealsSummary({
      pagination: { page: 1, per_page: 25, total_count: 0 },
      results: [],
    });
    expect(out.currencies).toEqual([]);
    // the line that threw
    expect(out.currencies.length > 0).toBe(false);
  });

  it('survives null, a string and an array', () => {
    for (const raw of [null, undefined, 'nope', [1, 2]]) {
      expect(normaliseDealsSummary(raw).currencies).toEqual([]);
    }
  });

  it('keeps a well-formed summary intact', () => {
    const out = normaliseDealsSummary({
      currencies: ['USD'],
      by_currency: {
        USD: {
          sale: '10000',
          commission: '1500',
          costs: '200',
          expenses: '100',
          received: '8000',
          net: '8200',
          remaining: '2000',
        },
      },
      count: 3,
    });
    expect(out.currencies).toEqual(['USD']);
    expect(out.by_currency.USD.net).toBe('8200');
    expect(out.count).toBe(3);
  });

  it('drops a bucket for a currency the response did not list, and never prints NaN', () => {
    const out = normaliseDealsSummary({
      currencies: ['USD'],
      by_currency: { USD: { sale: null, net: 900 }, GBP: { sale: '5' } },
    });
    expect(Object.keys(out.by_currency)).toEqual(['USD']);
    expect(out.by_currency.USD.sale).toBe('0');
    expect(out.by_currency.USD.net).toBe('900');
    expect(Number(out.by_currency.USD.sale).toLocaleString('en-US')).not.toBe('NaN');
  });

  it('omits count rather than inventing one', () => {
    expect(normaliseDealsSummary({ currencies: [] }).count).toBeUndefined();
    expect(normaliseDealsSummary({ currencies: [], count: 'x' }).count).toBeUndefined();
  });
});
