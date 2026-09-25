/**
 * servicesLibrary — the one list of services a document is built from.
 *
 * Kept deliberately separate (its own section, its own file) because it is
 * reference data an owner edits occasionally, while issuing a document is
 * something they do weekly. Mixing the two is what made the old desk feel
 * heavy: a price change meant opening a packages screen nested two tabs deep
 * inside Projects.
 *
 * WHERE THE ROWS LIVE. `/projects/admin/service-catalog/` — the editable rows
 * D21 seeded with Darz's real services. This module does not invent a second
 * store; it reads the same rows the composer prices from, so a price edited
 * here reaches the next proposal with nothing to sync.
 *
 * WHERE THE WORDS LIVE. On the row: `ProjectServiceCatalogItem.description`
 * (G-PROJ-8), read and written through the API like the name and the price.
 * A row with none is blank until an owner types one — the standard-set seed
 * writes Darz's own menu text into it (`standardSet.ts::serviceInput`).
 */
import type { PackageTemplateAdmin, ServiceCatalogItemAdmin } from '../../../api/types';
import { STANDARD_SERVICES, nameKey } from '../projects/standardSet';

/** What a document line needs to know about a service. */
export interface LibraryService {
  id: string;
  name: string;
  /** The row's own `description` (G-PROJ-8), '' when none is stored. */
  description: string;
  /** null = not priced yet. Never 0, which would read as free. */
  price: number | null;
  currency: string;
  unit: string;
  version: number;
}

/** A programme: a named set of services, so a whole package goes onto a
 * document in one click instead of six. */
export interface LibraryPackage {
  id: string;
  name: string;
  /** The services it holds, resolved to the library rows. */
  services: LibraryService[];
  /** Ids the catalogue no longer has — named rather than silently dropped. */
  missing: number;
}

/** Which programme a service belongs to, as Darz's own menu groups them —
 * the heading the library folds it under. */
export function groupOf(name: string): string {
  const hit = STANDARD_SERVICES.find((x) => nameKey(x.name) === nameKey(name));
  return hit?.groupTitle ?? OTHER_GROUP;
}

export const OTHER_GROUP = 'Other services';

export interface LibraryGroup {
  title: string;
  services: LibraryService[];
}

/**
 * The library folded into its programmes. A flat list of every service is a
 * screen you scroll rather than read (the owner's words, 2026-09-19), so the
 * page shows the groups and opens the one being worked on. Order follows
 * Darz's own menu; anything the menus do not know falls to the end, under
 * `OTHER_GROUP`, rather than being hidden.
 */
export function groupServices(services: readonly LibraryService[]): LibraryGroup[] {
  const order: string[] = [];
  for (const s of STANDARD_SERVICES) {
    const t = s.groupTitle;
    if (t && !order.includes(t)) order.push(t);
  }
  order.push(OTHER_GROUP);

  const byTitle = new Map<string, LibraryService[]>(order.map((t) => [t, []]));
  for (const s of services) {
    const t = groupOf(s.name);
    (byTitle.get(t) ?? byTitle.get(OTHER_GROUP))!.push(s);
  }
  return order
    .map((title) => ({ title, services: byTitle.get(title) ?? [] }))
    .filter((g) => g.services.length > 0);
}

/** A service's own running notes, where Darz's menu records them. */
export function serviceNotes(name: string): { flow?: string; time?: string; need?: string } {
  const hit = STANDARD_SERVICES.find((s) => nameKey(s.name) === nameKey(name));
  return hit ? { flow: hit.flow, time: hit.time, need: hit.need } : {};
}

const amount = (raw: unknown): number | null => {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function toLibrary(rows: readonly ServiceCatalogItemAdmin[]): LibraryService[] {
  return rows
    .map((r) => ({
      id: r.id,
      name: r.name ?? '',
      description: r.description ?? '',
      price: amount(r.price),
      currency: r.currency ?? '',
      unit: r.unit ?? 'piece',
      version: r.version,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The programmes, with their lines resolved against the library. A package
 * line the catalogue has lost is counted, not dropped in silence. */
export function toPackages(
  rows: readonly PackageTemplateAdmin[],
  services: readonly LibraryService[],
): LibraryPackage[] {
  const byId = new Map(services.map((s) => [s.id, s]));
  return rows
    .map((p) => {
      const lines = (p.lines ?? []) as Array<{ svcId?: string; count?: number }>;
      const resolved: LibraryService[] = [];
      let missing = 0;
      for (const l of lines) {
        const hit = l.svcId ? byId.get(l.svcId) : undefined;
        if (!hit) {
          missing += 1;
          continue;
        }
        // a count of 3 means three of that service on the document
        for (let i = 0; i < Math.max(1, Number(l.count) || 1); i += 1) resolved.push(hit);
      }
      return { id: p.id, name: p.name ?? '', services: resolved, missing };
    })
    .filter((p) => p.services.length > 0 || p.missing > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Collapse repeats into one line with a quantity — a package that names the
 * same service three times becomes "3 ×", not three rows. */
export function withQuantities(
  services: readonly LibraryService[],
): Array<{ service: LibraryService; qty: number }> {
  const out: Array<{ service: LibraryService; qty: number }> = [];
  for (const s of services) {
    const hit = out.find((o) => o.service.id === s.id);
    if (hit) hit.qty += 1;
    else out.push({ service: s, qty: 1 });
  }
  return out;
}

/** Which currency a document should open in: whatever the library prices in,
 * or the fallback the caller knows. Never a guess between two. */
export function libraryCurrency(
  services: readonly LibraryService[],
  fallback: string,
): string {
  const priced = services.filter((s) => s.price !== null && s.currency);
  if (!priced.length) return fallback;
  const first = priced[0].currency;
  return priced.every((s) => s.currency === first) ? first : fallback;
}

/** Filter for the picker: matches the name and the description, so "photo"
 * finds the service whose text mentions photography. */
export function search(services: readonly LibraryService[], query: string): LibraryService[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...services];
  return services.filter(
    (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
  );
}
