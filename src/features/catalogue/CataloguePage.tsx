/**
 * CataloguePage — the Market tab (SCREENS.md §03). Composes the ported
 * app.html chrome over the OOP `CatalogueController` (via `useCatalogue`):
 *
 *   1. `.hero` — "CURATED COLLECTION / The Collection / Contemporary Iranian
 *      works, available through darzmarket.art." (owner copy, THEME_DEFAULT);
 *   2. `.toolbar` — view segment · search · Recently added · All currencies;
 *   3. `.count` — "39 WORKS";
 *   4. the two-column `.grid` of `ArtworkCard`s (4–7 columns on desktop), or
 *      the **Single view** — one work per screen (`.scard`, `DZ.setView('solo')`);
 *   5. `.pager`.
 *
 * States: loading (ink well "LOADING…"), results, no results ("No works
 * match…"), error. The visible ids are published to `BrowseSet` so the
 * detail's previous / next arrows step through this page.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import type { Choice } from '../../api/types';
import './catalogue.css';
import { ArtworkCard } from './ArtworkCard';
import { browseSet } from './BrowseSet';
import { CatalogueToolbar, type CurrencyOption } from './CatalogueToolbar';
import { formatMoney, primaryImage } from './format';
import { Pager } from './Pager';
import { useCatalogue } from './useCatalogue';
import { viewPreference } from './ViewPreference';

export function CataloguePage() {
  const { state, setQuery, setPage } = useCatalogue();
  const { options } = useApi();
  const view = useSyncExternalStore(
    (cb) => viewPreference.subscribe(cb),
    () => viewPreference.mode,
    () => viewPreference.mode,
  );
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);

  // `GET /api/options/` publishes the currency choices — never hardcoded.
  useEffect(() => {
    let alive = true;
    options.all().then(
      (all) => {
        const list = (all as { currency?: Choice[] }).currency;
        if (alive && Array.isArray(list)) setCurrencies(list);
      },
      () => {
        /* the dropdown simply offers "All currencies" until options load */
      },
    );
    return () => {
      alive = false;
    };
  }, [options]);

  useEffect(() => {
    if (state.results.length) browseSet.publish(state.results.map((w) => w.id));
  }, [state.results]);

  const loading = state.status === 'loading' && state.results.length === 0;
  const empty =
    state.status !== 'loading' && state.status !== 'error' && state.results.length === 0;

  return (
    <div className="dz-page">
      <div className="hero">
        <p className="eyebrow">Curated Collection</p>
        <h1>The Collection</h1>
        <p>Contemporary Iranian works, available through darzmarket.art.</p>
      </div>

      <CatalogueToolbar
        query={state.query}
        onChange={setQuery}
        view={view}
        onView={(m) => viewPreference.set(m)}
        currencies={currencies}
      />

      {state.pagination && (
        <div className="count">
          {state.pagination.total_count}{' '}
          {state.pagination.total_count === 1 ? 'work' : 'works'}
        </div>
      )}

      {loading && <p className="dz-state">Loading…</p>}
      {state.status === 'error' && <p className="dz-state err">{state.error}</p>}
      {empty && <p className="dz-state">No works match this search.</p>}

      {state.results.length > 0 && view === 'grid' && (
        <div className="grid">
          {state.results.map((artwork) => (
            <ArtworkCard key={artwork.id} artwork={artwork} />
          ))}
        </div>
      )}

      {state.results.length > 0 && view === 'solo' && (
        <div className="dz-solo">
          {state.results.map((w, i) => {
            const image = primaryImage(w);
            const onRequest = w.price_type === 'on_request' || !w.price_amount;
            return (
              <Link key={w.id} to={`/artwork/${w.id}`} className="scard">
                <div className="simg">
                  <span className="simgwrap">
                    {image ? <img src={image} alt="" loading="lazy" /> : null}
                  </span>
                </div>
                <div className="smeta">
                  <div className="sar">{w.artist?.display_name ?? 'Unknown artist'}</div>
                  <div className="sti">
                    {w.title || 'Untitled'}
                    {w.year ? `, ${w.year}` : ''}
                  </div>
                  {w.medium && <div className="smed">{w.medium}</div>}
                  {w.dimensions && <div className="sdim">{w.dimensions}</div>}
                  <div className="spr">
                    {onRequest
                      ? 'Price on request'
                      : `${formatMoney(w.price_amount!)} ${w.currency}`}
                  </div>
                  <div className="sidx">
                    {i + 1} / {state.results.length}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {state.pagination && <Pager pagination={state.pagination} onPage={setPage} />}
    </div>
  );
}
