/**
 * ScreenBoundary — the collector app's counterpart of the admin's
 * `DeskBoundary`, and the last of the two the 2026-09-22 route walk asked for.
 *
 * **Why it was not built the same day.** The walk found the same class of
 * crash on the collector side as on the admin side — the worst being
 * `/auctions/lots/:id`, which was a **white screen**, because unlike a desk a
 * collector screen had no boundary under it. It was left out anyway, and
 * recorded as such, for a real reason: an error boundary puts copy in front of
 * a *collector* rather than an admin, and inventing copy for them is exactly
 * what `CLAUDE.md`'s faithful-port rule forbids. Built now, on the owner's
 * instruction (2026-09-22), and the objection turns out to dissolve:
 *
 * **The old app already catches a thrown render, and already has the words.**
 * `app.html:9821`:
 *
 *   try{ el.innerHTML=profBodyHTML(); }
 *   catch(e){ el.innerHTML='<div class="pad"><div class="big">Something went
 *             wrong</div>Reopen your profile or pull to refresh.</div>'; }
 *
 * So the heading is **"Something went wrong"**, verbatim, and the second line
 * is that fallback's own shape: name the way back, then the refresh. The only
 * adaptation is which way back — the old line says "Reopen your profile"
 * because that catch guards exactly one tab's body, while this guards whatever
 * screen is open, so it says to use the bar. "Pull to refresh" is kept as it
 * is: it is this app's phrase for it already (`ProfilePage.tsx:129`, itself
 * ported), and the Reload control beside it is the same affordance for a
 * desktop reader who cannot pull anything.
 *
 * `.pad` / `.pad .big` (`app.html:719-720`) is the old app's recipe for a
 * centred block with a heading. This port has `.dz-state` for the one-line
 * half of that role and never needed the heading half until now, so
 * `.dz-screenfail` in `shell.css` carries it, built from the same two rules.
 *
 * **Deliberately narrow, the same way `DeskBoundary` is:** it wraps `<main>`'s
 * content and nothing else, so the header, the chroma line and the nav stay up
 * and the person can tap another screen. A boundary around the whole app would
 * turn the same failure into a working app with nothing in it.
 *
 * The message itself is NOT shown. That is the one real difference from the
 * admin boundary, and it is deliberate: `DeskBoundary` prints
 * `error.message` because its reader is an admin who can act on
 * "responsibility_by_member is not iterable" and report it. A collector cannot,
 * and the old app shows them nothing of the kind. It goes to the console.
 *
 * Class component because there is no hook form of `componentDidCatch` — the
 * one place React's own idiom is still a class.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import './shell.css';

interface Props {
  children: ReactNode;
}
interface State {
  failed: boolean;
}

export class ScreenBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The browser console is the only place this can go — there is no error
    // reporting service in this app, and inventing one is not this fix's job.
    console.error('[screen] render failed:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="dz-screenfail">
        {/* `app.html:9821`, verbatim */}
        <p className="dz-screenfail-h">Something went wrong</p>
        <p className="dz-screenfail-s">
          Pick another screen below, or pull to refresh.{' '}
          <button
            type="button"
            className="dz-screenfail-r"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </p>
      </div>
    );
  }
}
