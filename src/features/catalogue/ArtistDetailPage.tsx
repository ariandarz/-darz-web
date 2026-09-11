/**
 * ArtistDetailPage — faithful port of app.html's `artistView()` (SCREENS.md
 * §05, COMPONENTS.md § Artwork card "Artist-page card"): **‹ Back** · eyebrow
 * "ARTIST" · name (Cormorant 34px) · bio · the "Available *works* n" section
 * rule · two-column artist cards (AVAILABLE badge, MARKET eyebrow, title +
 * year, medium, size, price in bold sans) · **Enquire about works by <Artist>**
 * (charcoal) · "A Darz specialist will respond within two days."
 *
 * The enquiry files a `kind=information` request with no artwork (the API
 * allows `artwork` to be null) carrying the artist in `detail`. Not ported:
 * the auction-record rows and market metrics (they need `auction_records`
 * joined per artist — `docs/PHASE_8_API_GAPS.md`) and the owner-authored
 * profile block (`dz-ap-*`, no backend field). Flagged, not faked.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import type { Artwork } from '../../api/types';
import { Toast } from '../../components';
import { browseSet } from './BrowseSet';
import '../requests/requests.css'; // `.dz-sheetcta`
import './catalogue.css';
import { formatMoney, primaryImage } from './format';
import { useCatalogue, useResource } from './useCatalogue';

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

function chip(w: Artwork): { label: string; cls: string } {
  const st = w.availability_status;
  if (st === 'sold') return { label: 'Sold', cls: 'sold' };
  if (st === 'reserved' || st === 'on_hold') return { label: 'Reserved', cls: 'res' };
  return { label: 'Available', cls: 'ok' };
}

/** app.html `dzMarketCard` → `dzUniCard`: the artist-page tile. */
function ArtistWorkCard({ w }: { w: Artwork }) {
  const image = primaryImage(w);
  const c = chip(w);
  const onRequest = w.price_type === 'on_request' || !w.price_amount;
  return (
    <Link to={`/artwork/${w.id}`} className="dza-wcard">
      <div className="dza-wimg">
        {image ? <img src={image} alt="" loading="lazy" /> : null}
        <span className={`dza-chip ${c.cls}`}>{c.label}</span>
      </div>
      <div className="dza-wbody">
        <div className="dza-wmeta">Market</div>
        <div className="dza-wtitle">
          {w.title || 'Untitled'}
          {w.year ? <span className="dza-wyear"> {w.year}</span> : null}
        </div>
        {w.medium && <div className="dza-wspec">{w.medium}</div>}
        {w.dimensions && <div className="dza-wspec">{w.dimensions}</div>}
        <div className="dza-wprice">
          {onRequest ? (
            <span className="por">Price on request</span>
          ) : (
            `${formatMoney(w.price_amount!)} ${w.currency}`
          )}
        </div>
      </div>
    </Link>
  );
}

export function ArtistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { catalog, crm } = useApi();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const {
    status,
    data: artist,
    error,
  } = useResource(() => catalog.artist(id!), [catalog, id]);
  const { state: works } = useCatalogue({ artist: id, per_page: 48 });

  useEffect(() => {
    if (works.results.length) browseSet.publish(works.results.map((w) => w.id));
  }, [works.results]);

  useEffect(() => {
    document.getElementById('dzMain')?.scrollTo({ top: 0 });
  }, [id]);

  if (status === 'loading') return <p className="dz-state">Loading…</p>;
  if (status === 'error') return <p className="dz-state err">{error}</p>;
  if (!artist) return null;

  const enquire = async () => {
    if (sending) return;
    setSending(true);
    try {
      await crm.createRequest({
        kind: 'information',
        detail: {
          artist: artist.id,
          message: `Please let me know about available works by ${artist.display_name}.`,
        },
        clientReqId: `artist:${artist.id}:${Date.now()}`,
      });
      setToast('Request sent.');
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="dz-page dza dza-artist">
      <div className="dtop" style={{ padding: '12px 16px', borderBottom: 0 }}>
        <button type="button" className="dz-back" onClick={() => navigate(-1)}>
          {BACK_ICON}
          <span>Back</span>
        </button>
      </div>

      <div style={{ padding: '0 16px 28px' }}>
        <p className="dza-mono">Artist</p>
        <h1 className="dza-hh">{artist.display_name}</h1>
        {(artist.nationality || artist.birth_year) && (
          <p className="dza-born">
            {[artist.nationality, artist.birth_year ? `b. ${artist.birth_year}` : '']
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        {artist.bio && <p className="dza-bio">{artist.bio}</p>}

        {works.results.length > 0 && (
          <>
            <div className="dza-sh">
              <h2>
                Available <i>works</i>
              </h2>
              <span className="c">
                {works.pagination?.total_count ?? works.results.length}
              </span>
            </div>
            <div className="dza-wgrid">
              {works.results.map((w) => (
                <ArtistWorkCard key={w.id} w={w} />
              ))}
            </div>
          </>
        )}
        {works.status !== 'loading' && works.results.length === 0 && (
          <div className="dza-aempty">No available works from this artist right now.</div>
        )}

        <div className="dza-enq">
          <button
            type="button"
            className="dz-sheetcta"
            disabled={sending}
            aria-busy={sending || undefined}
            onClick={() => void enquire()}
          >
            {sending ? 'Sending…' : `Enquire about works by ${artist.display_name}`}
          </button>
          <div className="dza-enqn">A Darz specialist will respond within two days.</div>
        </div>
      </div>

      <Toast message={toast ?? ''} open={Boolean(toast)} onClose={() => setToast(null)} />
    </div>
  );
}
