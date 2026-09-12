/**
 * AppShell — the Market App chrome every collector screen sits in. Faithful
 * port of app.html's `.frame` › `header` › `.chroma` › `main` › `nav`
 * (COMPONENTS.md § Shell / Navigation, app.html:2670-2693 markup):
 *
 *   - the 430px frame (desktop: `min(1760px,96vw)`), only `<main>` scrolls;
 *   - a sticky glass header: wordmark left, **Leave the Room** pill right;
 *   - the 2px cyan→magenta chroma line directly under the header;
 *   - the one `<nav id="nav">` — the bottom tab bar on a phone, the editorial
 *     top bar on desktop (`html.dz-desktop`, `LayoutController`).
 *
 * The visible v0.1 order is Market → Records → Chat → Profile → Settings
 * (`features.ts`, the port of the old `theme.navOff` gate, app.html:2969-2976).
 * Auctions and Insights render only when their flag is on; Highlights was
 * already hard-hidden in the old app. The Profile dot (`.navdot`,
 * app.html:455-460) signals unseen Darz replies; Chat carries the same dot.
 */
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApi } from '../../api/hooks';
import { Wordmark } from '../../components';
import { useConversations } from '../conversations/useConversations';
import { features } from './features';
import { layoutController } from './LayoutController';
import {
  AuctionsIcon,
  ChatIcon,
  MarketIcon,
  ProfileIcon,
  RecordsIcon,
  SettingsIcon,
  StoriesIcon,
} from './NavIcons';
import './shell.css';

interface Tab {
  key: string;
  label: string;
  to: string;
  icon: ReactNode;
  /** active when the path starts with one of these */
  match: string[];
  show: boolean;
  dot?: boolean;
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
  const location = useLocation();
  const navigate = useNavigate();
  const { auth } = useApi();
  const { controller } = useConversations();
  const unread = controller.unreadTotal();

  useSyncExternalStore(
    (cb) => layoutController.subscribe(cb),
    () => layoutController.isDesktop,
    () => false,
  );

  useEffect(() => {
    document.documentElement.classList.add('dz-shell');
    layoutController.start();
    return () => {
      layoutController.stop();
      document.documentElement.classList.remove('dz-shell');
    };
  }, []);

  const tabs: Tab[] = [
    {
      key: 'market',
      label: 'Market',
      to: '/',
      icon: <MarketIcon />,
      match: ['/', '/artwork', '/artists', '/saved'],
      show: features.market,
    },
    {
      key: 'auctions',
      label: 'Auctions',
      to: '/auctions',
      icon: <AuctionsIcon />,
      match: ['/auctions'],
      show: features.auctions,
    },
    {
      key: 'records',
      label: 'Records',
      to: '/records',
      icon: <RecordsIcon />,
      match: ['/records'],
      show: features.records,
    },
    {
      key: 'stories',
      label: 'Insights',
      to: '/stories',
      icon: <StoriesIcon />,
      match: ['/stories'],
      show: features.stories,
    },
    {
      key: 'chat',
      label: 'Chat',
      to: '/chat',
      icon: <ChatIcon />,
      match: ['/chat'],
      show: features.chat,
      dot: unread > 0,
    },
    {
      key: 'profile',
      label: 'Profile',
      to: '/profile',
      icon: <ProfileIcon />,
      match: ['/profile'],
      show: features.profile,
      dot: unread > 0,
    },
    {
      key: 'settings',
      label: 'Settings',
      to: '/settings',
      icon: <SettingsIcon />,
      match: ['/settings'],
      show: features.settings,
    },
  ];

  const path = location.pathname;
  const isOn = (t: Tab) =>
    t.match.some((m) => (m === '/' ? path === '/' : path === m || path.startsWith(m + '/')));

  const signOut = () =>
    void auth.logout().finally(() => navigate('/login', { replace: true }));

  return (
    <div className="frame">
      <header>
        <Wordmark suffix="market.art" withMark={false} />
        <button type="button" className="dz-leave" title="Leave the Room" onClick={signOut}>
          {LEAVE_ICON}
          <span>Leave the Room</span>
        </button>
      </header>
      <div className="chroma" />
      <main id="dzMain">{children}</main>
      <nav id="nav" aria-label="Sections">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.key}
              type="button"
              data-tab={t.key}
              className={[isOn(t) ? 'on' : '', t.dot ? 'nav-hasnew' : ''].join(' ').trim()}
              aria-current={isOn(t) ? 'page' : undefined}
              onClick={() => navigate(t.to)}
            >
              <span className="ic">
                {t.icon}
                {t.key === 'profile' || t.key === 'chat' ? (
                  <span className="navdot" aria-hidden="true" />
                ) : null}
              </span>
              <span className="lb">{t.label}</span>
            </button>
          ))}
      </nav>
    </div>
  );
}
