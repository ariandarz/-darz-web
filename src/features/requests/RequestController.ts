/**
 * RequestController — the collector's outbound actions on an artwork:
 * Buy now, 24h hold, Request viewing, Make an offer.
 *
 * Ports the behaviour of `app.html`'s `DZ.act()` (:10462) and `DZ.offer()` /
 * `DZ.submit()` / `DZ._placeOffer()` (:11074-11106), but **only** the
 * behaviour. The old implementation wrote straight to Supabase (a
 * `darz_place_offer` RPC with a project URL and anon key hardcoded in
 * `app.html` around :11103) — none of that is carried over. Every action here
 * goes through `POST /api/crm/requests/` on the new backend.
 *
 * Old action verb → new `RequestKindEnum`:
 *   buy   → purchase      visit → viewing
 *   hold  → hold          offer → offer
 * (`price` and `information` are wired for the "Request Price" / "Ask about"
 * entry points the old app shows on price-on-request works.)
 *
 * Duplicate-submit guard: the old app used `dzGuard('act:'+id+':'+kind)` and
 * `dzGuard('offer:'+id+':'+raw)` (v576, "double-tap / reload guard"). Same idea
 * here, keyed the same way — one in-flight POST per (artwork, kind[, amount]),
 * so a double-tap or a key-repeat cannot file two requests.
 */
import type { CrmService } from '../../api/services';
import type { Artwork, CollectorRequest, RequestDetail, RequestKind } from '../../api/types';
import { Observable } from '../shared/Observable';

/** The action verbs the artwork detail renders, as `app.html` names them. */
export type ActionVerb = 'buy' | 'hold' | 'visit' | 'offer' | 'price' | 'information';

/** app.html:9236 — the default secondary actions and their exact labels. */
export const ACTION_LABEL: Record<ActionVerb, string> = {
  buy: 'Buy now',
  hold: '24h hold',
  visit: 'Request viewing',
  offer: 'Make an offer',
  price: 'Request price',
  information: 'Ask about this work',
};

/** Action verb → the backend's `RequestKindEnum` value. */
export const ACTION_KIND: Record<ActionVerb, RequestKind> = {
  buy: 'purchase',
  hold: 'hold',
  visit: 'viewing',
  offer: 'offer',
  price: 'price',
  information: 'information',
};

/** app.html:10464-10468 — the confirmation copy, verbatim, per action. */
export const CONFIRM_COPY: Record<ActionVerb, { title: string; message: string }> = {
  buy: {
    title: 'Request received',
    message:
      'Thank you. Your request has been received. Darz will review it and get back to you shortly.',
  },
  hold: {
    title: 'Hold request received',
    message:
      'Your hold request has been received. Darz will review availability and get back to you shortly.',
  },
  visit: {
    title: 'Viewing request received',
    message:
      'Your viewing request has been received. Darz will check the possibility and get back to you shortly.',
  },
  // app.html:11101 — the offer confirmation is its own wording.
  offer: {
    title: 'Offer received',
    message: 'Thank you — your offer is in. Darz will review it and reply shortly.',
  },
  price: {
    title: 'Request received',
    message:
      'Thank you. Your request has been received. Darz will review it and get back to you shortly.',
  },
  information: {
    title: 'Request received',
    message:
      'Thank you. Your request has been received. Darz will review it and get back to you shortly.',
  },
};

export interface RequestConfirmation {
  verb: ActionVerb;
  artworkId: string;
  title: string;
  message: string;
  /** "Artist — Title", the line `dzActConfirm` shows under the heading */
  work: string;
  at: number;
}

export interface RequestSnapshot {
  /** guard keys with a POST in flight — `act:<id>:<verb>` / `offer:<id>:<amount>` */
  pending: ReadonlySet<string>;
  /** the confirmation sheet to show, or null */
  confirmation: RequestConfirmation | null;
  /** a failed submit, shown inline in the sheet (never a stack trace) */
  error: string | null;
  /** every request this session filed, newest first — feeds the detail page's
   * "you already asked about this" state without a refetch */
  filed: CollectorRequest[];
}

const EMPTY: RequestSnapshot = {
  pending: new Set(),
  confirmation: null,
  error: null,
  filed: [],
};

export class RequestController extends Observable<RequestSnapshot> {
  private readonly crm: CrmService;

  constructor(crm: CrmService) {
    super(EMPTY);
    this.crm = crm;
  }

  isPending(key: string): boolean {
    return this.getSnapshot().pending.has(key);
  }

  /** app.html:10462 — `dzGuard('act:'+id+':'+kind)`. */
  static actKey(artworkId: string, verb: ActionVerb): string {
    return `act:${artworkId}:${verb}`;
  }
  /** app.html:11099 — `dzGuard('offer:'+id+':'+raw)`, keyed by the raw amount so
   * a corrected offer is a new action but a double-tap of the same one is not. */
  static offerKey(artworkId: string, amount: number): string {
    return `offer:${artworkId}:${amount}`;
  }

  /** Buy now / 24h hold / Request viewing / Request price / Ask about. */
  act(artwork: Artwork, verb: ActionVerb, detail?: RequestDetail): Promise<void> {
    return this.file(RequestController.actKey(artwork.id, verb), artwork, verb, detail);
  }

  /** Make an offer. `amount` is already validated by the caller (the sheet owns
   * the empty/floor messages so it can put them next to the field). */
  offer(artwork: Artwork, amount: number, currency: string): Promise<void> {
    return this.file(RequestController.offerKey(artwork.id, amount), artwork, 'offer', {
      amount,
      currency,
    });
  }

  dismissConfirmation(): void {
    if (this.getSnapshot().confirmation) this.patch({ confirmation: null });
  }
  clearError(): void {
    if (this.getSnapshot().error) this.patch({ error: null });
  }

  private async file(
    key: string,
    artwork: Artwork,
    verb: ActionVerb,
    detail?: RequestDetail,
  ): Promise<void> {
    const { pending } = this.getSnapshot();
    if (pending.has(key)) return; // the double-tap guard
    this.patch({ pending: withKey(pending, key), error: null });

    try {
      const row = await this.crm.createRequest({
        kind: ACTION_KIND[verb],
        artwork: artwork.id,
        ...(detail ? { detail } : {}),
      });
      const copy = CONFIRM_COPY[verb];
      this.patch({
        filed: [row, ...this.getSnapshot().filed],
        confirmation: {
          verb,
          artworkId: artwork.id,
          title: copy.title,
          message: copy.message,
          work: workLine(artwork),
          at: Date.now(),
        },
      });
    } catch (err: unknown) {
      this.patch({ error: messageOf(err) });
    } finally {
      this.patch({ pending: withoutKey(this.getSnapshot().pending, key) });
    }
  }
}

// --- helpers ---------------------------------------------------------------

function withKey(set: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(set);
  next.add(key);
  return next;
}
function withoutKey(set: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const next = new Set(set);
  next.delete(key);
  return next;
}

/** app.html:10182 — `(artist + ' — ' + title)`, with a leading dash trimmed. */
export function workLine(artwork: Pick<Artwork, 'artist' | 'title'>): string {
  const artist = artwork.artist?.display_name ?? '';
  const title = artwork.title ?? '';
  return [artist, title].filter(Boolean).join(' — ');
}

/** Calm and factual — never a stack trace (VOICE_AND_COPY.md). */
function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Something went wrong.';
}
