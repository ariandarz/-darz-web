import { describe, expect, it } from 'vitest';
import type { PackageTemplateAdmin, ServiceCatalogItemAdmin } from '../../../api/types';
import { MERGED_SERVICES } from './standardSet';
import { collapse, describeTidy, hasWork, planTidy } from './tidyUp';

const svc = (id: string, name: string): ServiceCatalogItemAdmin =>
  ({
    id,
    name,
    price: '1',
    currency: 'TMN',
    version: 3,
  }) as unknown as ServiceCatalogItemAdmin;

const pkg = (id: string, name: string, lines: unknown): PackageTemplateAdmin =>
  ({ id, name, lines, version: 7 }) as unknown as PackageTemplateAdmin;

/** The pair the tests use throughout: the coverage row folded into the priced one. */
const PHOTO = MERGED_SERVICES.find((m) => m.folded === 'Installation photography')!;

describe('planTidy', () => {
  it('finds nothing in a workspace seeded after the ruling', () => {
    const plan = planTidy([svc('keep', PHOTO.kept)], []);
    expect(hasWork(plan)).toBe(false);
    expect(plan.remove).toEqual([]);
  });

  it('marks a superseded row for deletion, with the version a delete needs', () => {
    const plan = planTidy([svc('keep', PHOTO.kept), svc('old', PHOTO.folded)], []);
    expect(plan.remove).toEqual([{ id: 'old', name: PHOTO.folded, version: 3 }]);
  });

  it('re-points a package line at the row it was merged into', () => {
    const plan = planTidy(
      [svc('keep', PHOTO.kept), svc('old', PHOTO.folded)],
      [
        pkg('p1', 'Content Production', [
          { svcId: 'old', count: 1 },
          { svcId: 'other', count: 2 },
        ]),
      ],
    );
    expect(plan.repoint).toHaveLength(1);
    expect(plan.repoint[0]).toMatchObject({ id: 'p1', version: 7, moved: 1 });
    expect(plan.repoint[0].lines).toEqual([
      { svcId: 'keep', count: 1 },
      { svcId: 'other', count: 2 },
    ]);
  });

  it('collapses a package that held BOTH sides into one line, counts added', () => {
    const plan = planTidy(
      [svc('keep', PHOTO.kept), svc('old', PHOTO.folded)],
      [
        pkg('p1', 'Both', [
          { svcId: 'keep', count: 3 },
          { svcId: 'old', count: 1 },
        ]),
      ],
    );
    expect(plan.repoint[0].lines).toEqual([{ svcId: 'keep', count: 4 }]);
  });

  it('leaves a package that never named the folded row alone', () => {
    const plan = planTidy(
      [svc('keep', PHOTO.kept), svc('old', PHOTO.folded)],
      [pkg('p1', 'Elsewhere', [{ svcId: 'other', count: 1 }])],
    );
    expect(plan.repoint).toEqual([]);
    expect(plan.remove).toHaveLength(1); // the row still goes
  });

  it('refuses to strand a line: no merged partner means no delete', () => {
    const plan = planTidy(
      [svc('old', PHOTO.folded)],
      [pkg('p1', 'Content Production', [{ svcId: 'old', count: 1 }])],
    );
    expect(plan.remove).toEqual([]);
    expect(plan.repoint).toEqual([]);
    expect(plan.orphans).toEqual([{ name: PHOTO.folded, wanted: PHOTO.kept }]);
  });

  it('does nothing for the case-folded pair, which is already one row', () => {
    // "Artist interview" and "Artist Interview" resolve to the same catalogue
    // row, so there is no second row to move off or delete
    const plan = planTidy([svc('one', 'Artist Interview')], []);
    expect(hasWork(plan)).toBe(false);
  });

  it('handles the three real rows a pre-ruling workspace holds', () => {
    const catalogue = [
      svc('k1', 'Exhibition Photo Coverage'),
      svc('k2', 'Video Documentation'),
      svc('k3', 'Darz Listing'),
      svc('o1', 'Installation photography'),
      svc('o2', 'Video walkthrough / reel'),
      svc('o3', 'Collector network push'),
    ];
    const plan = planTidy(catalogue, [
      pkg('p1', 'Content Production', [
        { svcId: 'o1', count: 1 },
        { svcId: 'o2', count: 1 },
      ]),
      pkg('p2', 'Amplification', [{ svcId: 'o3', count: 1 }]),
    ]);
    expect(plan.remove.map((r) => r.id).sort()).toEqual(['o1', 'o2', 'o3']);
    expect(plan.repoint).toHaveLength(2);
    expect(plan.repoint[0].lines).toEqual([
      { svcId: 'k1', count: 1 },
      { svcId: 'k2', count: 1 },
    ]);
    expect(plan.repoint[1].lines).toEqual([{ svcId: 'k3', count: 1 }]);
  });

  it('matches a row however it is cased or spaced', () => {
    const plan = planTidy(
      [svc('keep', 'exhibition photo coverage'), svc('old', '  Installation Photography ')],
      [],
    );
    expect(plan.remove.map((r) => r.id)).toEqual(['old']);
  });
});

describe('collapse', () => {
  it('leaves distinct services alone', () => {
    expect(
      collapse([
        { svcId: 'a', count: 1 },
        { svcId: 'b', count: 2 },
      ]),
    ).toEqual([
      { svcId: 'a', count: 1 },
      { svcId: 'b', count: 2 },
    ]);
  });

  it('treats a missing count as one', () => {
    expect(collapse([{ svcId: 'a' }, { svcId: 'a' }])).toEqual([{ svcId: 'a', count: 2 }]);
  });

  it('keeps a line with no service id rather than dropping it', () => {
    expect(collapse([{ count: 1 }, { count: 1 }])).toHaveLength(2);
  });
});

describe('describeTidy', () => {
  it('says there is nothing to do when there is not', () => {
    expect(describeTidy(planTidy([], []))).toMatch(/no superseded lines/i);
  });

  it('names what moves and what is deleted, in that order', () => {
    const text = describeTidy(
      planTidy(
        [svc('keep', PHOTO.kept), svc('old', PHOTO.folded)],
        [pkg('p1', 'Content Production', [{ svcId: 'old', count: 1 }])],
      ),
    );
    expect(text).toMatch(/move 1 package line/);
    expect(text).toContain('Content Production');
    expect(text.indexOf('move')).toBeLessThan(text.indexOf('delete'));
    expect(text).toContain(PHOTO.folded);
  });

  it('says plainly when a line would have nowhere to go', () => {
    expect(describeTidy(planTidy([svc('old', PHOTO.folded)], []))).toMatch(
      /nowhere to move to/i,
    );
  });
});
