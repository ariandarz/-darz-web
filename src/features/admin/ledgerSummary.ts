/**
 * Normalising the Accounting desk's per-currency summary.
 *
 * The fourth instance of one failure in this repo, and the second to blank a
 * whole desk: `GET /accounting/admin/ledger/summary/` answers
 * `{book, month, currencies, by_currency, converted_income}`, the desk trusted
 * it, and `summary.currencies.length` threw
 * `Cannot read properties of undefined (reading 'length')` during render — so
 * `/admin/accounting` went **completely blank**, books, filters and all.
 *
 * `summary` being non-null is not the same question as `summary` having the
 * right shape, which is the trap: the desk guarded `summary &&` and that guard
 * passes for *any* object, including the empty paginated envelope the E2E stub
 * answers for an unmatched GET. See `artworkFacets.ts` for the same reasoning
 * written out at length, and `docs/ADMIN_V1_AUDIT.md` R-3 for why a wrong shape
 * is a real possibility rather than a hypothetical one.
 *
 * The worst case here is a desk with no money tiles over a working ledger
 * table — a missing summary is a degraded desk; a thrown render is no desk.
 */
import type { LedgerSummary } from '../../api/types';

type Bucket = LedgerSummary['by_currency'][string];

export const EMPTY_LEDGER_SUMMARY: LedgerSummary = {
  book: '',
  month: '',
  currencies: [],
  by_currency: {},
  converted_income: {},
};

/** A money field arrives as a decimal *string*; anything else is dropped to
 * '0' rather than rendered, because `Number(undefined).toLocaleString()` is
 * the string "NaN" and an accounting desk must never print one. */
function money(value: unknown): string {
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '0';
}

function bucket(raw: unknown, currency: string): Bucket {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    currency: typeof v.currency === 'string' && v.currency ? v.currency : currency,
    income: money(v.income),
    expense: money(v.expense),
    salaries: money(v.salaries),
    pending: money(v.pending),
    net: money(v.net),
    count: typeof v.count === 'number' && Number.isFinite(v.count) ? v.count : 0,
  };
}

export function normaliseLedgerSummary(raw: unknown): LedgerSummary {
  if (!raw || typeof raw !== 'object') return EMPTY_LEDGER_SUMMARY;
  const v = raw as Record<string, unknown>;

  const currencies = Array.isArray(v.currencies)
    ? v.currencies.filter((c): c is string => typeof c === 'string' && c !== '')
    : [];

  // Only the currencies the response actually listed get a bucket. A bucket
  // with no currency behind it would render a tile for money nobody reported.
  const byCurrency: LedgerSummary['by_currency'] = {};
  const rawBuckets = (
    v.by_currency && typeof v.by_currency === 'object' ? v.by_currency : {}
  ) as Record<string, unknown>;
  for (const currency of currencies)
    byCurrency[currency] = bucket(rawBuckets[currency], currency);

  const converted: Record<string, string> = {};
  const rawConverted = (
    v.converted_income && typeof v.converted_income === 'object' ? v.converted_income : {}
  ) as Record<string, unknown>;
  for (const [currency, amount] of Object.entries(rawConverted)) {
    // Never invent a converted total: a key whose value is not a real figure
    // is dropped, not zeroed, because "0 USD converted" reads as a fact.
    if (typeof amount === 'string' || typeof amount === 'number') {
      const asMoney = money(amount);
      if (asMoney !== '0' || amount === '0' || amount === 0) converted[currency] = asMoney;
    }
  }

  return {
    book: typeof v.book === 'string' ? v.book : '',
    month: typeof v.month === 'string' ? v.month : '',
    currencies,
    by_currency: byCurrency,
    converted_income: converted,
  };
}
