/**
 * RecordsController — the list-controller wiring plus the debounced search.
 * Fake AuctionService, fake timers; no network. (The pagination/stale-guard
 * state machine is covered by CatalogueController.test.ts.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuctionRecord, AuctionRecordQuery, Paginated } from '../../api/types';
import { RecordsController } from './RecordsController';

function page(results: AuctionRecord[]): Paginated<AuctionRecord> {
  return {
    results,
    pagination: {
      page: 1,
      per_page: 24,
      total_pages: 1,
      total_count: results.length,
      has_next: false,
      has_previous: false,
    },
  };
}

function make(impl: (q: AuctionRecordQuery) => Promise<Paginated<AuctionRecord>>) {
  const auctions = { records: vi.fn(impl) };
  return { c: new RecordsController(auctions as never, { ordering: '-sale_date' }), auctions };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('RecordsController', () => {
  it('reload() fetches with the initial ordering + per_page', async () => {
    const { c, auctions } = make(async () => page([{ id: 'r1' } as AuctionRecord]));
    await c.reload();
    expect(auctions.records).toHaveBeenCalledWith(
      expect.objectContaining({ ordering: '-sale_date', per_page: 24, page: 1 }),
    );
    expect(c.getSnapshot().results).toHaveLength(1);
  });

  it('setSearch debounces (300ms) and trims, then resets to page 1', async () => {
    const { c, auctions } = make(async () => page([]));
    await c.reload();
    auctions.records.mockClear();

    c.setSearch('  bahman ');
    c.setSearch('  bahman m'); // supersedes — only the last fires
    expect(auctions.records).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    await Promise.resolve();
    expect(auctions.records).toHaveBeenCalledTimes(1);
    expect(auctions.records).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'bahman m', page: 1 }),
    );
  });

  it('an empty search clears the param', async () => {
    const { c, auctions } = make(async () => page([]));
    await c.reload();
    auctions.records.mockClear();
    c.setSearch('   ');
    await vi.advanceTimersByTimeAsync(300);
    await Promise.resolve();
    expect(auctions.records.mock.calls[0][0].search).toBeUndefined();
  });

  it('setOrdering swaps the sort and refetches', async () => {
    const { c, auctions } = make(async () => page([]));
    await c.reload();
    auctions.records.mockClear();
    c.setOrdering('price_amount');
    await Promise.resolve();
    expect(auctions.records).toHaveBeenCalledWith(
      expect.objectContaining({ ordering: 'price_amount', page: 1 }),
    );
  });
});
