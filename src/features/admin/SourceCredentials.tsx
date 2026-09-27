/**
 * SourceCredentials — a portal sign-in shown ONCE: the ready-to-send link, the
 * PIN, and the covering message. One component for both moments a pair
 * exists in plaintext — issuing a new partner (Sources desk) and re-issuing
 * an existing one's credentials (Source detail, G-PORT-13) — so the two can
 * never say different things about the same secret.
 */
import { useState } from 'react';
import { ShownOnceSecret } from './kit';
import { invitationMessage, reminderMessage } from './galleryInvite';

export interface IssuedPair {
  id: string;
  name: string;
  token: string;
  pin: string;
  contactName: string;
}

export function IssuedCredentials({
  issued,
  onOpen,
  onDone,
}: {
  issued: IssuedPair;
  /** absent on the partner's own page, where "Open" would go nowhere */
  onOpen?: () => void;
  onDone: () => void;
}) {
  return (
    <>
      {/* Phase 14: the portal is live at /portal/:token — hand over the
          ready-to-send address, not just the raw key. */}
      <ShownOnceSecret
        label={`Portal link — ${issued.name}`}
        value={`${window.location.origin}/portal/${issued.token}`}
        hint="The partner's no-login portal address. Send it with the PIN below — the pair shows only this once."
      />
      <ShownOnceSecret label="Portal PIN" value={issued.pin} />
      {/* The two boxes above are the credentials; this is the message.
          Added 2026-09-19: an admin was otherwise writing the covering
          note from scratch for every partner, and this is the one moment
          the link exists to put in it. */}
      <InviteCard issued={issued} onOpen={onOpen} onDone={onDone} />
    </>
  );
}

/**
 * The covering message, ready to send. The credentials above are the
 * shown-once contract; this is what a partner actually receives — the old
 * panel kept it as a template rather than retyping it per partner
 * (`darz-studio.html:36197-36198`, ported in `galleryInvite.ts`).
 *
 * The textarea is editable and selectable, so a blocked clipboard is never a
 * dead end and an admin can adjust a line before sending.
 */
function InviteCard({
  issued,
  onOpen,
  onDone,
}: {
  issued: IssuedPair;
  onOpen?: () => void;
  onDone: () => void;
}) {
  const parts = {
    name: issued.name,
    contactName: issued.contactName,
    url: `${window.location.origin}/portal/${issued.token}`,
    pin: issued.pin,
  };
  const [kind, setKind] = useState<'invitation' | 'reminder'>('invitation');
  const [text, setText] = useState(() => invitationMessage(parts));
  const [copied, setCopied] = useState(false);

  const pick = (next: 'invitation' | 'reminder') => {
    setKind(next);
    setText(next === 'invitation' ? invitationMessage(parts) : reminderMessage(parts));
    setCopied(false);
  };

  return (
    <div className="ad-card ad-form ad-invite">
      <div className="ad-form-h">Send it to {issued.name}</div>
      <p className="ad-secret-hint">
        The link and code are already in the message. Copy it into WhatsApp, an email or a
        message — this is the only moment the link can be put in one.
      </p>
      <div className="ad-invite-kinds">
        <button
          type="button"
          className={`ad-rowbtn${kind === 'invitation' ? ' is-on' : ''}`}
          onClick={() => pick('invitation')}
        >
          Invitation
        </button>
        <button
          type="button"
          className={`ad-rowbtn${kind === 'reminder' ? ' is-on' : ''}`}
          onClick={() => pick('reminder')}
        >
          Reminder
        </button>
      </div>
      <textarea
        className="ad-invite-text"
        aria-label="The message to send"
        rows={14}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCopied(false);
        }}
      />
      <div className="ad-rowacts">
        <button
          type="button"
          className="ad-rowbtn is-primary"
          onClick={() =>
            void navigator.clipboard
              ?.writeText(text)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }
        >
          {copied ? 'Copied' : 'Copy the message'}
        </button>
        {onOpen && (
          <button type="button" className="ad-rowbtn" onClick={onOpen}>
            Open {issued.name} →
          </button>
        )}
        <button type="button" className="ad-rowbtn" onClick={onDone}>
          Done — I have sent it
        </button>
      </div>
    </div>
  );
}
