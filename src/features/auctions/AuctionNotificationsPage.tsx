/**
 * AuctionNotificationsPage — `/auctions/notifications`. The collector's
 * auction notification feed: newest first, unread emphasised, "Mark read" per
 * row and "Mark all read", tap a row → the related lot. Reads the same polled
 * `AuctionNotificationsController` the live banner uses.
 */
import { Link, useNavigate } from 'react-router-dom';
import './auctions.css';
import { notificationLine, notificationPill } from './status';
import { useAuctionNotifications } from './useAuctionNotifications';

export function AuctionNotificationsPage() {
  const navigate = useNavigate();
  const { results, status, error, unreadCount, controller } = useAuctionNotifications();

  return (
    <div className="dz-page">
      <div className="hero">
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <p className="eyebrow">Auctions</p>
          <Link to="/auctions" className="dz-back" style={{ padding: '6px 13px' }}>
            Auctions
          </Link>
        </div>
        <h1>
          Your <span className="lt">notifications</span>
        </h1>
        <p>Outbid, closing soon, won and lost — for the lots you have bid on.</p>
        {unreadCount > 0 && (
          <button
            type="button"
            className="dz-back"
            style={{ marginTop: 12, padding: '6px 13px' }}
            onClick={() => void controller.markAllRead()}
          >
            Mark all read ({unreadCount})
          </button>
        )}
      </div>

      {status === 'loading' && results.length === 0 && <p className="dz-state">Loading…</p>}
      {status === 'error' && <p className="dz-state err">{error}</p>}
      {status !== 'loading' && results.length === 0 && status !== 'error' && (
        <p className="dz-state">No notifications yet.</p>
      )}

      {results.length > 0 && (
        <div className="dz-notiflist">
          {results.map((n) => {
            const pill = notificationPill(n.kind);
            const unread = n.read_at == null;
            return (
              <div
                key={n.id}
                className={`dz-notifrow${unread ? ' unread' : ''}`}
                onClick={() => {
                  void controller.markRead(n.id);
                  if (n.lot) navigate(`/auctions/lots/${n.lot}`);
                }}
              >
                <span className={`aucpill ${pill.kind}`}>{pill.label}</span>
                <div className="dz-notifbody">
                  <div className="dz-notiftext">{notificationLine(n)}</div>
                  <div className="dz-notifmeta">
                    {n.lot_number != null ? `Lot ${n.lot_number} · ` : ''}
                    {new Date(n.created_at).toLocaleString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                {unread && (
                  <button
                    type="button"
                    className="dz-notifread"
                    onClick={(e) => {
                      e.stopPropagation();
                      void controller.markRead(n.id);
                    }}
                  >
                    Mark read
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
