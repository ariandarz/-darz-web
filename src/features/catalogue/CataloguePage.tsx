/**
 * CataloguePage — the collector catalogue browse view. Composes the ported
 * app.html chrome (`.hero`, `.toolbar`, `.grid`, `.pager`) over the OOP
 * `CatalogueController` (via `useCatalogue`).
 */
import { Link } from 'react-router-dom';
import './catalogue.css';
import { ArtworkCard } from './ArtworkCard';
import { CatalogueToolbar } from './CatalogueToolbar';
import { Pager } from './Pager';
import { useCatalogue } from './useCatalogue';

export function CataloguePage() {
  const { state, setQuery, setPage } = useCatalogue();

  return (
    <div className="dz-page">
      <div className="hero">
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <p className="eyebrow">Darz Market</p>
          <span style={{ display: 'flex', gap: 8 }}>
            <Link to="/saved" className="dz-back" style={{ padding: '6px 13px' }}>
              Saved
            </Link>
            <Link to="/artists" className="dz-back" style={{ padding: '6px 13px' }}>
              Artists
            </Link>
          </span>
        </div>
        <h1>
          The <span className="lt">catalogue</span>
        </h1>
        <p>Contemporary Iranian art, available now.</p>
      </div>

      <CatalogueToolbar query={state.query} onChange={setQuery} />

      {state.pagination && <div className="count">{state.pagination.total_count} works</div>}

      {state.status === 'loading' && state.results.length === 0 && (
        <p className="dz-state">Loading…</p>
      )}
      {state.status === 'error' && <p className="dz-state err">{state.error}</p>}
      {state.status !== 'loading' &&
        state.results.length === 0 &&
        state.status !== 'error' && <p className="dz-state">No works match this search.</p>}

      {state.results.length > 0 && (
        <div className="grid">
          {state.results.map((artwork) => (
            <ArtworkCard key={artwork.id} artwork={artwork} />
          ))}
        </div>
      )}

      {state.pagination && <Pager pagination={state.pagination} onPage={setPage} />}
    </div>
  );
}
