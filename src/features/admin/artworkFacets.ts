/**
 * Normalising the Database desk's facet response.
 *
 * `GET /catalog/admin/artworks/facets/` answers `{years, sources}` — but a
 * desk must not blank out when it answers something else, and there are real
 * ways for it to: an older deploy without the route, a proxy that rewrites an
 * unknown admin path onto a list endpoint, or the E2E stub tier, whose whole
 * job is to answer every unmatched GET with an empty *paginated* envelope.
 *
 * That last one is not hypothetical — it is how this function came to exist.
 * Trusting the shape and calling `.map` on `facets.years` threw
 * `Cannot read properties of undefined (reading 'map')` during render, which
 * takes the **entire desk** down, not just the dropdown: the table, the rows
 * and the empty state all vanish behind a blank page. A missing dropdown
 * vocabulary is a degraded filter; a thrown render is a broken desk.
 *
 * So: anything that is not an array of the right primitive is dropped, and the
 * worst case is two empty dropdowns over a working table.
 */
import type { ArtworkFacets } from '../../api/types';

export const EMPTY_FACETS: ArtworkFacets = { years: [], sources: [] };

export function normaliseFacets(raw: unknown): ArtworkFacets {
  if (!raw || typeof raw !== 'object') return EMPTY_FACETS;
  const value = raw as Record<string, unknown>;
  return {
    years: Array.isArray(value.years)
      ? value.years.filter((y): y is number => typeof y === 'number' && Number.isFinite(y))
      : [],
    sources: Array.isArray(value.sources)
      ? value.sources.filter((s): s is string => typeof s === 'string' && s !== '')
      : [],
  };
}
