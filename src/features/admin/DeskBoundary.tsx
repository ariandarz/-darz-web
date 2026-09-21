/**
 * The one thing standing between a desk that throws and a blank browser tab.
 *
 * **Why this exists, in four incidents.** A render that throws takes down
 * everything above it as well as the desk itself, so until now a single bad
 * field meant the navbar, the sub-tabs and every route went white — with
 * nothing on screen saying so, and no way back except retyping a URL:
 *
 *   1. `AdminLayout` returned a fragment under a centring flex `#root`, so the
 *      admin bar laid out beside the table (caught by a screenshot, and the
 *      reason `docs/ADMIN_V1_AUDIT.md` says a suite of logic tests cannot see
 *      this class of bug at all).
 *   2. An unexpected facets response blanked the whole Artworks desk — `.map`
 *      on `undefined` (fixed in `artworkFacets.ts`).
 *   3. `.length` on an undefined `currencies` blanked all of `/admin/accounting`.
 *   4. `responsibility_by_member is not iterable` blanked the Projects
 *      dashboard.
 *
 * 2-4 are the same mistake — trusting a response's shape — and each was fixed
 * where it happened, which is right but never finishes: the next desk to read
 * a new endpoint can make it again. This is the floor under all of them. It
 * does **not** replace normalising a response; it makes the failure legible
 * and survivable when normalising was missed.
 *
 * Deliberately narrow: it wraps the desk `<Outlet>` and nothing else, so the
 * shell stays up and the person can click another desk. An error boundary
 * around the whole app would make the same failure look like a working app
 * with nothing in it.
 *
 * Class component because there is no hook form of `componentDidCatch` —
 * the one place React's own idiom is still a class, so the repo's
 * function-components rule does not apply.
 *
 * It holds no reset logic of its own: the shell gives it `key={pathname}`, so
 * React discards a boundary that caught something the moment you open another
 * desk. Keyed on the PATHNAME and not the full location, because a desk's
 * filters live in the query string — keying on those too would remount the
 * desk, and lose its state, every time someone touched a dropdown.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import './admin.css';

interface Props {
  children: ReactNode;
}
interface State {
  message: string | null;
}

export class DeskBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : 'Something went wrong.' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The browser console is the only place this can go — there is no error
    // reporting service in this app, and inventing one is not this fix's job.
    console.error('[desk] render failed:', error, info.componentStack);
  }

  render() {
    if (this.state.message === null) return this.props.children;
    return (
      <div className="dz-page ad-page">
        <h1 className="ad-h">This desk could not be drawn</h1>
        <p className="ad-desksub">
          The rest of the panel still works — pick another desk above, or reload this one.
        </p>
        <p className="dz-state err" role="alert">
          {this.state.message}{' '}
          <button type="button" className="ad-chip" onClick={() => window.location.reload()}>
            Reload
          </button>
        </p>
      </div>
    );
  }
}
