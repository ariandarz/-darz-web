/**
 * LotDetailPage — the artwork detail in auction context (SCREENS.md §08,
 * capture `11-lot`): **‹ Back** · heart · hero with the work contained ·
 * **View in Room** · **Share** · artist · "Title, year" · **ABOUT THE ARTIST ›**
 * · Medium · Size · Year · the ESTIMATE block · **Place a bid** (`act-primary`,
 * pulsing) · the "LIVE BIDDING ● LIVE / Closes in 2d 23h / No bids yet — be
 * the first." status · current bid box · bid history · delivery note.
 *
 * Live price / bid-count / countdown come from `useLot` (`LotController`:
 * REST snapshot + `LotSocket`, with a REST re-fetch on reconnect/focus and an
 * ~8s poll fallback). Bidding is gated on an approved paddle and opens
 * `BidSheet`; server rejections and an accepted bid surface via a `Toast`.
 * Not ported: **Chat on WhatsApp** (no number on the backend), the
 * Registered → Bid → Leading → Won rail and the buyer's-premium note beyond
 * the spec row (flagged).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Toast } from '../../components';
import { primaryImage } from '../catalogue/format';
import { ViewInRoom } from '../catalogue/ViewInRoom';
import { SaveButton } from '../saved/SaveButton';
import './auctions.css';
import { BidSheet } from './BidSheet';
import { durationShort, formatMoney, lotStatusLabel } from './format';
import { lotPills } from './status';
import { useBidHistory, useLot, useMyRegistration } from './useAuctions';

const SHIP_NOTE =
  'Delivery can be coordinated upon request. Final costs are confirmed before payment.';

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
const IC_ROOM = (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
  >
    <rect x="3" y="4" width="18" height="13" rx="1" />
    <path d="M3 20h18" />
  </svg>
);
const IC_SHARE = (
  <svg
    width="15"
    height="15"
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
const IC_TRUCK = (
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
    <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

export function LotDetailPage() {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const { lot, status, error, live, bidding, bidError, bidAccepted, placeBid, clearBidState } =
    useLot(lotId!);
  const history = useBidHistory(lotId!);
  const reg = useMyRegistration(lot?.auction ?? '');
  const [bidOpen, setBidOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Re-render the countdown once a second while the lot is live.
  const [, tick] = useState(0);
  useEffect(() => {
    if (lot?.status !== 'live') return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [lot?.status]);

  const share = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: lot?.artwork.title || 'Darz lot', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast('Copied.');
    } catch {
      /* dismissed */
    }
  }, [lot]);

  if (status === 'loading') return <p className="dz-state">Loading…</p>;
  if (status === 'error') return <p className="dz-state err">{error}</p>;
  if (!lot) return null;

  const image = primaryImage(lot.artwork);
  const rows: Array<[string, string]> = (
    [
      ['Medium', lot.artwork.medium],
      ['Size', lot.artwork.dimensions],
      ['Year', lot.artwork.year ? String(lot.artwork.year) : ''],
      ["Buyer's premium", lot.premium_pct ? `${Number(lot.premium_pct)}%` : ''],
    ] as Array<[string, string]>
  ).filter(([, v]) => Boolean(v));
  const est =
    lot.low_estimate && lot.high_estimate
      ? `${formatMoney(lot.low_estimate)} – ${formatMoney(lot.high_estimate)}`
      : '';
  const closed = lot.status === 'sold' || lot.status === 'passed';
  const left =
    lot.status === 'live' ? durationShort(new Date(lot.ends_at).getTime() - Date.now()) : '';
  const bids = history.status === 'ok' ? history.data.results : [];
  const canBid = lot.status === 'live' && reg.registration?.status === 'approved';
  const artistName = lot.artwork.artist?.display_name ?? 'Unknown artist';

  return (
    <div className="dz-page detail dtpl-A">
      <div className="dtop">
        <button type="button" className="dz-back" onClick={() => navigate(-1)}>
          {BACK_ICON}
          <span>Back</span>
        </button>
        <SaveButton artwork={lot.artwork} variant="icon" />
      </div>

      <div className="dz-herocol">
        <div className="dhero">
          {image ? <img src={image} alt={lot.artwork.title} /> : null}
        </div>
        <div className="dz-xrow" style={{ ['--xn' as string]: 2 }}>
          <button type="button" className="dz-x-btn" onClick={() => setRoomOpen(true)}>
            {IC_ROOM} View in Room
          </button>
          <button type="button" className="dz-x-btn" onClick={() => void share()}>
            {IC_SHARE} Share
          </button>
        </div>
      </div>

      <div className="dbody">
        <div className="d-eyebrow">
          <span className="lt-no">Lot {lot.lot_number}</span>
          {lot.status === 'live' ? (
            <span className="d-status live">
              <span className="d" />
              Live
            </span>
          ) : (
            <span className={`d-status ${lot.status === 'scheduled' ? 'upcoming' : 'ended'}`}>
              {lotStatusLabel(lot.status)}
            </span>
          )}
        </div>
        <h1>{artistName}</h1>
        {(lot.artwork.title || lot.artwork.year) && (
          <div className="sub">
            {lot.artwork.title || 'Untitled'}
            {lot.artwork.year ? `, ${lot.artwork.year}` : ''}
          </div>
        )}
        {lot.artwork.artist && (
          <Link to={`/artists/${lot.artwork.artist.id}`} className="dz-aplink">
            About the artist
            <span aria-hidden="true">›</span>
          </Link>
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

        <div className="price">
          <p className="lab">{closed ? 'Final price' : 'Estimate'}</p>
          {closed ? (
            <div className="amt">
              <span className="num">
                {lot.current_amount ? formatMoney(lot.current_amount) : 'Passed'}
              </span>
              {lot.current_amount && <span className="cur">{lot.currency}</span>}
            </div>
          ) : est ? (
            <div className="amt">
              <span className="num est">{est}</span>
              <span className="cur">{lot.currency}</span>
            </div>
          ) : (
            <p className="por">Estimate on request</p>
          )}
        </div>

        {lot.status === 'live' && (
          <div className="actions">
            {canBid ? (
              <button
                type="button"
                className="act-primary dzglow bid"
                onClick={() => {
                  clearBidState();
                  setBidOpen(true);
                }}
              >
                {lot.is_leading ? 'Raise your bid' : 'Place a bid'}
              </button>
            ) : (
              <>
                <button type="button" className="act-primary dz-bidclosed" disabled>
                  Place a bid
                </button>
                <p className="auc-live-hint">
                  {reg.registration?.status === 'pending'
                    ? 'Your paddle is being confirmed — bidding unlocks automatically.'
                    : reg.registration?.status === 'rejected'
                      ? 'Bidding is not available on this account for this auction.'
                      : null}
                  {!reg.registration && (
                    <>
                      <Link to={`/auctions/${lot.auction}`}>Register a paddle</Link> on the
                      auction page to place bids.
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        )}

        <div className="dz-bidstat-wrap">
          <div className="dz-bidstat">
            {lot.status === 'live' ? 'Live bidding' : lotStatusLabel(lot.status)}
            {lot.status === 'live' && (
              <span className="lt-stat live">
                <span className="d" />
                Live
              </span>
            )}
          </div>
          {left && <div className="dz-bidstat-sub">Closes in {left}</div>}
          {lot.bid_count === 0 && !closed && (
            <div className="dz-bidstat-sub">No bids yet — be the first.</div>
          )}
          {lot.bid_count > 0 && (
            <div className="dz-bidnow">
              <span>
                <span className="l">{closed ? 'Final price' : 'Current bid'}</span>
                <b>
                  {lot.current_amount ? formatMoney(lot.current_amount) : '—'} {lot.currency}
                </b>
              </span>
              <span className="lt-bidders">
                <span>
                  {lot.bid_count} bid{lot.bid_count === 1 ? '' : 's'}
                </span>
                {lotPills(lot).map((p) => (
                  <span key={p.label} className={`aucpill ${p.kind}`}>
                    {p.label}
                  </span>
                ))}
              </span>
            </div>
          )}
          {(live === 'reconnecting' || live === 'failed') && (
            <div className="dz-bidstat-sub">
              Reconnecting to live updates… the price shown may be a few seconds behind.
            </div>
          )}
        </div>

        <div className="dz-shipnote">
          {IC_TRUCK}
          <span>{SHIP_NOTE}</span>
        </div>

        {lot.artwork.public_description && (
          <>
            <p className="about-l">About this work</p>
            <p className="about">{lot.artwork.public_description}</p>
          </>
        )}

        {bids.length > 0 && (
          <>
            <div className="auc-lots-h">
              <span className="lh-t">Bid history</span>
              <span className="lh-n">{bids.length}</span>
            </div>
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
          </>
        )}
      </div>

      {bidOpen && (
        <BidSheet
          lot={lot}
          open
          onClose={() => setBidOpen(false)}
          onPlaceBid={placeBid}
          bidding={bidding}
          error={bidError}
        />
      )}
      <ViewInRoom artwork={lot.artwork} open={roomOpen} onClose={() => setRoomOpen(false)} />
      <Toast
        open={bidAccepted || bidError !== null || Boolean(toast)}
        message={bidAccepted ? 'Your bid is in.' : (bidError ?? toast ?? '')}
        onClose={() => {
          clearBidState();
          setToast(null);
        }}
      />
    </div>
  );
}
