/**
 * SavedItemsPage — `/saved`. The collector's saved works.
 *
 * Renders the same `.hero` / `.count` / `.grid` chrome and the same
 * `ArtworkCard` as the catalogue (`src/features/catalogue/`), so a saved work
 * looks exactly like it does everywhere else — no second card design.
 *
 * There is no separate fetch here: `SavedController` is the one server-derived
 * source of truth, already loaded for the save buttons, so unsaving a work
 * removes it from this list immediately and correctly. Nothing is read from
 * `localStorage`; a refresh re-reads `GET /api/crm/saved/`.
 */
import { Link } from 'react-router-dom';
import { Button } from '../../components';
import '../catalogue/catalogue.css';
import { ArtworkCard } from '../catalogue/ArtworkCard';
import './saved.css';
import { useSaved } from './useSaved';

export function SavedItemsPage() {
  const { status, items, error, controller } = useSaved();
  const loading = status === 'loading' || status === 'idle';

  return (
    <div className="dz-page">
      <div className="hero">
        <div className="dz-saved-links">
          <p className="eyebrow">Darz Market</p>
          <Link to="/" className="dz-back">
            The catalogue
          </Link>
        </div>
        <h1>
          Your <span className="lt">saved works</span>
        </h1>
        <p>Works you have kept. Saved to your account, not to this device.</p>
      </div>

      {status === 'ready' && items.length > 0 && (
        <div className="count">
          {items.length} {items.length === 1 ? 'work' : 'works'}
        </div>
      )}

      {loading && <p className="dz-state">Loading…</p>}

      {status === 'error' && (
        <>
          <p className="dz-state err">{error}</p>
          <div className="dz-saved-retry">
            <Button variant="outline" onClick={() => void controller.reload()}>
              Try again
            </Button>
          </div>
        </>
      )}

      {status === 'ready' && items.length === 0 && (
        <div className="dz-saved-empty">
          <p>Nothing saved yet. Save a work from the catalogue and it will be waiting here.</p>
          <Link to="/" className="dz-back dz-saved-empty-cta">
            Browse the catalogue
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <div className="grid">
          {items.map((row) =>
            row.artwork ? <ArtworkCard key={row.id} artwork={row.artwork} /> : null,
          )}
        </div>
      )}
    </div>
  );
}
