/**
 * InquirySheet — the v0.1 "Send Inquiry" sheet on the artwork detail.
 *
 * Port of the old "Request Price & Availability" sheet (`DZ._reqPriceDo`,
 * app.html:11046-11048) in the offer-sheet chrome this repo already ported
 * (`.dz-offerwrap`, app.html:1257-1278): the title, the seam, the "Artist —
 * Title" line, one calm line of copy, a message field and one submit. The old
 * sheet also asked for name, email, phone and city; the new backend snapshots
 * the collector's contact details server-side on every request
 * (`contact_snapshot`, Phase 19.3), so those fields are not repeated here.
 *
 * Success is shown only after the backend confirmed the request (created, or
 * replayed on the same `client_req_id`): `RequestController.inquire` resolves
 * true only then, and the shared `ConfirmSheet` opens with the inquiry copy.
 */
import { useState, type FormEvent } from 'react';
import type { Artwork, CollectorRequest } from '../../api/types';
import { Sheet } from '../../components';
import { RequestController, workLine } from './RequestController';
import './requests.css';
import { useRequests } from './useRequests';

export function InquirySheet({
  artwork,
  open,
  onClose,
  onSent,
}: {
  artwork: Artwork;
  open: boolean;
  onClose: () => void;
  onSent: (request: CollectorRequest) => void;
}) {
  const { pending, error, controller } = useRequests();
  const [message, setMessage] = useState('');
  const busy = pending.has(RequestController.actKey(artwork.id, 'inquiry'));
  const empty = !message.trim();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || empty) return;
    const ok = await controller.inquire(artwork, message);
    if (ok) {
      const filed = controller.getSnapshot().lastFiled;
      onClose();
      if (filed) onSent(filed.request);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} aria-label="Send Inquiry">
      <form className="dz-offerwrap" onSubmit={(e) => void submit(e)}>
        <h3>Send Inquiry</h3>
        <div className="dz-seamline" />
        <div className="si">{workLine(artwork)}</div>

        <div className="dz-offerfield" style={{ marginTop: 14 }}>
          <textarea
            id="inqv"
            className="dz-field"
            rows={4}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              controller.clearError();
            }}
            placeholder="What would you like to know about this work?"
            aria-label="Your message"
            aria-invalid={error ? true : undefined}
            autoFocus
          />
        </div>

        <div className="dz-offerhint">
          A Darz specialist will reply in your conversation — price, availability, or anything
          else about this work.
        </div>
        <div className="dz-offererr" role="alert">
          {error}
        </div>

        <button
          type="submit"
          className="dz-sheetcta"
          disabled={busy || empty}
          aria-busy={busy || undefined}
        >
          {busy ? 'Sending…' : 'Send Inquiry'}
        </button>
      </form>
    </Sheet>
  );
}
