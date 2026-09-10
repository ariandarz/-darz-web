/**
 * The unified auction status vocabulary — one place that maps a lot / auction
 * / notification state to the `.aucpill` label + kind. Ported from `app.html`
 * `aucPill(label, kind)` (~6258) and the pill CSS (~1300-1308): kinds are
 * `good` / `bad` / `soon` / `ext` / `neutral` / `won`.
 */
import type { AuctionNotification, Lot, NotificationKind } from '../../api/types';

export type PillKind = 'good' | 'bad' | 'soon' | 'ext' | 'neutral' | 'won';
export interface Pill {
  label: string;
  kind: PillKind;
}

const CLOSING_SOON_MS = 600_000; // app.html CLOSING_SOON_MS — 10 min

/** The pills a lot row / lot detail shows, in order. Mirrors `app.html`'s
 * lot-row logic: leading vs live, reserve met/not, closing-soon, and the
 * settled outcome. */
export function lotPills(
  lot: Pick<Lot, 'status' | 'ends_at' | 'reserve_met' | 'bid_count' | 'is_leading'>,
): Pill[] {
  if (lot.status === 'sold') {
    return [
      lot.is_leading ? { label: 'You won', kind: 'won' } : { label: 'Sold', kind: 'neutral' },
    ];
  }
  if (lot.status === 'passed') return [{ label: 'Passed', kind: 'neutral' }];
  if (lot.status === 'cancelled') return [{ label: 'Withdrawn', kind: 'neutral' }];

  const out: Pill[] = [];
  if (lot.status === 'live') {
    if (lot.is_leading) out.push({ label: 'Your bid is leading', kind: 'good' });
    if (lot.bid_count > 0) {
      out.push(
        lot.reserve_met
          ? { label: 'Reserve met', kind: 'neutral' }
          : { label: 'Reserve not met', kind: 'neutral' },
      );
    }
    const left = new Date(lot.ends_at).getTime() - Date.now();
    if (left > 0 && left <= CLOSING_SOON_MS) out.push({ label: 'Closing soon', kind: 'soon' });
  }
  return out;
}

const NOTIFICATION_PILL: Record<NotificationKind, Pill> = {
  outbid: { label: 'Outbid', kind: 'bad' },
  won: { label: 'Won', kind: 'won' },
  lost: { label: 'Lost', kind: 'neutral' },
  closing_soon: { label: 'Closing soon', kind: 'soon' },
};

export function notificationPill(kind: NotificationKind): Pill {
  return NOTIFICATION_PILL[kind] ?? { label: kind, kind: 'neutral' };
}

/** One-line banner / list text for a notification, naming the lot. */
export function notificationLine(n: AuctionNotification): string {
  const kind = n.kind as NotificationKind;
  const title = n.lot_artwork_title ? `“${n.lot_artwork_title}”` : 'a lot you follow';
  const amount = (n.payload as { amount?: string } | null)?.amount;
  switch (kind) {
    case 'outbid':
      return `You’ve been outbid on ${title}${amount ? ` — now ${amount}` : ''}.`;
    case 'won':
      return `You won ${title}${amount ? ` for ${amount}` : ''}.`;
    case 'lost':
      return `${title} sold to another bidder.`;
    case 'closing_soon':
      return `${title} is closing soon.`;
    default:
      return `Update on ${title}.`;
  }
}
