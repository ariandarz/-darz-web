/**
 * ThreadPage — `/chat/:id`. One conversation with Darz: the artwork it is
 * about (for an inquiry), the bubbles, and the compose pill. Port of the old
 * chat sheet (`DZ.chatOpen`, app.html:11572-11610) and its bubbles
 * (`dzThreadBubbleHTML`, :7250) over the backend's `RequestMessage` thread.
 *
 * The inquiry's own message lives in `request.detail.message` (not a
 * `RequestMessage`), so it opens the thread as the collector's first bubble
 * at the request's own timestamp — the artwork context is never lost.
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { RequestMessage } from '../../api/types';
import { formatMoney, primaryImage } from '../catalogue/format';
import { useArtworks } from '../catalogue/useArtworkCache';
import { useConversations, useThread } from '../conversations/useConversations';
import { workLine } from '../requests/RequestController';
import '../catalogue/catalogue.css';
import './chat.css';

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
  const { controller: conversations, status: listStatus } = useConversations();
  const request = conversations.byId(id!);
  const thread = useThread(id!);
  const lookup = useArtworks([request?.artwork]);
  const artwork = lookup(request?.artwork);
  const [draft, setDraft] = useState('');
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

  if (!request && listStatus !== 'ready') return <p className="dz-state">Loading…</p>;
  if (!request) return <p className="dz-state">This conversation is not available.</p>;

  const isInquiry = request.kind === 'information' && !!request.artwork;
  const detail = (request.detail ?? {}) as { message?: string };
  const opening: RequestMessage | null =
    isInquiry && detail.message
      ? {
          id: `opening-${request.id}`,
          request: request.id,
          sender: 'collector',
          body: detail.message,
          artwork_refs: [],
          seen_by_collector: true,
          seen_by_team: true,
          created_at: request.created_at,
        }
      : null;
  const bubbles = opening ? [opening, ...thread.messages] : thread.messages;

  return (
    <div className="dz-page dz-chatpage" ref={scrollRef}>
      <div className="dz-chathead">
        <button type="button" className="dz-back" onClick={() => navigate('/chat')}>
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
          <span>Chat</span>
        </button>
        <h3>{isInquiry ? 'Inquiry' : 'Chat with Darz'}</h3>
      </div>

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
          {thread.status === 'ready' && bubbles.length === 0 && (
            <p className="dz-thread-note">
              {isInquiry ? workLine(artwork ?? { artist: null, title: '' }) : 'Write to Darz.'}
            </p>
          )}
          {thread.status === 'ready' &&
            bubbles.length > 0 &&
            !thread.messages.some((m) => m.sender === 'team') && (
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
    </div>
  );
}
