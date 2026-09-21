/**
 * `useNow` — the current time as state, so a countdown re-renders as it counts.
 *
 * The old app runs one 1-second timer while anything on screen is still
 * counting down and stops it once everything has closed (`recCdStart` /
 * `recCdTick`, `app.html:4688-4691`). This is that rule as a hook: the caller
 * passes whether anything is live, and the timer exists only while it is.
 *
 * It also fixes a purity bug the lint rule was pointing at (**TD-7**). Reading
 * `Date.now()` during render makes the render impure *and* leaves the value
 * frozen: `AuctionEventPage` had no timer at all, so its "2d 23h" was whatever
 * it was when the page mounted and only ever moved when some other state
 * happened to change. The time a component displays has to be state, like any
 * other value that changes on its own.
 */
import { useEffect, useState } from 'react';

/** Epoch ms, refreshed every `ms` while `active`. Frozen when not. */
export function useNow(active: boolean, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    // A self-rescheduling timeout rather than `setInterval`, for the same
    // reason the old tick re-reads the clock every time (`recCdTick`): each
    // tick takes a fresh `Date.now()`, so a throttled background tab resumes
    // showing the real remaining time instead of a drifted one. The first is
    // scheduled at 0 — `recCdStart` ticks once before starting its timer,
    // because `active` may have just flipped and `now` be an interval stale.
    let t = setTimeout(function tick() {
      setNow(Date.now());
      t = setTimeout(tick, ms);
    }, 0);
    return () => clearTimeout(t);
  }, [active, ms]);

  return now;
}
