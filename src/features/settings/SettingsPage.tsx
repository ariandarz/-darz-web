/**
 * SettingsPage — `/settings`. Port of `settingsView()` (app.html:9827-9939),
 * reduced to what v0.1 has a real backend or a real device setting for:
 *
 *   ✓ Profile row (:9920-9922) → /profile — "view & edit profile" again now
 *     that Account edits through `PATCH /api/auth/me/` (G-B1)
 *   ✓ DISPLAY › Appearance — Paper / Black, the app's own theme engine
 *     (`ThemeController`; the old app's moon toggle + `appMode`). Shown here
 *     because this port has no header toggle. Currency / Language rows stay
 *     hidden as in the old default (`showCurrencySetting` / `showLangSetting`
 *     = Hidden, :9916-9920).
 *   ✓ ACCOUNT › Edit profile → Profile › Account, the editable card
 *     (:9949); Privacy & data (:9950)
 *   ✓ LEGAL › Terms & Conditions · Privacy Policy (:9954-9956). "Auction
 *     Terms" is behind `features.auctions`. See `useLegalLinks` for where
 *     each link points.
 *   ✓ About (:9931-9933), LEAVE THE ROOM + "Powered by Darz" + build (:9936)
 *   ✗ NOTIFICATIONS (:9901-9915) — the toggles were device-local preferences
 *     with no backend, and push is wired to auctions only (Phase 13): hidden
 *     behind `features.push`, not deleted.
 *   ✓ Membership (:9923-9927) — the row, its plan sub-line and its ACTIVE /
 *     EXPIRED pill from `GET /api/auth/my-membership/` (G-MEMB-3/6/7),
 *     opening the access-tier sheet (`MembershipSheet`). Behind
 *     `features.membership`.
 *   ✗ "Get the app" (PWA install) — no service worker in this build yet.
 */
import { useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApi, useOptions, useSession } from '../../api/hooks';
import type { Choice } from '../../api/types';
import { themeController } from '../../design';
import '../catalogue/catalogue.css';
import { MembershipSheet } from '../membership/MembershipSheet';
import { membershipState, membershipSubline } from '../membership/membership';
import '../membership/membership.css';
import { useMyMembership } from '../membership/useMyMembership';
import { features } from '../shell/features';
import { useLegalLinks } from './useLegalLinks';
import './settings.css';

const ic = {
  disp: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  acct: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  ),
  legal: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h6" />
    </svg>
  ),
  info: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
  bell: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  ),
};

function useTheme() {
  return useSyncExternalStore(
    (cb) => themeController.subscribe(cb),
    () => themeController.theme,
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { me } = useSession();
  const { auth } = useApi();
  const theme = useTheme();

  const name = me?.display_name || me?.name || 'Darz Profile';
  const sub = me?.tier
    ? `${me.tier.charAt(0).toUpperCase() + me.tier.slice(1)} collector`
    : 'Collector';

  const signOut = () =>
    void auth.logout().finally(() => navigate('/login', { replace: true }));

  const [membershipOpen, setMembershipOpen] = useState(false);
  const { membership, reload: reloadMembership } = useMyMembership(features.membership);
  const options = useOptions();
  const memb = membershipState(membership);
  const tierLabel = (tier: string) =>
    ((options?.['accounts.collector_tier'] as Choice[] | undefined) ?? []).find(
      (c) => c.value === tier,
    )?.label ?? tier;
  const legal = useLegalLinks(features.auctions);

  return (
    <div className="dz-page">
      <div className="hero compact">
        <p className="eyebrow">Preferences</p>
        <h1>Settings</h1>
      </div>

      <div className="st-card">
        <Link to="/profile" className="st-profile">
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="n" style={{ display: 'block' }}>
              {name}
            </span>
            <span className="m" style={{ display: 'block' }}>
              {sub} · view &amp; edit profile
            </span>
          </span>
          <span className="st-chev">›</span>
        </Link>
      </div>

      {/* Membership (`:9923-9927`) — the row, its sub-line and its pill, from
          `GET /api/auth/my-membership/`. While the read is in flight (or if it
          fails) the row shows the old default sub-line and no pill, which is
          exactly what the old app shows a non-member. */}
      {features.membership && (
        <div className="st-card">
          <button
            type="button"
            className="st-row top click"
            onClick={() => setMembershipOpen(true)}
          >
            {/* flex:1 — the old row's text block (:9925), so the pill sits by
                the chevron rather than mid-row */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t">Membership</div>
              <div className="s">
                {membershipSubline(memb, memb.kind === 'none' ? '' : tierLabel(memb.tier))}
              </div>
            </div>
            {memb.kind === 'active' && <span className="mb-pill on">ACTIVE</span>}
            {memb.kind === 'ended' && <span className="mb-pill off">EXPIRED</span>}
            <span className="st-chev">›</span>
          </button>
        </div>
      )}

      {features.push && (
        <div className="st-card">
          <div className="st-head">
            <span className="ic">{ic.bell}</span>
            <span className="lb">NOTIFICATIONS</span>
          </div>
          <div className="st-row top">
            <div>
              <div className="t">Push to this device</div>
              <div className="s">Alerts for auctions you follow</div>
            </div>
          </div>
        </div>
      )}

      <div className="st-card">
        <div className="st-head">
          <span className="ic">{ic.disp}</span>
          <span className="lb">DISPLAY</span>
        </div>
        <div className="st-row top">
          <div>
            <div className="t">Appearance</div>
            <div className="s">Paper or Black, remembered on this device</div>
          </div>
          <div className="ctl">
            <div className="st-seg" role="group" aria-label="Appearance">
              <button
                type="button"
                className={theme.isDark() ? '' : 'on'}
                onClick={() => themeController.set('light')}
              >
                Paper
              </button>
              <button
                type="button"
                className={theme.isDark() ? 'on' : ''}
                onClick={() => themeController.set('bw')}
              >
                Black
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="st-card">
        <div className="st-head">
          <span className="ic">{ic.acct}</span>
          <span className="lb">ACCOUNT</span>
        </div>
        <Link to="/profile?tab=account" className="st-row top click">
          <div>
            <div className="t">Edit profile</div>
            <div className="s">Name, contact and collector details</div>
          </div>
          <span className="st-chev">›</span>
        </Link>
        <Link to="/chat" className="st-row top click">
          <div>
            <div className="t">Privacy &amp; data</div>
            <div className="s">Ask Darz what is stored and how it is used</div>
          </div>
          <span className="st-chev">›</span>
        </Link>
      </div>

      <div className="st-card">
        <div className="st-head">
          <span className="ic">{ic.legal}</span>
          <span className="lb">LEGAL</span>
        </div>
        <a className="st-row top click" href={legal.terms} target="_blank" rel="noopener">
          <div>
            <div className="t">Terms &amp; Conditions</div>
            <div className="s">How we work together</div>
          </div>
          <span className="st-chev">›</span>
        </a>
        <a className="st-row top click" href={legal.privacy} target="_blank" rel="noopener">
          <div>
            <div className="t">Privacy Policy</div>
            <div className="s">Your data, kept close</div>
          </div>
          <span className="st-chev">›</span>
        </a>
        {features.auctions && (
          <a className="st-row top click" href={legal.auction} target="_blank" rel="noopener">
            <div>
              <div className="t">Auction Terms</div>
              <div className="s">How bidding works</div>
            </div>
            <span className="st-chev">›</span>
          </a>
        )}
      </div>

      <div className="st-card">
        <div className="st-about-t">
          <span style={{ color: 'var(--ink)', display: 'flex', opacity: 0.85 }}>
            {ic.info}
          </span>
          About darzmarket.art app
        </div>
        <p className="st-about-p">
          darzmarket.art is a private room for collectors of contemporary Iranian art: a
          curated market, artist auction records, and a direct line to Darz.
        </p>
      </div>

      <div className="st-leave-wrap">
        <button type="button" className="st-leave" onClick={signOut}>
          LEAVE THE ROOM
        </button>
        <div className="dz-powered">Powered by Darz</div>
        <div className="st-ver">v0.1</div>
      </div>

      <MembershipSheet
        open={membershipOpen}
        onClose={() => setMembershipOpen(false)}
        membership={membership}
        onRedeemed={reloadMembership}
      />
    </div>
  );
}
