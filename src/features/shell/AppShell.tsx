/**
 * AppShell — the Market App chrome every collector screen sits in. Faithful
 * port of app.html's `.frame` › `header` › `.chroma` › `main` › `nav`
 * (COMPONENTS.md § Shell / Navigation, app.html:2670-2693 markup):
 *
 *   - the 430px frame (desktop: `min(1760px,96vw)`), only `<main>` scrolls;
 *   - a sticky glass header: wordmark left, **Leave the Room** pill right;
 *   - the 2px cyan→magenta chroma line directly under the header;
 *   - the bottom nav (desktop: `order:-1`, a top nav with a chroma underline).
 *
 * Nav tabs are the shipped DOM order minus the sections this backend has no
 * data for: Market · Auctions · Records · Profile · Settings. Highlights is
 * always hidden in the old app too; **Insights & Stories** is owner-toggled
 * there and has no backend model here (docs/TASKLIST.md Phase 12+), so it is
 * left out rather than shown as a dead tab — flagged, not silently dropped.
 * The floating **Chat** pill is omitted for the same reason (no chat API).
 */
import { useEffect, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import { Wordmark } from '../../components';
import { cx } from '../../lib/cx';
import { layoutController } from './LayoutController';
import { NAV_ICONS, type NavIconKey } from './navIcons';
import './shell.css';

interface Tab {
  key: NavIconKey;
  label: string;
  to: string;
  /** which route prefixes light this tab (Market owns the catalogue, artwork,
   * artists and saved routes — they are all the same "Market" section) */
  match: string[];
}

const TABS: Tab[] = [
  { key: 'market', label: 'Market', to: '/', match: ['/', '/artwork', '/artists', '/saved'] },
  { key: 'auctions', label: 'Auctions', to: '/auctions', match: ['/auctions'] },
  { key: 'records', label: 'Records', to: '/records', match: ['/records'] },
  { key: 'profile', label: 'Profile', to: '/profile', match: ['/profile'] },
  { key: 'settings', label: 'Settings', to: '/settings', match: ['/settings'] },
];

function isActive(tab: Tab, pathname: string): boolean {
  return tab.match.some((m) =>
    m === '/' ? pathname === '/' : pathname === m || pathname.startsWith(m + '/'),
  );
}

const LEAVE_ICON = (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

export function AppShell({ children }: { children: ReactNode }) {
  const { auth } = useApi();
  const { pathname } = useLocation();

  // The layout engine lives for the whole app; start it once with the shell.
  useEffect(() => {
    layoutController.start();
    return () => layoutController.stop();
  }, []);

  return (
    <div className="frame">
      <header>
        <Wordmark suffix="market.art" withMark={false} />
        <button
          type="button"
          className="dz-leave"
          title="Leave the Room"
          onClick={() => void auth.logout()}
        >
          {LEAVE_ICON}
          <span>Leave the Room</span>
        </button>
      </header>
      <div className="chroma" />
      <main id="dzMain">{children}</main>
      <nav aria-label="Sections">
        {TABS.map((tab) => (
          <NavLink
            key={tab.key}
            to={tab.to}
            className={cx(isActive(tab, pathname) && 'on')}
            aria-current={isActive(tab, pathname) ? 'page' : undefined}
          >
            <span className="ic">{NAV_ICONS[tab.key]}</span>
            <span className="lb">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
