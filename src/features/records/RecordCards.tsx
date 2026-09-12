/**
 * The two ways one record renders in a list — `recCard` (app.html:4976-4988)
 * and `recRow` (:4989-4999) — plus the status-driven price block
 * (`_priceBlock`, :4971-4975): "Sold" only with a real price, "Estimate" for
 * an estimate-only lot, otherwise the status label with the estimate small.
 * Same class names. The image shows the whole work, never cropped.
 */
import { Link } from 'react-router-dom';
import type { AuctionRecord } from '../../api/types';
import { formatMoney } from '../catalogue/format';
import { houseLabel, resultOf } from './insights';
import { estimateLine, monogram, resultStatus, saleDateLabel } from './recordFormat';
import './records.css';

function PriceBlock({ r }: { r: AuctionRecord }) {
  const st = resultStatus(r);
  const est = estimateLine(r);
  if (st.kind === 'sold')
    return (
      <>
        <div className="rec2-pl">Result</div>
        <div className="rec2-price">
          {formatMoney(resultOf(r))} <span className="c">{r.currency ?? ''}</span>
        </div>
      </>
    );
  if (st.kind === 'estimate')
    return (
      <>
        <div className="rec2-pl">Estimate</div>
        <div className="rec2-price">{est || 'On request'}</div>
      </>
    );
  return (
    <>
      <div className="rec2-pl">Result</div>
      <div className="rec2-statuslab">{st.label}</div>
      {est && <div className="rec2-estsm">est {est}</div>}
    </>
  );
}

export function RecordCard({ r }: { r: AuctionRecord }) {
  const artist = r.artist_display_name ?? r.artist_name_raw ?? 'Unattributed';
  const foot = [r.lot_reference].filter(Boolean);
  return (
    <Link to={`/records/${r.id}`} className="rec2-c">
      <div className="rec2-im">
        {r.image_url ? (
          <img src={r.image_url} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className="rec2-ph">
            <div className="m">{monogram(artist)}</div>
          </div>
        )}
      </div>
      <div className="rec2-b">
        <div className="rec2-meta">
          <span className="h">{houseLabel(r.house)}</span>
          {r.sale_date && <span className="d">{saleDateLabel(r.sale_date)}</span>}
        </div>
        <div className="rec2-ar">{artist}</div>
        <div className="rec2-ti">
          {r.lot_title || 'Untitled'}
          {r.year ? `, ${r.year}` : ''}
        </div>
        <div className="rec2-line" />
        <PriceBlock r={r} />
        {(foot.length > 0 || r.sale_name) && (
          <div className="rec2-cfoot">
            <span>{foot.join(' · ')}</span>
            {r.sale_name && <span className="sn">{r.sale_name}</span>}
          </div>
        )}
      </div>
    </Link>
  );
}

export function RecordRow({ r }: { r: AuctionRecord }) {
  const artist = r.artist_display_name ?? r.artist_name_raw ?? 'Unattributed';
  const st = resultStatus(r);
  const est = estimateLine(r);
  return (
    <Link to={`/records/${r.id}`} className="rec2-row">
      <div className="rec2-rimg">
        {r.image_url ? (
          <img src={r.image_url} alt="" loading="lazy" />
        ) : (
          <span>{monogram(artist)}</span>
        )}
      </div>
      <div className="rec2-rmain">
        <div className="rec2-ran">{artist}</div>
        <div className="rec2-rti">
          {r.lot_title || 'Untitled'}
          {r.year ? `, ${r.year}` : ''}
        </div>
        <div className="rec2-rmeta">
          {houseLabel(r.house)}
          {r.sale_date ? ` · ${saleDateLabel(r.sale_date)}` : ''}
        </div>
      </div>
      <div className="rec2-rright">
        {st.kind === 'sold' ? (
          <>
            <div className="rec2-rprice">
              {formatMoney(resultOf(r))} <span className="c">{r.currency ?? ''}</span>
            </div>
            <div className="rec2-rlab">Result</div>
          </>
        ) : st.kind === 'estimate' ? (
          <>
            <div className="rec2-rprice">{est || 'On request'}</div>
            <div className="rec2-rlab">Estimate</div>
          </>
        ) : (
          <>
            <div className="rec2-rstatus">{st.label}</div>
            {est && <div className="rec2-rlab">est {est}</div>}
          </>
        )}
      </div>
    </Link>
  );
}
