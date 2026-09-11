/**
 * ArtworkDetailPage — faithful port of app.html's Template A artwork detail
 * (`.detail.dtpl-A`, SCREENS.md §04, COMPONENTS.md § Detail blocks):
 *
 *   1. `.dtop`: **‹ Back** pill · heart;
 *   2. square hero with the work contained on the well; previous / next arrows
 *      move within the set the collector came from (`BrowseSet`);
 *   3. two outline pills **View in Room** · **Share**;
 *   4. artist name (h1) · "Title, year" · **ABOUT THE ARTIST ›** pill;
 *   5. spec rows Medium · Size · Year · Edition · Artist born;
 *   6. the price block — ASKING PRICE · amount · ink tick, or "Price on request";
 *   7. `ActionButtons` (Buy now · 24h hold · Request viewing · Make an offer);
 *   8. the delivery note inset;
 *   9. "WANT TO SEE MORE WORKS BY / Artist / n more works / View more works".
 *
 * Not ported (no backend field, flagged rather than faked): **Chat on
 * WhatsApp** (needs the gallery's number, `theme.whatsapp`), the Logistics &
 * payment sheet (`artwork.logi`), the auction-record panel under the work, and
 * the owner-selected templates B / C.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import { Toast } from '../../components';
import { ActionButtons } from '../requests/ActionButtons';
import { SaveButton } from '../saved/SaveButton';
import { browseSet } from './BrowseSet';
import './catalogue.css';
import { availabilityClass, availabilityLabel, formatMoney, primaryImage } from './format';
import { useCatalogue, useResource } from './useCatalogue';
import { ViewInRoom } from './ViewInRoom';

/** THEME_DEFAULT.shipNote — owner-editable in Admin → App Design in the old
 * app; there is no theme endpoint yet, so the shipped default is used. */
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
const CHEVRON = (dir: 'prev' | 'next') => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={dir === 'prev' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
  </svg>
);
// app.html:9134 — the View in Room glyph; the share glyph is the app's own
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

export function ArtworkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { catalog } = useApi();
  const navigate = useNavigate();
  const {
    status,
    data: artwork,
    error,
  } = useResource(() => catalog.artwork(id!), [catalog, id]);
  const [roomOpen, setRoomOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // "More by artist" — the artist's other available works (app.html v495)
  const artistId = artwork?.artist?.id;
  const { state: more } = useCatalogue(artistId ? { artist: artistId, per_page: 1 } : {});

  // the previous / next set is whatever list the collector came from
  const { prev, next } = id ? browseSet.neighbours(id) : { prev: null, next: null };

  // Scroll the frame's <main> to the top on each work (app.html does the same
  // on `DZ.open`; the router keeps the old scroll otherwise).
  useEffect(() => {
    document.getElementById('dzMain')?.scrollTo({ top: 0 });
  }, [id]);

  const share = useCallback(async () => {
    if (!artwork) return;
    const url = window.location.href;
    const title = `${artwork.artist?.display_name ?? 'Darz'} — ${artwork.title || 'Untitled'}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast('Copied.');
    } catch {
      /* the collector dismissed the share sheet — nothing to say */
    }
  }, [artwork]);

  if (status === 'loading') return <p className="dz-state">Loading…</p>;
  if (status === 'error') return <p className="dz-state err">{error}</p>;
  if (!artwork) return null;

  const image = primaryImage(artwork);
  const fields: Array<[string, string]> = (
    [
      ['Medium', artwork.medium],
      ['Size', artwork.dimensions],
      ['Year', artwork.year ? String(artwork.year) : ''],
      ['Edition', artwork.edition],
      ['Artist born', artwork.artist?.birth_year ? String(artwork.artist.birth_year) : ''],
    ] as Array<[string, string]>
  ).filter(([, v]) => Boolean(v));
  const onRequest = artwork.price_type === 'on_request' || !artwork.price_amount;
  const moreCount = Math.max(0, (more.pagination?.total_count ?? 1) - 1);
  const artistName = artwork.artist?.display_name ?? 'Unknown artist';

  return (
    <div className="dz-page detail dtpl-A">
      <div className="dtop">
        <button type="button" className="dz-back" onClick={() => navigate(-1)}>
          {BACK_ICON}
          <span>Back</span>
        </button>
        <SaveButton artwork={artwork} variant="icon" />
      </div>

      <div className="dz-herocol">
        <div className="dhero">
          {image ? <img src={image} alt={artwork.title} /> : null}
          {prev && (
            <button
              type="button"
              className="dz-navarrow prev"
              aria-label="Previous work"
              onClick={() => navigate(`/artwork/${prev}`, { replace: true })}
            >
              {CHEVRON('prev')}
            </button>
          )}
          {next && (
            <button
              type="button"
              className="dz-navarrow next"
              aria-label="Next work"
              onClick={() => navigate(`/artwork/${next}`, { replace: true })}
            >
              {CHEVRON('next')}
            </button>
          )}
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
        {artwork.availability_status !== 'available' && (
          <div className="d-eyebrow">
            <span className={`d-status ${availabilityClass(artwork.availability_status)}`}>
              {availabilityLabel(artwork.availability_status)}
            </span>
          </div>
        )}
        <h1>{artistName}</h1>
        <div className="sub">
          {artwork.title || 'Untitled'}
          {artwork.year ? `, ${artwork.year}` : ''}
        </div>
        {artwork.artist && (
          <Link to={`/artists/${artwork.artist.id}`} className="dz-aplink">
            About the artist
            <span aria-hidden="true">›</span>
          </Link>
        )}

        {fields.length > 0 && (
          <div className="fields">
            {fields.map(([k, v]) => (
              <div className="frow" key={k}>
                <span className="k">{k}</span>
                <span className="v">{v}</span>
              </div>
            ))}
          </div>
        )}

        <div className="price">
          <p className="lab">Asking price</p>
          {onRequest ? (
            <p className="por">Price on request</p>
          ) : (
            <div className="amt">
              <span className="num">{formatMoney(artwork.price_amount!)}</span>
              <span className="cur">{artwork.currency}</span>
            </div>
          )}
          <div className="tick" />
        </div>

        <ActionButtons artwork={artwork} />

        <div className="dz-shipnote">
          {IC_TRUCK}
          <span>{SHIP_NOTE}</span>
        </div>

        {artwork.public_description && (
          <>
            <p className="about-l">About this work</p>
            <p className="about">{artwork.public_description}</p>
          </>
        )}

        {artwork.artist && moreCount > 0 && (
          <div className="dz-moreby">
            <div className="dz-moreby-q">Want to see more works by</div>
            <div className="dz-moreby-name">{artistName}</div>
            <div className="dz-moreby-sub">
              {moreCount} more {moreCount === 1 ? 'work' : 'works'} in the collection
            </div>
            <Link to={`/artists/${artwork.artist.id}`} className="dz-moreby-btn">
              View more works by this artist
            </Link>
          </div>
        )}
      </div>

      <ViewInRoom artwork={artwork} open={roomOpen} onClose={() => setRoomOpen(false)} />
      <Toast message={toast ?? ''} open={Boolean(toast)} onClose={() => setToast(null)} />
    </div>
  );
}
