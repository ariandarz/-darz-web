/**
 * portalForm — the portal's pure change model, ported from the old
 * `gallery-update.html` page logic (build 914) and re-aimed at the new
 * backend's update contract (`apps/gallery/services.py::GalleryUpdateService`).
 *
 * The submission discipline is the old page's: ONE update per work per send,
 * whose `kind` is the dominant change (`kindOf`, gallery-update.html:1424)
 * and whose payload carries the WHOLE edit plus its before-values
 * (`payloadFor`, :1425 — "WHAT IT WAS, at the moment of submission").
 * What changed for the new backend:
 *
 *  - a status change submits kind `availability` with `availability_status`
 *    in the catalogue vocabulary, because that is the one key approval
 *    auto-applies (`GalleryUpdateService.approve`); the old page's separate
 *    'status' kind is record-only there.
 *  - a plain "still available" confirmation is kind `availability` WITHOUT
 *    `availability_status`, so approving it never asks the catalogue for a
 *    self-transition.
 *  - a price edit carries `price_amount` + `currency` (the `_PRICE_FIELDS`
 *    approval applies), cleaned of the display separators.
 */
import type {
  Choice,
  PortalCatalogueEntry,
  PortalExhibition,
  PortalMessage,
  PortalPricelist,
  PortalPricelistBuild,
  PortalPricelistLine,
  PortalPricelistLineInput,
  PortalSnapshot,
  PortalState,
  PortalUpdate,
  PortalWork,
} from '../../api/types';
import type { OptionsMap } from '../../api/services';
import { HttpError } from '../../api/errors';
import { asArray } from '../../api/shapes';

/* ── formatting (gallery-update.html:663, :666) ─────────────────────────── */

/** Thousands separators for pure numbers; anything textual is untouched. */
export function fmtThousands(v: string | number | null | undefined): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const n = s.replace(/[,\s ٬]/g, '');
  if (/^\d+(\.\d+)?$/.test(n)) {
    const p = n.split('.');
    return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (p[1] ? '.' + p[1] : '');
  }
  return s;
}

/** `["works-on-paper","mixed-media"]` (stringified or real) → "Works on paper · Mixed media". */
export function prettyMedium(m: string | null | undefined): string {
  let s = String(m ?? '').trim();
  if (!s) return '';
  if (s.charAt(0) === '[') {
    try {
      const arr: unknown = JSON.parse(s);
      if (Array.isArray(arr)) s = arr.join(', ');
    } catch {
      s = s.replace(/[[\]"']/g, '');
    }
  }
  return s
    .split(',')
    .map((p) => {
      const t = p.replace(/[_-]+/g, ' ').trim();
      return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
    })
    .filter(Boolean)
    .join(' · ');
}

/* ── the per-work edit model (gallery-update.html:1406-1419) ────────────── */

export interface PortalDraft {
  /** chosen availability (catalogue vocabulary) — unset = untouched */
  status?: string;
  price?: string;
  currency?: string;
  city?: string;
  shippingNote?: string;
  provenance?: string;
  viewing?: boolean;
  hold2w?: boolean;
  needsCorrection?: boolean;
  imageNeedsUpdate?: boolean;
  note?: string;
  /** "What collectors can do" — unset = untouched (G-PORT-8: advisory). */
  offerActions?: string[];
  offerFloor?: string;
  offerCurrency?: string;
  /** A replacement photo attached to this card (G-PORT-1) — it goes to its
   * own multipart endpoint on Send update, as a pending `image` update. */
  imageFile?: File;
}

export function statusChanged(draft: PortalDraft, original: string): boolean {
  return !!(draft.status && draft.status !== (original || 'available'));
}

function hasText(v: string | undefined): boolean {
  return !!(v && v.trim());
}

/** Any submittable edit at all — mirrors `hasChange` (:1411) plus the offer
 * block, which the old page saved separately and the new one rides along. */
export function hasChange(draft: PortalDraft, original: string): boolean {
  return !!(
    statusChanged(draft, original) ||
    hasText(draft.price) ||
    hasText(draft.currency) ||
    draft.needsCorrection ||
    draft.imageNeedsUpdate ||
    hasText(draft.note) ||
    hasText(draft.city) ||
    hasText(draft.shippingNote) ||
    hasText(draft.provenance) ||
    draft.viewing ||
    draft.hold2w ||
    draft.offerActions !== undefined ||
    hasText(draft.offerFloor)
  );
}

/** The dominant change decides the kind — old `kindOf` (:1424) priority,
 * with 'status' folded into 'availability' (see the header). */
export function updateKind(draft: PortalDraft, original: string): string {
  if (statusChanged(draft, original)) return 'availability';
  if (hasText(draft.price) || hasText(draft.currency)) return 'price';
  if (draft.needsCorrection || hasText(draft.city)) return 'correction';
  if (draft.imageNeedsUpdate) return 'image';
  if (
    hasText(draft.note) ||
    hasText(draft.shippingNote) ||
    hasText(draft.provenance) ||
    draft.viewing ||
    draft.hold2w ||
    draft.offerActions !== undefined ||
    hasText(draft.offerFloor)
  )
    return 'note';
  return 'availability'; // the plain "still available" confirmation
}

/** Digits-only decimal for the backend's DecimalField. */
function cleanAmount(v: string | undefined): string {
  return String(v ?? '').replace(/[,\s ٬]/g, '');
}

/**
 * The update payload — old `payloadFor` (:1425) with the auto-applied keys
 * spelled the way `GalleryUpdateService.approve` reads them. Everything else
 * is context for the reviewer (the desk renders the payload verbatim).
 */
export function buildUpdatePayload(
  work: { snapshot: PortalSnapshot },
  draft: PortalDraft,
  staff: string,
): Record<string, unknown> {
  const s = work.snapshot || {};
  const original = s.availability_status || 'available';
  const chosen = draft.status || original;
  const payload: Record<string, unknown> = {
    artist: s.artist || '',
    title: s.title || '',
    chosenStatus: chosen,
    fromStatus: original,
    fromPrice: String(s.price_amount ?? ''),
    fromCurrency: String(s.currency ?? ''),
    confirmAvailable: chosen === 'available',
    priceChanged: !!(hasText(draft.price) || hasText(draft.currency)),
    needsCorrection: !!draft.needsCorrection,
    imageNeedsUpdate: !!draft.imageNeedsUpdate,
    city: draft.city || '',
    shippingNote: draft.shippingNote || '',
    provenance: draft.provenance || '',
    viewing: !!draft.viewing,
    hold2w: !!draft.hold2w,
    note: draft.note || '',
  };
  if (statusChanged(draft, original)) payload.availability_status = chosen;
  if (hasText(draft.price)) payload.price_amount = cleanAmount(draft.price);
  if (hasText(draft.currency)) payload.currency = draft.currency;
  if (draft.offerActions !== undefined) payload.offer_actions = draft.offerActions;
  if (hasText(draft.offerFloor)) {
    payload.offer_floor = cleanAmount(draft.offerFloor);
    payload.offer_currency = draft.offerCurrency || s.currency || '';
  }
  if (staff) payload.staff = staff;
  return payload;
}

/* ── new-work card (gallery-update.html:1443) ───────────────────────────── */

export interface NewWorkDraft {
  tid: number;
  artist: string;
  title: string;
  year: string;
  medium: string;
  dimensions: string;
  price: string;
  currency: string;
  status: string;
  note: string;
  submitted: boolean;
}

export function blankNewWork(tid: number): NewWorkDraft {
  return {
    tid,
    artist: '',
    title: '',
    year: '',
    medium: '',
    dimensions: '',
    price: '',
    currency: 'USD',
    status: 'available',
    note: '',
    submitted: false,
  };
}

export function buildNewWorkPayload(n: NewWorkDraft, staff: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    artist: n.artist || '',
    title: n.title || '',
    year: n.year || '',
    medium: n.medium || '',
    dimensions: n.dimensions || '',
    price: fmtThousands(n.price || ''),
    currency: n.currency || '',
    status: n.status || 'available',
    note: n.note || '',
  };
  if (staff) payload.staff = staff;
  return payload;
}

/* ── sales funnel (gallery-update.html:980-996, v923) ───────────────────── */

/** Stage → sort rank (old FN_ORDER, :980) on the backend's enum. The old
 * page's 'In Discussion' has no server stage and does not port. */
export const FUNNEL_ORDER: Record<string, number> = {
  offer_received: 0,
  on_hold: 1,
  requested: 2,
  saved: 3,
  viewed: 4,
  reserved: 5,
  listed: 6,
  sold: 7,
  withdrawn: 8,
};

/** Stage → tone class + the two lines of the old drawer copy (:983-993). */
export const FUNNEL_META: Record<string, { c: string; n: string; nx: string }> = {
  listed: {
    c: 'st-listed',
    n: 'Shared with Darz and live in the Market App.',
    nx: 'Keep the price and details current so it’s ready.',
  },
  viewed: {
    c: 'st-viewed',
    n: 'Collectors have opened this work.',
    nx: 'Gaining attention — nothing needed yet.',
  },
  saved: {
    c: 'st-saved',
    n: 'A collector added this to their saved list.',
    nx: 'Quietly gaining interest.',
  },
  requested: {
    c: 'st-req',
    n: 'A price, availability or viewing request came in.',
    nx: 'Darz is following up — you’ll see the outcome here.',
  },
  offer_received: {
    c: 'st-offer',
    n: 'A collector made an offer.',
    nx: 'Darz is reviewing it. No action needed from you yet.',
  },
  on_hold: {
    c: 'st-hold',
    n: 'Held for a collector while they decide.',
    nx: 'Confirm you can hold this work if Darz asks.',
  },
  reserved: {
    c: 'st-res',
    n: 'Committed to a buyer, pending payment.',
    nx: 'Not available to others for now.',
  },
  sold: {
    c: 'st-sold',
    n: 'This work has sold.',
    nx: 'Deal complete — kept here for your records.',
  },
  withdrawn: {
    c: 'st-wd',
    n: 'Withdrawn from the Market App.',
    nx: 'No longer being shown to collectors.',
  },
};

export function funnelMeta(stage: string) {
  return FUNNEL_META[stage] || FUNNEL_META.listed;
}

export function workStage(w: PortalWork): string {
  return w.funnel?.stage || 'listed';
}

/** "today" / "3 days ago" / ISO date — old `fnAgo` (:996), from an ISO stamp. */
export function agoLabel(iso: string | null | undefined): string {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '';
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return '1 day ago';
  if (d < 30) return `${d} days ago`;
  return iso.slice(0, 10);
}

/** Statuses that read as "gone" for the dashboard (old ARCH, :1132 — only
 * the values that exist in the catalogue vocabulary). */
export const GONE_STATUSES = ['sold', 'withdrawn', 'archived'];

/* ── exhibitions (gallery-update.html:1495-1515, §78/§91) ───────────────── */

/** May the source still edit / (re)submit? Mirrors the server guard exactly:
 * `_PORTAL_EDITABLE_STATES = (draft, requested)` (`exhibitions.py:36`). */
export function canEditExhibition(ex: Pick<PortalExhibition, 'request_status'>): boolean {
  return ex.request_status === 'draft' || ex.request_status === 'requested';
}

export function catalogueByKey(
  cat: PortalCatalogueEntry[],
): Map<string, PortalCatalogueEntry> {
  return new Map(cat.map((c) => [c.key, c]));
}

const num = (v: string | number | null | undefined): number => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export interface ExhibitionTotals {
  sub: number;
  disc: number;
  tot: number;
  count: number;
  unpriced: number;
}

/**
 * Old `exhEvTotals` (:1511) on the new shapes. Once Darz has published the
 * composed package, the REAL `service_lines` are the truth (declined lines
 * don't count); before that, the working selection priced from the catalogue
 * defaults (`default_price` null = unpriced — "Pricing to be announced").
 */
export function exhibitionTotals(
  ex: PortalExhibition,
  selection: string[],
  cat: PortalCatalogueEntry[],
): ExhibitionTotals {
  const disc = num(ex.discount);
  if (ex.published && ex.service_lines.length) {
    let sub = 0;
    let unpriced = 0;
    for (const line of ex.service_lines) {
      if (line.status === 'declined') continue;
      if (line.price === null || line.price === '') unpriced++;
      else sub += num(line.price);
    }
    return {
      sub,
      disc,
      tot: Math.max(0, sub - disc),
      count: ex.service_lines.length,
      unpriced,
    };
  }
  const byKey = catalogueByKey(cat);
  let sub = 0;
  let unpriced = 0;
  for (const key of selection) {
    const entry = byKey.get(key);
    if (!entry || entry.default_price === null) unpriced++;
    else sub += num(entry.default_price);
  }
  return { sub, disc, tot: Math.max(0, sub - disc), count: selection.length, unpriced };
}

/** €/$/£ prefix, else the code + space — old `curSym` (:758); TMN reads T. */
export function curSym(c: string | null | undefined): string {
  const code = String(c || '').toUpperCase();
  if (code === 'EUR') return '€';
  if (code === 'USD') return '$';
  if (code === 'GBP') return '£';
  if (code === 'TMN' || code === 'T') return 'T ';
  return code ? `${code} ` : '';
}

export function exhibitionMoney(currency: string | null | undefined, n: number): string {
  return curSym(currency) + fmtThousands(Math.round(n));
}

/* ── link theme ─────────────────────────────────────────────────────────── */

/** The portal follows ITS LINK's theme, not the device (the old page applies
 * the load RPC's `theme`, :707). The new `theme` is a JSON blob — read
 * `mode`, tolerating the old plain-string form. Default light. */
export function portalIsDark(theme: unknown): boolean {
  if (theme === 'dark') return true;
  return (
    typeof theme === 'object' &&
    theme !== null &&
    (theme as { mode?: unknown }).mode === 'dark'
  );
}

/* ── options + date helpers shared by the portal views ──────────────────── */

export function choices(options: OptionsMap | null, key: string): Choice[] {
  return (options?.[key] as Choice[] | undefined) ?? [];
}

/** `{value,label}` lookup with the raw-value fallback (CLAUDE.md: labels come
 * from `GET /api/options/`, never a hardcoded map — the portal reaches it
 * because the endpoint is `AllowAny`). */
export function choiceLabel(
  options: OptionsMap | null,
  key: string,
  value: string | null | undefined,
): string {
  if (!value) return '';
  const hit = choices(options, key).find((c) => c.value === value);
  return hit?.label ?? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

/** "5 Sept 2026" (old `fmtDate`, gallery-update.html:1131). */
export function fmtDate(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "5 Sept, 14:20" (old `fmtDateTime`, :932). */
export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** v872 (gallery-update.html:783-788) — one portal serves galleries, artists,
 * collectors and dealers; the link's `source_type` drives every label. */
export const SRC_LABELS: Record<
  string,
  { noun: string; portal: string; eyebrow: string; enter: string }
> = {
  gallery: {
    noun: 'Gallery',
    portal: 'Gallery Update Portal',
    eyebrow: 'Gallery update portal',
    enter: 'Enter Gallery Portal',
  },
  artist: {
    noun: 'Artist',
    portal: 'Artist Portal',
    eyebrow: 'Artist portal',
    enter: 'Enter Artist Portal',
  },
  collector: {
    noun: 'Collector',
    portal: 'Collector Portal',
    eyebrow: 'Collector portal',
    enter: 'Enter Collector Portal',
  },
  dealer: {
    noun: 'Dealer',
    portal: 'Dealer Portal',
    eyebrow: 'Dealer portal',
    enter: 'Enter Dealer Portal',
  },
};

export function srcLabels(sourceType: string | undefined) {
  return SRC_LABELS[sourceType ?? 'gallery'] ?? SRC_LABELS.gallery;
}

/* ── the state read, normalised (C-8) ───────────────────────────────────── */

/**
 * `portal_state` is hand-typed (`views.py:95-114`); the schema declares it as a
 * bare `GalleryLink`, so nothing checks the embedded lists at build time. Every
 * one of them goes through `asArray` here, once, so a missing or malformed list
 * renders as empty instead of blanking the portal (HANDOFF §6).
 */
export function normalisePortalState(raw: unknown): PortalState {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<PortalState> &
    Record<string, unknown>;
  const works = asArray<PortalWork>(r.assigned_artworks).map((w) => ({
    ...w,
    snapshot: (w.snapshot && typeof w.snapshot === 'object'
      ? w.snapshot
      : {}) as PortalSnapshot,
    image_url: typeof w.image_url === 'string' && w.image_url ? w.image_url : null,
  }));
  return {
    ...(r as PortalState),
    assigned_artworks: works,
    pricelists: asArray<PortalPricelist>(r.pricelists).map((p) => ({
      ...p,
      lines: asArray<PortalPricelistLine>(p.lines),
    })),
    messages: asArray<PortalMessage>(r.messages),
    updates: asArray<PortalUpdate>(r.updates),
    cover: typeof r.cover === 'string' && r.cover ? r.cover : null,
  };
}

/** The header's cover (G-PORT-9) with the old caption "artist — title"
 * (`renderCover`, gallery-update.html:852-856). The server names only the
 * URL — it is the first assigned work WITH an image — so the caption is read
 * off that same work. */
export function coverOf(data: Pick<PortalState, 'cover' | 'assigned_artworks'>): {
  url: string;
  caption: string;
} | null {
  if (!data.cover) return null;
  const w = data.assigned_artworks.find((a) => a.image_url === data.cover);
  const s = w?.snapshot ?? {};
  const caption = [s.artist || '', s.title ? ` — ${s.title}` : ''].join('').trim();
  return { url: data.cover, caption };
}

/* ── the server's own updates: Sent pills, Pending review, History (G-PORT-2) ─ */

/** artwork id → the newest PENDING update's stamp — the old `setPending`
 * (gallery-update.html:929), now read off `updates[]` instead of a separate
 * pending list. */
export function pendingStamps(updates: readonly PortalUpdate[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const u of updates) {
    if (u.status !== 'pending' || !u.artwork) continue;
    if (!out[u.artwork] || String(u.created_at) > String(out[u.artwork]))
      out[u.artwork] = u.created_at;
  }
  return out;
}

/** The old dashboard's fourth tile, "Pending review" (`renderDash`, :1140) —
 * every pending submission the portal has sent, per-work or not. */
export function pendingCount(updates: readonly PortalUpdate[]): number {
  return updates.filter((u) => u.status === 'pending').length;
}

/** Newest first — the History tab's order (collaboration-agreement.js:468). */
export function historyRows(updates: readonly PortalUpdate[]): PortalUpdate[] {
  return [...updates].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

const payloadOf = (u: Pick<PortalUpdate, 'payload'>) =>
  (u.payload && typeof u.payload === 'object' ? u.payload : {}) as Record<string, unknown>;

/** Which work an entry is about — old `histTitle` (gallery-update.html:2130-2135). */
export function historyTitle(u: PortalUpdate, works: readonly PortalWork[]): string {
  const w = u.artwork ? works.find((x) => x.artwork === u.artwork) : undefined;
  if (w) return `${w.snapshot.artist || '—'} — ${w.snapshot.title || 'Untitled'}`;
  const p = payloadOf(u);
  const t = [p.artist, p.title].filter((v) => typeof v === 'string' && v).join(' — ');
  return t || (u.artwork ? 'A work no longer in your portal' : 'This portal');
}

/**
 * The one line that says what a submission asked for — old `historyWhat`
 * (collaboration-agreement.js:254-267) on the new payload keys. The kind's
 * own word comes from `gallery.update_kind` (options), never a local map.
 */
export function historyWhat(u: PortalUpdate, options: OptionsMap | null): string {
  const p = payloadOf(u);
  if (u.kind === 'availability' || u.kind === 'status') {
    const to = typeof p.availability_status === 'string' ? p.availability_status : '';
    return to
      ? `Reported as ${choiceLabel(options, 'catalog.availability_status', to)}`
      : 'Confirmed as current';
  }
  if (u.kind === 'price') {
    const amt = p.price_amount;
    return amt !== undefined && amt !== null && String(amt) !== ''
      ? `New price ${fmtThousands(String(amt))}${p.currency ? ` ${String(p.currency)}` : ''}`
      : 'Price updated';
  }
  return choiceLabel(options, 'gallery.update_kind', u.kind);
}

/** What the source wrote — the note, or an ask's question. */
export function historyNote(u: PortalUpdate): string {
  const p = payloadOf(u);
  const v = u.kind === 'ask' ? p.question : p.note;
  return typeof v === 'string' ? v.trim() : '';
}

/** Kinds whose approval writes to the artwork (`GalleryUpdateService.approve`);
 * approving any other kind records Darz's decision only. */
const APPLIED_KINDS = ['availability', 'price', 'correction'];

/**
 * What a state MEANS, in the gallery's words — old `HISTORY_STATE_NOTE`
 * (collaboration-agreement.js:235-242). `approved` keeps the old "stands in
 * the Darz catalogue" only for the kinds approval really applies; for the
 * rest it is the old `handled` sentence, which is what approval now is.
 */
export function historyStateNote(u: Pick<PortalUpdate, 'kind' | 'status'>): string {
  if (u.status === 'pending')
    return 'Darz has this and will review it. Nothing more is needed from you.';
  if (u.status === 'rejected')
    return 'Darz did not adopt this change. Message Darz if it should be revisited.';
  if (u.status === 'approved')
    return APPLIED_KINDS.includes(u.kind)
      ? 'Darz accepted this and it now stands in the Darz catalogue.'
      : 'Darz has dealt with this.';
  return '';
}

/* ── per-work ask / withdraw / replacement image (G-PORT-4 / 6 / 1) ─────── */

/** An `ask`: a question about ONE assigned work (`GalleryUpdate.KIND_ASK`).
 * The desk renders `question`; artist/title ride for the reviewer, the same
 * context `buildUpdatePayload` sends. */
export function buildAskPayload(
  work: { snapshot: PortalSnapshot },
  question: string,
  staff: string,
): Record<string, unknown> {
  const s = work.snapshot || {};
  const payload: Record<string, unknown> = {
    artist: s.artist || '',
    title: s.title || '',
    question: question.trim(),
  };
  if (staff) payload.staff = staff;
  return payload;
}

/** A `withdraw`: the old §79 "Remove from portal" (gallery-update.html:
 * 1209-1224), now a REQUEST — approving it unassigns the work
 * (`GalleryUpdateService.approve`, G-PORT-6). */
export function buildWithdrawPayload(
  work: { snapshot: PortalSnapshot },
  staff: string,
): Record<string, unknown> {
  const s = work.snapshot || {};
  const payload: Record<string, unknown> = {
    artist: s.artist || '',
    title: s.title || '',
    fromStatus: s.availability_status || 'available',
  };
  if (staff) payload.staff = staff;
  return payload;
}

/** The same ceiling as a pricelist file (the old page's own 6 MB, :1059). */
export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

/**
 * Why a picked replacement photo cannot go, or `null` when it can. The old
 * input took `image/*` and downscaled in a canvas (`downscale`, :1474); here
 * the file goes as picked, so the size is guarded instead. The size line is
 * the old new-work refusal (:1447); the type line has no old source (the old
 * `accept` filter was the only guard) — flagged.
 */
export function imageFileProblem(file: Pick<File, 'size' | 'type'>): string | null {
  if (!/^image\//.test(file.type || ''))
    return 'That file is not an image — choose a JPG or PNG.';
  if (file.size > MAX_UPLOAD_BYTES) return 'That image is too large — use a smaller file.';
  return null;
}

/* ── the pricelist builder (P3b; old `buildOpen`/`buildSubmit`, :1111-1128) ─ */

export interface BuilderLine {
  /** an assigned work's artwork id, or '' for a work typed by title */
  artwork: string;
  title: string;
  price: string;
  currency: string;
  /** a `catalog.availability_status` value (Q-7), or '' */
  availability: string;
  note: string;
}

/** The old `blankItem()` (:1111) on the new line shape. */
export function blankBuilderLine(currency = 'USD'): BuilderLine {
  return { artwork: '', title: '', price: '', currency, availability: '', note: '' };
}

/**
 * The wire body — or the old refusal. As the old `buildSubmit` (:1121), a row
 * with neither a work nor a title is skipped, and nothing left means "Add at
 * least one work." (the server's `allow_empty=False`).
 */
export function buildPricelistBody(
  lines: readonly BuilderLine[],
): { ok: true; body: PortalPricelistBuild; index: number[] } | { ok: false; error: string } {
  const index: number[] = [];
  const out: PortalPricelistLineInput[] = [];
  lines.forEach((l, i) => {
    if (!l.artwork && !l.title.trim()) return;
    index.push(i);
    const price = cleanAmount(l.price);
    out.push({
      artwork: l.artwork || null,
      work_title: l.title.trim(),
      price: price === '' ? null : price,
      currency: l.currency || '',
      availability: l.availability || '',
      note: l.note.trim(),
    });
  });
  if (!out.length) return { ok: false, error: 'Add at least one work.' };
  return { ok: true, body: { lines: out }, index };
}

/**
 * Per-line messages from a 400 — `details.lines` is DRF's list of per-line
 * error objects (`[{}, {"non_field_errors": [...]}]`), which the flat
 * `ValidationError.fields` cannot carry, so it is read off the raw body.
 * `index` maps a sent line back to the row on screen (skipped blanks shift it).
 */
export function builderLineErrors(
  err: unknown,
  index: readonly number[],
): Record<number, string> {
  const body = err instanceof HttpError ? err.body : null;
  const details = (body as { error?: { details?: { lines?: unknown } } } | null)?.error
    ?.details;
  const out: Record<number, string> = {};
  asArray<unknown>(details?.lines).forEach((entry, i) => {
    if (!entry || typeof entry !== 'object') return;
    const msgs = Object.values(entry as Record<string, unknown>).flatMap((v) =>
      Array.isArray(v) ? v.map(String) : [String(v)],
    );
    if (msgs.length) out[index[i] ?? i] = msgs.join(' ');
  });
  return out;
}

/** Pricelist `status` has no `/api/options/` entry (C-14): the raw value,
 * capitalised, until the backend registers one. */
export function pricelistStatusLabel(options: OptionsMap | null, status: string): string {
  return choiceLabel(options, 'gallery.pricelist_status', status || 'submitted');
}
