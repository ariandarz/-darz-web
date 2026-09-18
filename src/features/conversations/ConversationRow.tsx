/**
 * ConversationRow — one request as a list row: the artwork thumbnail (or the
 * chat glyph for the general conversation), the kind label, the work line,
 * the date, and on the right the same precedence the old app used
 * (`dzActRowHTML`, app.html:9492-9494): an unseen reply wins, else the status
 * pill with the amount beside it, else the amount alone. Same `.actli*`
 * classes, so it diffs 1:1.
 */
import { Link } from 'react-router-dom';
import { statusLabel, useOptions } from '../../api/hooks';
import type { Artwork, CollectorRequest } from '../../api/types';
import { primaryImage } from '../catalogue/format';
import { workLine } from '../requests/RequestController';
import { requestAmount, statusMeta } from '../requests/status';
import './conversations.css';
import { KIND_LABEL, shortDate } from './rows';

export function ConversationRow({
  request,
  artwork,
  to,
}: {
  request: CollectorRequest;
  /** the resolved artwork (undefined while loading, null when unavailable) */
  artwork: Artwork | null | undefined;
  to: string;
}) {
  const options = useOptions();
  const isMsg = request.kind === 'message';
  const unread = (request.unread_count || 0) > 0;
  const detail = (request.detail ?? {}) as { message?: string };
  // :9487 — the work line, falling back to "Artwork" when the id resolves to
  // nothing. A request with NO artwork at all (the artist enquiry, which the
  // backend cannot link to an artist — G-P5-11) has no work to name: its own
  // message stands below instead of a misleading "Artwork".
  const title = isMsg
    ? 'Chat with Darz'
    : !request.artwork
      ? null
      : artwork
        ? workLine(artwork)
        : artwork === null
          ? 'Artwork'
          : '…';
  const image = artwork ? primaryImage(artwork) : null;
  // a message is a conversation, not a request with a state (:9489)
  const meta = isMsg
    ? null
    : statusMeta(request, {
        fallbackLabel: statusLabel(options, request.kind, request.status),
      });
  const money = requestAmount(request);
  const amount = money ? (
    <span className="actli-amt">
      {money.amount}
      {money.currency ? <span>{money.currency}</span> : null}
    </span>
  ) : null;

  return (
    <Link to={to} className={`actli${unread ? ' actli--rep' : ''}`}>
      <span className="actli-th">
        {isMsg ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.2-5.5A8.4 8.4 0 1 1 21 11.5z" />
          </svg>
        ) : image ? (
          <img src={image} alt="" loading="lazy" />
        ) : null}
      </span>
      <span className="actli-b">
        <span className="actli-k">{KIND_LABEL[request.kind] ?? request.kind}</span>
        {title ? <span className="actli-t">{title}</span> : null}
        {!isMsg && detail.message ? (
          <span className="actli-t q">“{detail.message}”</span>
        ) : null}
        <span className="actli-d">{shortDate(request.created_at)}</span>
      </span>
      <span className="actli-r">
        <span className="actli-meta">
          {unread ? (
            <span className="actli-rep nw">New reply</span>
          ) : meta?.label ? (
            <>
              <span className={`actli-stat ${meta.pill}`}>{meta.label}</span>
              {amount}
            </>
          ) : (
            amount
          )}
        </span>
        {unread ? <span className="actli-dot" /> : <span className="actli-chev">›</span>}
      </span>
    </Link>
  );
}
