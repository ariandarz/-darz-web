/**
 * ArtworkCard — the catalogue unit. Faithful port of app.html's `.card`
 * (COMPONENTS.md § Artwork card): image on an ink well with the glass heart
 * (`.save`) top-right and a status badge (`.cardstat`) top-left, then the meta
 * stack — artist (`.ar`), *title, year* (`.ti`), medium (`.cd`) and the price
 * row (`.pr`) with the currency and a "Request price" button on works with no
 * price. The card is a router `<Link>`; the save control is a sibling inside
 * `.card-wrap` (a button inside an anchor is invalid HTML).
 *
 * The shipped `.cd` line reads "medium | category" — the backend has no
 * category field, so only the medium is shown (flagged, not invented).
 */
import { Link, type LinkProps } from 'react-router-dom';
import type { Artwork } from '../../api/types';
import { SaveButton } from '../saved/SaveButton';
import { availabilityClass, availabilityLabel, formatMoney, primaryImage } from './format';

export function ArtworkCard({
  artwork,
  state,
}: {
  artwork: Artwork;
  /** router state to carry into the detail (the browse set, a `from` label) */
  state?: LinkProps['state'];
}) {
  const image = primaryImage(artwork);
  const showStatusBadge = artwork.availability_status !== 'available';
  const onRequest = artwork.price_type === 'on_request' || !artwork.price_amount;

  return (
    <div className="card-wrap">
      <Link
        to={`/artwork/${artwork.id}`}
        state={state}
        className="card"
        aria-label={artwork.title}
      >
        <div className="img dz-fit">
          {image ? (
            <img className="dz-fimg" src={image} alt="" loading="lazy" />
          ) : (
            <span className="dzld">Loading</span>
          )}
          {showStatusBadge && (
            <span className={`cardstat ${availabilityClass(artwork.availability_status)}`}>
              {availabilityLabel(artwork.availability_status)}
            </span>
          )}
        </div>
        <div className="meta">
          <div className="ar">{artwork.artist?.display_name ?? 'Unknown artist'}</div>
          <div className="ti">
            {artwork.title || 'Untitled'}
            {artwork.year ? `, ${artwork.year}` : ''}
          </div>
          {artwork.medium && <div className="cd">{artwork.medium}</div>}
          <div className="pr">
            {onRequest ? (
              <span className="req">Request price</span>
            ) : (
              <>
                {formatMoney(artwork.price_amount!)}
                <span className="c">{artwork.currency}</span>
                <span className="tick" />
              </>
            )}
          </div>
        </div>
      </Link>
      <SaveButton artwork={artwork} variant="icon" className="card-save" />
    </div>
  );
}
