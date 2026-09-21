/**
 * Acquisitions — "Your acquisitions", the section above the activity list that
 * follows a purchase, an offer or a hold through its stages. Port of
 * `dzAcqSectionHTML` (app.html:9685-9703) and `dzMktRailHTML` (:9679-9684):
 * a card per request — thumbnail · "Artist — Title" · the kind's own label ·
 * the status pill — and under it the four-step rail Requested · In review ·
 * Accepted · Complete, or, once the request has ended, one quiet line with
 * the final word. Ten at most, as the original.
 *
 * The old app wrote this card with inline styles; the markup is the same, in
 * classes, so the rest of the app's skin applies (the rail's own `.aucrail` /
 * `.rstep` / `.rd` / `.rl` are the original names, app.html:1096-1104).
 *
 * A pill-less (just-filed) request shows **In review** here, not nothing —
 * `dzAcqSectionHTML`'s own fallback (:9697).
 */
import { Link } from 'react-router-dom';
import { statusLabel, useOptions } from '../../api/hooks';
import type { Artwork, CollectorRequest } from '../../api/types';
import { primaryImage } from '../catalogue/format';
import { workLine } from '../requests/RequestController';
import { MKT_RAIL, statusMeta } from '../requests/status';
import { ACQUISITION_LABEL, isAcquisition } from './acquisitionRows';
import './profile.css';

/** app.html:9692 — at most ten. */
const MAX = 10;

function Rail({ stage }: { stage: number }) {
  return (
    <span className="aucrail">
      {MKT_RAIL.map((step, i) => (
        <span key={step} className={`rstep${i < stage ? ' done' : i === stage ? ' now' : ''}`}>
          <span className="rd" />
          <span className="rl">{step}</span>
        </span>
      ))}
    </span>
  );
}

export function Acquisitions({
  requests,
  lookup,
  to,
}: {
  requests: CollectorRequest[];
  lookup: (id: string | null | undefined) => Artwork | null | undefined;
  to: (request: CollectorRequest) => string;
}) {
  const options = useOptions();
  const items = requests.filter(isAcquisition);
  if (items.length === 0) return null;

  return (
    <>
      <div className="prof-sech">
        <span className="t">Your acquisitions</span>
        <span className="c">{items.length}</span>
      </div>
      {items.slice(0, MAX).map((r) => {
        const meta = statusMeta(r, {
          fallbackLabel: statusLabel(options, r.kind, r.status),
        });
        const artwork = lookup(r.artwork);
        const image = artwork ? primaryImage(artwork) : null;
        const head = artwork ? workLine(artwork) : artwork === null ? 'A work' : '…';
        const ended = meta.stage < 0;

        return (
          <Link key={r.id} to={to(r)} className="acq">
            <span className="acq-top">
              <span className="acq-th">
                {image ? <img src={image} alt="" loading="lazy" /> : null}
              </span>
              <span className="acq-b">
                <span className="acq-t">{head}</span>
                <span className="acq-k">{ACQUISITION_LABEL[r.kind] ?? 'Request'}</span>
              </span>
              {/* :9697 — no pill only once it has ended; otherwise In review */}
              {meta.label ? (
                <span className={`actli-stat ${meta.pill}`}>{meta.label}</span>
              ) : ended ? null : (
                <span className="actli-stat s-rev">In review</span>
              )}
            </span>
            {ended ? (
              <span className="acq-end">{meta.label ?? 'Closed'}</span>
            ) : (
              <Rail stage={meta.stage} />
            )}
          </Link>
        );
      })}
    </>
  );
}
