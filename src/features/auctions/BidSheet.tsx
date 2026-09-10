/**
 * BidSheet — "Place a bid" / "Raise your bid". Ported from `app.html`'s
 * `DZ.bid()` / bid panel (~6031-6045): the "Artist — Title" line, the current
 * bid row, the grouped max-amount field with the currency suffix, the calm
 * proxy-bid hint, an inline error slot and the CTA.
 *
 * `max_amount` is the collector's confidential ceiling; the server resolves
 * the displayed price. The floor / "must increase" / "not approved" / "not
 * live" rejections are surfaced from the server's own message — this sheet
 * never invents a floor. Pre-fills `lot.min_next_amount` (the lowest the
 * engine will accept right now, from `next_increment`).
 */
import { useEffect, useRef, useState } from 'react';
import type { Lot } from '../../api/types';
import { Sheet } from '../../components';
import { formatMoney } from '../catalogue/format';
import {
  caretAfterGrouping,
  digitsBefore,
  groupDigits,
  parseAmount,
} from '../requests/amount';
import './auctions.css';

export function BidSheet({
  lot,
  open,
  onClose,
  onPlaceBid,
  bidding,
  error,
}: {
  lot: Lot;
  open: boolean;
  onClose: () => void;
  onPlaceBid: (maxAmount: number) => Promise<boolean>;
  bidding: boolean;
  error: string | null;
}) {
  const currency = lot.currency ?? '';
  const minNext = parseAmount(lot.min_next_amount);
  // Pre-filled with the minimum acceptable bid. `BidSheet` is mounted only
  // while open (see `LotDetailPage`), so a lazy initializer is all that's
  // needed — no reset effect (matches `OfferSheet`).
  const [value, setValue] = useState(() => (minNext > 0 ? groupDigits(String(minNext)) : ''));
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const raising = lot.is_leading;

  // Focus the field a beat after opening (app.html:11084).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

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

  const amount = parseAmount(value);
  const submit = () => {
    if (!value.trim() || !(amount > 0)) {
      setLocalError('Please enter your maximum bid.');
      inputRef.current?.focus();
      return;
    }
    setLocalError(null);
    void onPlaceBid(amount).then((ok) => {
      if (ok) onClose();
    });
  };

  const shown = localError ?? error;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      aria-label={raising ? 'Raise your bid' : 'Place a bid'}
    >
      <div className="dz-offerwrap">
        <h3>{raising ? 'Raise your bid' : 'Place a bid'}</h3>
        <div className="dz-seamline" />
        <div className="si">
          {lot.artwork.artist?.display_name ?? 'Unknown artist'}
          {lot.artwork.title ? ` — ${lot.artwork.title}` : ''}
        </div>

        <div className="dz-offerline">
          <span className="l">{lot.current_amount ? 'Current bid' : 'Opening'}</span>
          <b>
            {formatMoney(lot.current_amount ?? lot.opening_amount)}{' '}
            {currency && <span className="cur">{currency}</span>}
          </b>
        </div>

        <div className="dz-offerfield">
          <input
            ref={inputRef}
            className="dz-field"
            inputMode="numeric"
            value={value}
            onChange={onInput}
            placeholder={minNext > 0 ? formatMoney(minNext) : '12,000'}
            aria-label="Your maximum bid"
            aria-invalid={shown ? true : undefined}
          />
          {currency && <span className="dz-offercur">{currency}</span>}
        </div>

        <div className="dz-offerhint">
          Set your maximum — the system bids on your behalf up to that figure, by the smallest
          step needed to lead, and never against you. Minimum next bid {formatMoney(minNext)}{' '}
          {currency}.
        </div>
        <div className="dz-offererr" role="alert">
          {shown}
        </div>

        <button
          type="button"
          className="dz-sheetcta"
          onClick={submit}
          disabled={bidding}
          aria-busy={bidding || undefined}
        >
          {bidding ? 'Placing…' : raising ? 'Raise your bid' : 'Place a bid'}
        </button>
      </div>
    </Sheet>
  );
}
