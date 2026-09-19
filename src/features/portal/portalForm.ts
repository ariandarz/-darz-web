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
  PortalSnapshot,
  PortalWork,
} from '../../api/types';
import type { OptionsMap } from '../../api/services';

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
    else sub += entry.default_price;
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
