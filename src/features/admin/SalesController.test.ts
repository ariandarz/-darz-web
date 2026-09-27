/**
 * Unit tests for SalesController — every desk control reaching the sales
 * list as its own query param (G-SALE-2), the Auction tab's fixed scope, and
 * the strip read (G-SALE-1 summary, overdue walk). `SalesAdminService` is a
 * fake; no network.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Paginated, SaleAdmin, SaleDeskSummary } from '../../api/types';
import { SalesController } from './SalesController';

function page(results: SaleAdmin[], n = 1, hasNext = false): Paginated<SaleAdmin> {
  return {
    results,
    pagination: {
      page: n,
      per_page: 100,
      total_pages: hasNext ? n + 1 : n,
      total_count: results.length,
      has_next: hasNext,
      has_previous: n > 1,
    },
  };
}

const row = (id: string, over: Partial<SaleAdmin> = {}) =>
  ({ id, status: 'draft', follow_up_overdue: false, source: 'market', ...over }) as SaleAdmin;

const SUMMARY: SaleDeskSummary = {
  total: 9,
  by_status: {
    draft: 2,
    confirmed: 1,
    invoiced: 1,
    paid: 0,
    delivered: 0,
    completed: 3,
    lost: 2,
  },
  by_payment_status: { unpaid: 9 },
  by_delivery_status: { pending: 9 },
  by_source: { market: 8, auction: 1 },
};

function fakeSales(over: Record<string, unknown> = {}) {
  return {
    sales: vi.fn(async () => page([row('s1')])),
    summary: vi.fn(async () => SUMMARY),
    ...over,
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('SalesController — each control is one query param', () => {
  const cases: Array<[string, Record<string, string>]> = [
    ['search', { search: 'Heech' }],
    ['stage', { status: 'confirmed' }],
    ['payment', { payment_status: 'partial' }],
    ['delivery', { delivery_status: 'in_transit' }],
    ['source', { source: 'auction' }],
    ['sort', { ordering: '-price' }],
  ];
  for (const [name, patch] of cases) {
    it(`${name} → ${Object.keys(patch)[0]}`, async () => {
      const sales = fakeSales();
      const c = new SalesController(sales as never);
      c.setQuery(patch);
      await tick();
      expect(sales.sales).toHaveBeenLastCalledWith({ ...patch, page: 1 });
    });
  }

  it('drops a cleared filter from the query', async () => {
    const sales = fakeSales();
    const c = new SalesController(sales as never);
    c.setQuery({ payment_status: 'paid' });
    await tick();
    c.setQuery({ payment_status: undefined });
    await tick();
    const last = (sales.sales.mock.calls.at(-1) as unknown[])[0] as Record<string, unknown>;
    expect(last.payment_status).toBeUndefined();
  });

  it('keeps the Auction tab’s scope on every read, whatever the filters say', async () => {
    const sales = fakeSales();
    const c = new SalesController(sales as never, {}, { source: 'auction' });
    await c.reload();
    expect(sales.sales).toHaveBeenLastCalledWith({ source: 'auction', page: 1 });
    c.setQuery({ source: 'market', status: 'draft' });
    await tick();
    expect(sales.sales).toHaveBeenLastCalledWith({
      source: 'auction',
      status: 'draft',
      page: 1,
    });
  });
});

describe('SalesController.readStrip', () => {
  it('Market Sales: tiles and total from summary/, attention from a walk', async () => {
    const sales = fakeSales({
      sales: vi.fn(async (q: { page?: number }) =>
        q.page === 1
          ? page([row('a', { follow_up_overdue: true }), row('b')], 1, true)
          : page([row('c', { follow_up_overdue: true })], 2, false),
      ),
    });
    const strip = await new SalesController(sales as never).readStrip();
    expect(sales.summary).toHaveBeenCalledTimes(1);
    expect(strip.tiles).toEqual({ open: 4, payPending: 2, completed: 3, lost: 2 });
    expect(strip.total).toBe(9);
    expect(strip.attention).toBe(2);
    expect(strip.sources).toEqual(['market', 'auction']);
    // the walk reads whole pages, unfiltered
    expect(sales.sales).toHaveBeenCalledWith({ page: 1, per_page: 100 });
    expect(sales.sales).toHaveBeenCalledWith({ page: 2, per_page: 100 });
  });

  it('Auction Sales: counts its own scoped rows (the summary is ledger-wide)', async () => {
    const sales = fakeSales({
      sales: vi.fn(async () =>
        page([
          row('a', { source: 'auction', status: 'draft', follow_up_overdue: true }),
          row('b', { source: 'auction', status: 'completed' }),
        ]),
      ),
    });
    const strip = await new SalesController(
      sales as never,
      {},
      {
        source: 'auction',
      },
    ).readStrip();
    expect(sales.summary).not.toHaveBeenCalled();
    expect(sales.sales).toHaveBeenCalledWith({ source: 'auction', page: 1, per_page: 100 });
    expect(strip).toEqual({
      tiles: { open: 1, payPending: 0, completed: 1, lost: 0 },
      attention: 1,
      total: 2,
      sources: [],
    });
  });
});
