/**
 * priceList — the one price list a quote is built from.
 *
 * The problem this solves, found live on 2026-09-19 by walking the chain:
 * the gallery's portal shows the exhibition menu WITH prices (T 700,000,
 * T 8,000,000 …) because `/gallery/portal/{token}/exhibitions/catalogue/`
 * serves `default_price`. The desk's composer has no such endpoint — the
 * only admin-side view of that menu is `gallery.exhibition_service` in
 * `/api/options/`, which is `{value,label}` pairs and nothing else
 * (G-PORT-12). So every line of a request arrived at the desk **blank**,
 * and Darz retyped, from memory, a number the gallery had already been
 * shown. A slip there puts a different price on the client's PDF than the
 * one they chose.
 *
 * What makes the fix possible: since D21 the Projects **service catalogue**
 * (`/projects/admin/service-catalog/`) holds those same eight services as
 * real, editable rows, seeded from the same source file the portal menu is
 * built from (`darzmarket-api/apps/gallery/exhibition_catalogue.py`). It is
 * the one price list in the panel an admin can actually edit — so it, not
 * the desk's memory, is what a package should be priced from.
 *
 * The join is by NAME, case-folded through `nameKey` — the same idempotency
 * key the seed itself uses — between each catalogue row and the
 * `STANDARD_SERVICES` entry that carries the portal's `serviceKey`. Renaming
 * a row in the catalogue therefore unlinks it, which is why the composer
 * says on screen where each price came from rather than leaving it implied.
 *
 * Two rules it will not break:
 *  - **Never converts a currency.** Nothing in this app stores an exchange
 *    rate (G-PROJ-9), so a price list in Toman contributes nothing to a
 *    package being quoted in USD — the line stays blank and the composer
 *    says why. A wrong conversion on an invoice is worse than an empty box.
 *  - **Never invents a price.** A row the catalogue does not cover, or one
 *    whose price is 0 / unset, seeds blank exactly as before.
 */
import type { PortalCatalogueEntry, ServiceCatalogItemAdmin } from '../../api/types';
import { STANDARD_SERVICES, nameKey } from './projects/standardSet';

/** The eight `gallery.exhibition_service` keys, with the catalogue name and
 * the description each one was seeded from. Derived, never hand-listed, so
 * it cannot drift from the seed. */
export const EXHIBITION_SERVICE_ROWS: ReadonlyArray<{
  key: string;
  name: string;
  about: string;
}> = STANDARD_SERVICES.filter((s) => s.serviceKey).map((s) => ({
  key: s.serviceKey as string,
  name: s.name,
  about: s.about,
}));

/** Where a seeded price came from — what the composer tells the admin. */
export type PriceOrigin =
  /** a row in the service catalogue, in this package's currency */
  | 'list'
  /** the catalogue covers it, but in another currency — not converted */
  | 'other-currency'
  /** the catalogue has the row and it carries no price */
  | 'unpriced'
  /** no catalogue row matches this service */
  | 'missing';

export interface PricedService {
  key: string;
  title: string;
  description: string;
  /** In `currency`, or null when nothing may be carried over. */
  price: number | null;
  origin: PriceOrigin;
  /** The catalogue row's own currency, when one matched. */
  listCurrency?: string;
  /** The catalogue row's own price, when one matched — shown when it is in
   * another currency, so the admin can see the figure they set. */
  listPrice?: number;
}

const amount = (raw: unknown): number | null => {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * The exhibition menu, priced from the service catalogue for a package in
 * `currency`. Always returns all eight entries in their catalogue order, so
 * the composer's "＋ service" buttons are unchanged whether or not a price
 * list exists yet.
 */
export function priceExhibitionServices(
  rows: readonly ServiceCatalogItemAdmin[],
  currency: string,
): PricedService[] {
  const byName = new Map<string, ServiceCatalogItemAdmin>();
  for (const r of rows) {
    const k = nameKey(r.name ?? '');
    // first row wins: the catalogue's own order, so a later duplicate of a
    // name cannot silently take over a price the earlier one set
    if (k && !byName.has(k)) byName.set(k, r);
  }

  return EXHIBITION_SERVICE_ROWS.map(({ key, name, about }) => {
    const row = byName.get(nameKey(name));
    if (!row) {
      return { key, title: name, description: about, price: null, origin: 'missing' as const };
    }
    const listPrice = amount(row.price);
    const listCurrency = row.currency ?? '';
    if (listPrice === null) {
      return {
        key,
        title: row.name || name,
        description: about,
        price: null,
        origin: 'unpriced' as const,
        listCurrency,
      };
    }
    if (listCurrency !== currency) {
      return {
        key,
        title: row.name || name,
        description: about,
        price: null,
        origin: 'other-currency' as const,
        listCurrency,
        listPrice,
      };
    }
    return {
      key,
      title: row.name || name,
      description: about,
      price: listPrice,
      origin: 'list' as const,
      listCurrency,
      listPrice,
    };
  });
}

/**
 * The composer speaks `PortalCatalogueEntry` — the same shape the portal's
 * own catalogue endpoint returns — so `seedLines`/`draftFromCatalogue` need
 * no change at all: feed them a priced menu and a request stops arriving
 * blank.
 */
export function asCatalogueEntries(priced: readonly PricedService[]): PortalCatalogueEntry[] {
  return priced.map((p) => ({
    key: p.key,
    title: p.title,
    description: p.description,
    default_price: p.price,
  }));
}

/** What the composer says above the lines. One sentence, only when there is
 * something the admin would otherwise have to work out for themselves. */
export function priceListSummary(
  priced: readonly PricedService[],
  currency: string,
): string | null {
  if (!priced.length) return null;
  const n = (o: PriceOrigin) => priced.filter((p) => p.origin === o).length;
  const listed = n('list');
  const other = n('other-currency');
  const missing = n('missing');
  const unpriced = n('unpriced');

  if (listed === 0 && other > 0) {
    const cur = priced.find((p) => p.origin === 'other-currency')?.listCurrency ?? '';
    return `Your price list is in ${cur} and this package is in ${currency}, so no price is carried over — nothing here stores an exchange rate. Type each price, or quote the package in ${cur}.`;
  }
  if (listed === 0 && missing === priced.length) {
    return 'Your service catalogue has none of these services yet, so every line starts blank. Add them once on Projects → Packages and every package after this one is priced for you.';
  }
  const parts: string[] = [`${listed} of ${priced.length} priced from your service catalogue`];
  if (other) parts.push(`${other} held back (another currency)`);
  if (unpriced) parts.push(`${unpriced} not priced there yet`);
  if (missing) parts.push(`${missing} not in it`);
  return `${parts.join(' · ')}. Change a price there and the next package follows.`;
}
