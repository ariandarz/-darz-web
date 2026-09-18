/**
 * RequestDetail — the blocks the old app's request card opened with
 * (`DZ.actOpen`, app.html:11265-11318), for the kinds that are a request
 * rather than a conversation: the kind as the heading, the work it is about,
 * the **Current status** banner, the meta rows, and — when Darz has not
 * written yet — the per-kind line that says what happens next.
 *
 * The thread and its composer are NOT here: `ThreadPage` renders the same
 * ones every conversation uses, so a reply round-trips identically whatever
 * the collector asked for.
 *
 * Two blocks of the original are deliberately absent. The old app had a
 * separate "headline reply" channel (`request_replies`, `.actsh-rep`) beside
 * the thread; this backend has one thread, so Darz's reply is a bubble like
 * any other. And `dzReplyCtaHTML`'s "Continue on WhatsApp" needs the
 * gallery's number, which no endpoint publishes (the design-pass flag in
 * `docs/API_INTEGRATION_GAPS.md`).
 */
import { Link } from 'react-router-dom';
import { statusLabel, useOptions } from '../../api/hooks';
import type { Artwork, CollectorRequest } from '../../api/types';
import { primaryImage } from '../catalogue/format';
import { KIND_LABEL } from '../conversations/rows';
import { holdExpiry, requestAmount, statusMeta } from '../requests/status';
import './chat.css';

/** app.html:11288 — `new Date(ts).toLocaleString()`. */
function fullStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RequestDetail({
  request,
  artwork,
  hasReply,
}: {
  request: CollectorRequest;
  artwork: Artwork | null | undefined;
  /** true once Darz has written on the thread — the note gives way to it */
  hasReply: boolean;
}) {
  const options = useOptions();
  const meta = statusMeta(request, {
    fallbackLabel: statusLabel(options, request.kind, request.status),
  });
  const label = KIND_LABEL[request.kind] ?? request.kind;
  const money = requestAmount(request);
  const expiry = holdExpiry(request);
  const detail = (request.detail ?? {}) as { message?: string };

  return (
    <>
      {/* :11276 — the work the request is about */}
      {request.artwork ? (
        <div className="actsh-art">
          {artwork && primaryImage(artwork) ? (
            <div className="actsh-img">
              <img src={primaryImage(artwork)!} alt="" />
            </div>
          ) : (
            <div className="actsh-img" />
          )}
          <div className="actsh-artb">
            <div className="actsh-artt">
              {artwork
                ? [artwork.artist?.display_name, artwork.title].filter(Boolean).join(' — ') ||
                  'Artwork'
                : artwork === null
                  ? 'This work is no longer listed.'
                  : '…'}
            </div>
            {artwork && (artwork.year || artwork.medium) ? (
              <div className="actsh-arts">
                {[artwork.year, artwork.medium].filter(Boolean).join(' · ')}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* :11281 — the workflow state Darz set, or the pre-reply wording */}
      <div className="actsh-stat">
        <span className="l">Current status</span>
        <span className={`v ${meta.label ? meta.pill : ''}`}>
          {meta.label ?? 'Submitted — awaiting Darz'}
        </span>
      </div>

      <div className="actsh-rows">
        <div className="actsh-row">
          <span className="k">Request</span>
          <span className="v">{label}</span>
        </div>
        {money ? (
          <div className="actsh-row">
            <span className="k">Amount</span>
            <span className="v">
              {money.amount}
              {money.currency ? ` ${money.currency}` : ''}
            </span>
          </div>
        ) : null}
        {/* not in the old app, which had no hold timer: the backend sets a
            48 h `expires_at` on every hold, so the collector is told when it
            runs out (owner decision D11). */}
        {expiry ? (
          <div className="actsh-row">
            <span className="k">{expiry.expired ? 'Held until' : 'Held until'}</span>
            <span className="v">{fullStamp(expiry.at.toISOString())}</span>
          </div>
        ) : null}
        <div className="actsh-row last">
          <span className="k">When</span>
          <span className="v">{fullStamp(request.created_at)}</span>
        </div>
      </div>

      {/* :11298 — with no reply yet, the per-kind line stands in for one */}
      {!hasReply && <div className="actsh-none">{meta.note}</div>}

      {/* the request's own message, when it carried one */}
      {!hasReply && detail.message ? (
        <div className="actsh-mine">“{detail.message}”</div>
      ) : null}

      {request.artwork && artwork ? (
        <Link to={`/artwork/${artwork.id}`} className="actsh-btn actsh-view">
          View artwork
        </Link>
      ) : null}
    </>
  );
}
