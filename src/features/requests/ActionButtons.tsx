/**
 * ActionButtons — the artwork detail's `.actions` block. Port of
 * `app.html`'s action list (:9236-9243): one `.act-primary` (Buy now) plus a
 * `.act-row` of icon `.act-box` buttons (24h hold / Request viewing / Make an
 * offer).
 *
 * Column count follows the original exactly (:9241, v458 — "secondary actions
 * adapt to count: 1→full, 2→2-up, 3→3-up, 4→2×2, 5+→3-up"), carried on the
 * `--an` custom property.
 *
 * A price-on-request work has no Buy now: the old app collapses to a single
 * request entry point (:9245, "ONE request entry point"), so the primary
 * becomes "Request price".
 *
 * The old app gated these behind `DZ.otpGate` and a per-artwork allow-list
 * (`DZ._actAllows`, v1131 "gallery chooses which collector actions are
 * available on this work"). Neither is ported: the new API has no per-artwork
 * action allow-list — see `docs/FLOW_1_API_GAPS.md` (G-F1-3).
 */
import { useState } from 'react';
import type { Artwork } from '../../api/types';
import { ActionIcon } from './icons';
import { columnsFor } from './layout';
import { OfferSheet } from './OfferSheet';
import { ACTION_LABEL, RequestController, type ActionVerb } from './RequestController';
import './requests.css';
import { useRequests } from './useRequests';

export function ActionButtons({ artwork }: { artwork: Artwork }) {
  const { pending, controller } = useRequests();
  const [offerOpen, setOfferOpen] = useState(false);

  // app.html:9245 — a price-on-request work shows no Buy now.
  const onRequest = artwork.price_type === 'on_request' || !artwork.price_amount;
  const primary: ActionVerb = onRequest ? 'price' : 'buy';
  const secondary: ActionVerb[] = ['hold', 'visit', 'offer'];

  const isBusy = (verb: ActionVerb) => pending.has(RequestController.actKey(artwork.id, verb));

  const fire = (verb: ActionVerb) => {
    if (verb === 'offer') {
      setOfferOpen(true);
      return;
    }
    if (isBusy(verb)) return; // guarded again in the controller
    void controller.act(artwork, verb);
  };

  const primaryBusy = isBusy(primary);

  return (
    <>
      <div className="actions">
        <button
          type="button"
          className="act-primary"
          onClick={() => fire(primary)}
          disabled={primaryBusy}
          aria-busy={primaryBusy || undefined}
        >
          {primaryBusy ? 'Sending…' : ACTION_LABEL[primary]}
        </button>

        <div className="act-row" style={{ ['--an' as string]: columnsFor(secondary.length) }}>
          {secondary.map((verb) => {
            const busy = isBusy(verb);
            return (
              <button
                key={verb}
                type="button"
                className="act-box"
                onClick={() => fire(verb)}
                disabled={busy}
                aria-busy={busy || undefined}
                aria-label={ACTION_LABEL[verb]}
              >
                <span className="ai">
                  <ActionIcon verb={verb} />
                </span>
                <span className="al">{busy ? 'Sending…' : ACTION_LABEL[verb]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mounted only while open: `app.html`'s `openSheet()` rebuilds the sheet
          markup on every call, so a re-open never inherits the previous
          attempt's amount or error. */}
      {offerOpen && <OfferSheet artwork={artwork} open onClose={() => setOfferOpen(false)} />}
    </>
  );
}
