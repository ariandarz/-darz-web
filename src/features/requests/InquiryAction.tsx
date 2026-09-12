/**
 * InquiryAction — the v0.1 artwork-detail action block: ONE primary
 * `.act-primary` "Send Inquiry" (the old `btnAct` already routes an
 * `inquire` action, app.html:9217-9226, and `ACTIC` carries its icon; the
 * default `detailBtns` just never used it).
 *
 * Duplicate prevention beyond the idempotency key: if the collector already
 * has an open inquiry on this work, the block shows that instead of a second
 * Send — "Inquiry sent · Open the conversation" — and links to its thread.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Artwork } from '../../api/types';
import { useConversations } from '../conversations/useConversations';
import { InquirySheet } from './InquirySheet';
import './requests.css';

export function InquiryAction({ artwork }: { artwork: Artwork }) {
  const { controller } = useConversations();
  const [open, setOpen] = useState(false);
  const existing = controller.openInquiryFor(artwork.id);

  if (existing) {
    return (
      <div className="actions">
        <Link to={`/chat/${existing.id}`} className="act-primary dz-inq-sent">
          <span className="dz-inq-l">Inquiry sent</span>
          <span className="dz-inq-s">
            {existing.unread_count
              ? 'Darz replied — open the conversation'
              : 'Open the conversation'}
          </span>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="actions">
        <button type="button" className="act-primary" onClick={() => setOpen(true)}>
          Send Inquiry
        </button>
      </div>
      {open && (
        <InquirySheet
          artwork={artwork}
          open
          onClose={() => setOpen(false)}
          onSent={(row) => controller.absorb(row)}
        />
      )}
    </>
  );
}
