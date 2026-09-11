/**
 * ProfileController — the collector's own numbers and rows for the Profile
 * tab (SCREENS.md §11): saved works, requests ("Activity"), unseen Darz
 * replies ("Messages"), auction registrations and auction notices. One
 * `load()` fans the five reads out in parallel; each is independent, so a
 * failed one leaves its slot empty instead of blanking the page.
 *
 * Extends the shared `Observable` store base; the page subscribes through
 * `useProfile()`.
 */
import type { DarzApi } from '../../api';
import { Observable } from '../shared/Observable';
import type {
  Artwork,
  AuctionNotification,
  BidderRegistration,
  CollectorRequest,
  SavedArtwork,
} from '../../api/types';

export interface ProfileSnapshot {
  status: 'idle' | 'loading' | 'ok';
  savedCount: number | null;
  saved: SavedArtwork[];
  requests: CollectorRequest[];
  requestsCount: number | null;
  unreadReplies: number;
  registrations: BidderRegistration[];
  notifications: AuctionNotification[];
  unreadNotices: number;
  /** artworks referenced by requests, keyed by id (for the activity rows) */
  artworks: Record<string, Artwork>;
  /** auction titles referenced by registrations, keyed by auction id */
  auctionTitles: Record<string, string>;
}

const EMPTY: ProfileSnapshot = {
  status: 'idle',
  savedCount: null,
  saved: [],
  requests: [],
  requestsCount: null,
  unreadReplies: 0,
  registrations: [],
  notifications: [],
  unreadNotices: 0,
  artworks: {},
  auctionTitles: {},
};

export class ProfileController extends Observable<ProfileSnapshot> {
  private readonly api: DarzApi;
  private loading: Promise<void> | null = null;

  constructor(api: DarzApi) {
    super(EMPTY);
    this.api = api;
  }

  /** Concurrent callers share the one in-flight load. */
  load(): Promise<void> {
    if (this.loading) return this.loading;
    this.patch({ status: 'loading' });
    const { crm, auctions, catalog } = this.api;
    this.loading = (async () => {
      const [saved, requests, registrations, notifications] = await Promise.all([
        crm.saved({ per_page: 6 }).catch(() => null),
        crm.requests({ per_page: 12 }).catch(() => null),
        auctions.registrations({ per_page: 20 }).catch(() => null),
        auctions.notifications({ per_page: 20 }).catch(() => null),
      ]);
      const reqs = requests?.results ?? [];
      const regs = registrations?.results ?? [];
      const notes = notifications?.results ?? [];
      this.patch({
        status: 'ok',
        savedCount: saved?.pagination.total_count ?? null,
        saved: saved?.results ?? [],
        requests: reqs,
        requestsCount: requests?.pagination.total_count ?? null,
        unreadReplies: reqs.reduce((n, r) => n + (r.unread_count ?? 0), 0),
        registrations: regs,
        notifications: notes,
        unreadNotices: notes.filter((n) => n.read_at == null).length,
      });

      // the rows' artworks and auction titles — best effort, in parallel
      const artIds = [...new Set(reqs.map((r) => r.artwork).filter((x): x is string => !!x))];
      const aucIds = [...new Set(regs.map((r) => r.auction))];
      const [arts, aucs] = await Promise.all([
        Promise.all(artIds.map((id) => catalog.artwork(id).catch(() => null))),
        Promise.all(aucIds.map((id) => auctions.auction(id).catch(() => null))),
      ]);
      const artworks: Record<string, Artwork> = {};
      arts.forEach((a) => {
        if (a) artworks[a.id] = a;
      });
      const auctionTitles: Record<string, string> = {};
      aucs.forEach((a) => {
        if (a) auctionTitles[a.id] = a.title;
      });
      this.patch({ artworks, auctionTitles });
    })().finally(() => {
      this.loading = null;
    });
    return this.loading;
  }
}
