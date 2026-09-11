/**
 * SettingsPage — the Settings tab (SCREENS.md §12, capture `19-settings`).
 * Ported from `app.html` `settingsView()` (:9827): eyebrow "PREFERENCES" ·
 * "Settings" · the profile row ("<name> / Collector · view & edit profile") ·
 * groups with a 16px line icon — **NOTIFICATIONS** (New arrivals · Auction
 * reminders · Offer & request updates toggles) · **DISPLAY** (Language;
 * Appearance) · **ACCOUNT** (Edit profile) · **LEGAL** (Auction Terms) · the
 * **About darzmarket.art app** card · **LEAVE THE ROOM** · the faint build stamp.
 *
 * The three notification switches are per-device preferences here exactly as
 * in the old app (`localStorage`, `DevicePreferences`). Not ported, flagged:
 * **Push to this device** (needs the VAPID public key the backend does not
 * publish yet), **Privacy & data** and **Terms & Conditions** (the owner's
 * legal copy is not exposed by the API — only the auction terms ship with the
 * app), **Get the app** (no service worker / install prompt in this build),
 * **Insights & Stories** (no editorial backend), the social pills other than
 * darzmarket.art (the owner's links live in `THEME_DEFAULT.socialLinks`).
 */
import { useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useSession } from '../../api/hooks';
import { Dropdown, Sheet } from '../../components';
import { themeController } from '../../design';
import { DARZ_AUC_TERMS } from '../auctions/terms';
import { devicePreferences } from './DevicePreferences';
import '../profile/profile.css'; // `.phead`
import './settings.css';

const IC = {
  bell: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  disp: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  ),
  acct: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  info: (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  legal: (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  ),
  globe: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20z" />
    </svg>
  ),
};

const CHEV = (
  <span className="st-chev" aria-hidden="true">
    ›
  </span>
);

/** THEME_DEFAULT.aboutText — owner-editable in the old app; the shipped default. */
const ABOUT =
  'darzmarket.art app brings selected Iranian artworks, auctions, and curated opportunities into one elegant collecting space, helping collectors discover, evaluate, and acquire with confidence.';

function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`st-toggle${on ? ' on' : ''}`}
      onClick={onChange}
    >
      <span className="st-knob" />
    </button>
  );
}

export function SettingsPage() {
  const { me } = useSession();
  const { auth } = useApi();
  const prefs = useSyncExternalStore(
    (cb) => devicePreferences.subscribe(cb),
    () => devicePreferences.prefs,
    () => devicePreferences.prefs,
  );
  const theme = useSyncExternalStore(
    (cb) => themeController.subscribe(cb),
    () => themeController.theme,
    () => themeController.theme,
  );
  const [legal, setLegal] = useState<'auction' | null>(null);
  const name = me?.display_name ?? me?.name ?? me?.email ?? 'Your profile';

  return (
    <div className="dz-page settings">
      <div className="phead">
        <div className="eyebrow">Preferences</div>
        <h1>Settings</h1>
      </div>

      <Link to="/profile/account" className="st-card st-profile">
        <span className="st-row">
          <span className="st-b">
            <span className="st-t">{name}</span>
            <span className="st-s">Collector · view &amp; edit profile</span>
          </span>
          {CHEV}
        </span>
      </Link>

      <div className="st-card">
        <div className="st-head">
          <span className="st-ic">{IC.bell}</span>
          <span>Notifications</span>
        </div>
        <div className="st-row">
          <span className="st-b">
            <span className="st-t">New arrivals</span>
            <span className="st-s">When fresh works are listed</span>
          </span>
          <Toggle
            on={prefs.newArrivals}
            onChange={() => devicePreferences.toggle('newArrivals')}
            label="New arrivals"
          />
        </div>
        <div className="st-row top">
          <span className="st-b">
            <span className="st-t">Auction reminders</span>
            <span className="st-s">Before a lot you follow closes</span>
          </span>
          <Toggle
            on={prefs.auctionReminders}
            onChange={() => devicePreferences.toggle('auctionReminders')}
            label="Auction reminders"
          />
        </div>
        <div className="st-row top">
          <span className="st-b">
            <span className="st-t">Offer &amp; request updates</span>
            <span className="st-s">Replies on your offers and requests</span>
          </span>
          <Toggle
            on={prefs.offerUpdates}
            onChange={() => devicePreferences.toggle('offerUpdates')}
            label="Offer and request updates"
          />
        </div>
      </div>

      <div className="st-card">
        <div className="st-head">
          <span className="st-ic">{IC.disp}</span>
          <span>Display</span>
        </div>
        <div className="st-row">
          <span className="st-b">
            <span className="st-t">Language</span>
            <span className="st-s">App language</span>
          </span>
          <Dropdown
            className="st-lang"
            label="App language"
            options={[{ value: 'en', label: 'English' }]}
            value={prefs.lang}
            onChange={(v) => devicePreferences.set('lang', v)}
          />
        </div>
        <div className="st-row top">
          <span className="st-b">
            <span className="st-t">Appearance</span>
            <span className="st-s">{theme.isDark() ? 'Black' : 'Paper'} on this device</span>
          </span>
          <Toggle
            on={theme.isDark()}
            onChange={() => themeController.toggle()}
            label="Black mode"
          />
        </div>
      </div>

      <div className="st-card">
        <div className="st-head">
          <span className="st-ic">{IC.acct}</span>
          <span>Account</span>
        </div>
        <Link to="/profile/account" className="st-row st-link">
          <span className="st-b">
            <span className="st-t">Edit profile</span>
            <span className="st-s">Name, contact and collector details</span>
          </span>
          {CHEV}
        </Link>
      </div>

      <div className="st-card">
        <div className="st-head">
          <span className="st-ic">{IC.legal}</span>
          <span>Legal</span>
        </div>
        <button type="button" className="st-row st-link" onClick={() => setLegal('auction')}>
          <span className="st-b">
            <span className="st-t">Auction Terms</span>
            <span className="st-s">How bidding works</span>
          </span>
          {CHEV}
        </button>
      </div>

      <div className="st-card st-about">
        <div className="st-about-h">
          <span className="st-ic">{IC.info}</span>
          <span>About darzmarket.art app</span>
        </div>
        <p className="st-about-p">{ABOUT}</p>
        <div className="st-social">
          <a href="https://darzmarket.art" target="_blank" rel="noopener" className="st-pill">
            <span className="st-pill-ic">{IC.globe}</span>
            darzmarket.art
          </a>
        </div>
      </div>

      <div className="st-leave">
        <button type="button" className="st-leave-btn" onClick={() => void auth.logout()}>
          Leave the Room
        </button>
      </div>
      <div className="st-build" id="appBuildStamp">
        v{__APP_VERSION__}
      </div>

      <Sheet open={legal === 'auction'} onClose={() => setLegal(null)} title="Auction Terms">
        <div className="st-legal">{DARZ_AUC_TERMS}</div>
      </Sheet>
    </div>
  );
}
