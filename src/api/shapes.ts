/**
 * Reading a response's shape without trusting it.
 *
 * This repo has now fixed the same crash seven times: something that should be
 * an array was not, `.map` or `.length` threw during render, and because a
 * thrown render takes its whole subtree with it, **a desk went blank** —
 * navbar, table, empty state and all. The list, for anyone tempted to skip the
 * guard: the artworks facets, the accounting summary, the projects dashboard,
 * the artwork editor's image store, its selection grants, the auction invite
 * list, and a project's linked partner orgs.
 *
 * Two of those were on `main` before anyone opened the page.
 *
 * `normaliseFacets` / `normaliseLedgerSummary` exist for responses with enough
 * structure to be worth a module of their own. `asArray` is for the common
 * case underneath them — one field that should be a list — so that guarding it
 * costs one call rather than a new file, and nobody has to decide whether this
 * particular field is worth the ceremony.
 *
 * It is not a validator. It answers exactly one question — "can I iterate
 * this?" — and a caller that needs the elements checked as well should filter
 * after it, as `normaliseFacets` does.
 */

/**
 * `value` if it is an array, `[]` otherwise.
 *
 *     images.map(…)              // throws on `{pagination, results}`
 *     asArray(images).map(…)     // renders an empty image strip
 *
 * The degraded result is always the honest one here: an empty list says "none
 * that I can see", which is what a caller who cannot read the response knows.
 */
export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
