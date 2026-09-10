/**
 * Framework-free display helpers for the auction screens. Ported from the
 * shipped Market App (`DarzStudio/app.html`): the state vocabulary from
 * `aucLabel` / `_state` (~1642, ~8240) and the countdown wording from
 * `durLong` / `timeLeft` (~countdown helpers). Kept separate from the
 * components so they stay unit-testable.
 */
import type { Auction, Lot } from '../../api/types';

export { formatMoney } from '../catalogue/format';

/** The one time-aware state that drives an auction's badge, chip and
 * countdown — mirrors `app.html`'s `_state = ended ? 'ended' : open ? 'live'
 * : 'upcoming'` so a clock-expired `live` row never shows a green chip. */
export type AuctionState = 'upcoming' | 'live' | 'ended';

export function auctionState(
  auction: Pick<Auction, 'status' | 'starts_at' | 'ends_at'>,
): AuctionState {
  const now = Date.now();
  if (auction.status === 'closed' || auction.status === 'cancelled') return 'ended';
  if (new Date(auction.ends_at).getTime() <= now) return 'ended';
  if (auction.status === 'live' || new Date(auction.starts_at).getTime() <= now) return 'live';
  return 'upcoming';
}

/** `aucLabel` (app.html): the collector-facing word for each state. */
export function auctionStateLabel(state: AuctionState): string {
  return state === 'live' ? 'Live' : state === 'ended' ? 'Ended' : 'Upcoming';
}

/** Lot status → the museum-label word shown on a lot row / detail. */
export function lotStatusLabel(status: Lot['status']): string {
  const map: Record<string, string> = {
    scheduled: 'Upcoming',
    live: 'Live',
    sold: 'Sold',
    passed: 'Passed',
    cancelled: 'Withdrawn',
  };
  return map[status] ?? status;
}

/** "2 days, 4 hr" / "3 hr, 12 min" / "48 sec" — the long countdown wording
 * from `app.html`'s `durLong`. Returns '' once the target is in the past. */
export function durationLong(msUntil: number): string {
  if (msUntil <= 0) return '';
  const s = Math.floor(msUntil / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d) return `${d} day${d === 1 ? '' : 's'}, ${h} hr`;
  if (h) return `${h} hr, ${m} min`;
  if (m) return `${m} min, ${sec} sec`;
  return `${sec} sec`;
}

/** The countdown line + its lead word for an auction, matching
 * `app.html`'s list card: "Closing in …" while live, "Opens in …" before,
 * "Auction ended" after. */
export function auctionCountdown(auction: Pick<Auction, 'status' | 'starts_at' | 'ends_at'>): {
  label: string;
  text: string;
} {
  const state = auctionState(auction);
  const now = Date.now();
  if (state === 'ended') return { label: 'Closed', text: 'Auction ended' };
  if (state === 'live') {
    const left = durationLong(new Date(auction.ends_at).getTime() - now);
    return { label: 'Closes', text: left ? `Closing in ${left}` : 'Closing soon' };
  }
  const until = durationLong(new Date(auction.starts_at).getTime() - now);
  return { label: 'Opens', text: until ? `Opens in ${until}` : 'Opening soon' };
}

/** Lot-level countdown text for a live lot ("… left"), '' otherwise. */
export function lotTimeLeft(lot: Pick<Lot, 'status' | 'ends_at'>): string {
  if (lot.status !== 'live') return '';
  const left = durationLong(new Date(lot.ends_at).getTime() - Date.now());
  return left ? `${left} left` : 'Closing';
}
