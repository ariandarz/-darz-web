/**
 * AppShell — the frame, the scrolling `<main>`, and the one `<nav id="nav">`
 * (app.html:2685-2693) that is the bottom tab bar on a phone and the
 * editorial top bar on desktop (`html.dz-desktop`, see shell.css).
 *
 * The visible v0.1 order is Market → Records → Chat → Profile → Settings.
 * Auctions and Insights are preserved and rendered only when their feature
 * flag is on (`features.ts`) — the port of the old `theme.navOff` gate
 * (app.html:2969-2976). Highlights was already hard-hidden in the old app.
 *
 * The Profile dot (`.navdot`, app.html:455-460) signals unseen Darz replies;
 * Chat carries the same dot for the same reason.
 */
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
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

  return (
    <div className="frame">
      <main>{children}</main>
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
