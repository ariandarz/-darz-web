/**
 * ArtworkCard — one catalogue grid tile. Faithful port of app.html's `.card`
 * (image / artist / title / dims / price). Not a base design-system
 * component (it's catalogue-domain shaped), but built from the same
 * class-name convention as `src/design/components.css`.
 */
import { Link } from 'react-router-dom';
import type { Artwork } from '../../api/types';
import { availabilityClass, availabilityLabel, formatMoney, primaryImage } from './format';

export function ArtworkCard({ artwork }: { artwork: Artwork }) {
  const image = primaryImage(artwork);
  const showStatusBadge = artwork.availability_status !== 'available';

  return (
    <Link to={`/artwork/${artwork.id}`} className="card" aria-label={artwork.title}>
      <div className="img">
        {image ? (
          <img src={image} alt="" loading="lazy" />
        ) : (
          <span className="ph">Untitled</span>
        )}
        {showStatusBadge && (
          <span className={`cardstat ${availabilityClass(artwork.availability_status)}`}>
            {availabilityLabel(artwork.availability_status)}
          </span>
        )}
      </div>
      <div className="meta">
        <div className="ar">{artwork.artist?.display_name ?? 'Unknown artist'}</div>
        <div className="ti">{artwork.title || 'Untitled'}</div>
        <div className="cd">
          {[artwork.medium, artwork.year ? String(artwork.year) : '']
            .filter(Boolean)
            .join(', ')}
        </div>
        {artwork.price_type === 'on_request' ? (
          <div className="pr">On request</div>
        ) : artwork.price_amount ? (
          <div className="pr">
            <span className="c">{artwork.currency}</span>
            {formatMoney(artwork.price_amount)}
            <span className="tick" />
          </div>
        ) : null}
      </div>
    </Link>
  );
}
