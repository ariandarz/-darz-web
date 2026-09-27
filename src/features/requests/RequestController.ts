/**
 * RequestController — the collector's outbound requests: Buy now, 48h hold,
 * Request viewing, Make an offer, Request Price & Availability, Send Inquiry,
 * and the artist page's "Enquire about works by …".
 *
 * Ports the behaviour of `app.html`'s `DZ.act()` (:10462), `DZ.offer()` /
 * `DZ.submit()` / `DZ._placeOffer()` (:11074-11117), `DZ.reqPriceSubmit()`
 * (:11049-11064) and `DZ.artistEnquireSubmit()` (:11033-11044), but **only**
 * the behaviour. The old implementation wrote straight to Supabase (a
 * `darz_place_offer` RPC with a project URL and anon key hardcoded in
 * `app.html` around :11103) — none of that is carried over. Every action here
 * goes through `POST /api/crm/requests/` on the new backend.
 *
 * Old action verb → new `RequestKindEnum`:
 *   buy   → purchase      visit → viewing       price → price
 *   hold  → hold          offer → offer         inquiry · artist → information
 *
 * Duplicate-submit guard: the old app used `dzGuard('act:'+id+':'+kind)`,
 * `dzGuard('offer:'+id+':'+raw)`, `dzGuard('inquire:'+id)` and
 * `dzGuard('artistinq:'+name)` (v576, "double-tap / reload guard"). Same idea
 * here, keyed the same way — one in-flight POST per key, so a double-tap or a
 * key-repeat cannot file two requests — plus one `client_req_id` per key that
 * survives a failed attempt, so a retry replays the row instead of filing a
 * second one (`docs/API_INTEGRATION_GAPS.md` G-F1-5).
 */
import type { CrmService } from '../../api/services';
import type {
  Artwork,
  CollectorRequest,
  Currency,
  RequestDetailInput,
  RequestKind,
  ViewingMode,
} from '../../api/types';
import { Observable } from '../shared/Observable';

/** The action verbs the artwork detail renders, as `app.html` names them.
 * `inquiry` is the v0.1 "Send Inquiry" — the one collector→Darz contact CTA
 * (kind `information`, with the collector's message in `detail`). `artist`
 * is the artist page's enquiry (also `information`, with no artwork). */
export type ActionVerb =
  'buy' | 'hold' | 'visit' | 'offer' | 'price' | 'information' | 'inquiry' | 'artist';

/** app.html:9229 / :9242 — the default action labels. */
export const ACTION_LABEL: Record<ActionVerb, string> = {
  buy: 'Buy now',
  // app.html:9229 says "24h hold"; the backend keeps a hold for 48 h
  // (`Hold.DEFAULT_TTL`, apps/crm/models.py:155). Owner decision D2
  // (2026-09-17, docs/PHASE_5_PLAN.md): the label follows the API.
  hold: '48h hold',
  visit: 'Request viewing',
  offer: 'Make an offer',
  // app.html:9242 — `t.reqPriceLabel || 'Request Price & Availability'`, the
  // one request entry point on a price-hidden work.
  price: 'Request Price & Availability',
  information: 'Ask about this work',
  inquiry: 'Send Inquiry',
  artist: 'Enquire about works by',
};

/** Action verb → the backend's `RequestKindEnum` value. */
export const ACTION_KIND: Record<ActionVerb, RequestKind> = {
  buy: 'purchase',
  hold: 'hold',
  visit: 'viewing',
  offer: 'offer',
  price: 'price',
  information: 'information',
  inquiry: 'information',
  artist: 'information',
};

/** The confirmation copy, verbatim, per action: app.html:10464-10468
 * (`DZ.act`), :11101 (`_placeOffer`), :11064 (`reqPriceSubmit`), :11044
 * (`artistEnquireSubmit`, `{artist}` filled in at call time). */
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
  offer: {
    title: 'Offer received',
    message: 'Thank you — your offer is in. Darz will review it and reply shortly.',
  },
  price: {
    title: 'Enquiry received',
    message:
      'Thank you — your request is in. Darz will review price and availability and reply shortly.',
  },
  information: {
    title: 'Request received',
    message:
      'Thank you. Your request has been received. Darz will review it and get back to you shortly.',
  },
  // v0.1 — the inquiry lands in a conversation the collector can open from
  // Chat or Profile, so the confirmation says where the reply will arrive.
  inquiry: {
    title: 'Inquiry sent',
    message:
      'Darz has received your inquiry about this work and will reply in your conversation.',
  },
  artist: {
    title: 'Enquiry received',
    message:
      'Thank you — your request is in. Darz will share available works by {artist} and reply shortly.',
  },
};

/** The artist page's enquiry subject — no artwork, only who it is about. */
export interface ArtistSubject {
  id: string;
  display_name: string;
}

export interface RequestConfirmation {
  verb: ActionVerb;
  /** null for the artist enquiry, which is about no single work */
  artworkId: string | null;
  title: string;
  message: string;
  /** "Artist — Title" (or the artist's name), the line `dzActConfirm` shows
   * under the heading */
  work: string;
  at: number;
}

export interface RequestSnapshot {
  /** guard keys with a POST in flight — `act:<id>:<verb>` / `offer:<id>:<amount>`
   * / `artistinq:<artistId>` */
  pending: ReadonlySet<string>;
  /** the request the last successful action created (or replayed) */
  lastFiled: { key: string; request: CollectorRequest; replayed: boolean } | null;
  /** the confirmation sheet to show, or null */
  confirmation: RequestConfirmation | null;
  /** a failed submit, shown inline in the sheet (never a stack trace) */
  error: string | null;
  /** every request this session filed, newest first — feeds the detail page's
   * "you already asked about this" state without a refetch */
  filed: CollectorRequest[];
}

/** What a request is about: the artwork (or none) and the line the
 * confirmation shows for it. */
interface Subject {
  artworkId: string | null;
  /** The artist an enquiry is about (G-P5-11) — sent as the request's
   * nullable `artist` FK so Darz sees a real link, not just a name in the
   * message. Absent for every artwork-bound action. */
  artistId?: string;
  work: string;
}

const EMPTY: RequestSnapshot = {
  pending: new Set(),
  lastFiled: null,
  confirmation: null,
  error: null,
  filed: [],
};

export class RequestController extends Observable<RequestSnapshot> {
  private readonly crm: CrmService;
  /** Idempotency keys by guard key. Minted on the first attempt of an action
   * and kept across a failed attempt, so a retry of the SAME action re-sends
   * the same `client_req_id` and the backend replays the row it already
   * holds instead of filing a second one. Cleared once the action succeeds —
   * a later, separate request for the same work is a new key. */
  private readonly clientIds = new Map<string, string>();

  constructor(crm: CrmService) {
    super(EMPTY);
    this.crm = crm;
  }

  /** The `client_req_id` for a guard key — reused until the action lands. */
  clientRequestId(key: string): string {
    let id = this.clientIds.get(key);
    if (!id) {
      id = newClientId();
      this.clientIds.set(key, id);
    }
    return id;
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
  /** app.html:11033 — `dzGuard('artistinq:'+name)`; keyed by id here. */
  static artistKey(artistId: string): string {
    return `artistinq:${artistId}`;
  }

  /** Buy now / 48h hold / Request viewing / Request price / Ask about.
   * Resolves true once the backend confirmed the request (created, or
   * replayed on the same `client_req_id`); false on a failure or a refused
   * double-tap — the caller keeps its sheet open only in that case. */
  act(artwork: Artwork, verb: ActionVerb, detail?: RequestDetailInput): Promise<boolean> {
    return this.file(
      RequestController.actKey(artwork.id, verb),
      verb,
      subjectOf(artwork),
      detail,
    );
  }

  /** v0.1 Send Inquiry: one `information` request carrying the collector's
   * message, linked to the artwork. */
  inquire(artwork: Artwork, message: string): Promise<boolean> {
    const text = message.trim();
    if (!text) return Promise.resolve(false);
    return this.file(
      RequestController.actKey(artwork.id, 'inquiry'),
      'inquiry',
      subjectOf(artwork),
      {
        message: text,
      },
    );
  }

  /** Make an offer. `amount` is already validated by the caller (the sheet owns
   * the empty/floor messages so it can put them next to the field). It goes on
   * the wire as a decimal string, the schema's own type for it (G-F1-1). */
  offer(artwork: Artwork, amount: number, currency: Currency | ''): Promise<boolean> {
    return this.file(
      RequestController.offerKey(artwork.id, amount),
      'offer',
      subjectOf(artwork),
      {
        amount: String(amount),
        currency,
      },
    );
  }

  /** Request viewing — `preferred_time` (ISO-8601) and `mode`, both required
   * by the backend's `ViewingDetailSerializer` (apps/crm/serializers.py:29-31). */
  requestViewing(
    artwork: Artwork,
    preferredTime: string,
    mode: ViewingMode,
  ): Promise<boolean> {
    return this.act(artwork, 'visit', { preferred_time: preferredTime, mode });
  }

  /** Request Price & Availability — the sheet's message (app.html:11049). */
  requestPrice(artwork: Artwork, message: string): Promise<boolean> {
    return this.act(artwork, 'price', { message: message.trim() });
  }

  /** app.html:11033-11044 — "Enquire about works by <artist>": one
   * `information` request with no artwork. The artist goes out as the
   * request's `artist` id (G-P5-11, adopted in V1 Phase 9a) AND stays named in
   * the message text, which is the old app's own wording — no visible change. */
  enquireAboutArtist(artist: ArtistSubject): Promise<boolean> {
    const copy = CONFIRM_COPY.artist;
    return this.file(
      RequestController.artistKey(artist.id),
      'artist',
      { artworkId: null, artistId: artist.id, work: artist.display_name },
      { message: `Please let me know about available works by ${artist.display_name}.` },
      { title: copy.title, message: copy.message.replace('{artist}', artist.display_name) },
    );
  }

  dismissConfirmation(): void {
    if (this.getSnapshot().confirmation) this.patch({ confirmation: null });
  }
  clearError(): void {
    if (this.getSnapshot().error) this.patch({ error: null });
  }

  private async file(
    key: string,
    verb: ActionVerb,
    subject: Subject,
    detail?: RequestDetailInput,
    copy: { title: string; message: string } = CONFIRM_COPY[verb],
  ): Promise<boolean> {
    const { pending } = this.getSnapshot();
    if (pending.has(key)) return false; // the double-tap guard
    this.patch({ pending: withKey(pending, key), error: null });

    try {
      const { row, replayed } = await this.crm.createRequest({
        kind: ACTION_KIND[verb],
        artwork: subject.artworkId,
        ...(subject.artistId ? { artist: subject.artistId } : {}),
        ...(detail ? { detail } : {}),
        client_req_id: this.clientRequestId(key),
      });
      this.clientIds.delete(key);
      const filed = this.getSnapshot().filed.filter((r) => r.id !== row.id);
      this.patch({
        filed: [row, ...filed],
        lastFiled: { key, request: row, replayed },
        confirmation: {
          verb,
          artworkId: subject.artworkId,
          title: copy.title,
          message: copy.message,
          work: subject.work,
          at: Date.now(),
        },
      });
      return true;
    } catch (err: unknown) {
      this.patch({ error: messageOf(err) });
      return false;
    } finally {
      this.patch({ pending: withoutKey(this.getSnapshot().pending, key) });
    }
  }
}

// --- helpers ---------------------------------------------------------------

function subjectOf(artwork: Artwork): Subject {
  return { artworkId: artwork.id, work: workLine(artwork) };
}

/** A fresh idempotency key (≤ 64 chars, the backend's `client_req_id` limit). */
function newClientId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

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
export function workLine(artwork: {
  artist?: { display_name?: string | null } | null;
  title?: string | null;
}): string {
  const artist = artwork.artist?.display_name ?? '';
  const title = artwork.title ?? '';
  return [artist, title].filter(Boolean).join(' — ');
}

/** app.html:11046 — the request-price sheet's work line adds the year:
 * "Artist — Title, 2023". */
export function workLineWithYear(artwork: Pick<Artwork, 'artist' | 'title' | 'year'>): string {
  const line = workLine(artwork);
  return artwork.year ? `${line}, ${artwork.year}` : line;
}

/** Calm and factual — never a stack trace (VOICE_AND_COPY.md). */
function messageOf(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Something went wrong.';
}
