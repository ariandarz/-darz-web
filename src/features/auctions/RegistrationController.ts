/**
 * RegistrationController — the collector's paddle registrations (Phase 8
 * step 2). One instance per auction-event screen: loads the collector's own
 * registrations (`GET /api/auctions/registrations/`), exposes the one for
 * this auction (or null), and files a new request
 * (`POST /api/auctions/registrations/` with `agree_terms`).
 *
 * Snapshot + observer plumbing from the shared `Observable` base, same as
 * `LotController` / `SavedController`.
 */
import type { AuctionService } from '../../api';
import type { BidderRegistration } from '../../api/types';
import { Observable } from '../shared/Observable';

export type RegLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface RegistrationSnapshot {
  status: RegLoadStatus;
  registrations: BidderRegistration[];
  error: string | null;
  /** a register POST is in flight — the double-tap guard */
  registering: boolean;
  registerError: string | null;
}

export class RegistrationController extends Observable<RegistrationSnapshot> {
  private readonly auctions: AuctionService;
  private token = 0;

  constructor(auctions: AuctionService) {
    super({
      status: 'idle',
      registrations: [],
      error: null,
      registering: false,
      registerError: null,
    });
    this.auctions = auctions;
  }

  /** The registration for one auction, or null if the collector has none. */
  forAuction(auctionId: string): BidderRegistration | null {
    return this.getSnapshot().registrations.find((r) => r.auction === auctionId) ?? null;
  }

  async load(): Promise<void> {
    const mine = ++this.token;
    this.patch({
      status: this.getSnapshot().registrations.length ? 'ready' : 'loading',
      error: null,
    });
    try {
      const data = await this.auctions.registrations({ per_page: 200 });
      if (mine !== this.token) return;
      this.patch({ registrations: data.results, status: 'ready' });
    } catch (err) {
      if (mine !== this.token) return;
      this.patch({ status: 'error', error: (err as Error).message });
    }
  }

  reload(): Promise<void> {
    return this.load();
  }

  /** File a paddle request. Refuses a second call while one is in flight, and
   * re-loads the list on success so the band flips to `pending`. Surfaces the
   * server's message verbatim on failure (e.g. the terms-required 400). */
  async register(auctionId: string, agreeTerms: boolean): Promise<boolean> {
    if (this.getSnapshot().registering) return false;
    this.patch({ registering: true, registerError: null });
    try {
      await this.auctions.register(auctionId, agreeTerms);
      await this.load();
      this.patch({ registering: false });
      return true;
    } catch (err) {
      this.patch({ registering: false, registerError: (err as Error).message });
      return false;
    }
  }

  clearRegisterError(): void {
    if (this.getSnapshot().registerError) this.patch({ registerError: null });
  }
}
