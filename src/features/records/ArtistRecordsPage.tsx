/**
 * ArtistRecordsPage — `/records/artist/:id`. One artist's complete auction
 * history at the five v0.1 houses, in the Cards / List views (`recCard` /
 * `recRow`), sortable (the old per-artist sort, app.html:5387-5395: newest ·
 * oldest · highest price, ranked within ONE currency), and — where enough
 * verified data exists — the artist's market metrics in the `.dza-stat2`
 * grid the old artist page used (`artistView`, app.html:5341-5381), plus a
 * results-over-time list. Every figure comes from `insights.ts`; a block
 * with too little data simply does not appear.
 */
import { Link, useNavigate, useParams } from 'react-router-dom';
import '../auctions/auctions.css';
import { formatMoney } from '../catalogue/format';
import { RecordCard, RecordRow } from './RecordCards';
import { saleDateLabel } from './recordFormat';
import { resultOf } from './insights';
import { sortRecords, type RecordSort } from './RecordsArchiveController';
import './records.css';
import { useRecordsArchive } from './useRecordsArchive';

const SORTS: Array<{ value: RecordSort; label: string }> = [
  { value: 'recent', label: 'Newest record' },
  { value: 'yearAsc', label: 'Oldest record' },
  { value: 'hi', label: 'Highest result' },
  { value: 'lo', label: 'Lowest result' },
];

export function ArtistRecordsPage() {
  const { id } = useParams<{ id: string }>();
  const key = decodeURIComponent(id ?? '');
  const navigate = useNavigate();
  const { status, error, view, sort, controller } = useRecordsArchive();
  const records = controller.forArtist(key);
  const name = controller.artistName(key);
  const ins = controller.insightsFor(key);
  const list = sortRecords(records, sort);
  const cur = ins.currency ?? '';

  if (status === 'loading') return <p className="dz-state">Loading…</p>;
  if (status === 'error') return <p className="dz-state err">{error}</p>;

  const pct = (x: number) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;
  const bestYear = Math.max(1, ...ins.byYear.map((y) => y.high));

  return (
    <div className="dz-page">
      <div className="rec2-dtop">
        <button type="button" className="dz-back" onClick={() => navigate('/records')}>
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
          <span>Records</span>
        </button>
      </div>
      <div className="rec2-ahead">
        <p className="rec2-eyebrow">Artist auction records</p>
        <h1 className="rec2-h1">{name ?? 'Artist'}</h1>
        <div className="rec2-seam" />
      </div>

      {records.length === 0 && (
        <div className="rec2-empty">
          <div className="lk" />
          <h3>No verified records</h3>
          <p>Nothing from the five houses is on file for this artist yet.</p>
        </div>
      )}

      {ins.sales > 0 && (
        <>
          <div className="rec2-sech">
            <span className="t">Market insights</span>
            <span className="c">{cur ? `in ${cur}` : ''}</span>
          </div>
          <div className="dza-stat2">
            {ins.highest && (
              <div>
                <div className="l">Highest result</div>
                <div className="v">
                  {formatMoney(resultOf(ins.highest))}
                  <span className="c">{cur}</span>
                </div>
              </div>
            )}
            {ins.lowest && (
              <div>
                <div className="l">Lowest result</div>
                <div className="v">
                  {formatMoney(resultOf(ins.lowest))}
                  <span className="c">{cur}</span>
                </div>
              </div>
            )}
            <div>
              <div className="l">Sales</div>
              <div className="v">
                {ins.sales}
                <span className="c">of {ins.records} records</span>
              </div>
            </div>
            {ins.sellThrough != null && (
              <div>
                <div className="l">Sell-through</div>
                <div className="v">{Math.round(ins.sellThrough * 100)}%</div>
              </div>
            )}
            {ins.recent[0] && (
              <div>
                <div className="l">Last sale</div>
                <div className="v sm">{saleDateLabel(ins.recent[0].sale_date)}</div>
              </div>
            )}
            {ins.trend && (
              <div>
                <div className="l">Price trend</div>
                <div className="v sm">
                  {ins.trend}
                  {ins.trend === 'Rising' ? ' ↑' : ins.trend === 'Declining' ? ' ↓' : ' →'}
                </div>
              </div>
            )}
            {ins.vsEstimate != null && (
              <div>
                <div className="l">vs. estimate</div>
                <div className="v sm">
                  {Math.abs(ins.vsEstimate) < 0.05
                    ? 'On estimate'
                    : `${pct(ins.vsEstimate)} ${ins.vsEstimate > 0 ? 'above' : 'below'} mid-estimate`}
                </div>
              </div>
            )}
            {ins.aboveHighShare != null && (
              <div>
                <div className="l">Above high estimate</div>
                <div className="v sm">{Math.round(ins.aboveHighShare * 100)}% of sales</div>
              </div>
            )}
          </div>

          {ins.byYear.length > 0 && (
            <>
              <div className="rec2-sech">
                <span className="t">Results over time</span>
                <span className="c">highest result per year</span>
              </div>
              <div className="rec2-years">
                {ins.byYear.map((y) => (
                  <div className="rec2-yrow" key={y.year}>
                    <span className="y">{y.year}</span>
                    <span className="rec2-ybar">
                      <i
                        style={{
                          width: `${Math.max(3, Math.round((y.high / bestYear) * 100))}%`,
                        }}
                      />
                    </span>
                    <span className="v">
                      {formatMoney(y.high)}
                      <small>
                        {y.sales} sale{y.sales === 1 ? '' : 's'}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
          <p className="rec2-note">
            Computed from sold results in {cur || 'one currency'} only — never mixed or
            converted. Unsold, passed and pending lots are counted as appearances, not results.
          </p>
        </>
      )}

      {records.length > 0 && (
        <>
          <div className="rec2-sech">
            <span className="t">All records</span>
            <span className="c">{records.length}</span>
          </div>
          <div className="rec2-tools" style={{ paddingTop: 4 }}>
            <select
              className="rec2-sort"
              value={sort}
              onChange={(e) => controller.setSort(e.target.value as RecordSort)}
              aria-label="Sort records"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <div className="rec2-vtog" role="group" aria-label="View">
              <button
                type="button"
                className={view === 'card' ? 'on' : ''}
                onClick={() => controller.setView('card')}
              >
                Cards
              </button>
              <button
                type="button"
                className={view === 'list' ? 'on' : ''}
                onClick={() => controller.setView('list')}
              >
                List
              </button>
            </div>
          </div>
          {(sort === 'hi' || sort === 'lo') && cur && (
            <div className="rec2-curnote" style={{ marginTop: 12 }}>
              <span className="lk" />
              <span>
                Ranked by result in {cur} — prices are never compared across currencies.
              </span>
            </div>
          )}
          {view === 'list' ? (
            <div className="rec2-listwrap">
              {list.map((r) => (
                <RecordRow key={r.id} r={r} />
              ))}
            </div>
          ) : (
            <div className="rec2-grid">
              {list.map((r) => (
                <RecordCard key={r.id} r={r} />
              ))}
            </div>
          )}
        </>
      )}

      {records[0]?.artist && (
        <div className="rec2-cta" style={{ margin: '0 20px 30px' }}>
          <Link to={`/artists/${records[0].artist}`} className="ghost">
            Available works by this artist
          </Link>
        </div>
      )}
    </div>
  );
}
