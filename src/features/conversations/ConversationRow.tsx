/**
 * ConversationRow — one request as a list row: the artwork thumbnail (or the
 * chat glyph for the general conversation), the kind label, the work line,
 * the date, and on the right the same precedence the old app used
 * (`dzActRowHTML`, app.html:9492-9494): an unseen reply wins, else the status
 * pill with the amount beside it, else the amount alone. Same `.actli*`
 * classes, so it diffs 1:1.
 *
 * The work comes off the row itself — the backend nests
 * `{id, title, artist, image}` on every collector request (G-P5-2) — so a list
 * of these costs no catalogue reads.
 */
import { Link } from 'react-router-dom';
import { statusLabel, useOptions } from '../../api/hooks';
import type { CollectorRequest } from '../../api/types';
import { workLine } from '../requests/RequestController';
import { requestAmount, statusMeta } from '../requests/status';
import './conversations.css';
import { KIND_LABEL, shortDate } from './rows';

export function ConversationRow({ request, to }: { request: CollectorRequest; to: string }) {
  const options = useOptions();
  const isMsg = request.kind === 'message';
  const unread = (request.unread_count || 0) > 0;
  const detail = (request.detail ?? {}) as { message?: string };
  const artwork = request.artwork;
  // :9487 — the work line, falling back to "Artwork" when it names nothing. A
  // request with NO artwork at all (the artist enquiry) has no work to name:
  // its own message stands below instead of a misleading "Artwork".
  const title = isMsg ? 'Chat with Darz' : artwork ? workLine(artwork) || 'Artwork' : null;
  const image = artwork?.image ?? null;
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
