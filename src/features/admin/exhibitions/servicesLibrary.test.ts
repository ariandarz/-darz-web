import { describe, expect, it } from 'vitest';
import type { PackageTemplateAdmin, ServiceCatalogItemAdmin } from '../../../api/types';
import {
  OTHER_GROUP,
  groupServices,
  libraryCurrency,
  search,
  serviceNotes,
  toLibrary,
  toPackages,
  withQuantities,
  type LibraryService,
} from './servicesLibrary';

const row = (name: string, price?: string, currency = 'TMN'): ServiceCatalogItemAdmin =>
  ({
    id: `id-${name}`,
    name,
    price,
    currency,
    unit: 'piece',
    version: 1,
  }) as unknown as ServiceCatalogItemAdmin;

const svc = (id: string, over: Partial<LibraryService> = {}): LibraryService => ({
  id,
  name: id,
  description: '',
  price: 100,
  currency: 'TMN',
  unit: 'piece',
  version: 1,
  ...over,
});

describe('toLibrary', () => {
  it('fills the description from Darz’s own menu, by name', () => {
    const [s] = toLibrary([row('Exhibition Photo Coverage', '700000')]);
    expect(s.description).toContain('photographic documentation');
    expect(s.price).toBe(700000);
  });

  it('matches the name however it is cased or spaced', () => {
    expect(toLibrary([row('  video documentation ', '1')])[0].description).toContain('video');
  });

  it('leaves a hand-added service without a description rather than inventing one', () => {
    expect(toLibrary([row('Something Darz added', '5')])[0].description).toBe('');
  });

  it('reads an unset, empty or zero price as not priced yet', () => {
    for (const p of [undefined, '', '0', '0.00'])
      expect(toLibrary([row('Darz Listing', p)])[0].price).toBeNull();
  });

  it('sorts by name, so the list reads the same every time', () => {
    const names = toLibrary([row('Zed', '1'), row('Alpha', '1')]).map((s) => s.name);
    expect(names).toEqual(['Alpha', 'Zed']);
  });
});

describe('serviceNotes', () => {
  it('returns the running notes Darz’s menu records', () => {
    expect(serviceNotes('Exhibition Photo Coverage').time).toBeTruthy();
  });

  it('is empty for a service the menus do not know', () => {
    expect(serviceNotes('Nothing like this')).toEqual({});
  });
});

describe('toPackages', () => {
  const services = [svc('a', { name: 'A' }), svc('b', { name: 'B' })];
  const pkg = (name: string, lines: unknown): PackageTemplateAdmin =>
    ({ id: `p-${name}`, name, lines }) as unknown as PackageTemplateAdmin;

  it('resolves a package’s lines to the library rows', () => {
    const [p] = toPackages([pkg('One', [{ svcId: 'a', count: 1 }])], services);
    expect(p.services.map((s) => s.id)).toEqual(['a']);
    expect(p.missing).toBe(0);
  });

  it('repeats a service by its count, so three means three', () => {
    const [p] = toPackages([pkg('One', [{ svcId: 'a', count: 3 }])], services);
    expect(p.services).toHaveLength(3);
  });

  it('treats a missing or zero count as one', () => {
    const [p] = toPackages([pkg('One', [{ svcId: 'a' }, { svcId: 'b', count: 0 }])], services);
    expect(p.services).toHaveLength(2);
  });

  it('counts a line the catalogue has lost rather than dropping it silently', () => {
    const [p] = toPackages([pkg('One', [{ svcId: 'gone' }, { svcId: 'a' }])], services);
    expect(p.missing).toBe(1);
    expect(p.services).toHaveLength(1);
  });

  it('leaves out a package that resolves to nothing at all', () => {
    expect(toPackages([pkg('Empty', [])], services)).toEqual([]);
  });
});

describe('withQuantities', () => {
  it('collapses repeats into one line with a quantity', () => {
    const a = svc('a');
    expect(withQuantities([a, a, svc('b')])).toEqual([
      { service: a, qty: 2 },
      { service: svc('b'), qty: 1 },
    ]);
  });

  it('keeps the order the package listed them in', () => {
    expect(withQuantities([svc('b'), svc('a'), svc('b')]).map((o) => o.service.id)).toEqual([
      'b',
      'a',
    ]);
  });
});

describe('libraryCurrency', () => {
  it('uses the one currency the library prices in', () => {
    expect(libraryCurrency([svc('a'), svc('b')], 'USD')).toBe('TMN');
  });

  it('falls back rather than choosing between two currencies', () => {
    expect(libraryCurrency([svc('a'), svc('b', { currency: 'USD' })], 'EUR')).toBe('EUR');
  });

  it('falls back when nothing is priced', () => {
    expect(libraryCurrency([svc('a', { price: null })], 'EUR')).toBe('EUR');
  });
});

describe('search', () => {
  const list = toLibrary([row('Exhibition Photo Coverage', '1'), row('Darz Listing', '1')]);

  it('returns everything for an empty query', () => {
    expect(search(list, '  ')).toHaveLength(2);
  });

  it('matches the name', () => {
    expect(search(list, 'listing').map((s) => s.name)).toEqual(['Darz Listing']);
  });

  it('matches the description too, so a word from the menu finds the service', () => {
    expect(search(list, 'collectors').map((s) => s.name)).toEqual(['Darz Listing']);
  });
});

describe('groupServices', () => {
  const rows = toLibrary([
    row('Exhibition Photo Coverage', '700000'),
    row('Curatorial essay', ''),
    row('Something Darz added by hand', '5'),
  ]);

  it('folds each service under the programme Darz’s menu puts it in', () => {
    const titles = groupServices(rows).map((g) => g.title);
    expect(titles).toContain('Content Production'); // the photo line, since the merge
    expect(titles).toContain('Editorial & Catalogue'); // the curatorial essay
  });

  it('keeps a service the menus do not know, under its own heading', () => {
    const other = groupServices(rows).find((g) => g.title === OTHER_GROUP);
    expect(other?.services.map((s) => s.name)).toEqual(['Something Darz added by hand']);
  });

  it('leaves out a programme with nothing in it', () => {
    for (const g of groupServices(rows)) expect(g.services.length).toBeGreaterThan(0);
  });

  it('accounts for every service exactly once', () => {
    const all = groupServices(rows).flatMap((g) => g.services.map((s) => s.name));
    expect(all.sort()).toEqual(rows.map((r) => r.name).sort());
  });

  it('puts the unknown heading last, so the real programmes read first', () => {
    const titles = groupServices(rows).map((g) => g.title);
    expect(titles[titles.length - 1]).toBe(OTHER_GROUP);
  });

  it('is empty for an empty library', () => {
    expect(groupServices([])).toEqual([]);
  });
});
