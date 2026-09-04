/**
 * ArtistDetailPage — the artist's bio + their available works, faithful to
 * the "Available works" section of app.html's `artistView()`. The old page
 * also shows auction market metrics and a full records archive; those need
 * auction data the backend doesn't expose yet and are intentionally left out
 * (see docs/API_GAP_ANALYSIS.md, G9 partial).
 */
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import { ArtworkCard } from './ArtworkCard';
import './catalogue.css';
import { useCatalogue, useResource } from './useCatalogue';

export function ArtistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { catalog } = useApi();
  const navigate = useNavigate();

  const {
    status,
    data: artist,
    error,
  } = useResource(() => catalog.artist(id!), [catalog, id]);
  const { state: works } = useCatalogue({ artist: id });

  if (status === 'loading') return <p className="dz-state">Loading…</p>;
  if (status === 'error') return <p className="dz-state err">{error}</p>;
  if (!artist) return null;

  return (
    <div className="dz-page dza dza-artist">
      <div className="dtop" style={{ padding: '12px 16px' }}>
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

      <div style={{ padding: '0 16px' }}>
        <p className="dza-mono">Artist</p>
        <h1 className="dza-hh">{artist.display_name}</h1>
        {(artist.nationality || artist.birth_year) && (
          <p className="da-size" style={{ marginTop: 6 }}>
            {[artist.nationality, artist.birth_year ? `b. ${artist.birth_year}` : '']
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        {artist.bio && (
          <p className="about" style={{ marginTop: 14 }}>
            {artist.bio}
          </p>
        )}

        <p className="about-l" style={{ marginTop: 26 }}>
          Available works
          {works.pagination ? ` (${works.pagination.total_count})` : ''}
        </p>
        {works.status === 'idle' && works.results.length === 0 && (
          <div className="dza-aempty">No available works from this artist right now.</div>
        )}
        {works.results.length > 0 && (
          <div className="grid" style={{ padding: '10px 0 24px' }}>
            {works.results.map((artwork) => (
              <ArtworkCard key={artwork.id} artwork={artwork} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
