/**
 * ConditionsSheet — the Auction Terms & Conditions gate shown at
 * registration. Ported from `app.html`'s `aucTermsGate` / `DZ.aucTerms`
 * (~8199-8210): the "Conditions of Sale" heading, the full terms text
 * (`auction.terms` when the auction carries one, else `DARZ_AUC_TERMS`), the
 * "I have read and agree…" checkbox (`dz-trmck`, ~8202) and the enter/register
 * action gated on it.
 *
 * The backend records the acceptance moment on the registration row
 * (`terms_accepted_at`, Phase 11.2) — this is a real acceptance, not a
 * cosmetic checkbox.
 */
import { useState } from 'react';
import type { Auction } from '../../api/types';
import { Sheet } from '../../components';
import './auctions.css';
import { DARZ_AUC_TERMS, REG_COPY } from './terms';

export function ConditionsSheet({
  auction,
  open,
  onClose,
  onRegister,
  registering,
  error,
}: {
  auction: Auction;
  open: boolean;
  onClose: () => void;
  onRegister: (agreeTerms: boolean) => Promise<boolean>;
  registering: boolean;
  error: string | null;
}) {
  const [agreed, setAgreed] = useState(false);
  const terms = auction.terms?.trim() ? auction.terms : DARZ_AUC_TERMS;

  const submit = () => {
    if (!agreed || registering) return;
    void onRegister(true).then((ok) => {
      if (ok) onClose();
    });
  };

  return (
    <Sheet open={open} onClose={onClose} aria-label="Conditions of Sale">
      <div className="dz-trmwrap">
        <h3>Conditions of Sale</h3>
        <div className="dz-seamline" />
        <div className="dz-trm-tagline">Bid with confidence. Collect with clarity.</div>

        <div className="dz-trmtext">{terms}</div>

        <label className="dz-trmck">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>{REG_COPY.agree}</span>
        </label>

        {error && (
          <div className="dz-offererr" role="alert">
            {error}
          </div>
        )}

        <button
          type="button"
          className="dz-sheetcta"
          onClick={submit}
          disabled={!agreed || registering}
          aria-busy={registering || undefined}
        >
          {registering ? 'Registering…' : REG_COPY.cta}
        </button>
      </div>
    </Sheet>
  );
}
