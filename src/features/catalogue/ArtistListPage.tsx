/**
 * ArtistListPage — faithful port of app.html's Artists tab (`artistsView()`):
 * a search box + sort dropdown (`.dza-atools`) over a card grid
 * (`.dza-agrid2`), with `.dza-aempty` for no matches. "Most records" /
 * "Top price" sorts are not offered — they need auction-record joins the
 * backend doesn't have yet (see docs/API_GAP_ANALYSIS.md, G9).
 */
import { useEffect, useState } from 'react';
import './catalogue.css';
import { ArtistCard } from './ArtistCard';
import { Pager } from './Pager';
import { useArtistList } from './useCatalogue';

export function ArtistListPage() {
  const { state, setQuery, setPage } = useArtistList();
  const [term, setTerm] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      if (term !== (state.query.search ?? '')) setQuery({ search: term || undefined });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  return (
    <div className="dz-page dza">
      <div style={{ padding: '14px 16px 0' }}>
        <p className="dza-mono">The artists</p>
        <h1 className="dza-hh">Artists</h1>

        <div className="dza-atools">
          <label className="dza-abar" style={{ flex: 1 }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              placeholder="Search an artist…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </label>
          <select
            className="dza-asel"
            value={state.query.ordering ?? 'name'}
            onChange={(e) => setQuery({ ordering: e.target.value })}
          >
            <option value="name">Name A–Z</option>
            <option value="works">Most works</option>
          </select>
        </div>

        {state.status === 'loading' && state.results.length === 0 && (
          <p className="dz-state">Loading…</p>
        )}
        {state.status === 'error' && <p className="dz-state err">{state.error}</p>}
        {state.status !== 'loading' &&
          state.results.length === 0 &&
          state.status !== 'error' && (
            <div className="dza-aempty">
              {term
                ? `No artists match "${term}".`
                : 'Artists appear here as works are published.'}
            </div>
          )}

        {state.results.length > 0 && (
          <div className="dza-agrid2">
            {state.results.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        )}
      </div>

      {state.pagination && <Pager pagination={state.pagination} onPage={setPage} />}
    </div>
  );
}
