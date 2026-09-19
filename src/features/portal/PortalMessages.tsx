/**
 * PortalMessages — the Q&A thread with Darz (gallery-update.html:1070-1088).
 * `portal_state` embeds the whole thread; sends go to
 * `POST /gallery/portal/{token}/messages/` and the state re-reads. Senders
 * are the server's own vocabulary — `admin` renders as the old page's
 * "Darz" bubble, `portal` as "You".
 */
import { useEffect, useRef, useState, useSyncExternalStore, useCallback } from 'react';
import type { PortalSession } from './PortalSession';
import { fmtDateTime } from './portalForm';

export function PortalMessages({
  session,
  notify,
}: {
  session: PortalSession;
  notify: (m: string) => void;
}) {
  const state = useSyncExternalStore(
    useCallback((fn) => session.subscribe(fn), [session]),
    () => session.getSnapshot(),
  );
  const msgs = state.data?.messages ?? [];
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // keep the newest message in view, the old page's scroll (:1078)
    threadRef.current?.scrollTo(0, threadRef.current.scrollHeight);
  }, [msgs.length]);

  const send = async () => {
    const text = body.trim();
    if (!text) {
      notify('Write a message first.');
      return;
    }
    setBusy(true);
    try {
      await session.sendMessage(text);
      setBody('');
      await session.reload();
      notify('Sent to Darz.');
    } catch (err) {
      if (!session.noteAuthFailure(err)) notify('Could not send. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="sec-note">
        Questions and answers between you and Darz. Darz may ask here if something needs
        confirming.
      </div>
      {msgs.length ? (
        <div className="msg-thread" ref={threadRef}>
          {msgs.map((m) => (
            <div className={`msg ${m.sender === 'portal' ? 'gallery' : 'darz'}`} key={m.id}>
              <div className="who">{m.sender === 'portal' ? 'You' : 'Darz'}</div>
              {m.body}
              <div className="tm">{fmtDateTime(m.created_at)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="msg-empty">No messages yet. Send Darz a note any time.</div>
      )}
      <div className="msg-box">
        <textarea
          placeholder="Write a message to Darz…"
          aria-label="Message to Darz"
          value={body}
          disabled={busy}
          onChange={(e) => setBody(e.target.value)}
        />
        <button
          className="btn btn--primary"
          type="button"
          disabled={busy}
          onClick={() => void send()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
