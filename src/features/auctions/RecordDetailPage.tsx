/**
 * RecordDetailPage — `/records/:id`. One external auction-house result, in
 * the old `recordDetailView()` chrome (app.html:5112-5165, CSS :5078-5111):
 * the matted hero (whole work, never cropped), house eyebrow, artist,
 * "Title, year", the result moment (Final price realized / Estimate /
 * Status), the `.rec2-dl` specs — Medium · Size · Auction house · Sale date ·
 * Sale name · Lot · Estimate · Hammer price · Buyer's premium · Final price ·
 * Above high est. · Currency · Year · Source — the note blocks, the artist's
 * other lots ("Auction record history", up to 6) and the CTAs.
 *
 * Reads the record from the session archive when it is there (no second
 * request) and falls back to `GET /api/auctions/records/{id}/`.
 */
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { AuctionRecord } from '../../api/types';
import { formatMoney } from '../catalogue/format';
import { estimateLine, monogram, resultStatus, saleDateLabel } from '../records/recordFormat';
import { houseLabel, num, resultOf } from '../records/insights';
import { artistKeyOf, sortRecords } from '../records/RecordsArchiveController';
import '../records/records.css';
import { useRecordsArchive } from '../records/useRecordsArchive';
import './auctions.css';
import { useRecord } from './useAuctions';

export function RecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const archive = useRecordsArchive();
  const cached = archive.controller.byId(id!);
  const fetched = useRecord(id!);
  const record: AuctionRecord | null =
    cached ?? (fetched.status === 'ok' ? fetched.data : null);

  if (!record && fetched.status === 'loading') return <p className="dz-state">Loading…</p>;
  if (!record && fetched.status === 'error')
    return <p className="dz-state err">{fetched.error}</p>;
  if (!record) return null;

  const r = record;
  const artist = r.artist_display_name ?? r.artist_name_raw ?? 'Unattributed';
  const st = resultStatus(r);
  const cur = r.currency ?? '';
  const money = (v: string | number | null | undefined) =>
    num(v) ? `${formatMoney(num(v))}${cur ? ' ' + cur : ''}` : '';
  const hammer = num(r.hammer_amount);
  const realized = resultOf(r);
  const premium = hammer && realized > hammer ? realized - hammer : 0;
  const hi = num(r.high_estimate);
  const aboveHigh = st.kind === 'sold' && hi > 0 && realized > hi ? (realized - hi) / hi : 0;

  const moment =
    st.kind === 'sold'
      ? { lb: 'Final price realized', amt: money(realized), cls: '' }
      : st.kind === 'estimate'
        ? { lb: 'Estimate', amt: estimateLine(r) || 'On request', cls: '' }
        : { lb: 'Status', amt: st.label, cls: ' st' };

  const rows: Array<[string, string]> = (
    [
      ['Medium', r.medium],
      ['Size', r.dimensions],
      ['Auction house', houseLabel(r.house)],
      ['Sale date', saleDateLabel(r.sale_date, true)],
      ['Sale name', r.sale_name],
      ['Lot', r.lot_reference],
      ['Estimate', estimateLine(r)],
      ['Hammer price', hammer ? money(hammer) : ''],
      ['Buyer’s premium', premium ? `+ ${formatMoney(premium)}${cur ? ' ' + cur : ''}` : ''],
      st.kind === 'sold' ? ['Final price', money(realized)] : ['Result status', st.label],
      ['Above high est.', aboveHigh > 0 ? `+${Math.round(aboveHigh * 100)}%` : ''],
      ['Currency', cur],
      ['Year', r.year],
      ['Source', r.source_url && !/^https?:/i.test(r.source_url) ? r.source_url : ''],
    ] as Array<[string, string | null | undefined]>
  ).filter((x): x is [string, string] => Boolean(x[1]));

  const notes: Array<[string, string | null | undefined]> = [
    ['Provenance', r.provenance],
    ['Exhibition history', r.exhibition],
    ['Literature', r.literature],
    ['Auction-house note', r.house_notes],
    ['Notes', r.notes],
  ];

  const key = artistKeyOf(r);
  const others = sortRecords(
    archive.controller.forArtist(key).filter((x) => x.id !== r.id),
    'recent',
  ).slice(0, 6);
  const extUrl = /^https?:\/\//i.test(r.source_url ?? '') ? r.source_url : '';

  return (
    <div className="dz-page">
      <div className="rec2-dtop">
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
      <div className="rec2-dwrap">
        <div className="rec2-dhero">
          {r.image_url ? (
            <img src={r.image_url} alt={r.lot_title ?? ''} decoding="async" />
          ) : (
            <div className="ph">{monogram(artist)}</div>
          )}
        </div>
        <div>
          <div className="rec2-deyebrow">{houseLabel(r.house) || 'Auction record'}</div>
          <h1 className="rec2-dh1">{artist}</h1>
          <div className="rec2-dti">
            {r.lot_title || 'Untitled'}
            {r.year ? `, ${r.year}` : ''}
          </div>
          <div className="rec2-moment">
            <span className="lb">{moment.lb}</span>
            <span className={`amt${moment.cls}`}>{moment.amt}</span>
          </div>
          <dl className="rec2-dl">
            {rows.map(([k, v]) => (
              <div className="r" key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {notes
            .filter(([, v]) => Boolean(v))
            .map(([k, v]) => (
              <div className="rec2-prov" key={k}>
                <div className="rec2-deyebrow">{k}</div>
                <p>{v}</p>
              </div>
            ))}
          {others.length > 0 && (
            <div className="rec2-hist">
              <div className="hh">Auction record history</div>
              {others.map((x) => {
                const xs = resultStatus(x);
                return (
                  <Link key={x.id} to={`/records/${x.id}`} className="rec2-hrow">
                    <span>
                      {x.lot_title || 'Untitled'}{' '}
                      <span className="hy">{x.year || saleDateLabel(x.sale_date)}</span>
                    </span>
                    <span className="hp">
                      {xs.kind === 'sold' ? formatMoney(resultOf(x)) : xs.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
          <div className="rec2-cta">
            {extUrl && (
              <a href={extUrl} target="_blank" rel="noopener">
                View on {houseLabel(r.house) || 'the auction website'}
              </a>
            )}
            <Link to={`/records/artist/${encodeURIComponent(key)}`}>All {artist} records</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
