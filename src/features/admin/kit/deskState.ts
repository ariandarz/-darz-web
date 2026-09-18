/**
 * The desk kit's one piece of real logic: what a list desk shows right now.
 *
 * It is pure and lives apart from the components because it has edge cases that
 * are easy to get subtly wrong and impossible to test through a component in
 * this repo (vitest only — no jsdom, by design).
 *
 * The rules are generalised from the request desk, which had them inline as a
 * chain of four conditions. Two are worth stating because they are the ones a
 * fresh implementation usually gets wrong:
 *
 *  - **A reload with rows already on screen keeps the rows.** Going to
 *    `loading` on every filter change would flash the table away and back,
 *    which on a desk you are actively filtering reads as a bug. So `rows` wins
 *    over `loading` whenever there is anything to show.
 *  - **An error never hides rows either.** A failed *refresh* still leaves the
 *    last good page usable; the failure is a banner, not a replacement. That is
 *    why `error` here is only the *empty* error view, and `deskBanner` is what
 *    tells you something went wrong regardless of the view.
 */
import type { LoadStatus } from '../../shared/ListController';

/** Which of the four bodies a list desk renders. */
export type DeskView = 'loading' | 'error' | 'empty' | 'rows';

export function resolveDeskView(status: LoadStatus, rowCount: number): DeskView {
  if (rowCount > 0) return 'rows';
  if (status === 'loading') return 'loading';
  if (status === 'error') return 'error';
  return 'empty';
}

/**
 * The message to show above the body, if any — independent of the view, so a
 * failed refresh or a failed row action surfaces without taking the table away.
 *
 * `actionError` wins: it is the thing the person just did, so it is the more
 * relevant of the two, and a row action that 409s while a background refresh
 * also failed should still explain the 409.
 */
export function deskBanner(
  status: LoadStatus,
  loadError: string | null,
  actionError?: string | null,
): string | null {
  return actionError ?? (status === 'error' ? loadError : null);
}
