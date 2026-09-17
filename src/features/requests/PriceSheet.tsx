/**
 * PriceSheet — "Request Price & Availability". Port of `DZ._reqPriceDo`
 * (app.html:11046-11048) and `DZ.reqPriceSubmit` (:11049-11064) in the
 * offer-sheet chrome: the title + seam · "Artist — Title, year" · the note ·
 * the prefilled message · **Send enquiry** · "Darz will get back to you soon."
 * Capture: design/market-app `04-request-price`.
 *
 * Owner decision D6 (2026-09-17, docs/PHASE_5_PLAN.md): the old sheet's First
 * name / Last name / Email / Phone / City fields are not repeated — the
 * backend snapshots the collector's contact details on every request
 * (`contact_snapshot`, Phase 19.3), the same call v0.1's Send Inquiry already
 * made. Files `kind=price` with the message; the confirmation is the old
 * "Enquiry received" copy (:11064).
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Artwork } from '../../api/types';
import { Sheet } from '../../components';
import { RequestController, workLineWithYear } from './RequestController';
import './requests.css';
import { useRequests } from './useRequests';

/** app.html:11047 — the message the sheet opens with. */
export const PRICE_REQUEST_MESSAGE =
  'Please let me know the price and availability of this artwork.';

export function PriceSheet({
  artwork,
  open,
  onClose,
}: {
  artwork: Artwork;
  open: boolean;
  onClose: () => void;
}) {
  const { pending, error, controller } = useRequests();
  const [message, setMessage] = useState(PRICE_REQUEST_MESSAGE);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = pending.has(RequestController.actKey(artwork.id, 'price'));
  const empty = !message.trim();

  // app.html:11048 — the first field takes focus a beat after the sheet opens.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || empty) return;
    // The controller opens the confirmation on success; on a failure the
    // message shows inline below and the sheet stays open.
    const ok = await controller.requestPrice(artwork, message);
    if (ok) onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} aria-label="Request Price & Availability">
      <form className="dz-offerwrap" onSubmit={(e) => void submit(e)}>
        <h3>Request Price &amp; Availability</h3>
        <div className="dz-seamline" />
        <div className="si">{workLineWithYear(artwork)}</div>
        <div className="dz-reqnote">
          A Darz specialist will respond within 2 days with price and availability.
        </div>

        <div className="dz-offerfield">
          <textarea
            ref={inputRef}
            id="rqMs"
            className="dz-field"
            rows={4}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              controller.clearError();
            }}
            placeholder="Message"
            aria-label="Message"
            aria-invalid={error ? true : undefined}
          />
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
          {busy ? 'Sending…' : 'Send enquiry'}
        </button>
        <div className="dz-sheetfoot">Darz will get back to you soon.</div>
      </form>
    </Sheet>
  );
}
