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
import { LoginPage } from './features/auth/LoginPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { ArtistDetailPage } from './features/catalogue/ArtistDetailPage';
import { ArtistListPage } from './features/catalogue/ArtistListPage';
import { ArtworkCacheProvider } from './features/catalogue/ArtworkCacheProvider';
import { ArtworkDetailPage } from './features/catalogue/ArtworkDetailPage';
import { CataloguePage } from './features/catalogue/CataloguePage';
import { AdminRequestsPage } from './features/admin/AdminRequestsPage';
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

        {/* Admin desk. `RequireAuth` only proves a session exists — the API's
            own admin permissions are the real gate, and a collector token gets
            403s here. A principal-aware guard is Phase 7 proper. */}
        <Route
          path="/admin/requests"
          element={
            <Gate flag="adminDesk">
              <AdminRequestsPage />
            </Gate>
          }
        />
      </Route>
      <Route path="/_design" element={<App />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
