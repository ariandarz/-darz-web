/**
 * RecordDetailPage — `/records/:id`. One external auction-house result, all
 * fields the backend `AuctionRecord` carries. Chrome reuses the shared
 * `.detail` shell (back bar + `.dbody` + `.fields`), matching the catalogue /
 * lot detail pages.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { formatMoney } from '../catalogue/format';
import './auctions.css';
import { useRecord } from './useAuctions';

export function RecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { status, data: record, error } = useRecord(id!);

  if (status === 'loading') return <p className="dz-state">Loading…</p>;
  if (status === 'error') return <p className="dz-state err">{error}</p>;
  if (!record) return null;

  const rows: Array<[string, string]> = (
    [
      ['House', record.house],
      [
        'Sale date',
        record.sale_date
          ? new Date(record.sale_date).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          : '',
      ],
      [
        'Price realised',
        record.price_amount
          ? `${formatMoney(record.price_amount)} ${record.currency ?? ''}`
          : '',
      ],
      ['Lot reference', record.lot_reference ?? ''],
    ] as Array<[string, string]>
  ).filter(([, v]) => Boolean(v));

  return (
    <div className="dz-page detail dtpl-A">
      <div className="dtop">
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

      <div className="dbody">
        <div className="eyebrow">Auction result</div>
        <h1>{record.artist_display_name ?? 'Unattributed'}</h1>
        {record.lot_title && <p className="sub">{record.lot_title}</p>}

        {rows.length > 0 && (
          <div className="fields">
            {rows.map(([k, v]) => (
              <div className="frow" key={k}>
                <span className="k">{k}</span>
                <span className="v">{v}</span>
              </div>
            ))}
          </div>
        )}

        {record.notes && (
          <>
            <p className="about-l">Notes</p>
            <p className="about">{record.notes}</p>
          </>
        )}

        {record.source_url && (
          <p style={{ marginTop: 14 }}>
            <a
              href={record.source_url}
              target="_blank"
              rel="noreferrer"
              className="auc-live-hint"
            >
              View the source listing ↗
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
