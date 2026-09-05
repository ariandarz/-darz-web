/**
 * OfferSheet — "Make an Offer". Faithful port of `app.html`'s `DZ.offer()`
 * (:11074) and `DZ.submit()` (:11093): the seam, the "Artist — Title" line, the
 * asking-price row (only when the work has a price), the grouped amount field
 * with the currency suffix, the calm hint, the inline error slot and the CTA.
 *
 * Copy is verbatim from the original, including both validation messages.
 *
 * **The accepted-offer floor stays private.** app.html:11077 is explicit about
 * it ("the accepted-offer limit is kept PRIVATE — never reveal the floor
 * number"), and the new API does not expose a floor to the client at all, so
 * this sheet cannot leak one: a rejected-as-too-low offer is surfaced from the
 * server's own error message. See `docs/FLOW_1_API_GAPS.md` (G-F1-2).
 */
import { useEffect, useRef, useState } from 'react';
import type { Artwork } from '../../api/types';
import { Sheet } from '../../components';
import { formatMoney } from '../catalogue/format';
import { caretAfterGrouping, digitsBefore, groupDigits, parseAmount } from './amount';
import { RequestController, workLine } from './RequestController';
import './requests.css';
import { useRequests } from './useRequests';

export function OfferSheet({
  artwork,
  open,
  onClose,
}: {
  artwork: Artwork;
  open: boolean;
  onClose: () => void;
}) {
  const { pending, error, controller } = useRequests();
  const [value, setValue] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ask = parseAmount(artwork.price_amount);
  const currency = artwork.currency ?? '';
  const amount = parseAmount(value);
  const busy = pending.has(RequestController.offerKey(artwork.id, amount));

  // app.html:11084 — the field takes focus a beat after the sheet opens.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  // No reset effect is needed: `ActionButtons` mounts this component only
  // while the sheet is open, so every open starts from fresh state.

  /** `DZ.fmtNum` (:11085) — regroup, then restore the caret by digit count. */
  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const raw = el.value;
    const caret = el.selectionStart ?? raw.length;
    const grouped = groupDigits(raw);
    const next = caretAfterGrouping(grouped, digitsBefore(raw, caret));
    setValue(grouped);
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(next, next);
      } catch {
        /* Safari throws on a detached node — the value is already correct. */
      }
    });
  };

  const submit = () => {
    // app.html:11096 — the empty/zero case, worded exactly as the original.
    if (!value.trim() || !(amount > 0)) {
      setLocalError('Please enter your offer amount.');
      inputRef.current?.focus();
      return;
    }
    setLocalError(null);
    void controller.offer(artwork, amount, currency).then(() => {
      // The controller opens the confirmation sheet on success; close this one
      // either way so the collector is never left looking at a stale form.
      onClose();
    });
  };

  const shown = localError ?? error;

  return (
    <Sheet open={open} onClose={onClose} aria-label="Make an Offer">
      <div className="dz-offerwrap">
        <h3>Make an Offer</h3>
        <div className="dz-seamline" />
        <div className="si">{workLine(artwork)}</div>

        {ask > 0 && (
          <div className="dz-offerline">
            <span className="l">Asking price</span>
            <b>
              {formatMoney(ask)} {currency && <span className="cur">{currency}</span>}
            </b>
          </div>
        )}

        <div className="dz-offerfield">
          <input
            ref={inputRef}
            id="offv"
            className="dz-field"
            inputMode="numeric"
            value={value}
            onChange={onInput}
            placeholder={
              ask > 0 ? `Your offer (e.g. ${formatMoney(ask)})` : 'Your offer (e.g. 12,000)'
            }
            aria-label="Your offer"
            aria-invalid={shown ? true : undefined}
          />
          {currency && <span className="dz-offercur">{currency}</span>}
        </div>

        <div className="dz-offerhint">
          Enter your best offer — a Darz specialist will review it and respond.
        </div>
        <div className="dz-offererr" role="alert">
          {shown}
        </div>

        <button
          type="button"
          className="dz-sheetcta"
          onClick={submit}
          disabled={busy}
          aria-busy={busy || undefined}
        >
          {busy ? 'Submitting…' : 'Submit offer'}
        </button>
      </div>
    </Sheet>
  );
}
