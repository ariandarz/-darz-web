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
 * request entry point (:9242, "ONE request entry point"), so the primary
 * becomes "Request Price & Availability" and opens the `PriceSheet` — always
 * shown; `price`/`information` aren't gated by `allowed_actions`, only the
 * four commerce verbs below are. "Request viewing" opens the `ViewingSheet`
 * (the backend needs a preferred time + mode — Phase 5 D1); Buy now and the
 * hold still file straight away, as `DZ.act` did.
 *
 * The old app gated these behind `DZ.otpGate` and a per-artwork allow-list
 * (`DZ._actAllows`, v1131 "gallery chooses which collector actions are
 * available on this work"). The allow-list is ported now:
 * `artwork.allowed_actions` (docs/FLOW_1_API_GAPS.md G-F1-3, already
 * resolved server-side — an artwork with no explicit list shows all four).
 * `otpGate` (a one-time-passcode step) is not — there is no OTP flow in this
 * app; flagged, not silently dropped.
 */
import { useState } from 'react';
import { cx } from '../../lib/cx';
import type { Artwork, CollectorAction } from '../../api/types';
import { ActionIcon } from './icons';
import { columnsFor } from './layout';
import { OfferSheet } from './OfferSheet';
import { PriceSheet } from './PriceSheet';
import {
  ACTION_KIND,
  ACTION_LABEL,
  RequestController,
  type ActionVerb,
} from './RequestController';
import './requests.css';
import { useRequests } from './useRequests';
import { ViewingSheet } from './ViewingSheet';

/** The verbs that open a sheet before anything is filed. */
type SheetVerb = 'offer' | 'visit' | 'price';

/** The four verbs the gallery's per-artwork `allowed_actions` gates — every
 * other verb (`price`, `information`) is always offered. */
const GATED_VERBS: ActionVerb[] = ['buy', 'hold', 'visit', 'offer'];

function isAllowed(artwork: Artwork, verb: ActionVerb): boolean {
  if (!GATED_VERBS.includes(verb)) return true;
  const allowed = artwork.allowed_actions as CollectorAction[] | undefined;
  return (allowed ?? []).includes(ACTION_KIND[verb] as CollectorAction);
}

export function ActionButtons({ artwork }: { artwork: Artwork }) {
  const { pending, controller } = useRequests();
  const [sheet, setSheet] = useState<SheetVerb | null>(null);

  // app.html:9245 — a price-on-request work shows no Buy now. "price" is
  // ungated, so it's always available as the fallback primary.
  const onRequest = artwork.price_type === 'on_request' || !artwork.price_amount;
  const wantsBuy = !onRequest;
  const primary: ActionVerb | null = wantsBuy
    ? isAllowed(artwork, 'buy')
      ? 'buy'
      : null // the gallery hasn't enabled purchase on this work — no primary
    : 'price';
  const secondary: ActionVerb[] = (['hold', 'visit', 'offer'] as ActionVerb[]).filter((verb) =>
    isAllowed(artwork, verb),
  );

  const isBusy = (verb: ActionVerb) => pending.has(RequestController.actKey(artwork.id, verb));

  const fire = (verb: ActionVerb) => {
    if (verb === 'offer' || verb === 'visit' || verb === 'price') {
      setSheet(verb);
      return;
    }
    if (isBusy(verb)) return; // guarded again in the controller
    void controller.act(artwork, verb);
  };

  const primaryBusy = primary ? isBusy(primary) : false;

  return (
    <>
      <div className="actions">
        {primary && (
          <button
            type="button"
            className={cx(
              'act-primary',
              // app.html `.dzglow`: the green pulsing border on an available
              // work's Buy now (SCREENS.md §04: "green pulse when available")
              primary === 'buy' && artwork.availability_status === 'available' && 'dzglow',
            )}
            onClick={() => fire(primary)}
            disabled={primaryBusy}
            aria-busy={primaryBusy || undefined}
          >
            {primaryBusy ? 'Sending…' : ACTION_LABEL[primary]}
          </button>
        )}

        {secondary.length > 0 && (
          <div
            className="act-row"
            style={{ ['--an' as string]: columnsFor(secondary.length) }}
          >
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
        )}
      </div>

      {/* Mounted only while open: `app.html`'s `openSheet()` rebuilds the sheet
          markup on every call, so a re-open never inherits the previous
          attempt's amount or error. */}
      {sheet === 'offer' && (
        <OfferSheet artwork={artwork} open onClose={() => setSheet(null)} />
      )}
      {sheet === 'visit' && (
        <ViewingSheet artwork={artwork} open onClose={() => setSheet(null)} />
      )}
      {sheet === 'price' && (
        <PriceSheet artwork={artwork} open onClose={() => setSheet(null)} />
      )}
    </>
  );
}
