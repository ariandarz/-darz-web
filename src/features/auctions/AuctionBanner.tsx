/**
 * AuctionBanner — the live "Darz auction" notification banner. Ported from
 * `app.html`'s `.dz-anotif` (~793): a calm charcoal box fixed bottom-centre,
 * INDEPENDENT of any reply banner, with a status word coloured by kind
 * (outbid red, closing-soon orange, won green) and a matching left seam bar.
 *
 * Shows the newest unread `outbid` / `won` / `lost` / `closing_soon`. Tap →
 * the related lot (and marks it read); the × marks it read without navigating.
 * Rendered once by `AuctionNotificationsProvider`.
 */
import { useNavigate } from 'react-router-dom';
import './auctions.css';
import { notificationLine, notificationPill } from './status';
import { useAuctionNotifications } from './useAuctionNotifications';

const ACCENT: Record<string, string> = {
  good: 'acc-ok',
  won: 'acc-ok',
  bad: 'acc-bad',
  soon: 'acc-soon',
  ext: 'acc-ext',
  neutral: '',
};
const STATUS_CLASS: Record<string, string> = {
  good: 'ok',
  won: 'ok',
  bad: 'bad',
  soon: 'soon',
  ext: 'ext',
  neutral: 'warn',
};

export function AuctionBanner() {
  const navigate = useNavigate();
  const { latestUnread, unreadCount, controller } = useAuctionNotifications();

  if (!latestUnread) return null;
  const n = latestUnread;
  const pill = notificationPill(n.kind);

  const open = () => {
    void controller.markRead(n.id);
    navigate(n.lot ? `/auctions/lots/${n.lot}` : '/auctions/notifications');
  };

  return (
    <div className={`dz-anotif show ${ACCENT[pill.kind] ?? ''}`}>
      <button type="button" className="dz-anotif-body" onClick={open}>
        <span className={`dz-anotif-st ${STATUS_CLASS[pill.kind] ?? 'warn'}`}>
          {pill.label}
        </span>
        <span className="dz-anotif-line">{notificationLine(n)}</span>
        {unreadCount > 1 && <span className="dz-notif-ct">{unreadCount}</span>}
      </button>
      <button
        type="button"
        className="dz-anotif-x"
        aria-label="Dismiss"
        onClick={() => void controller.markRead(n.id)}
      >
        ✕
      </button>
    </div>
  );
}
