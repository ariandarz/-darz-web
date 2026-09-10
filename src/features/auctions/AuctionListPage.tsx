/**
 * AuctionListPage — the collector auctions list. Ported from `app.html`
 * `auctionsList()` (~5674): a `.hero` over a column of `.card.auc-split`
 * event cards (poster left, charcoal meta panel right) with the one
 * time-aware status vocabulary (`aucLabel` / `_state`, ~1642). Step 1 is
 * browse only — a card links to `/auctions/:id`.
 */
import { Link } from 'react-router-dom';
import { Pager } from '../catalogue/Pager';
import './auctions.css';
import { auctionCountdown, auctionState, auctionStateLabel } from './format';
import { useAuctionList } from './useAuctions';
import { useAuctionNotifications } from './useAuctionNotifications';

export function AuctionListPage() {
  const { state, setPage } = useAuctionList();
  const { unreadCount } = useAuctionNotifications();

  return (
    <div className="dz-page">
      <div className="hero">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 8,
          }}
        >
          <p className="eyebrow">Auctions</p>
          <span style={{ display: 'flex', gap: 8 }}>
            <Link
              to="/auctions/notifications"
              className="dz-back"
              style={{ padding: '6px 13px' }}
            >
              Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
            </Link>
            <Link to="/" className="dz-back" style={{ padding: '6px 13px' }}>
              Catalogue
            </Link>
          </span>
        </div>
        <h1>
          Live &amp; <span className="lt">Upcoming</span>
        </h1>
        <p>Bid on selected works — live sales and timed online auctions.</p>
      </div>

      {state.status === 'loading' && state.results.length === 0 && (
        <p className="dz-state">Loading…</p>
      )}
      {state.status === 'error' && <p className="dz-state err">{state.error}</p>}
      {state.status !== 'loading' &&
        state.results.length === 0 &&
        state.status !== 'error' && (
          <p className="dz-state">No auctions yet. Check back soon.</p>
        )}

      {state.results.length > 0 && (
        <div className="auc-events">
          {state.results.map((auction) => {
            const st = auctionState(auction);
            const cd = auctionCountdown(auction);
            const date = new Date(auction.starts_at).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
            return (
              <Link key={auction.id} to={`/auctions/${auction.id}`} className="card auc-split">
                <div className="auc-split-img">
                  <span className={`asm-badge ${st}`}>{auctionStateLabel(st)}</span>
                  <span className="ph">{auction.title.slice(0, 1)}</span>
                </div>
                <div className="auc-split-meta">
                  <div className="asm-title">{auction.title}</div>
                  <div className="asm-date">{date}</div>
                  <div className="asm-chroma" />
                  <div className={`asm-stat ${st}`}>
                    <span className="d" />
                    {auctionStateLabel(st)}
                  </div>
                  <div className={`asm-count ${st}`}>{cd.text}</div>
                  <div className="asm-lots">
                    {auction.lots_count} {auction.lots_count === 1 ? 'Lot' : 'Lots'}
                  </div>
                  {auction.description && (
                    <div className="asm-desc">{auction.description}</div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {state.pagination && <Pager pagination={state.pagination} onPage={setPage} />}
    </div>
  );
}
