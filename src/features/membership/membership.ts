/**
 * The collector's membership, as the Settings row and the sheet read it —
 * from `GET /api/auth/my-membership/` (G-MEMB-3/6/7), framework-free.
 *
 * The old app kept `{code, plan, expiry}` on the device and derived two
 * states from it (app.html:10275-10281): **active** (`dzMembership()` — a plan
 * whose expiry, if any, has not passed by the end of that day) and **ended**
 * (`dzMembExpired()` — a plan whose expiry has passed). Anything else is "no
 * membership", and the sheet opens on "Choose your access".
 *
 * The same two states are read off the server's summary:
 *
 *  - **ended** — `active_until` is set and the end of that day has passed;
 *  - **active** — a `tier` is set and the collector's access `status` is
 *    `active`. `active_until` null means an admin-set tier with no coded term
 *    (the backend's own documented case), which the old sheet printed as the
 *    bare word "Active";
 *  - otherwise **none**.
 */
import type { MyMembership } from '../../api/types';

export type MembershipState =
  | { kind: 'active'; tier: string; until: string | null }
  | { kind: 'ended'; tier: string; until: string }
  | { kind: 'none' };

export function membershipState(
  m: MyMembership | null | undefined,
  now = new Date(),
): MembershipState {
  if (!m || !m.tier) return { kind: 'none' };
  if (m.active_until) {
    // `new Date(expiry+'T23:59:59')` (:10275) — the whole last day counts.
    const end = new Date(`${m.active_until}T23:59:59`);
    if (!Number.isNaN(end.getTime()) && end.getTime() < now.getTime()) {
      return { kind: 'ended', tier: m.tier, until: m.active_until };
    }
  }
  if (m.status === 'active') return { kind: 'active', tier: m.tier, until: m.active_until };
  return { kind: 'none' };
}

/** `new Date(expiry+'T00:00:00').toLocaleDateString()` (:10316) — the old
 * app's own call, default locale format and all. `null` for an unparsable
 * date, so a caller never prints "Invalid Date". */
export function formatUntil(date: string): string | null {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
}

/**
 * The Settings row's sub-line (app.html:9925), verbatim in its three forms:
 * `<Plan> · active until <date>` / `<Plan> · active`, "Membership ended ·
 * renew to continue", and the default "View plans and your access to the
 * private room". `planLabel` is the options-map label for the tier.
 */
export function membershipSubline(state: MembershipState, planLabel: string): string {
  if (state.kind === 'active') {
    const until = state.until ? formatUntil(state.until) : null;
    return `${planLabel} · ${until ? `active until ${until}` : 'active'}`;
  }
  if (state.kind === 'ended') return 'Membership ended · renew to continue';
  return 'View plans and your access to the private room';
}
