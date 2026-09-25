/**
 * Reading a paginated list whole.
 *
 * The backend clamps `per_page` to **100** (`apps/core/pagination.py`
 * `max_page_size`). Asking for 500 silently returns the first 100 with
 * `has_next: true`, so a caller that reads one page and stops truncates any
 * list past 100 rows (C-5: the Artists desk and every artist picker did). A
 * desk that needs a whole list walks it with this; one walker and one cap, so
 * desks cannot differ on how much of a list they actually read.
 *
 * Lifted from `features/admin/projects/projectForm.ts` (where the Projects
 * desks first needed it), which re-exports it; the two private `walkAll`
 * copies in the exhibitions desks now use it too.
 */
import type { Paginated } from './types';

/** The backend's page-size ceiling — asking for more is pointless. */
export const MAX_PER_PAGE = 100;

/** The page cap — 50 pages × 100 rows is far past any real roster, and it
 * stops a bad `has_next` from looping forever. */
export const WALK_MAX_PAGES = 50;

/** Every page of a list, in order. `fetchPage` gets the 1-based page number;
 * pass `per_page: MAX_PER_PAGE` in it. */
export async function walkPages<T>(
  fetchPage: (page: number) => Promise<
    Pick<Paginated<T>, 'results'> & {
      pagination?: Partial<Paginated<T>['pagination']>;
    }
  >,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= WALK_MAX_PAGES; page++) {
    const res = await fetchPage(page);
    out.push(...res.results);
    if (!res.pagination?.has_next) break;
  }
  return out;
}
