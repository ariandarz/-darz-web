/**
 * RecordsPage — `/records`, the external auction-house results archive
 * (SCREENS.md §09, capture `12-records`). Ported from `app.html`
 * `recordsView()` (~4760+): eyebrow "THE AUCTION RECORD" (mono) · "Records" ·
 * chroma dash · sub-section pills **Upcoming n · Past n · Artist** · search
 * "Search artist or title…" · **Recently sold** sort · **Cards | List** view ·
 * record cards (`.rec2-c`: image, house, date, artist, title, price realised)
 * or dense list rows (`.rec2-row`) · the calm empty state ("No upcoming lots
 * yet / New auction lots appear here as Darz confirms them.").
 *
 * Sections come from the record's own `section` (the API has no section
 * filter, so the loaded page is split client-side); **Past** is owner-toggled
 * in the old app and hidden by default — shown here because the archive is
 * the whole point of the tab (flagged as a scope decision). Highlights stays
 * hidden (no highlight rows are curated yet).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuctionRecord } from '../../api/types';
import { Dropdown, Segment } from '../../components';
import { formatMoney } from '../catalogue/format';
import { Pager } from '../catalogue/Pager';
import './auctions.css';
import { useRecords } from './useAuctions';

const SORTS = [
  { value: '-sale_date', label: 'Recently sold' },
  { value: 'sale_date', label: 'Oldest first' },
  { value: '-price_amount', label: 'Highest price' },
  { value: 'price_amount', label: 'Lowest price' },
];

type Section = 'upcoming' | 'past' | 'artist';
type ViewMode = 'cards' | 'list';

function isUpcoming(r: AuctionRecord): boolean {
  if (r.section === 'upcoming') return true;
  if (r.section === 'past') return false;
  return Boolean(r.sale_date && new Date(r.sale_date).getTime() > Date.now());
}

function saleDate(r: AuctionRecord): string {
  return r.sale_date
    ? new Date(r.sale_date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : '';
}

function priceOf(r: AuctionRecord): string | null {
  const v = r.realized_amount ?? r.hammer_amount ?? r.price_amount;
  return v ? `${formatMoney(v)} ${r.currency ?? ''}`.trim() : null;
}

export function RecordsPage() {
  const navigate = useNavigate();
  const { state, controller } = useRecords({ ordering: '-sale_date', per_page: 48 });
  const [searchInput, setSearchInput] = useState('');
  const [section, setSection] = useState<Section>('past');
  const [view, setView] = useState<ViewMode>('cards');
  const [artist, setArtist] = useState<string | null>(null);

  const upcoming = useMemo(() => state.results.filter(isUpcoming), [state.results]);
  const past = useMemo(() => state.results.filter((r) => !isUpcoming(r)), [state.results]);
  const artists = useMemo(() => {
    const map = new Map<string, number>();
    state.results.forEach((r) => {
      const n = r.artist_display_name ?? r.artist_name_raw ?? 'Unattributed';
      map.set(n, (map.get(n) ?? 0) + 1);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [state.results]);

  const rows =
    section === 'upcoming'
      ? upcoming
      : section === 'past'
        ? past
        : artist
          ? state.results.filter(
              (r) => (r.artist_display_name ?? r.artist_name_raw ?? 'Unattributed') === artist,
            )
          : [];

  const loading = state.status === 'loading' && state.results.length === 0;
  const emptyCopy =
    section === 'upcoming'
      ? ['No upcoming lots yet', 'New auction lots appear here as Darz confirms them.']
      : ['No results yet', 'Auction results appear here as Darz records them.'];

  return (
    <div className="dz-page">
      <div className="rec2-hd">
        <p className="rec2-eyebrow">The auction record</p>
        <h1 className="rec2-h1">Records</h1>
        <div className="rec2-seam" />
      </div>

      <div className="ptabs sub">
        <button
          type="button"
          className={section === 'upcoming' ? 'on' : ''}
          onClick={() => setSection('upcoming')}
        >
          Upcoming <span className="ptab-n">{upcoming.length}</span>
        </button>
        <button
          type="button"
          className={section === 'past' ? 'on' : ''}
          onClick={() => setSection('past')}
        >
          Past <span className="ptab-n">{past.length}</span>
        </button>
        <button
          type="button"
          className={section === 'artist' ? 'on' : ''}
          onClick={() => setSection('artist')}
        >
          Artist
        </button>
      </div>

      <div className="rec2-tools">
        <div className="rec2-search">
          <input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              controller.setSearch(e.target.value);
            }}
            placeholder="Search artist or title…"
            aria-label="Search records"
          />
        </div>
        <Dropdown
          label="Sort records"
          options={SORTS}
          value={state.query.ordering ?? '-sale_date'}
          onChange={(v) => controller.setOrdering(v)}
        />
        <Segment<ViewMode>
          label="Records view"
          value={view}
          onChange={setView}
          className="rec2-view"
          options={[
            { value: 'cards', content: 'Cards' },
            { value: 'list', content: 'List' },
          ]}
        />
      </div>

      {loading && <p className="dz-state">Loading…</p>}
      {state.status === 'error' && <p className="dz-state err">{state.error}</p>}

      {section === 'artist' && !artist && !loading && (
        <div className="rec2-artists">
          {artists.length === 0 && (
            <div className="rec2-empty">
              <div className="rec2-empty-t">No artists yet</div>
              <div className="rec2-empty-s">Artists appear here as results are recorded.</div>
            </div>
          )}
          {artists.map(([name, n]) => (
            <button
              key={name}
              type="button"
              className="rec2-row"
              onClick={() => setArtist(name)}
            >
              <span className="rec2-row-ar">{name}</span>
              <span className="rec2-row-n">
                {n} {n === 1 ? 'record' : 'records'}
              </span>
            </button>
          ))}
        </div>
      )}

      {section === 'artist' && artist && (
        <div className="rec2-artists-back">
          <button type="button" className="dz-back" onClick={() => setArtist(null)}>
            <span>‹ All artists</span>
          </button>
          <span className="rec2-artists-name">{artist}</span>
        </div>
      )}

      {!loading &&
        state.status !== 'error' &&
        (section !== 'artist' || artist) &&
        rows.length === 0 && (
          <div className="rec2-empty">
            <div className="rec2-empty-t">{emptyCopy[0]}</div>
            <div className="rec2-empty-s">{emptyCopy[1]}</div>
          </div>
        )}

      {rows.length > 0 && view === 'cards' && (
        <div className="rec2-grid">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              className="rec2-c"
              onClick={() => navigate(`/records/${r.id}`)}
            >
              {r.image_url && (
                <div className="rec2-img">
                  <img src={r.image_url} alt="" loading="lazy" />
                </div>
              )}
              <div className="rec2-meta">
                <span className="h">{r.house}</span>
                {saleDate(r) && <span className="d">{saleDate(r)}</span>}
              </div>
              <div className="rec2-ar">{r.artist_display_name ?? 'Unattributed'}</div>
              {r.lot_title && <div className="rec2-ti">{r.lot_title}</div>}
              <div className="rec2-line" />
              <div className="rec2-pl">{isUpcoming(r) ? 'Estimate' : 'Price realised'}</div>
              {isUpcoming(r) ? (
                r.low_estimate && r.high_estimate ? (
                  <div className="rec2-price">
                    {formatMoney(r.low_estimate)} – {formatMoney(r.high_estimate)}{' '}
                    <span className="c">{r.currency ?? ''}</span>
                  </div>
                ) : (
                  <div className="rec2-wait">Estimate on request</div>
                )
              ) : priceOf(r) ? (
                <div className="rec2-price">{priceOf(r)}</div>
              ) : (
                <div className="rec2-wait">Not reported</div>
              )}
            </button>
          ))}
        </div>
      )}

      {rows.length > 0 && view === 'list' && (
        <div className="rec2-list">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              className="rec2-row"
              onClick={() => navigate(`/records/${r.id}`)}
            >
              {r.image_url && (
                <span className="rec2-row-img">
                  <img src={r.image_url} alt="" loading="lazy" />
                </span>
              )}
              <span className="rec2-row-b">
                <span className="rec2-row-ar">{r.artist_display_name ?? 'Unattributed'}</span>
                <span className="rec2-row-ti">
                  {r.lot_title}
                  {r.year ? `, ${r.year}` : ''}
                </span>
                <span className="rec2-row-h">
                  {r.house}
                  {saleDate(r) ? ` · ${saleDate(r)}` : ''}
                </span>
              </span>
              <span className="rec2-row-pr">{priceOf(r) ?? '—'}</span>
            </button>
          ))}
        </div>
      )}

      {state.pagination && section !== 'artist' && (
        <Pager pagination={state.pagination} onPage={(p) => controller.setPage(p)} />
      )}
    </div>
  );
}
