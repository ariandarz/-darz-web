/**
 * Auction-record insights — pure, evidence-based arithmetic over one artist's
 * verified records. Nothing here invents data: every figure is computed from
 * fields the records actually carry, inside ONE currency, and every block is
 * gated on having enough of them to be honest (the old artist page's rule,
 * app.html:5341-5381: "each box appears only when its value is accurately
 * computable").
 *
 * Definitions (all on SOLD records with a positive result, in the dominant
 * sale currency — never mixed, never converted):
 *   result        = price_amount (the display figure; realized > hammer)
 *   estimate mid  = (low + high) / 2 when both are present
 *   vs estimate   = (result − mid) / mid, averaged over records with both
 *   trend         = newest half vs oldest half of the dated sold series,
 *                   ≥ 4 sales: > +10% Rising, < −10% Declining, else Stable
 */
import type { AuctionRecord } from '../../api/types';

/** The five houses v0.1 shows. Matching is case- and apostrophe-insensitive
 * ("Sotheby's" / "Sotheby’s" / "SOTHEBYS"). */
export const V0_1_HOUSES = ["Sotheby's", "Christie's", 'Bonhams', 'Tehran Auction', 'Millon'];

export function houseKey(house: string | null | undefined): string {
  return String(house ?? '')
    .toLowerCase()
    .replace(/[’'`´]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
const ALLOWED = new Set(V0_1_HOUSES.map(houseKey));

/** Is this record from one of the v0.1 houses? */
export function isAllowedHouse(record: Pick<AuctionRecord, 'house'>): boolean {
  return ALLOWED.has(houseKey(record.house));
}

/** The canonical display name for an allowed house (or the raw value). */
export function houseLabel(house: string | null | undefined): string {
  const k = houseKey(house);
  return V0_1_HOUSES.find((h) => houseKey(h) === k) ?? String(house ?? '');
}

export function num(v: string | number | null | undefined): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function resultOf(r: AuctionRecord): number {
  return num(r.price_amount) || num(r.realized_amount) || num(r.hammer_amount);
}

export function estimateMid(r: AuctionRecord): number {
  const lo = num(r.low_estimate);
  const hi = num(r.high_estimate);
  return lo > 0 && hi > 0 ? (lo + hi) / 2 : 0;
}

export function isSold(r: AuctionRecord): boolean {
  return (r.status ?? 'sold') === 'sold' && resultOf(r) > 0;
}

export function saleYear(r: AuctionRecord): number | null {
  if (!r.sale_date) return null;
  const y = Number(String(r.sale_date).slice(0, 4));
  return Number.isFinite(y) && y > 1900 ? y : null;
}

export interface YearPoint {
  year: number;
  sales: number;
  /** highest result that year */
  high: number;
  /** median result that year */
  median: number;
}

export interface ArtistInsights {
  currency: string | null;
  records: number;
  sales: number;
  /** sold ÷ (sold + unsold/passed) — needs ≥ 3 real appearances */
  sellThrough: number | null;
  highest: AuctionRecord | null;
  lowest: AuctionRecord | null;
  /** the 3 most recent sold results */
  recent: AuctionRecord[];
  /** by year, oldest first — needs ≥ 2 years */
  byYear: YearPoint[];
  /** average (result − estimate mid)/mid — needs ≥ 2 records with both */
  vsEstimate: number | null;
  /** share of sales above their high estimate, same gate */
  aboveHighShare: number | null;
  trend: 'Rising' | 'Stable' | 'Declining' | null;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** The dominant sale currency — the one most sold records carry. */
export function dominantCurrency(sold: AuctionRecord[]): string | null {
  const counts = new Map<string, number>();
  for (const r of sold)
    if (r.currency) counts.set(r.currency, (counts.get(r.currency) ?? 0) + 1);
  let best: string | null = null;
  for (const [c, n] of counts) if (best === null || n > (counts.get(best) ?? 0)) best = c;
  return best;
}

export function artistInsights(records: AuctionRecord[]): ArtistInsights {
  const past = records.filter((r) => (r.section ?? 'past') === 'past');
  const appearances = past.filter((r) => (r.status ?? 'sold') !== 'pending');
  const soldAll = appearances.filter(isSold);
  const currency = dominantCurrency(soldAll);
  const sold = currency ? soldAll.filter((r) => r.currency === currency) : [];

  const byResult = [...sold].sort((a, b) => resultOf(b) - resultOf(a));
  const dated = sold
    .filter((r) => r.sale_date)
    .sort((a, b) => String(a.sale_date).localeCompare(String(b.sale_date)));

  const years = new Map<number, number[]>();
  for (const r of dated) {
    const y = saleYear(r);
    if (y) years.set(y, [...(years.get(y) ?? []), resultOf(r)]);
  }
  const byYear: YearPoint[] = [...years.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, xs]) => ({
      year,
      sales: xs.length,
      high: Math.max(...xs),
      median: median(xs),
    }));

  const withEst = sold.filter((r) => estimateMid(r) > 0);
  const perf = withEst.map((r) => (resultOf(r) - estimateMid(r)) / estimateMid(r));
  const aboveHigh = withEst.filter((r) => resultOf(r) > num(r.high_estimate)).length;

  let trend: ArtistInsights['trend'] = null;
  if (dated.length >= 4) {
    const half = Math.floor(dated.length / 2);
    const avg = (xs: AuctionRecord[]) => xs.reduce((a, r) => a + resultOf(r), 0) / xs.length;
    const older = avg(dated.slice(0, half));
    const newer = avg(dated.slice(dated.length - half));
    if (older > 0) {
      const ratio = newer / older;
      trend = ratio > 1.1 ? 'Rising' : ratio < 0.9 ? 'Declining' : 'Stable';
    }
  }

  return {
    currency,
    records: records.length,
    sales: sold.length,
    sellThrough: appearances.length >= 3 ? soldAll.length / appearances.length : null,
    highest: byResult[0] ?? null,
    lowest: byResult.length > 1 ? byResult[byResult.length - 1] : null,
    recent: [...dated].reverse().slice(0, 3),
    byYear: byYear.length >= 2 ? byYear : [],
    vsEstimate: perf.length >= 2 ? perf.reduce((a, b) => a + b, 0) / perf.length : null,
    aboveHighShare: withEst.length >= 2 ? aboveHigh / withEst.length : null,
    trend,
  };
}
