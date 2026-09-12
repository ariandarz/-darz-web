/**
 * Record display helpers — the monogram placeholder, the sale-date label,
 * the estimate line and the status-driven result kind (`_priceBlock`,
 * app.html:4971-4975: "Sold" only with a real price). Pure; shared by the
 * cards, the rows, the detail page and the artist page.
 */
import type { AuctionRecord } from '../../api/types';
import { formatMoney } from '../catalogue/format';
import { num, resultOf } from './insights';

export function monogram(name: string): string {
  const p = name.trim().split(/\s+/);
  return (
    ((p[0]?.[0] ?? '') + (p.length > 1 ? (p[p.length - 1]?.[0] ?? '') : '')).toUpperCase() ||
    '·'
  );
}

export function saleDateLabel(iso: string | null | undefined, long = false): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(
    'en-GB',
    long
      ? { day: 'numeric', month: 'long', year: 'numeric' }
      : { month: 'short', year: 'numeric' },
  );
}

export function estimateLine(r: AuctionRecord): string {
  const lo = num(r.low_estimate);
  const hi = num(r.high_estimate);
  if (lo && hi)
    return `${formatMoney(lo)} – ${formatMoney(hi)}${r.currency ? ' ' + r.currency : ''}`;
  if (lo || hi) return `${formatMoney(lo || hi)}${r.currency ? ' ' + r.currency : ''}`;
  return '';
}

export type ResultKind = 'sold' | 'estimate' | 'status';
export function resultStatus(r: AuctionRecord): { kind: ResultKind; label: string } {
  const st = r.status ?? 'sold';
  if (st === 'sold' && resultOf(r) > 0) return { kind: 'sold', label: 'Sold' };
  if (st === 'pending') return { kind: 'estimate', label: 'Final price pending' };
  if (st === 'sold') return { kind: 'estimate', label: 'Estimate only' };
  const LABEL: Record<string, string> = {
    unsold: 'Unsold',
    passed: 'Passed',
    withdrawn: 'Withdrawn',
  };
  return { kind: 'status', label: LABEL[st] ?? st };
}
