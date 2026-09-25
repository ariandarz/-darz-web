/**
 * ThreadPage — `/chat/:id`. One request with Darz, in two shapes over the
 * same thread (owner decision D10, 2026-09-17: the route, not a sheet):
 *
 *   - a **conversation** (the general Chat, or an artwork inquiry) keeps the
 *     v0.1 chat presentation — the artwork card and the bubbles;
 *   - every **other kind** (purchase · hold · offer · viewing · price, and an
 *     enquiry with no artwork) opens the old app's request card instead —
 *     `RequestDetail`, ported from `DZ.actOpen` (app.html:11265-11318) — over
 *     the identical thread and composer, so a reply round-trips the same way
 *     whatever the collector asked for.
 *
 * The request's own message lives in `request.detail.message` (not a
 * `RequestMessage`), so it opens the thread as the collector's first bubble
 * at the request's own timestamp — the context is never lost.
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { RequestMessage } from '../../api/types';
import { formatMoney, primaryImage } from '../catalogue/format';
import { useArtworks } from '../catalogue/useArtworkCache';
import { useConversations, useThread } from '../conversations/useConversations';
import { KIND_LABEL } from '../conversations/rows';
import { workLine } from '../requests/RequestController';
import '../catalogue/catalogue.css';
import '../requests/requests.css'; // `.actsh-btn`
import './chat.css';
import { RequestDetail } from './RequestDetail';

function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { controller: conversations } = useConversations();
  const request = conversations.byId(id!);
  // A cold deep link reads its one request (G-P5-3) rather than waiting for
  // the whole list; a no-op once the list already holds it.
  useEffect(() => {
    if (id) void conversations.open(id);
  }, [conversations, id]);
  const thread = useThread(id!);
  // The row nests the work's id/title/artist/image (G-P5-2); the request card
  // also shows year and medium, so the full artwork still comes from the cache.
  const lookup = useArtworks([request?.artwork?.id]);
  const artwork = lookup(request?.artwork?.id);
  const [draft, setDraft] = useState('');
  const [removing, setRemoving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // keep the newest message in view, like the old sheet (scrollTop = scrollHeight)
    const main = scrollRef.current?.closest('main');
    if (main) main.scrollTop = main.scrollHeight;
  }, [thread.messages.length]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const ok = await thread.controller.send(draft);
    if (ok) {
      setDraft('');
      if (areaRef.current) areaRef.current.style.height = '';
    }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // app.html `DZ.chatKey`: Enter sends, Shift+Enter breaks the line
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };
  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  };

  if (!request && !conversations.isMissing(id!)) return <p className="dz-state">Loading…</p>;
  if (!request) return <p className="dz-state">This conversation is not available.</p>;

  const isInquiry = request.kind === 'information' && !!request.artwork;
  // the two shapes: a conversation, or the old app's request card
  const isConversation = request.kind === 'message' || isInquiry;
  const detail = (request.detail ?? {}) as { message?: string };
  const opening: RequestMessage | null = detail.message
    ? {
        id: `opening-${request.id}`,
        request: request.id,
        sender: 'collector',
        body: detail.message,
        artwork_refs: [],
        document_refs: [],
        seen_by_collector: true,
        seen_by_team: true,
        archived: false,
        created_at: request.created_at,
      }
    : null;
  const bubbles = opening ? [opening, ...thread.messages] : thread.messages;
  const hasReply = thread.messages.some((m) => m.sender === 'team');

  return (
    <div className="dz-page dz-chatpage" ref={scrollRef}>
      <div className="dz-chathead">
        <button
          type="button"
          className="dz-back"
          onClick={() => navigate(isConversation ? '/chat' : '/profile?tab=market')}
        >
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
          <span>{isConversation ? 'Chat' : 'Back'}</span>
        </button>
        {/* :11274 — a request is headed by its own kind */}
        <h3>
          {isConversation
            ? isInquiry
              ? 'Inquiry'
              : 'Chat with Darz'
            : (KIND_LABEL[request.kind] ?? request.kind)}
        </h3>
      </div>

      {!isConversation && (
        <RequestDetail request={request} artwork={artwork} hasReply={hasReply} />
      )}

      {isInquiry &&
        (artwork ? (
          <Link to={`/artwork/${artwork.id}`} className="dz-chatart-card">
            {primaryImage(artwork) ? (
              <img className="th" src={primaryImage(artwork)!} alt="" />
            ) : (
              <span className="th" />
            )}
            <span className="in">
              <span className="ar">{artwork.artist?.display_name ?? 'Unknown artist'}</span>
              <span className="ti">
                {artwork.title || 'Untitled'}
                {artwork.year ? `, ${artwork.year}` : ''}
              </span>
              <span className="pr">
                {artwork.price_type === 'on_request' || !artwork.price_amount
                  ? 'Price on request'
                  : `${artwork.currency} ${formatMoney(artwork.price_amount)}`}
              </span>
            </span>
          </Link>
        ) : artwork === null ? (
          <div className="dz-chatart-card">
            <span className="in">
              <span className="ar">This work is no longer listed.</span>
            </span>
          </div>
        ) : null)}

      <div className="dz-chatscroll">
        {thread.status === 'error' && bubbles.length === 0 && (
          <p className="dz-state err">{thread.error}</p>
        )}
        <div className="dz-thread">
          {bubbles.map((m) => (
            <div key={m.id} className={`dz-bub ${m.sender === 'collector' ? 'me' : 'darz'}`}>
              <div className="who">{m.sender === 'collector' ? 'You' : 'Darz'}</div>
              {m.body}
              <div className="tm">{stamp(m.created_at)}</div>
            </div>
          ))}
          {thread.status === 'ready' && bubbles.length === 0 && isConversation && (
            <p className="dz-thread-note">
              {isInquiry ? workLine(artwork ?? { artist: null, title: '' }) : 'Write to Darz.'}
            </p>
          )}
          {thread.status === 'ready' && bubbles.length > 0 && !hasReply && isConversation && (
            <p className="dz-thread-note">Darz will reply here.</p>
          )}
        </div>
      </div>

      <form className="dz-threadwrap" onSubmit={(e) => void send(e)}>
        <div className="dz-threadform">
          <textarea
            ref={areaRef}
            rows={1}
            placeholder="Write to Darz…"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              grow(e.target);
              thread.controller.clearSendError();
            }}
            onKeyDown={onKey}
            aria-label="Your message"
          />
          <button
            type="submit"
            className="dz-threadsend"
            disabled={thread.sending || !draft.trim()}
            aria-busy={thread.sending || undefined}
            aria-label="Send"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div className={`dz-threadout${thread.sendError ? ' err' : ''}`}>
          {thread.sendError ?? (thread.sending ? 'Sending…' : '')}
        </div>
      </form>

      {!isConversation && (
        <div className="actsh-act">
          {removing ? (
            /* :11333-11340 — the confirm replaces the row in place. The old
               copy ended "This can't be undone."; the hide is this session's
               view only (G-P5-4), so it says what actually happens. */
            <div className="actsh-confirm">
              <b>Remove this from your activity?</b>
              <i>
                It goes from your profile for now. Darz keeps its own record, and it returns
                when you reload.
              </i>
              <button
                type="button"
                className="actsh-btn danger"
                onClick={() => {
                  conversations.hide(request.id);
                  navigate('/profile?tab=market');
                }}
              >
                Remove
              </button>
              <button type="button" className="actsh-btn" onClick={() => setRemoving(false)}>
                Keep
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="actsh-btn danger"
              onClick={() => setRemoving(true)}
            >
              Remove from activity
            </button>
          )}
          <button
            type="button"
            className="actsh-btn"
            onClick={() => navigate('/profile?tab=market')}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
