/**
 * Feature controls — the v0.1 visibility reduction.
 *
 * v0.1 is a visibility reduction, not a rebuild: every future feature stays in
 * the codebase and is switched OFF here, so it can be activated later without
 * rebuilding anything. This mirrors the old app's own mechanism — the owner's
 * `theme.navOff` map (app.html:2969-2976, `dzNavSectionSync`) that hides nav
 * sections, `theme.detailBtns` (app.html:2844, :9217-9237) that decides which
 * collector actions the artwork detail renders, and `theme.showQ` /
 * `theme.chatAI` / `theme.storiesShow` for the rest — but as ONE typed table
 * read by the nav, the route table, the artwork detail and the profile.
 *
 * Only the code reads this. There is no runtime/owner toggle yet (the old
 * app's is Admin → Owner Settings; the new backend has no equivalent), which is
 * why the set is chosen by a build-time env var rather than an API call.
 *
 * `VITE_FEATURE_SET` — `v0.1` (default when unset) or `full`. See `.env.example`.
 */

export type FeatureSet = 'v0.1' | 'full';

export interface FeatureFlags {
  /** Market — catalogue browse, artwork detail, artist pages. Always on. */
  market: true;
  /** Records — external auction-house results per artist (DEC-13). */
  records: boolean;
  /** Chat — the collector ↔ Darz Admin conversation (human, not AI). */
  chat: boolean;
  /** Profile — saved works, previous inquiries, activity, account. */
  profile: boolean;
  /** Settings — the v0.1-relevant settings only. */
  settings: boolean;

  /** The one v0.1 contact CTA on the artwork detail. */
  sendInquiry: boolean;
  /** Buy now / 24h hold / Request viewing / Make an offer / Request price —
   * the old `theme.detailBtns` set (app.html:2844). Hidden in v0.1. */
  commerceActions: boolean;
  /** Save / unsave (Phase 6). */
  save: boolean;

  /** Auctions — events, lots, bidding, registration, countdowns, the auction
   * notifications feed + banner (Phase 8). Hidden in v0.1 (DEC-2R: the
   * hardened engine stays dormant). */
  auctions: boolean;
  /** Profile › Auctions anchor (registrations, standings). */
  profileAuctions: boolean;
  /** The collector questionnaire (`theme.showQ`). */
  questionnaire: boolean;
  /** "Ask Darz AI" chat mode (`theme.chatAI`). */
  aiChat: boolean;
  /** Gallery / artist chat — does not exist in the old app either. */
  galleryChat: boolean;
  /** Insights & Stories (`theme.storiesShow`, DEC-6: deferred). */
  stories: boolean;
  /** Recommendations "Curated for you". */
  recommendations: boolean;
  /** Membership display / redemption. */
  membership: boolean;
  /** Web-push opt-in (backend Phase 13 — wired to auctions only today). */
  push: boolean;
  /** The admin desk (`/admin/*`) — a team-principal surface, never in the
   * collector nav. */
  adminDesk: boolean;
}

const V0_1: FeatureFlags = {
  market: true,
  records: true,
  chat: true,
  profile: true,
  settings: true,

  sendInquiry: true,
  commerceActions: false,
  save: true,

  auctions: false,
  profileAuctions: false,
  questionnaire: false,
  aiChat: false,
  galleryChat: false,
  stories: false,
  recommendations: false,
  membership: false,
  push: false,
  adminDesk: true,
};

const FULL: FeatureFlags = {
  ...V0_1,
  commerceActions: true,
  auctions: true,
  profileAuctions: true,
  questionnaire: true,
  aiChat: true,
  stories: true,
  recommendations: true,
  membership: true,
  push: true,
};

export const FEATURE_SETS: Record<FeatureSet, FeatureFlags> = { 'v0.1': V0_1, full: FULL };

/** Which set the build runs. Unset / unknown → `v0.1` (the launch scope). */
export function resolveFeatureSet(
  raw: unknown = import.meta.env.VITE_FEATURE_SET,
): FeatureSet {
  return raw === 'full' ? 'full' : 'v0.1';
}

export const FEATURE_SET: FeatureSet = resolveFeatureSet();
export const features: FeatureFlags = FEATURE_SETS[FEATURE_SET];

/**
 * The route prefixes a feature owns. A hidden feature's routes redirect to
 * Market so a deep link, a stale bookmark or a typed URL can never reach it
 * (the old app's `render()` guard, app.html:5673: a switched-off tab forces
 * `tab='market'`).
 */
export const FEATURE_ROUTES: ReadonlyArray<[keyof FeatureFlags, string]> = [
  ['auctions', '/auctions'],
  ['records', '/records'],
  ['chat', '/chat'],
  ['profile', '/profile'],
  ['settings', '/settings'],
  ['adminDesk', '/admin'],
];

/** True when `path` belongs to a feature that is switched off. */
export function isHiddenPath(path: string, flags: FeatureFlags = features): boolean {
  return FEATURE_ROUTES.some(
    ([flag, prefix]) => !flags[flag] && (path === prefix || path.startsWith(prefix + '/')),
  );
}
