/**
 * RegistrationController — loads the collector's paddle registrations, filters
 * one per auction, and files a new request with the terms-agree flag. Fake
 * AuctionService; no network.
 */
import { describe, expect, it, vi } from 'vitest';
import type { BidderRegistration, Paginated } from '../../api/types';
import { RegistrationController } from './RegistrationController';

const AUC = 'auction-1';

function reg(over: Partial<BidderRegistration> = {}): BidderRegistration {
  return {
    id: 'r1',
    auction: AUC,
    status: 'pending',
    paddle_number: null,
    terms_accepted_at: null,
    created_at: '',
    ...over,
  } as BidderRegistration;
}

function page(results: BidderRegistration[]): Paginated<BidderRegistration> {
  return {
    results,
    pagination: {
      page: 1,
      per_page: 200,
      total_pages: 1,
      total_count: results.length,
      has_next: false,
      has_previous: false,
    },
  };
}

function make(seed: BidderRegistration[] = []) {
  const state = { rows: seed };
  const auctions = {
    registrations: vi.fn(async () => page(state.rows)),
    register: vi.fn(async (auctionId: string, agree: boolean) => {
      if (!agree) throw new Error('You must accept the Conditions of Sale to register.');
      const r = reg({ auction: auctionId });
      state.rows = [...state.rows, r];
      return r;
    }),
  };
  return { c: new RegistrationController(auctions as never), auctions, state };
}

describe('RegistrationController', () => {
  it('load() fills registrations; forAuction picks the matching one', async () => {
    const { c } = make([
      reg({ id: 'other', auction: 'auction-2' }),
      reg({ id: 'mine', auction: AUC }),
    ]);
    await c.load();
    expect(c.getSnapshot().status).toBe('ready');
    expect(c.forAuction(AUC)?.id).toBe('mine');
    expect(c.forAuction('nope')).toBeNull();
  });

  it('register(auctionId, true) posts, reloads, and the band flips to pending', async () => {
    const { c, auctions } = make();
    await c.load();
    expect(c.forAuction(AUC)).toBeNull();

    const ok = await c.register(AUC, true);

    expect(ok).toBe(true);
    expect(auctions.register).toHaveBeenCalledWith(AUC, true);
    expect(c.forAuction(AUC)?.status).toBe('pending');
    expect(c.getSnapshot().registering).toBe(false);
  });

  it('register surfaces the server rejection (terms not agreed) on registerError', async () => {
    const { c } = make();
    await c.load();

    const ok = await c.register(AUC, false);

    expect(ok).toBe(false);
    expect(c.getSnapshot().registerError).toBe(
      'You must accept the Conditions of Sale to register.',
    );
    c.clearRegisterError();
    expect(c.getSnapshot().registerError).toBeNull();
  });

  it('register refuses a second call while one is in flight', async () => {
    const { c, auctions } = make();
    await c.load();
    let release: (v: BidderRegistration) => void = () => {};
    auctions.register.mockImplementationOnce(
      () => new Promise<BidderRegistration>((r) => (release = r)),
    );

    const first = c.register(AUC, true);
    const second = await c.register(AUC, true);
    expect(second).toBe(false);
    expect(auctions.register).toHaveBeenCalledTimes(1);

    release(reg());
    await first;
  });

  it('surfaces a load error', async () => {
    const { c, auctions } = make();
    auctions.registrations.mockRejectedValueOnce(new Error('down'));
    await c.load();
    expect(c.getSnapshot().status).toBe('error');
    expect(c.getSnapshot().error).toBe('down');
  });
});
