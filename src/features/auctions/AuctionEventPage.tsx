/**
 * AuctionEventPage — one auction. Ported from `app.html` `aucDetail()`
 * (~8230-8330): back bar, poster hero + status badge, eyebrow/title/date,
 * a Closes-in / Opens-in countdown, description, the `RegistrationBand`
 * (`bidRegState` slot, ~8300), then `.auc-lots` — the `.lotrow` list
 * (~1736-1762).
 */
import { Link, useNavigate, useParams } from 'react-router-dom';
import { primaryImage } from '../catalogue/format';
import './auctions.css';
import {
  auctionCountdown,
  auctionState,
  auctionStateLabel,
  formatMoney,
  lotStatusLabel,
  lotTimeLeft,
} from './format';
import { RegistrationBand } from './RegistrationBand';
import { useAuction, useLots, useMyRegistration } from './useAuctions';

export function AuctionEventPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const auctionReq = useAuction(id!);
  const lotsReq = useLots(id!);
  const reg = useMyRegistration(id!);

  if (auctionReq.status === 'loading') return <p className="dz-state">Loading…</p>;
  if (auctionReq.status === 'error') return <p className="dz-state err">{auctionReq.error}</p>;
  const auction = auctionReq.data;
  if (!auction) return null;

  const st = auctionState(auction);
  const cd = auctionCountdown(auction);
  const lots = lotsReq.status === 'ok' ? lotsReq.data.results : [];
  const dateRange = `${new Date(auction.starts_at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })} → ${new Date(auction.ends_at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}`;

  return (
    <div className="dz-page detail auc-event">
      <div className="dtop">
        <button type="button" className="dz-back" onClick={() => navigate('/auctions')}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
          <span>Back</span>
        </button>
      </div>

      <div className="auc-hero">
        <span className={`auc-hbadge ${st}`}>{auctionStateLabel(st)}</span>
      </div>

      <div className="dbody">
        <div className="eyebrow">Darz Auction</div>
        <h1>{auction.title}</h1>
        <div className="sub" style={{ marginTop: 6 }}>
          {dateRange}
        </div>

        <div className={`auc-cd ${st}`}>
          <div className="lab">{cd.label}</div>
          <span className="num">{cd.text}</span>
        </div>

        {auction.description && (
          <div className="about" style={{ marginTop: 12 }}>
            {auction.description}
          </div>
        )}

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
            const img = primaryImage(lot.artwork);
            const est =
              lot.low_estimate && lot.high_estimate
                ? `Est. ${formatMoney(lot.low_estimate)} – ${formatMoney(lot.high_estimate)} ${lot.currency}`
                : 'Estimate on request';
            const left = lotTimeLeft(lot);
            return (
              <Link key={lot.id} to={`/auctions/lots/${lot.id}`} className="lotrow">
                <div
                  className="lt-img"
                  style={img ? { backgroundImage: `url(${img})` } : undefined}
                />
                <div className="lt-body">
                  <div className="lt-head">
                    <span className="lt-no">Lot {lot.lot_number}</span>
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
                      {lot.artwork.title}
                      {lot.artwork.year ? `, ${lot.artwork.year}` : ''}
                    </div>
                  )}
                  <div className="lt-est">
                    <b>{est}</b>
                    {left ? ` · ${left}` : ''}
                  </div>
                  <div className="lt-foot">
                    <div className="lt-money">
                      <span className="lt-lab">
                        {lot.status === 'sold' || lot.status === 'passed'
                          ? 'Final price'
                          : 'Current bid'}
                      </span>
                      {lot.current_amount ? (
                        <span className="lt-amt">
                          {formatMoney(lot.current_amount)} {lot.currency}
                        </span>
                      ) : (
                        <span className="lt-amt none">No bids yet</span>
                      )}
                      {lot.bid_count > 0 && (
                        <div className="lt-bidders">
                          <span>
                            {lot.bid_count} bid{lot.bid_count === 1 ? '' : 's'}
                          </span>
                          {lot.status === 'live' && (
                            <>
                              <span>·</span>
                              <span>
                                {lot.reserve_met ? 'Reserve met' : 'Reserve not met'}
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
