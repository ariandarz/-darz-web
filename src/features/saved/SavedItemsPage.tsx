/**
 * SavedItemsPage — `/saved`. The collector's saved works.
 *
 * Renders the same `.hero` / `.count` / `.grid` chrome and the same
 * `ArtworkCard` as the catalogue (`src/features/catalogue/`), so a saved work
 * looks exactly like it does everywhere else — no second card design.
 *
 * A real paginated list now (`SavedListController`, same `ListController`
 * seam the catalogue and admin request feed use), not a one-off full-list
 * read into memory — see `docs/PHASE_6_API_GAPS.md` G-P6-1/G-P6-2 and
 * `SavedListController`'s own docs for why that changed. An unsave anywhere
 * on this page re-reads the current page from the server so the grid stays
 * correct; nothing is cached in `localStorage`.
 */
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import { Button } from '../../components';
import '../catalogue/catalogue.css';
import { ArtworkCard } from '../catalogue/ArtworkCard';
import { Pager } from '../catalogue/Pager';
import { useListController } from '../shared/useListController';
import './saved.css';
import { SavedListController } from './SavedListController';
import { useSaved } from './useSaved';
import type { SavedArtwork, SavedArtworkQuery } from '../../api/types';

export function SavedItemsPage() {
  const { crm } = useApi();
  const { state, setPage, reload } = useListController<SavedArtwork, SavedArtworkQuery>(
    () => new SavedListController(crm),
  );
  const { lastAction } = useSaved();

  // An unsave anywhere (this page's own cards included) should drop the row
  // from this list without waiting for a manual refresh.
  const seenAction = useRef<number | null>(null);
  useEffect(() => {
    if (!lastAction || lastAction.at === seenAction.current) return;
    seenAction.current = lastAction.at;
    if (lastAction.op === 'unsave') void reload();
  }, [lastAction, reload]);

  const loading = state.status === 'loading' && state.results.length === 0;

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

      {state.status !== 'loading' && state.pagination && state.pagination.total_count > 0 && (
        <div className="count">
          {state.pagination.total_count}{' '}
          {state.pagination.total_count === 1 ? 'work' : 'works'}
        </div>
      )}

      {loading && <p className="dz-state">Loading…</p>}

      {state.status === 'error' && (
        <>
          <p className="dz-state err">{state.error}</p>
          <div className="dz-saved-retry">
            <Button variant="outline" onClick={() => void reload()}>
              Try again
            </Button>
          </div>
        </>
      )}

      {!loading && state.status !== 'error' && state.results.length === 0 && (
        <div className="dz-saved-empty">
          <p>Nothing saved yet. Save a work from the catalogue and it will be waiting here.</p>
          <Link to="/" className="dz-back dz-saved-empty-cta">
            Browse the catalogue
          </Link>
        </div>
      )}

      {state.results.length > 0 && (
        <div className="grid">
          {state.results.map((row) =>
            row.artwork ? <ArtworkCard key={row.id} artwork={row.artwork} /> : null,
          )}
        </div>
      )}

      {state.pagination && <Pager pagination={state.pagination} onPage={setPage} />}
    </div>
  );
}
