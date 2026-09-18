/**
 * AdminThreadPage — `/admin/chat/:id`, one conversation, the team writing.
 * The old panel's conversation detail pane (`_chatDetail`,
 * `darz-studio.html:40454-40470`): "← All" back to the list, the collector's
 * name over the thread, the bubbles, and the composer. Copy ported verbatim
 * where the old pane had it:
 *  - empty thread: "No messages yet. Write below to start the conversation."
 *    (`:40457`)
 *  - composer placeholder: "Write a message to {name}…" (`:40458`'s field)
 *  - the sent toast: "Sent to the collector ✓" (`chatSend`, `:40546`) — here a
 *    quiet inline confirmation rather than a floating toast, same words.
 *
 * The machine is `AdminThreadController` (the shared `MessageThreadController`
 * bound to the admin endpoints); opening the thread marks the collector's
 * messages seen exactly as `_chatSeen` did (`:40547`).
 *
 * **The header's collector/context line rides in on router state from the
 * list.** There is no `GET /api/crm/admin/requests/{id}/` — the unified list
 * is the only admin read of a request — so a hard refresh or a pasted link
 * has nothing to name the collector with and the header says "Conversation"
 * until the list is visited. Recorded as **G-CHAT-1** in
 * `docs/ADMIN_ARCHITECTURE.md` §2 rather than papered over with an unbounded
 * page-through of the list. The thread itself is complete either way.
 *
 * Mode/status/assignee/Clear from the old pane are not ported — no backend;
 * see `AdminChatPage`'s header for the full list.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import type { AdminRequest, RequestMessage } from '../../api/types';
import { AdminThreadController } from './AdminThreadController';
import { DeskBanner } from './kit';
import './admin.css';

export function AdminThreadPage() {
  const { id = '' } = useParams();
  const { crm } = useApi();
  // the list passes its row so the header can name the collector (see above)
  const fromList = (useLocation().state ?? null) as AdminRequest | null;

  const [controller] = useState(() => new AdminThreadController(crm, id));
  const [sentAt, setSentAt] = useState(0);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  const snap = useThread(controller);

  // keep the newest message on screen, the way the old pane pinned its scroll
  // (`chatView`, :40534: `th.scrollTop = th.scrollHeight`)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [snap.messages.length]);

  const name = fromList?.collector?.display_name || 'Conversation';
  const context = fromList ? contextLine(fromList) : null;

  const send = async () => {
    if (await controller.send(draft)) {
      setDraft('');
      setSentAt(Date.now());
    }
  };

  return (
    <div className="dz-page ad-page ad-thread">
      <div className="ad-thread-head">
        {/* :40456 — the old pane's own back label */}
        <Link to="/admin/chat" className="ad-back">
          ← All
        </Link>
        <div className="ad-thread-who">
          <div className="ad-thread-name">{name}</div>
          {context && <div className="ad-thread-sub">{context}</div>}
        </div>
      </div>

      {snap.status === 'loading' && snap.messages.length === 0 && (
        <p className="dz-state">Loading…</p>
      )}
      {snap.status === 'error' && <DeskBanner>{snap.error}</DeskBanner>}

      {snap.status === 'ready' && (
        <div className="ad-card ad-bubbles">
          {snap.messages.length === 0 ? (
            /* :40457, verbatim */
            <p className="ad-thread-empty">
              No messages yet.
              <br />
              Write below to start the conversation.
            </p>
          ) : (
            snap.messages.map((m) => <Bubble key={m.id} m={m} />)
          )}
          <div ref={endRef} />
        </div>
      )}

      <div className="ad-composer">
        <textarea
          className="ad-composer-in"
          rows={2}
          placeholder={`Write a message to ${name}…`}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            controller.clearSendError();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="button"
          className="ad-action"
          disabled={snap.sending || !draft.trim()}
          onClick={() => void send()}
        >
          Send
        </button>
      </div>
      {snap.sendError && <DeskBanner>{snap.sendError}</DeskBanner>}
      {sentAt > 0 && !snap.sendError && (
        /* chatSend's own words (:40546), as a quiet line under the composer */
        <p className="ad-sent" key={sentAt}>
          Sent to the collector ✓
        </p>
      )}
    </div>
  );
}

function Bubble({ m }: { m: RequestMessage }) {
  return (
    <div className={`ad-bub${m.sender === 'team' ? ' is-team' : ''}`}>
      <div className="ad-bub-b">{m.body}</div>
      <div className="ad-bub-t">
        {new Date(m.created_at).toLocaleString('en-GB', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })}
      </div>
    </div>
  );
}

function contextLine(r: AdminRequest): string {
  if (r.kind === 'message') return 'Chat with Darz';
  const art = r.artwork
    ? r.artwork.artist
      ? `${r.artwork.artist.display_name} — ${r.artwork.title}`
      : r.artwork.title
    : '';
  const kind = r.kind.charAt(0).toUpperCase() + r.kind.slice(1).replace(/_/g, ' ');
  return [kind, art].filter(Boolean).join(' · ');
}

/** Subscribe to the controller — the same seam `useListController` uses. */
function useThread(controller: AdminThreadController) {
  const [snap, setSnap] = useState(controller.getSnapshot());
  useEffect(() => controller.subscribe(() => setSnap(controller.getSnapshot())), [controller]);
  return snap;
}
