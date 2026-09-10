/**
 * The default auction Conditions of Sale, shown at registration when the
 * auction carries no `terms` text of its own. Ported verbatim from
 * `DarzStudio/app.html`'s `DARZ_AUC_TERMS` array (~8177-8195) — the same
 * ten headed clauses, joined by blank lines.
 *
 * The backend field (`Auction.terms`, Phase 11.2) wins when set; this is only
 * the fallback, matching the old app's `aucTermsText(a)` (`a.terms || DARZ_AUC_TERMS`).
 */
export const DARZ_AUC_TERMS: string = [
  'Conditions of Sale\nBy placing a bid, you agree to the Auction Terms & Conditions.',
  'Buyer Responsibilities\nReview all artwork information carefully before bidding. Successful bidders are responsible for timely payment and collection.',
  'Seller Responsibilities\nSellers must provide accurate information regarding authenticity, provenance, condition, and ownership.',
  'Bidding Rules\nAll bids are binding. The highest valid bid at the close of the auction will secure the lot.',
  'Auction Premium\nA 20% Auction Premium will be added to the final hammer price.',
  'Payment Terms\nPayment must be completed within the specified payment period. Ownership transfers only after full payment is received.',
  'Artwork Condition\nArtwork descriptions and images are provided for guidance. Additional information may be requested before bidding.',
  'Shipping & Collection\nShipping, insurance, customs duties, and related costs are the responsibility of the buyer unless stated otherwise.',
  'Cancellations & Disputes\nDarz reserves the right to withdraw lots, cancel bids made in error, and resolve disputes where necessary.',
  'Privacy\nCollector information remains confidential and is handled according to Darz standards.',
].join('\n\n');

/** app.html `THEME_DEFAULT` (~2844) — the registration-state band copy. */
export const REG_COPY = {
  /** the "Register to bid" CTA panel (app.html `auc-reg`, ~8305) */
  ctaTitle: 'Register to bid',
  ctaSub: 'Request a paddle to place bids in this auction.',
  cta: 'Register',
  /** pending / approved / rejected band text (app.html aucDetail ~8300) */
  pending: 'Registered — we are confirming your paddle. Bidding unlocks automatically.',
  approved: '✓ Your paddle is confirmed — you can place bids.',
  rejected:
    'Thank you for your interest. Our team will be in touch regarding access to the next sale.',
  agree: 'I have read and agree to the Auction Terms & Conditions.',
} as const;
