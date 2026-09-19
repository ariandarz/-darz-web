/**
 * The standard set is Darz's real catalogue, so these tests are one question
 * asked many ways: does a number here still equal the number in the source it
 * came from? The sources are the backend's own exhibition catalogue
 * (`apps/gallery/exhibition_catalogue.py`, itself a verbatim port of
 * `gallery-update.html`'s `EXH_SVC`) and the coverage menu
 * (`../DarzStudio/coverage-packages.html`'s `DATA`). Nothing here may be
 * "fixed" to make a test pass: a failure means the data drifted from Darz's
 * real prices.
 */
import { describe, expect, it } from 'vitest';
import {
  MERGED_SERVICES,
  SUPERSEDED_NAMES,
  supersededRows,
  NAME_COLLISIONS,
  STANDARD_CHECKLISTS,
  STANDARD_CURRENCY,
  STANDARD_PACKAGES,
  STANDARD_SERVICES,
  STANDARD_SET_COUNTS,
  UNPRICED_SERVICES,
  checklistInput,
  missingServices,
  nameKey,
  packageInput,
  planChecklists,
  planPackages,
  planServices,
  sameName,
  serviceIdIndex,
  serviceInput,
} from './standardSet';

/** Darz's real Toman prices, written out so a change to the module alone can
 * never make this file agree with it (`exhibition_catalogue.py:11-60`). */
const REAL_PRICES: ReadonlyArray<[string, number | null]> = [
  ['Exhibition Photo Coverage', 700000],
  ['Video Documentation', 10000000],
  ['Pre-opening Teaser', 12000000],
  ['Studio Visit & Interview', 20000000],
  ['Cinematic Exhibition Film', 36000000],
  ['Artist Interview', 8000000],
  ['Exhibition Review', 10000000],
  ['Darz Listing', null],
];

/** The coverage menu's five groups and how many services each holds. §02 has
 * five, one of which is the priced "Artist Interview" (see the merge below). */
const COVERAGE: ReadonlyArray<[string, number]> = [
  ['Announcement & Pre-Show', 4],
  ['Content Production', 5],
  ['Editorial & Catalogue', 3],
  ['Distribution on Instagram', 6],
  ['Amplification & Collector Reach', 5],
];

const svc = (name: string) => STANDARD_SERVICES.find((s) => s.name === name)!;

describe('the set itself', () => {
  it('is 27 real services, 5 programmes and 4 checklists', () => {
    expect(STANDARD_SERVICES).toHaveLength(27);
    expect(STANDARD_PACKAGES).toHaveLength(5);
    expect(STANDARD_CHECKLISTS).toHaveLength(4);
    expect(STANDARD_SET_COUNTS).toEqual({
      services: 27,
      packages: 5,
      checklists: 4,
      unpriced: UNPRICED_SERVICES.length,
    });
  });

  it('is priced in Toman — the owner’s decision for Iranian galleries', () => {
    expect(STANDARD_CURRENCY).toBe('TMN');
  });

  it('comes from the two real sources and nowhere else', () => {
    // 8 exhibition + 19 coverage = 27. The coverage menu lists 23; four of its
    // lines named a service the exhibition catalogue already priced, and the
    // owner ruled those pairs one service (MERGED_SERVICES), so the four are
    // rows on the exhibition side and the coverage-only count is 23 - 4.
    expect(STANDARD_SERVICES.filter((s) => s.source === 'exhibition')).toHaveLength(8);
    expect(STANDARD_SERVICES.filter((s) => s.source === 'coverage')).toHaveLength(19);
    expect(STANDARD_SERVICES.filter((s) => s.source === 'exhibition' && s.group)).toHaveLength(
      MERGED_SERVICES.length,
    );
  });

  it('keeps every line traceable to where it came from', () => {
    for (const s of STANDARD_SERVICES) {
      if (s.source === 'exhibition') expect(s.serviceKey, s.name).toBeTruthy();
      else expect(s.group, s.name).toBeTruthy();
      expect(s.about, s.name).toBeTruthy();
    }
  });

  it('files every line under one of the four served categories', () => {
    for (const s of STANDARD_SERVICES)
      expect(['media', 'production', 'curatorial', 'other']).toContain(s.category);
  });

  it('never repeats a name within a kind — the idempotency key', () => {
    for (const names of [
      STANDARD_SERVICES.map((s) => s.name),
      STANDARD_PACKAGES.map((p) => p.name),
      STANDARD_CHECKLISTS.map((c) => c.name),
    ]) {
      expect(new Set(names.map(nameKey)).size).toBe(names.length);
    }
    expect(NAME_COLLISIONS).toHaveLength(0);
  });
});

describe('the prices are Darz’s, not invented', () => {
  it.each(REAL_PRICES)('%s is priced at %s Toman', (name, price) => {
    const row = svc(name as string);
    expect(row, `${name} is missing`).toBeDefined();
    expect(row.source).toBe('exhibition');
    expect(row.price).toBe(price);
  });

  it('prices exactly the seven services that have a price, and nothing else', () => {
    const priced = STANDARD_SERVICES.filter((s) => s.price !== null && s.price > 0);
    expect(priced.map((s) => s.name).sort()).toEqual(
      REAL_PRICES.filter(([, p]) => p !== null)
        .map(([n]) => n as string)
        .sort(),
    );
  });

  it('leaves every coverage-only line unpriced — the menu is quoted per show', () => {
    for (const s of STANDARD_SERVICES.filter((x) => x.source === 'coverage'))
      expect(s.price, s.name).toBeNull();
    expect(UNPRICED_SERVICES).toHaveLength(20); // 19 coverage-only + Darz Listing
  });

  it('invents no internal cost — none is written down anywhere', () => {
    for (const s of STANDARD_SERVICES) expect(s.internalCost, s.name).toBe(0);
  });
});

describe('the look-alike services', () => {
  it('merges only the pair whose names are one capital apart', () => {
    // "Artist interview" (coverage §02) and "Artist Interview" (priced) fold to
    // one key, so they cannot be two rows: the priced side carries §02.
    const both = STANDARD_SERVICES.filter((s) => sameName(s.name, 'Artist Interview'));
    expect(both).toHaveLength(1);
    expect(both[0].price).toBe(8000000);
    expect(both[0].groupTitle).toBe('Content Production');
    expect(both[0].flow, 'keeps the coverage menu’s own wording').toBeTruthy();
  });

  // The owner ruled on 2026-09-19 that all four pairs are one service.
  it('keeps ONE row per merged pair, on the side the portal names', () => {
    expect(MERGED_SERVICES).toHaveLength(4);
    for (const m of MERGED_SERVICES) {
      const kept = svc(m.kept);
      expect(kept, `${m.kept} must survive the merge`).toBeDefined();
      expect(kept?.source, 'the surviving side is the exhibition line').toBe('exhibition');
      expect(
        kept?.serviceKey,
        'priceList.ts joins by this — folding the other way would break pricing',
      ).toBeTruthy();
      expect(kept?.group, `${m.kept} takes the folded line's group`).toBeTruthy();
      expect(kept?.flow, `${m.kept} keeps the coverage menu's own wording`).toBeTruthy();
      expect(
        STANDARD_SERVICES.some((x) => sameName(x.name, m.folded) && !sameName(x.name, m.kept)),
        `${m.folded} must no longer be its own row`,
      ).toBe(false);
    }
  });

  it('invents no price while merging — each pair keeps the priced side as it was', () => {
    expect(svc('Exhibition Photo Coverage')?.price).toBe(700000);
    expect(svc('Video Documentation')?.price).toBe(10000000);
    expect(svc('Artist Interview')?.price).toBe(8000000);
    // neither side of this pair had one, so the merge does not produce one
    expect(svc('Darz Listing')?.price).toBeNull();
  });

  it('finds the rows a workspace seeded before the ruling still holds', () => {
    const before = [
      { name: 'Installation photography' },
      { name: 'exhibition photo coverage' }, // the surviving name, oddly cased
      { name: 'Something Darz added by hand' },
    ];
    expect(supersededRows(before).map((r) => r.name)).toEqual(['Installation photography']);
    expect(supersededRows([])).toEqual([]);
    // every folded name is one the standard set no longer carries
    for (const n of SUPERSEDED_NAMES) {
      const still = STANDARD_SERVICES.filter((x) => sameName(x.name, n));
      // "Artist interview" folds onto a name that only differs in case, so it
      // resolves to the surviving row rather than to nothing
      for (const row of still) expect(row.source).toBe('exhibition');
    }
  });
});

describe('the programmes are the coverage groups', () => {
  it.each(COVERAGE)('%s carries its own %i services and no fee', (title, n) => {
    const p = STANDARD_PACKAGES.find((x) => x.name === title)!;
    expect(p, `${title} is missing`).toBeDefined();
    expect(p.lines).toHaveLength(n as number);
    for (const l of p.lines) {
      expect(l.count).toBe(1);
      expect(svc(l.service)?.groupTitle, l.service).toBe(title);
    }
    for (const v of Object.values(p.overrides?.internal ?? {})) expect(Number(v)).toBe(0);
  });

  it('accounts for every grouped service exactly once across the five', () => {
    const lines = STANDARD_PACKAGES.flatMap((p) => p.lines.map((l) => l.service));
    expect(lines).toHaveLength(23);
    expect(new Set(lines).size).toBe(23);
  });
});

describe('the checklist templates are unchanged', () => {
  it('keeps the four workflow templates and their stages (:13444-13447)', () => {
    expect(STANDARD_CHECKLISTS.map((c) => c.name)).toEqual([
      'Proposal checklist',
      'Shoot-day checklist',
      'Publication checklist',
      'Archive handoff',
    ]);
    expect(STANDARD_CHECKLISTS.map((c) => c.stage)).toEqual([
      'proposal',
      'production',
      'publication',
      'archive',
    ]);
    expect(STANDARD_CHECKLISTS[0].items[0]).toBe('Confirm scope with the client');
    expect(checklistInput(STANDARD_CHECKLISTS[0])).toMatchObject({
      name: 'Proposal checklist',
      stage: 'proposal',
    });
  });
});

describe('the API bodies', () => {
  it('sends decimals as strings, in the currency it is given', () => {
    const photo = svc('Exhibition Photo Coverage');
    expect(serviceInput(photo, 'TMN')).toEqual({
      name: 'Exhibition Photo Coverage',
      category: photo.category,
      unit: photo.unit,
      internal_cost: '0',
      price: '700000',
      currency: 'TMN',
    });
  });

  it('writes an unpriced line as 0 — the field is non-null on the backend', () => {
    expect(serviceInput(svc('Darz Listing'), 'TMN').price).toBe('0');
    expect(serviceInput(svc('Curatorial essay'), 'TMN').price).toBe('0');
  });

  it('resolves a programme’s lines to the ids the API handed back', () => {
    const rows = STANDARD_SERVICES.map((s, i) => ({ id: `id-${i}`, name: s.name }));
    const idx = serviceIdIndex(rows);
    for (const p of STANDARD_PACKAGES) {
      expect(missingServices(p, idx), p.name).toEqual([]);
      const body = packageInput(p, idx) as { lines?: Array<{ svcId: string; count: number }> };
      expect(body.lines).toHaveLength(p.lines.length);
      for (const l of body.lines ?? []) expect(rows.some((r) => r.id === l.svcId)).toBe(true);
    }
  });

  it('names what it cannot resolve rather than writing a programme short', () => {
    const idx = serviceIdIndex([{ id: 'only', name: 'Exhibition announcement' }]);
    const p = STANDARD_PACKAGES.find((x) => x.name === 'Announcement & Pre-Show')!;
    expect(missingServices(p, idx)).toHaveLength(p.lines.length - 1);
  });
});

describe('the plan (idempotency by name)', () => {
  it('skips what is already there, whatever its case or spacing', () => {
    const plan = planServices([
      { name: '  exhibition photo coverage  ' },
      { name: 'Curatorial essay' },
    ]);
    expect(plan.skip.map((s) => s.name).sort()).toEqual([
      'Curatorial essay',
      'Exhibition Photo Coverage',
    ]);
    expect(plan.create).toHaveLength(25);
  });

  it('plans everything against an empty workspace and nothing against a full one', () => {
    expect(planServices([]).create).toHaveLength(27);
    expect(planServices(STANDARD_SERVICES).create).toHaveLength(0);
    expect(planPackages([]).create).toHaveLength(5);
    expect(planPackages(STANDARD_PACKAGES).create).toHaveLength(0);
    expect(planChecklists([]).create).toHaveLength(4);
    expect(planChecklists(STANDARD_CHECKLISTS).create).toHaveLength(0);
  });

  it('compares names one way only', () => {
    expect(sameName(' Artist Interview ', 'artist interview')).toBe(true);
    expect(sameName('Artist research', 'Artist Interview')).toBe(false);
  });
});
