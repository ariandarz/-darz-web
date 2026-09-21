/**
 * Regression tests for a crash the stub tier caught: an unexpected facet
 * response blanked the whole Artworks desk, because render called `.map` on
 * `undefined`. Every case here is a shape the endpoint could actually answer.
 */
import { describe, expect, it } from 'vitest';
import { EMPTY_FACETS, normaliseFacets } from './artworkFacets';

describe('normaliseFacets', () => {
  it('passes a well-formed response through', () => {
    expect(normaliseFacets({ years: [2024, 1998], sources: ['O Gallery'] })).toEqual({
      years: [2024, 1998],
      sources: ['O Gallery'],
    });
  });

  it('survives the paginated envelope the E2E stub answers for an unknown GET', () => {
    // This is the exact shape that took the desk down.
    expect(normaliseFacets({ results: [], pagination: { page: 1, total_count: 0 } })).toEqual(
      EMPTY_FACETS,
    );
  });

  it('survives every non-object body', () => {
    for (const raw of [null, undefined, 'nope', 42, true]) {
      expect(normaliseFacets(raw), String(raw)).toEqual(EMPTY_FACETS);
    }
  });

  it('survives an array body, which is not the envelope either', () => {
    // An array IS an object, so this is the case a plain typeof check misses.
    expect(normaliseFacets([1, 2, 3])).toEqual(EMPTY_FACETS);
  });

  it('drops a present-but-wrong-typed key rather than passing it to the UI', () => {
    expect(normaliseFacets({ years: 'all', sources: { a: 1 } })).toEqual(EMPTY_FACETS);
  });

  it('drops junk entries inside otherwise valid arrays', () => {
    expect(
      normaliseFacets({
        years: [2024, null, '1998', NaN, 2011],
        sources: ['O', '', null, 'D'],
      }),
    ).toEqual({ years: [2024, 2011], sources: ['O', 'D'] });
  });

  it('a partial response keeps the half that is valid', () => {
    expect(normaliseFacets({ years: [2024] })).toEqual({ years: [2024], sources: [] });
  });
});
