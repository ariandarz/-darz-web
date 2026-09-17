/**
 * AuctionListPage — the Auctions tab (SCREENS.md §06). Ported from `app.html`
 * `auctionsList()` (~5674): the hero "AUCTIONS / Live & *Upcoming* / Bid on
 * selected works — live sales and timed online auctions." over one **split
 * event card** per sale: poster framed left with the LIVE / UPCOMING / ENDED
 * badge; title, dates, chroma dash, status line, countdown ("Closing in 2
 * days, 23 hours" green · "Opens in …" slate), "Closes 14 Sept, 14:06 · Tehran
 * time", "4 LOTS", teaser.
 *
 * The **empty state** (no visible sale) is the old app's announcement card —
 * its copy is owner-editable (`THEME_DEFAULT.aucAnn*`); the shipped default is
 * used here. The "Register for the Next Online Auction" CTA needs an auction
 * to register against, so it is not shown without one (flagged).
 */
import { Link } from 'react-router-dom';
import type { Auction } from '../../api/types';
import { primaryImage } from '../catalogue/format';
import { Pager } from '../catalogue/Pager';
import './auctions.css';
import {
  auctionClockLine,
  auctionCountdown,
  auctionDateRange,
  auctionState,
  auctionStateLabel,
} from './format';
import { useAuctionList, useAuctionPoster } from './useAuctions';

function EventCard({ auction }: { auction: Auction }) {
  const st = auctionState(auction);
  const cd = auctionCountdown(auction);
  const clock = auctionClockLine(auction);
  const poster = useAuctionPoster(auction.id);
  const img = poster.status === 'ok' && poster.data ? primaryImage(poster.data) : null;

  return (
    <Link to={`/auctions/${auction.id}`} className="card auc-split">
      <div className="auc-split-img">
        <span className={`asm-badge ${st}`}>{auctionStateLabel(st)}</span>
        {img ? <img src={img} alt="" loading="lazy" /> : null}
      </div>
      <div className="auc-split-meta">
        <div className="asm-title">{auction.title}</div>
        <div className="asm-date">{auctionDateRange(auction)}</div>
        <div className="asm-chroma" />
        <div className={`asm-stat ${st}`}>
          <span className="d" />
          {auctionStateLabel(st)}
        </div>
        <div className={`asm-count ${st}`}>{cd.text}</div>
        {clock && <div className="asm-close">{clock}</div>}
        <div className="asm-lots">
          {auction.lots_count} {auction.lots_count === 1 ? 'Lot' : 'Lots'}
        </div>
        {auction.description && <div className="asm-desc">{auction.description}</div>}
      </div>
    </Link>
  );
}

export function AuctionListPage() {
  const { state, setPage } = useAuctionList();
  const empty =
    state.status !== 'loading' && state.status !== 'error' && state.results.length === 0;

  return (
    <div className="dz-page">
      <div className="hero">
        <p className="eyebrow">Auctions</p>
        <h1>
          Live &amp; <span className="lt">Upcoming</span>
        </h1>
        <p>Bid on selected works — live sales and timed online auctions.</p>
      </div>

      {state.status === 'loading' && state.results.length === 0 && (
        <p className="dz-state">Loading…</p>
      )}
      {state.status === 'error' && <p className="dz-state err">{state.error}</p>}

      {empty && (
        <div className="auc-ann">
          <div className="auc-ann-inner">
            <div className="auc-ann-lead">
              <div className="auc-ann-seam" />
              <div className="auc-ann-eyebrow">Auctions</div>
              <h2 className="auc-ann-title">The next sale is taking shape</h2>
              <p className="auc-ann-text">
                Live and timed online auctions of contemporary Iranian art will appear here.
                Our next sale is being prepared with care — stay close, and we will make sure
                you are among the first to know the moment bidding opens.
              </p>
              <div className="auc-ann-foot">Stay in touch — you'll be the first to know</div>
            </div>
          </div>
        </div>
      )}

      {state.results.length > 0 && (
        <div className="auc-events">
          {state.results.map((auction) => (
            <EventCard key={auction.id} auction={auction} />
          ))}
        </div>
      )}

      {state.pagination && <Pager pagination={state.pagination} onPage={setPage} />}
    </div>
  );
}
