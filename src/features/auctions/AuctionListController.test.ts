/**
 * AuctionListController — the pagination/stale-response state machine is the
 * shared `ListController` base (covered by CatalogueController.test.ts); this
 * only checks the wiring to `AuctionService.auctions`.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Auction, AuctionQuery, Paginated } from '../../api/types';
import { AuctionListController } from './AuctionListController';

function page(results: Auction[]): Paginated<Auction> {
  return {
    results,
    pagination: {
      page: 1,
      per_page: 20,
      total_pages: 1,
      total_count: results.length,
      has_next: false,
      has_previous: false,
    },
  };
}

function fakeService(impl: (q: AuctionQuery) => Promise<Paginated<Auction>>) {
  return { auctions: vi.fn(impl) } as unknown as {
    auctions: (q: AuctionQuery) => Promise<Paginated<Auction>>;
  };
}

describe('AuctionListController', () => {
  it('does not fetch until reload()', () => {
    const svc = fakeService(async () => page([]));
    const c = new AuctionListController(svc as never);
    expect(svc.auctions).not.toHaveBeenCalled();
    expect(c.getSnapshot().status).toBe('idle');
  });

  it('reload() fetches with the current query and fills the snapshot', async () => {
    const svc = fakeService(async () => page([{ id: 'a1' } as Auction]));
    const c = new AuctionListController(svc as never, { per_page: 10 });

    await c.reload();

    expect(svc.auctions).toHaveBeenCalledWith(
      expect.objectContaining({ per_page: 10, page: 1 }),
    );
    expect(c.getSnapshot().results).toHaveLength(1);
    expect(c.getSnapshot().status).toBe('idle');
  });

  it('surfaces a fetch error', async () => {
    const svc = fakeService(async () => {
      throw new Error('down');
    });
    const c = new AuctionListController(svc as never);
    await c.reload();
    expect(c.getSnapshot().status).toBe('error');
    expect(c.getSnapshot().error).toBe('down');
  });
});
