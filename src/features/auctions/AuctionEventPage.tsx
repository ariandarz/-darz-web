/**
 * AuctionEventPage — one auction (SCREENS.md §07). Ported from `app.html`
 * `aucDetail()` (~8230-8330): **‹ Back** · poster hero on the well with the
 * LIVE badge · eyebrow "LIVE AUCTION" · title · "Sep 9, 2026 → Sep 14, 2026" ·
 * "CLOSES IN **2d 23h**" + **Share** · description · the **Register to bid**
 * card · "THE LOTS · 4 lots" · lot cards (thumb, "Lot 01" + LIVE pill, artist,
 * title, medium · size, "Est. … · 2d 23h left", CURRENT BID, **Place a bid**).
 *
 * The poster is the first lot's artwork (no cover field on `Auction`).
 */
import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Toast } from '../../components';
import { primaryImage } from '../catalogue/format';
import './auctions.css';
import {
  auctionState,
  auctionStateLabel,
  durationShort,
  formatMoney,
  lotNo,
  lotStatusLabel,
} from './format';
import { RegistrationBand } from './RegistrationBand';
import { lotPills } from './status';
import { useAuction, useAuctionPoster, useLots, useMyRegistration } from './useAuctions';

const BACK_ICON = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
const IC_SHARE = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
  </svg>
);

export function AuctionEventPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const auctionReq = useAuction(id!);
  const lotsReq = useLots(id!);
  const poster = useAuctionPoster(id!);
  const reg = useMyRegistration(id!);
  const [toast, setToast] = useState<string | null>(null);

  const auctionData = auctionReq.data;
  const share = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: auctionData?.title ?? 'Darz auction', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast('Copied.');
    } catch {
      /* dismissed */
    }
  }, [auctionData]);

  if (auctionReq.status === 'loading') return <p className="dz-state">Loading…</p>;
  if (auctionReq.status === 'error') return <p className="dz-state err">{auctionReq.error}</p>;
  const auction = auctionReq.data;
  if (!auction) return null;

  const st = auctionState(auction);
  const lots = lotsReq.status === 'ok' ? lotsReq.data.results : [];
  const img = poster.status === 'ok' && poster.data ? primaryImage(poster.data) : null;
  const now = Date.now();
  const cdShort =
    st === 'live'
      ? durationShort(new Date(auction.ends_at).getTime() - now)
      : st === 'upcoming'
        ? durationShort(new Date(auction.starts_at).getTime() - now)
        : '';
  const eyebrow =
    st === 'live' ? 'Live auction' : st === 'upcoming' ? 'Upcoming auction' : 'Auction ended';
  const dateRange = `${new Date(auction.starts_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} → ${new Date(auction.ends_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;

  return (
    <div className="dz-page detail auc-event">
      <div className="dtop">
        <button type="button" className="dz-back" onClick={() => navigate('/auctions')}>
          {BACK_ICON}
          <span>Back</span>
        </button>
      </div>

      <div className="auc-hero poster">
        <span className={`auc-hbadge ${st}`}>{auctionStateLabel(st)}</span>
        {img ? <img src={img} alt="" /> : null}
      </div>

      <div className="dbody">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{auction.title}</h1>
        <div className="sub">{dateRange}</div>

        <div className={`price auc-cd ${st}`}>
          <div className="cd-main">
            <p className="lab">
              {st === 'live' ? 'Closes in' : st === 'upcoming' ? 'Opens in' : 'Closed'}
            </p>
            <span className="num">
              {cdShort || (st === 'ended' ? 'Auction ended' : 'Soon')}
            </span>
          </div>
          <button type="button" className="dz-x-btn cd-share" onClick={() => void share()}>
            {IC_SHARE} Share
          </button>
        </div>

        {auction.description && <div className="about">{auction.description}</div>}

        <RegistrationBand
          auction={auction}
          registration={reg.registration}
          register={reg.register}
          registering={reg.registering}
          registerError={reg.registerError}
        />

        <div className="auc-lots-h">
          <span className="lh-t">The lots</span>
          <span className="lh-n">
            {auction.lots_count} {auction.lots_count === 1 ? 'lot' : 'lots'}
          </span>
        </div>

        {lotsReq.status === 'error' && <p className="dz-state err">{lotsReq.error}</p>}

        <div className="auc-lots">
          {lots.map((lot) => {
            const limg = primaryImage(lot.artwork);
            const est =
              lot.low_estimate && lot.high_estimate
                ? `${formatMoney(lot.low_estimate)} – ${formatMoney(lot.high_estimate)} ${lot.currency}`
                : '';
            const left =
              lot.status === 'live'
                ? durationShort(new Date(lot.ends_at).getTime() - now)
                : '';
            const spec = [lot.artwork.medium, lot.artwork.dimensions]
              .filter(Boolean)
              .join(' · ');
            const closed = lot.status === 'sold' || lot.status === 'passed';
            return (
              <Link key={lot.id} to={`/auctions/lots/${lot.id}`} className="lotrow">
                <div
                  className="lt-img"
                  style={limg ? { backgroundImage: `url(${limg})` } : undefined}
                />
                <div className="lt-body">
                  <div className="lt-head">
                    <span className="lt-no">Lot {lotNo(lot.lot_number)}</span>
                    {lot.status === 'live' ? (
                      <span className="lt-stat live">
                        <span className="d" />
                        Live
                      </span>
                    ) : (
                      <span className="lt-stat opens">{lotStatusLabel(lot.status)}</span>
                    )}
                  </div>
                  <div className="lt-artist">
                    {lot.artwork.artist?.display_name ?? 'Unknown artist'}
                  </div>
                  {(lot.artwork.title || lot.artwork.year) && (
                    <div className="lt-title">
                      {lot.artwork.title || 'Untitled'}
                      {lot.artwork.year ? `, ${lot.artwork.year}` : ''}
                    </div>
                  )}
                  {spec && <div className="lt-spec">{spec}</div>}
                  <div className="lt-est">
                    {est ? (
                      <>
                        Est. <b>{est}</b>
                      </>
                    ) : (
                      'Estimate on request'
                    )}
                    {left ? ` · ${left} left` : ''}
                  </div>
                  <div className="lt-foot">
                    <div className="lt-money">
                      <span className="lt-lab">{closed ? 'Final price' : 'Current bid'}</span>
                      {lot.current_amount ? (
                        <span className="lt-amt">
                          {formatMoney(lot.current_amount)} {lot.currency}
                        </span>
                      ) : (
                        <span className="lt-amt none">No bids yet</span>
                      )}
                      {(lot.bid_count > 0 || lotPills(lot).length > 0) && (
                        <div className="lt-bidders">
                          {lot.bid_count > 0 && (
                            <span>
                              {lot.bid_count} bid{lot.bid_count === 1 ? '' : 's'}
                            </span>
                          )}
                          {lotPills(lot).map((p) => (
                            <span key={p.label} className={`aucpill ${p.kind}`}>
                              {p.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {lot.status === 'live' && <span className="lt-bid-btn">Place a bid</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      <Toast message={toast ?? ''} open={Boolean(toast)} onClose={() => setToast(null)} />
    </div>
  );
}
