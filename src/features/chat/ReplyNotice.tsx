/**
 * ReplyNotice — the floating "Darz has replied" card above the nav
 * (`#dzNotif`, app.html:2695-2699, `.dz-notif` :765-771). One tap opens the
 * request it belongs to; the × dismisses it until the next unseen reply.
 *
 * Shown for ANY request with an unseen team message, not only a conversation:
 * since step 3 every kind has a thread the collector can open.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConversations } from '../conversations/useConversations';
import './chat.css';

export function ReplyNotice() {
  const navigate = useNavigate();
  const { controller } = useConversations();
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const newest = controller.newestUnread();

  if (!newest || dismissed.has(newest.id)) return null;

  return (
    <button
      type="button"
      className="dz-notif show"
      onClick={() => navigate(`/chat/${newest.id}`)}
    >
      <span className="dz-notif-tx">
        <b>Darz has replied to your request.</b>
        <i>Tap here to view the message and continue.</i>
      </span>
      <span
        className="dz-notif-x"
        role="button"
        aria-label="Dismiss"
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(new Set([...dismissed, newest.id]));
        }}
      >
        ×
      </span>
    </button>
  );
}
