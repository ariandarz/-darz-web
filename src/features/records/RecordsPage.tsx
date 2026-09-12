/**
 * RecordsPage — `/records`. Artist auction records only (DEC-13): the
 * collector searches an artist by name and opens that artist's complete
 * history. This is the old Records tab's "Artist" sub-tab (`recordsView`,
 * app.html:5004-5025 — `.rec2-agrid` / `.rec2-acard` cards, or `.rec2-row`
 * rows under the same Cards / List toggle, `.rec2-vtog` :5045), with the
 * `.rec2-hd` header (:5067) and the `.rec2-tools` search row (:5036).
 * Upcoming / Past / Highlights sub-tabs and countdowns are not rendered —
 * v0.1 shows only past results from the five houses (`insights.V0_1_HOUSES`).
 */
import { Link } from 'react-router-dom';
import '../auctions/auctions.css';
import { monogram } from './recordFormat';
import { resultOf } from './insights';
import './records.css';
import { useRecordsArchive } from './useRecordsArchive';

export function RecordsPage() {
  const { status, error, view, search, controller } = useRecordsArchive();
  const artists = controller.artists();

  return (
    <div className="dz-page">
      <div className="rec2-hd">
        <p className="rec2-eyebrow">The auction record</p>
        <h1 className="rec2-h1">Records</h1>
        <div className="rec2-seam" />
        <p className="rec2-curnote">
          Results for contemporary Iranian artists at Sotheby’s, Christie’s, Bonhams, Tehran
          Auction and Millon — for reference.
        </p>
      </div>

      <div className="rec2-tools">
        <label className="rec2-search">
          <input
            value={search}
            onChange={(e) => controller.setSearch(e.target.value)}
            placeholder="Search an artist…"
            aria-label="Search an artist"
          />
        </label>
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

      {status === 'loading' && <p className="dz-state">Loading…</p>}
      {status === 'error' && <p className="dz-state err">{error}</p>}

      {status === 'ready' && artists.length === 0 && (
        <div className="rec2-empty">
          <div className="lk" />
          <h3>{search ? 'No artists found' : 'No records yet'}</h3>
          <p>
            {search
              ? 'Try another name, or clear the search.'
              : 'Results appear here as they are verified.'}
          </p>
        </div>
      )}

      {artists.length > 0 && view === 'list' && (
        <div className="rec2-listwrap">
          {artists.map((g) => (
            <Link
              key={g.key}
              to={`/records/artist/${encodeURIComponent(g.key)}`}
              className="rec2-row"
            >
              <div className="rec2-rimg">
                {g.best.image_url ? (
                  <img src={g.best.image_url} alt="" loading="lazy" />
                ) : (
                  <span>{monogram(g.name)}</span>
                )}
              </div>
              <div className="rec2-rmain">
                <div className="rec2-ran">{g.name}</div>
                <div className="rec2-rmeta">
                  {g.records.length} record{g.records.length === 1 ? '' : 's'}
                </div>
                {g.best.lot_title && resultOf(g.best) > 0 && (
                  <div className="rec2-rti">
                    Top lot · {g.best.lot_title}
                    {g.best.year ? `, ${g.best.year}` : ''}
                  </div>
                )}
              </div>
              <span className="rec2-go">›</span>
            </Link>
          ))}
        </div>
      )}

      {artists.length > 0 && view === 'card' && (
        <div className="rec2-agrid">
          {artists.map((g) => (
            <Link
              key={g.key}
              to={`/records/artist/${encodeURIComponent(g.key)}`}
              className="rec2-acard"
            >
              <div className="rec2-aimg">
                {g.best.image_url ? (
                  <img src={g.best.image_url} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="rec2-amono">{monogram(g.name)}</span>
                )}
              </div>
              <div className="rec2-ab">
                <div className="rec2-an">{g.name}</div>
                <div className="rec2-asum">
                  {g.records.length} record{g.records.length === 1 ? '' : 's'}
                </div>
                {g.best.lot_title && resultOf(g.best) > 0 && (
                  <div className="rec2-abest">
                    Top lot · {g.best.lot_title}
                    {g.best.year ? `, ${g.best.year}` : ''}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
