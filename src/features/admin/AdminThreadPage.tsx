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
 *
 * **Phase 6 — two additions over the old pane.**
 *  - **Archive / restore one message (G-CHAT-2).** The old pane put its
 *    per-bubble actions in a quiet text row under the timestamp ("Edit" ·
 *    "Delete" on Darz's own bubbles, `_chatBubble` `:40341`); Archive/Restore
 *    sits in the same row, on every bubble — the archive is the desk's own
 *    hide and never touches the collector's thread. An archived bubble, shown,
 *    says so beside its time the way an edited one did (" · edited",
 *    `:40342`). The "Include archived" switch re-reads the thread with
 *    `?include_archived=true`. The old equivalent was the panel-wide renewal
 *    cutoff (`chatArchiveNow`, `:40258`: "Messages are hidden from the active
 *    chat (not deleted …)"), so the per-message control and the switch's
 *    label have no old copy (flagged).
 *  - **Attach a document (D19 `document_refs`).** The old composer had no
 *    attach — the owner's workaround was to copy a document's link into the
 *    message. `DocumentAttach` picks one of this collector's documents (or an
 *    unissued one) of a collector-visible kind; sending it SHARES it with the
 *    collector (backend: attach = share). Its label and copy are new
 *    (flagged); the chip it leaves on the bubble reads kind · title and opens
 *    the document's page.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import type { AdminRequest, DocumentAdmin, RequestMessage } from '../../api/types';
import { AdminThreadController } from './AdminThreadController';
import { DocumentAttach } from './DocumentAttach';
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
  const [attached, setAttached] = useState<DocumentAdmin | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [withArchived, setWithArchived] = useState(false);
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
    const attach = attached ? { documentRefs: [attached.id] } : {};
    if (await controller.send(draft, attach)) {
      setDraft('');
      setAttached(null);
      setSentAt(Date.now());
    }
  };

  const archive = async (m: RequestMessage) => {
    if (archiving) return;
    setArchiving(m.id);
    await controller.archive(m.id, !m.archived);
    setArchiving(null);
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
        <label className="ad-actck ad-thread-arch">
          <input
            type="checkbox"
            checked={withArchived}
            onChange={(e) => {
              setWithArchived(e.target.checked);
              void controller.setIncludeArchived(e.target.checked);
            }}
          />
          Include archived
        </label>
      </div>

      {snap.status === 'loading' && snap.messages.length === 0 && (
        <p className="dz-state">Loading…</p>
      )}
      {snap.error && <DeskBanner>{snap.error}</DeskBanner>}

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
            snap.messages.map((m) => (
              <Bubble
                key={m.id}
                m={m}
                busy={archiving === m.id}
                onArchive={() => void archive(m)}
              />
            ))
          )}
          <div ref={endRef} />
        </div>
      )}

      <DocumentAttach
        collectorId={fromList?.collector?.id ?? null}
        picked={attached}
        onPick={setAttached}
      />
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

function Bubble({
  m,
  busy,
  onArchive,
}: {
  m: RequestMessage;
  busy: boolean;
  onArchive: () => void;
}) {
  const docs = m.document_refs ?? [];
  return (
    <div
      className={`ad-bub${m.sender === 'team' ? ' is-team' : ''}${m.archived ? ' is-archived' : ''}`}
    >
      <div className="ad-bub-b">{m.body}</div>
      {docs.length > 0 && (
        <div className="ad-bub-docs">
          {docs.map((d) => (
            <Link key={d.id} to={`/admin/documents/${d.id}`} className="ad-docchip">
              <span className="ad-docchip-k">{d.kind.replace(/_/g, ' ')}</span>
              <span className="ad-docchip-t">{d.title || 'Untitled'}</span>
            </Link>
          ))}
        </div>
      )}
      <div className="ad-bub-t">
        {new Date(m.created_at).toLocaleString('en-GB', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })}
        {m.archived ? ' · archived' : ''}
        {/* the old bubble's quiet action row (:40341) */}
        <button type="button" className="ad-bub-act" disabled={busy} onClick={onArchive}>
          {m.archived ? 'Restore' : 'Archive'}
        </button>
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
