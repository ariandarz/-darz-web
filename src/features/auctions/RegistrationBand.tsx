/**
 * RegistrationBand — the paddle-registration slot on the auction event page.
 * Ported from `app.html` `aucDetail`'s `bidRegState` block (~8300-8312): the
 * **Register to bid** card (vertical chroma seam on the left · 44px icon
 * square · "Register to bid" · "Request a paddle to place bids in this
 * auction." · full-width **Register →**) when the collector has no
 * registration, and the calm `.auc-msg` band for pending / approved /
 * rejected (COMPONENTS.md § Auction components).
 *
 * Only shown while the auction is still open (`app.html`: `if(_aEnded)return ''`).
 */
import { useState } from 'react';
import type { Auction, BidderRegistration } from '../../api/types';
import './auctions.css';
import { ConditionsSheet } from './ConditionsSheet';
import { auctionState } from './format';
import { REG_COPY } from './terms';

const PADDLE_ICON = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 13l-3 3-7-7 3-3z" />
    <path d="M17 6l-3 3" />
    <path d="M19 13l-6 6" />
    <path d="M4 21h10" />
  </svg>
);

export function RegistrationBand({
  auction,
  registration,
  register,
  registering,
  registerError,
}: {
  auction: Auction;
  registration: BidderRegistration | null;
  register: (agreeTerms: boolean) => Promise<boolean>;
  registering: boolean;
  registerError: string | null;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (auctionState(auction) === 'ended') return null;

  if (registration?.status === 'approved') {
    return <div className="auc-msg auc-msg-ok">{REG_COPY.approved}</div>;
  }
  if (registration?.status === 'pending') {
    return <div className="auc-msg auc-msg-pending">{REG_COPY.pending}</div>;
  }
  if (registration?.status === 'rejected') {
    return <div className="auc-msg">{REG_COPY.rejected}</div>;
  }

  return (
    <>
      <button type="button" className="auc-reg" onClick={() => setSheetOpen(true)}>
        <span className="arg-ico">{PADDLE_ICON}</span>
        <span className="arg-txt">
          <span className="arg-ttl">{REG_COPY.ctaTitle}</span>
          <span className="arg-sub">{REG_COPY.ctaSub}</span>
        </span>
        <span className="arg-cta">{REG_COPY.cta} →</span>
      </button>
      <ConditionsSheet
        auction={auction}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onRegister={register}
        registering={registering}
        error={registerError}
      />
    </>
  );
}
