/**
 * The old Manage-auction modal's "Terms & financial settings" block, terms
 * half (`darz-studio.html:32100-32108`): the "Auction terms & conditions"
 * label with **Reset to Darz default** and **No terms gate** on its right,
 * the textarea, and the format hint — all verbatim. Used by the create form
 * (Live Auctions) and the edit form (the auction page), which is why it is
 * its own file rather than living in either.
 *
 * The block's other half (Buyer's premium %, Anti-snipe seconds, Cascade
 * stagger, Maximum bidders, `:32110-32116`) is per-LOT in this backend
 * (`premium_pct`, `soft_close_sec` on the lot editor) or absent (cascade,
 * max bidders), so it is not repeated here.
 */
import { DARZ_AUC_TERMS } from '../auctions/terms';

export function AuctionTermsFields({
  terms,
  noTermsGate,
  onTerms,
  onNoTermsGate,
  disabled,
}: {
  terms: string;
  noTermsGate: boolean;
  onTerms: (v: string) => void;
  onNoTermsGate: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="ad-field ad-field--wide">
      <div className="ad-termsbar">
        <span className="ad-filter-l">Auction terms &amp; conditions</span>
        <span className="ad-termsright">
          <button
            type="button"
            className="ad-ghostbtn"
            disabled={disabled}
            onClick={() => onTerms(DARZ_AUC_TERMS)}
          >
            Reset to Darz default
          </button>
          <label className="ad-termsck">
            <input
              type="checkbox"
              checked={noTermsGate}
              disabled={disabled}
              onChange={(e) => onNoTermsGate(e.target.checked)}
            />{' '}
            No terms gate
          </label>
        </span>
      </div>
      <textarea
        rows={5}
        aria-label="Auction terms & conditions"
        value={terms}
        disabled={disabled}
        onChange={(e) => onTerms(e.target.value)}
      />
      <span className="ad-dsec-n">
        Collectors must read &amp; accept these once before entering this auction or placing a
        bid. Format: heading line, then its paragraph; blank line between sections.
      </span>
    </div>
  );
}
