/**
 * ConversationRow — one request as a list row: the artwork thumbnail (or the
 * chat glyph for the general conversation), the kind label, the work line,
 * the date, and on the right either "New reply" or the status pill. Port of
 * `dzActRowHTML` (app.html:9482-9506), with the same `.actli*` classes.
 */
import { Link } from 'react-router-dom';
import { statusLabel, useOptions } from '../../api/hooks';
import type { Artwork, CollectorRequest } from '../../api/types';
import { primaryImage } from '../catalogue/format';
import { workLine } from '../requests/RequestController';
import './conversations.css';
import { KIND_LABEL, shortDate, statusClass } from './rows';

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
  const title = isMsg
    ? 'Chat with Darz'
    : artwork
      ? workLine(artwork)
      : artwork === null
        ? 'Artwork'
        : '…';
  const image = artwork ? primaryImage(artwork) : null;

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
        <span className="actli-t">{title}</span>
        {!isMsg && detail.message ? (
          <span className="actli-t q">“{detail.message}”</span>
        ) : null}
        <span className="actli-d">{shortDate(request.created_at)}</span>
      </span>
      <span className="actli-r">
        <span className="actli-meta">
          {unread ? (
            <span className="actli-rep nw">New reply</span>
          ) : (
            <span className={`actli-stat ${statusClass(request.status)}`}>
              {statusLabel(options, request.kind, request.status)}
            </span>
          )}
        </span>
        {unread ? <span className="actli-dot" /> : <span className="actli-chev">›</span>}
      </span>
    </Link>
  );
}
