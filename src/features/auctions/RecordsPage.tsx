/**
 * RecordsPage — `/records`. The external auction-house results archive
 * (market-intelligence comparables). Ported from `app.html` `recordsView()`
 * (~4760+): the `.rec2-hd` header + seam, the `.rec2-tools` search/sort row,
 * and the `.rec2-grid` of `.rec2-c` cards.
 *
 * Lean by design: the backend `AuctionRecord` carries ~10 fields; the old tab
 * showed image / medium / dimensions / low+high estimate / hammer-vs-realized /
 * provenance / Past-Upcoming-Live sectioning too. Those are a documented gap
 * (`docs/PHASE_8_API_GAPS.md`) — not invented here.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatMoney } from '../catalogue/format';
import { Pager } from '../catalogue/Pager';
import './auctions.css';
import { useRecords } from './useAuctions';

const SORTS: Array<{ value: string; label: string }> = [
  { value: '-sale_date', label: 'Most recent' },
  { value: 'sale_date', label: 'Oldest first' },
  { value: '-price_amount', label: 'Highest price' },
  { value: 'price_amount', label: 'Lowest price' },
];

export function RecordsPage() {
  const navigate = useNavigate();
  const { state, controller } = useRecords({ ordering: '-sale_date' });
  const [searchInput, setSearchInput] = useState('');

  return (
    <div className="dz-page">
      <div className="rec2-hd">
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <p className="rec2-eyebrow">Auction results</p>
          <Link to="/auctions" className="dz-back" style={{ padding: '6px 13px' }}>
            Auctions
          </Link>
        </div>
        <h1 className="rec2-h1">Records</h1>
        <div className="rec2-seam" />
        <p className="rec2-curnote">
          Recent results for contemporary Iranian art at international auction houses — for
          reference.
        </p>
      </div>

      <div className="rec2-tools">
        <div className="rec2-search">
          <input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              controller.setSearch(e.target.value);
            }}
            placeholder="Search artist, house or work"
            aria-label="Search records"
          />
        </div>
        <select
          className="rec2-sort"
          value={state.query.ordering ?? '-sale_date'}
          onChange={(e) => controller.setOrdering(e.target.value)}
          aria-label="Sort records"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {state.pagination && <div className="count">{state.pagination.total_count} results</div>}

      {state.status === 'loading' && state.results.length === 0 && (
        <p className="dz-state">Loading…</p>
      )}
      {state.status === 'error' && <p className="dz-state err">{state.error}</p>}
      {state.status !== 'loading' &&
        state.results.length === 0 &&
        state.status !== 'error' && <p className="dz-state">No results match this search.</p>}

      {state.results.length > 0 && (
        <div className="rec2-grid">
          {state.results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="rec2-c"
              onClick={() => navigate(`/records/${r.id}`)}
            >
              <div className="rec2-meta">
                <span className="h">{r.house}</span>
                {r.sale_date && (
                  <span className="d">
                    {new Date(r.sale_date).toLocaleDateString(undefined, {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                )}
              </div>
              <div className="rec2-ar">{r.artist_display_name ?? 'Unattributed'}</div>
              {r.lot_title && <div className="rec2-ti">{r.lot_title}</div>}
              <div className="rec2-line" />
              <div className="rec2-pl">Price realised</div>
              {r.price_amount ? (
                <div className="rec2-price">
                  {formatMoney(r.price_amount)} <span className="c">{r.currency ?? ''}</span>
                </div>
              ) : (
                <div className="rec2-wait">Not reported</div>
              )}
            </button>
          ))}
        </div>
      )}

      {state.pagination && (
        <Pager pagination={state.pagination} onPage={(p) => controller.setPage(p)} />
      )}
    </div>
  );
}
