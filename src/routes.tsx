/**
 * Route table. The Phase 2 design-system showcase lives at `/_design`; the
 * catalogue is the real app.
 *
 * Every collector route sits behind one layout route: `RequireAuth` (the API's
 * default permission is `IsAuthenticated`) wrapping the session-scoped
 * providers — `SavedProvider` (Phase 6), `RequestProvider` (Phase 5),
 * `ConversationsProvider` (v0.1: inquiries + chat threads) and, only when the
 * feature is on, `AuctionNotificationsProvider` (Phase 8) — and the `AppShell`
 * that renders the one nav bar. The providers are inside the guard because
 * their endpoints need a session to answer at all.
 *
 * v0.1 visibility (`features/shell/features.ts`): a hidden feature's routes
 * stay registered but redirect to Market, so a deep link, a bookmark or a
 * typed URL cannot reach it — the old app's `render()` guard (app.html:5673).
 */
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import App from './App';
import { useSession } from './api/hooks';
import { LoginPage } from './features/auth/LoginPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { RequireTeam } from './features/auth/RequireTeam';
import { TeamLoginPage } from './features/auth/TeamLoginPage';
import { ArtistDetailPage } from './features/catalogue/ArtistDetailPage';
import { ArtistListPage } from './features/catalogue/ArtistListPage';
import { ArtworkCacheProvider } from './features/catalogue/ArtworkCacheProvider';
import { ArtworkDetailPage } from './features/catalogue/ArtworkDetailPage';
import { CataloguePage } from './features/catalogue/CataloguePage';
import { AdminRequestsPage } from './features/admin/AdminRequestsPage';
import { AdminShell } from './features/admin/AdminShell';
import { asAdminRole, firstVisiblePath } from './features/admin/adminNav';
import { AuctionEventPage } from './features/auctions/AuctionEventPage';
import { AuctionListPage } from './features/auctions/AuctionListPage';
import { AuctionNotificationsPage } from './features/auctions/AuctionNotificationsPage';
import { AuctionNotificationsProvider } from './features/auctions/AuctionNotificationsProvider';
import { LotDetailPage } from './features/auctions/LotDetailPage';
import { RecordDetailPage } from './features/auctions/RecordDetailPage';
import { ChatPage } from './features/chat/ChatPage';
import { ThreadPage } from './features/chat/ThreadPage';
import { ConversationsProvider } from './features/conversations/ConversationsProvider';
import { ProfilePage } from './features/profile/ProfilePage';
import { ArtistRecordsPage } from './features/records/ArtistRecordsPage';
import { RecordsArchiveProvider } from './features/records/RecordsArchiveProvider';
import { RecordsPage } from './features/records/RecordsPage';
import { RequestProvider } from './features/requests/RequestProvider';
import { SavedItemsPage } from './features/saved/SavedItemsPage';
import { SavedProvider } from './features/saved/SavedProvider';
import { SettingsPage } from './features/settings/SettingsPage';
import { AppShell } from './features/shell/AppShell';
import { features, isHiddenPath, type FeatureFlags } from './features/shell/features';

function CollectorLayout() {
  const location = useLocation();
  if (isHiddenPath(location.pathname)) return <Navigate to="/" replace />;

  const shell = (
    <AppShell>
      <Outlet />
    </AppShell>
  );
  return (
    <RequireAuth>
      <SavedProvider>
        <RequestProvider>
          <ConversationsProvider>
            <ArtworkCacheProvider>
              <RecordsArchiveProvider>
                {features.auctions ? (
                  <AuctionNotificationsProvider>{shell}</AuctionNotificationsProvider>
                ) : (
                  shell
                )}
              </RecordsArchiveProvider>
            </ArtworkCacheProvider>
          </ConversationsProvider>
        </RequestProvider>
      </SavedProvider>
    </RequireAuth>
  );
}

/**
 * `/admin` itself has no desk — it clamps to the first page this role can
 * actually open, the way the old panel does when the current page is not in the
 * allowed set (`darz-studio.html:11815`:
 * `if(!set[page])page=set.dashboard?'dashboard':'database';`). Market is the
 * fallback for the case that cannot arise today: a team session whose role
 * unlocks nothing at all.
 */
function AdminIndex() {
  const { me } = useSession();
  return <Navigate to={firstVisiblePath(asAdminRole(me?.role)) ?? '/'} replace />;
}

/** Renders `children` only when the feature is on; otherwise Market. */
function Gate({ flag, children }: { flag: keyof FeatureFlags; children: React.ReactElement }) {
  return features[flag] ? children : <Navigate to="/" replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<CollectorLayout />}>
        <Route path="/" element={<CataloguePage />} />
        <Route path="/artwork/:id" element={<ArtworkDetailPage />} />
        <Route path="/artists" element={<ArtistListPage />} />
        <Route path="/artists/:id" element={<ArtistDetailPage />} />
        <Route path="/saved" element={<SavedItemsPage />} />

        {/* Records — external auction-house results per artist (DEC-13). */}
        <Route
          path="/records"
          element={
            <Gate flag="records">
              <RecordsPage />
            </Gate>
          }
        />
        <Route
          path="/records/artist/:id"
          element={
            <Gate flag="records">
              <ArtistRecordsPage />
            </Gate>
          }
        />
        <Route
          path="/records/:id"
          element={
            <Gate flag="records">
              <RecordDetailPage />
            </Gate>
          }
        />

        {/* Chat — collector ↔ Darz Admin. */}
        <Route
          path="/chat"
          element={
            <Gate flag="chat">
              <ChatPage />
            </Gate>
          }
        />
        <Route
          path="/chat/:id"
          element={
            <Gate flag="chat">
              <ThreadPage />
            </Gate>
          }
        />

        <Route
          path="/profile"
          element={
            <Gate flag="profile">
              <ProfilePage />
            </Gate>
          }
        />
        <Route
          path="/settings"
          element={
            <Gate flag="settings">
              <SettingsPage />
            </Gate>
          }
        />

        {/* Auctions (Phase 8) — preserved, hidden in v0.1. */}
        <Route
          path="/auctions"
          element={
            <Gate flag="auctions">
              <AuctionListPage />
            </Gate>
          }
        />
        <Route
          path="/auctions/notifications"
          element={
            <Gate flag="auctions">
              <AuctionNotificationsPage />
            </Gate>
          }
        />
        <Route
          path="/auctions/:id"
          element={
            <Gate flag="auctions">
              <AuctionEventPage />
            </Gate>
          }
        />
        <Route
          path="/auctions/lots/:lotId"
          element={
            <Gate flag="auctions">
              <LotDetailPage />
            </Gate>
          }
        />
      </Route>

      {/* Admin desk — its own world. Not inside `CollectorLayout`: the desk
          needs no collector provider (it reads `crm`/`options` only) and must
          not wear the collector nav. `RequireTeam` is the principal-aware guard
          the old TODO here asked for — `RequireAuth` proves only that *a*
          session exists, and a collector token just collects 403s from
          `/api/crm/admin/...`.

          The desk's own tabs live in `features/admin/adminNav.ts`, ported from
          the old panel's `ADGROUPS`; `AdminShell` renders them. A route added
          below must be given a `path` in that table too, or the navbar will not
          know it exists. */}
      <Route
        path="/admin/login"
        element={
          /* Gated too, so the whole `/admin` prefix obeys FEATURE_ROUTES: with
             `adminDesk` off there must be no team gate to find either. */
          <Gate flag="adminDesk">
            <TeamLoginPage />
          </Gate>
        }
      />
      <Route
        element={
          /* One gate for the whole prefix rather than one per desk — the
             children are all `/admin/...`, so `FEATURE_ROUTES`' own
             `['adminDesk', '/admin']` entry is the rule being enforced. */
          <Gate flag="adminDesk">
            <RequireTeam>
              <AdminShell />
            </RequireTeam>
          </Gate>
        }
      >
        <Route path="/admin" element={<AdminIndex />} />
        <Route path="/admin/requests" element={<AdminRequestsPage />} />
        {/* An unknown `/admin/...` clamps to the desk, not to the collector
            Market the global catch-all would send it to: a team session has no
            business being dropped into the catalogue, and clamping is what the
            old panel does with a page it cannot open (:11815). */}
        <Route path="/admin/*" element={<AdminIndex />} />
      </Route>
      <Route path="/_design" element={<App />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
