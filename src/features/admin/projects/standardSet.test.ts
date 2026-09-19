/** The standard set — the old panel's own rates (`projSeedIfEmpty`,
 * `darz-studio.html:13381-13451`) as data: every figure spot-checked against
 * the old line, the seven-to-four category mapping (G-PROJ-4), the
 * skip-by-name plans that make a run idempotent, and the API bodies. */
import { describe, expect, it } from 'vitest';
import { asCounts, asInternal, asPackageLines, asPackagePaymentStages } from './projectForm';
import {
  OLD_CATEGORY_MAP,
  STANDARD_CHECKLISTS,
  STANDARD_CURRENCY,
  STANDARD_PACKAGES,
  STANDARD_SERVICES,
  STANDARD_SET_COUNTS,
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
  type StandardService,
} from './standardSet';

const SERVED = ['media', 'production', 'curatorial', 'other'];

function svc(name: string): StandardService {
  const hit = STANDARD_SERVICES.find((s) => s.name === name);
  if (!hit) throw new Error(`no standard service named ${name}`);
  return hit;
}

/** Every catalogue row, indexed as the desk would after the writes. */
function fakeIndex(): Map<string, string> {
  return serviceIdIndex(STANDARD_SERVICES.map((s, i) => ({ id: `id-${i}`, name: s.name })));
}

describe('the set itself', () => {
  it('is the old seed: 34 services, 8 packages, 4 checklists', () => {
    expect(STANDARD_SERVICES).toHaveLength(34);
    expect(STANDARD_PACKAGES).toHaveLength(8);
    expect(STANDARD_CHECKLISTS).toHaveLength(4);
    expect(STANDARD_SET_COUNTS).toEqual({ services: 34, packages: 8, checklists: 4 });
  });

  it('prices in the old rate card’s own currency (:13440)', () => {
    expect(STANDARD_CURRENCY).toBe('USD');
  });

  it('keeps the old file’s order at both ends (:13386, :13420)', () => {
    expect(STANDARD_SERVICES[0].name).toBe('Exhibition listing');
    expect(STANDARD_SERVICES[STANDARD_SERVICES.length - 1].name).toBe('Post-project report');
  });

  it('never repeats a name within a kind (the idempotency key)', () => {
    for (const names of [
      STANDARD_SERVICES.map((s) => s.name),
      STANDARD_PACKAGES.map((p) => p.name),
      STANDARD_CHECKLISTS.map((c) => c.name),
    ]) {
      expect(new Set(names.map(nameKey)).size).toBe(names.length);
    }
  });
});

describe('the figures are the old ones', () => {
  const cases: Array<[string, string, number, number]> = [
    // name, unit, internalCost, price — :13386-13420
    ['Exhibition listing', 'piece', 20, 120], // :13386, the first
    ['Content photography (half day)', 'day', 180, 600], // :13389
    ['Reel / video edit', 'piece', 120, 400], // :13391, the "/" name
    ['Exhibition text & wall texts', 'piece', 250, 800], // :13397, the "&" name
    ['Coordination & scheduling', 'hour', 25, 70], // :13400, the cheapest
    ['Darz channel distribution', 'piece', 30, 150], // :13404
    ['English-language translation', 'piece', 90, 300], // :13405
    ['Artist research', 'hour', 40, 120], // :13407, first of the §9 block
    ['Catalogue development', 'piece', 700, 2200], // :13416, the most expensive
    ['Post-project report', 'piece', 180, 560], // :13420, the last
  ];
  for (const [name, unit, internalCost, price] of cases) {
    it(`${name} — ${unit}, ${internalCost} / ${price}`, () => {
      const s = svc(name);
      expect(s.unit).toBe(unit);
      expect(s.internalCost).toBe(internalCost);
      expect(s.price).toBe(price);
    });
  }

  it('is the cheapest and the most expensive of the whole catalogue', () => {
    const prices = STANDARD_SERVICES.map((s) => s.price);
    expect(Math.min(...prices)).toBe(svc('Coordination & scheduling').price);
    expect(Math.max(...prices)).toBe(svc('Catalogue development').price);
  });
});

describe('the seven old categories over the served four (G-PROJ-4)', () => {
  it('files every line under a served category', () => {
    for (const s of STANDARD_SERVICES) expect(SERVED).toContain(s.category);
  });

  it('maps each old category the way the decision says', () => {
    for (const s of STANDARD_SERVICES) {
      const mapped = OLD_CATEGORY_MAP[s.oldCategory];
      if (mapped) expect(s.category).toBe(mapped);
      else expect(s.oldCategory).toBe('distribution'); // splits by line
    }
    expect(OLD_CATEGORY_MAP).toMatchObject({
      media: 'media',
      content: 'production',
      editorial: 'media',
      curatorial: 'curatorial',
      pm: 'other',
      documentation: 'production',
      distribution: null,
    });
  });

  it('splits the two distribution lines by what they are', () => {
    expect(svc('Darz channel distribution').category).toBe('media');
    expect(svc('English-language translation').category).toBe('other');
  });

  it('keeps every old category recorded, so nothing is lost', () => {
    expect(new Set(STANDARD_SERVICES.map((s) => s.oldCategory))).toEqual(
      new Set(Object.keys(OLD_CATEGORY_MAP)),
    );
  });
});

describe('the packages', () => {
  const idx = fakeIndex();

  it('takes the shared pkg() defaults where the old extra set nothing (:13424)', () => {
    const body = packageInput(
      STANDARD_PACKAGES.find((p) => p.name === 'Editorial Coverage')!,
      idx,
    );
    expect(body.purpose).toBe('Written editorial coverage with Darz’s voice and context.');
    expect(body.onsite).toBe(false);
    expect(body.revisions).toBe(1);
    expect(body.approval).toBe('One internal + one client review.');
    expect(body.usage_rights).toBe('Darz channels; client re-use with credit.');
    expect(body.archive_duration).toBe('12 months');
    expect(body.cancellation).toBe('Deposit non-refundable once work has begun.');
    expect(body.deposit_pct).toBe(50);
    expect(asPackagePaymentStages(body.payment_stages)).toEqual([
      { label: 'Deposit', pct: 50 },
      { label: 'On delivery', pct: 50 },
    ]);
    // the counts the template set, over the zeroes
    expect(asCounts(body.counts)).toEqual({
      posts: 2,
      stories: 0,
      articles: 1,
      interviews: 0,
      photos: 0,
      videos: 0,
      videoMin: 0,
    });
    expect(asInternal(body.internal)).toEqual({
      internalCost: 430,
      externalCost: 0,
      minFee: 700,
      recFee: 1200,
      targetMargin: 45,
    });
  });

  it('keeps PKG1’s own overrides: no deposit, paid on publication (:13426)', () => {
    const body = packageInput(
      STANDARD_PACKAGES.find((p) => p.name === 'Basic Exhibition Listing')!,
      idx,
    );
    expect(body.deposit_pct).toBe(0);
    expect(asPackagePaymentStages(body.payment_stages)).toEqual([
      { label: 'On publication', pct: 100 },
    ]);
    expect(asInternal(body.internal)).toEqual({
      internalCost: 60,
      externalCost: 0,
      minFee: 120,
      recFee: 250,
      targetMargin: 50,
    });
  });

  it('keeps PKG7’s Permanent archive and PKG8’s own usage rights', () => {
    const seven = packageInput(
      STANDARD_PACKAGES.find((p) => p.name === 'Full Project Documentation & Archive')!,
      idx,
    );
    expect(seven.archive_duration).toBe('Permanent');
    expect(seven.onsite).toBe(true);
    const eight = packageInput(
      STANDARD_PACKAGES.find((p) => p.name === 'International English-Language Package')!,
      idx,
    );
    expect(eight.usage_rights).toBe('Darz international channels; full English rights.');
    expect(eight.archive_duration).toBe('12 months'); // untouched default
  });

  it('marks the on-site templates (PKG3/5/6/7) and no others', () => {
    const onsite = STANDARD_PACKAGES.filter((p) => packageInput(p, idx).onsite).map(
      (p) => p.name,
    );
    expect(onsite).toEqual([
      'Photography & Video Documentation',
      'Complete Media Partnership',
      'Curatorial & Content Partnership',
      'Full Project Documentation & Archive',
    ]);
  });

  it('names lines that exist in the catalogue, and resolves them to ids', () => {
    for (const p of STANDARD_PACKAGES) expect(missingServices(p, idx)).toEqual([]);
    const body = packageInput(
      STANDARD_PACKAGES.find((p) => p.name === 'Complete Media Partnership')!,
      idx,
    );
    expect(asPackageLines(body.lines)).toEqual([
      { svcId: idx.get(nameKey('Exhibition listing')), count: 1 },
      { svcId: idx.get(nameKey('Editorial article')), count: 2 },
      { svcId: idx.get(nameKey('Social media post')), count: 6 },
      { svcId: idx.get(nameKey('Short-form video production')), count: 2 },
      { svcId: idx.get(nameKey('Darz channel distribution')), count: 1 },
    ]);
  });

  it('drops an unresolved line and reports it rather than writing a dangling id', () => {
    const partial = new Map([['exhibition listing', 'id-0']]);
    const pkg = STANDARD_PACKAGES.find((p) => p.name === 'Complete Media Partnership')!;
    expect(packageInput(pkg, partial).lines).toEqual([{ svcId: 'id-0', count: 1 }]);
    expect(missingServices(pkg, partial)).toEqual([
      'Editorial article',
      'Social media post',
      'Short-form video production',
      'Darz channel distribution',
    ]);
  });

  it('indexes by the same name rule the plans use', () => {
    const idx2 = serviceIdIndex([{ id: 'x', name: '  EXHIBITION Listing ' }]);
    expect(idx2.get(nameKey('Exhibition listing'))).toBe('x');
    // the first row of a repeated name keeps the link
    const idx3 = serviceIdIndex([
      { id: 'first', name: 'Wall texts' },
      { id: 'second', name: 'wall texts' },
    ]);
    expect(idx3.get('wall texts')).toBe('first');
  });
});

describe('the checklists', () => {
  it('carries the four old templates, stages and items verbatim (:13444-13447)', () => {
    expect(STANDARD_CHECKLISTS.map((c) => [c.name, c.stage])).toEqual([
      ['Proposal checklist', 'proposal'],
      ['Shoot-day checklist', 'production'],
      ['Publication checklist', 'publication'],
      ['Archive handoff', 'archive'],
    ]);
    for (const c of STANDARD_CHECKLISTS) expect(c.items).toHaveLength(4);
    expect(checklistInput(STANDARD_CHECKLISTS[1])).toEqual({
      name: 'Shoot-day checklist',
      stage: 'production',
      items: [
        'Confirm venue access & time',
        'Prepare equipment list',
        'Shot list agreed with the client',
        'Backup & label files same day',
      ],
    });
  });

  it('copies the items, so a body can never mutate the constant', () => {
    const body = checklistInput(STANDARD_CHECKLISTS[0]);
    expect(body.items).not.toBe(STANDARD_CHECKLISTS[0].items);
  });
});

describe('the plan skips what is already there', () => {
  it('matches a name trimmed and case-insensitively', () => {
    expect(sameName(' Wall Texts ', 'wall texts')).toBe(true);
    expect(sameName('Wall texts', 'Wall text')).toBe(false);
  });

  it('creates everything against an empty desk', () => {
    expect(planServices([]).create).toHaveLength(34);
    expect(planServices([]).skip).toEqual([]);
    expect(planPackages([]).create).toHaveLength(8);
    expect(planChecklists([]).create).toHaveLength(4);
  });

  it('skips the lines already in the catalogue, whatever their case or spacing', () => {
    const p = planServices([
      { name: '  exhibition LISTING ' },
      { name: 'Catalogue development' },
      { name: 'Something the owner added' },
    ]);
    expect(p.skip.map((s) => s.name)).toEqual(['Exhibition listing', 'Catalogue development']);
    expect(p.create).toHaveLength(32);
    expect(p.create.map((s) => s.name)).not.toContain('Exhibition listing');
  });

  it('skips packages and checklists the same way, so a run resumes', () => {
    const pk = planPackages([{ name: 'basic exhibition listing' }]);
    expect(pk.skip.map((x) => x.name)).toEqual(['Basic Exhibition Listing']);
    expect(pk.create).toHaveLength(7);
    const ch = planChecklists([{ name: 'ARCHIVE HANDOFF' }]);
    expect(ch.skip.map((x) => x.name)).toEqual(['Archive handoff']);
    expect(ch.create).toHaveLength(3);
    // a second run over a full desk writes nothing
    expect(planPackages(STANDARD_PACKAGES).create).toEqual([]);
    expect(planChecklists(STANDARD_CHECKLISTS).create).toEqual([]);
    expect(planServices(STANDARD_SERVICES).create).toEqual([]);
  });
});

describe('serviceInput', () => {
  it('sends the decimals as strings and the caller’s currency', () => {
    expect(serviceInput(svc('Exhibition listing'), STANDARD_CURRENCY)).toEqual({
      name: 'Exhibition listing',
      category: 'media',
      unit: 'piece',
      internal_cost: '20',
      price: '120',
      currency: 'USD',
    });
    const dear = serviceInput(svc('Catalogue development'), 'EUR');
    expect(dear.internal_cost).toBe('700');
    expect(dear.price).toBe('2200');
    expect(dear.currency).toBe('EUR');
  });

  it('emits a body for every line, with no empty name or negative money', () => {
    for (const s of STANDARD_SERVICES) {
      const body = serviceInput(s, STANDARD_CURRENCY);
      expect(body.name.trim()).toBe(body.name);
      expect(body.name.length).toBeGreaterThan(0);
      expect(Number(body.internal_cost)).toBeGreaterThanOrEqual(0);
      expect(Number(body.price)).toBeGreaterThan(Number(body.internal_cost));
    }
  });
});
