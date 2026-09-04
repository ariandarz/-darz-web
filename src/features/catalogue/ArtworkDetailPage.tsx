/**
 * ArtworkDetailPage — faithful port of app.html's Template A artwork detail
 * (`.detail.dtpl-A`): back bar, square contained hero, eyebrow + status,
 * title/subtitle, spec rows, one quiet price moment, description, and the
 * `.actions` block (app.html:503-508).
 *
 * Phase 6 fills `.actions` with the Save / Saved control. "Make an offer" and
 * "Request price" are still absent — they are Phase 5, which stays blocked on
 * backend Phase 19 (offer floor + idempotency key). Intentional V1 scope, not
 * an oversight.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import { SaveButton } from '../saved/SaveButton';
import './catalogue.css';
import { availabilityClass, availabilityLabel, formatMoney, primaryImage } from './format';
import { useResource } from './useCatalogue';

export function ArtworkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { catalog } = useApi();
  const navigate = useNavigate();
  const {
    status,
    data: artwork,
    error,
  } = useResource(() => catalog.artwork(id!), [catalog, id]);

  if (status === 'loading') return <p className="dz-state">Loading…</p>;
  if (status === 'error') return <p className="dz-state err">{error}</p>;
  if (!artwork) return null;

  const image = primaryImage(artwork);
  const fields: Array<[string, string]> = [
    ['Medium', artwork.medium],
    ['Material', artwork.material],
    ['Dimensions', artwork.dimensions],
    ['Edition', artwork.edition],
    ['City', artwork.city],
  ].filter(([, v]) => Boolean(v)) as Array<[string, string]>;

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

      <div className="dhero">{image ? <img src={image} alt={artwork.title} /> : null}</div>

      <div className="dbody">
        <div className="d-eyebrow">
          <p className="eyebrow">{artwork.artist?.display_name ?? 'Unknown artist'}</p>
          {artwork.availability_status !== 'available' && (
            <span className={`d-status ${availabilityClass(artwork.availability_status)}`}>
              {availabilityLabel(artwork.availability_status)}
            </span>
          )}
        </div>
        <h1>{artwork.title || 'Untitled'}</h1>
        {artwork.year && <p className="sub">{artwork.year}</p>}
        {artwork.dimensions && <p className="da-size">{artwork.dimensions}</p>}

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
          <p className="lab">Price</p>
          {artwork.price_type === 'on_request' || !artwork.price_amount ? (
            <p className="por">Available on request</p>
          ) : (
            <div className="amt">
              <span className="cur">{artwork.currency}</span>
              <span className="num">{formatMoney(artwork.price_amount)}</span>
            </div>
          )}
          <div className="tick" />
        </div>

        <div className="actions">
          <SaveButton artworkId={artwork.id} title={artwork.title} variant="action" />
        </div>

        {artwork.public_description && (
          <>
            <p className="about-l">About this work</p>
            <p className="about">{artwork.public_description}</p>
          </>
        )}
      </div>
    </div>
  );
}
