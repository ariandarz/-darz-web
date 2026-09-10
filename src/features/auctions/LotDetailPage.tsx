/**
 * LotDetailPage — one lot's live state. Ported from `app.html`'s lot view /
 * bid panel (~6028-6045) + the shared detail chrome: back bar, contained
 * hero, lot number + status, spec rows, the one live "Current bid / No bids
 * yet" moment, reserve pill, a live countdown, and the anonymous bid ladder
 * (`.dz-bidhist`, ~1310-1316).
 *
 * Live price/bid-count/countdown come from `useLot` (`LotController`: REST
 * snapshot + `LotSocket`, with a REST re-fetch on reconnect/focus and an
 * ~8s poll fallback). Step 1 has no place-bid control — that is step 2.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { primaryImage } from '../catalogue/format';
import './auctions.css';
import { formatMoney, lotStatusLabel, lotTimeLeft } from './format';
import { useBidHistory, useLot } from './useAuctions';

export function LotDetailPage() {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const { lot, status, error, live } = useLot(lotId!);
  const history = useBidHistory(lotId!);

  // Re-render the countdown once a second while the lot is live.
  const [, tick] = useState(0);
  useEffect(() => {
    if (lot?.status !== 'live') return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [lot?.status]);

  if (status === 'loading') return <p className="dz-state">Loading…</p>;
  if (status === 'error') return <p className="dz-state err">{error}</p>;
  if (!lot) return null;

  const image = primaryImage(lot.artwork);
  const rows: Array<[string, string]> = (
    [
      ['Medium', lot.artwork.medium],
      ['Dimensions', lot.artwork.dimensions],
      ['Year', lot.artwork.year ? String(lot.artwork.year) : ''],
      [
        'Estimate',
        lot.low_estimate && lot.high_estimate
          ? `${formatMoney(lot.low_estimate)} – ${formatMoney(lot.high_estimate)} ${lot.currency}`
          : '',
      ],
      ["Buyer's premium", lot.premium_pct ? `${Number(lot.premium_pct)}%` : ''],
    ] as Array<[string, string]>
  ).filter(([, v]) => Boolean(v));
  const left = lotTimeLeft(lot);
  const bids = history.status === 'ok' ? history.data.results : [];

  return (
    <div className="dz-page detail dtpl-A">
      <div className="dtop">
        <button type="button" className="dz-back" onClick={() => navigate(-1)}>
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

      <div className="dhero">{image ? <img src={image} alt={lot.artwork.title} /> : null}</div>

      <div className="dbody">
        <div className="eyebrow">
          Lot {lot.lot_number}
          {lot.status === 'live' ? ' · Live' : ` · ${lotStatusLabel(lot.status)}`}
        </div>
        <h1>{lot.artwork.artist?.display_name ?? 'Unknown artist'}</h1>
        {(lot.artwork.title || lot.artwork.year) && (
          <div className="sub">
            {lot.artwork.title}
            {lot.artwork.year ? `, ${lot.artwork.year}` : ''}
          </div>
        )}

        <div className="price" style={{ marginTop: 14 }}>
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
            <div className="lt-bidders">
              <span>
                {lot.bid_count} bid{lot.bid_count === 1 ? '' : 's'}
              </span>
              {lot.status === 'live' && (
                <>
                  <span>·</span>
                  <span>{lot.reserve_met ? 'Reserve met' : 'Reserve not met'}</span>
                </>
              )}
              {lot.is_leading && (
                <>
                  <span>·</span>
                  <span>Your bid is leading</span>
                </>
              )}
            </div>
            {left && (
              <div className="lt-est" style={{ marginTop: 6 }}>
                {left}
              </div>
            )}
          </div>
        </div>

        {(live === 'reconnecting' || live === 'failed') && (
          <p className="auc-live-hint">
            Reconnecting to live updates… the price shown may be a few seconds behind.
          </p>
        )}

        {rows.length > 0 && (
          <div className="fields">
            {rows.map(([k, v]) => (
              <div className="frow" key={k}>
                <span className="k">{k}</span>
                <span className="v">{v}</span>
              </div>
            ))}
          </div>
        )}

        {lot.artwork.public_description && (
          <>
            <p className="about-l">About this work</p>
            <p className="about">{lot.artwork.public_description}</p>
          </>
        )}

        <div className="auc-lots-h">
          <span className="lh-t">Bid history</span>
          <span className="lh-n">{bids.length}</span>
        </div>
        {bids.length === 0 ? (
          <p className="dz-state">No bids yet.</p>
        ) : (
          <div className="dz-bidhist">
            {bids.map((b, i) => (
              <div className={`bh-row${i === 0 ? ' top' : ''}`} key={b.id}>
                <span className="bh-who">
                  {b.paddle_number != null ? `Bidder ${b.paddle_number}` : 'Bidder'}
                  {i === 0 ? ' · leading' : ''}
                </span>
                <span className="bh-amt">{formatMoney(b.amount)}</span>
                <span className="bh-t">
                  {new Date(b.created_at).toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Place-a-bid / registration: Phase 8 step 2. */}
      </div>
    </div>
  );
}
