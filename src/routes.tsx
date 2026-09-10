/**
 * Route table. The Phase 2 design-system showcase moves to `/_design`; the
 * catalogue is the real app now.
 *
 * Every collector route sits behind one layout route: `RequireAuth` (the API's
 * default permission is `IsAuthenticated`) wrapping `SavedProvider`, so the
 * saved set is read once per session and every screen — catalogue card,
 * artwork detail, the Saved page — reads the same server-derived state
 * (Phase 6). The provider is inside the guard because `/api/crm/saved/`
 * needs a session to answer at all.
 */
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import App from './App';
import { LoginPage } from './features/auth/LoginPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { ArtistDetailPage } from './features/catalogue/ArtistDetailPage';
import { ArtistListPage } from './features/catalogue/ArtistListPage';
import { ArtworkDetailPage } from './features/catalogue/ArtworkDetailPage';
import { CataloguePage } from './features/catalogue/CataloguePage';
import { AdminRequestsPage } from './features/admin/AdminRequestsPage';
import { AuctionEventPage } from './features/auctions/AuctionEventPage';
import { AuctionListPage } from './features/auctions/AuctionListPage';
import { AuctionNotificationsPage } from './features/auctions/AuctionNotificationsPage';
import { AuctionNotificationsProvider } from './features/auctions/AuctionNotificationsProvider';
import { LotDetailPage } from './features/auctions/LotDetailPage';
import { RecordDetailPage } from './features/auctions/RecordDetailPage';
import { RecordsPage } from './features/auctions/RecordsPage';
import { RequestProvider } from './features/requests/RequestProvider';
import { SavedItemsPage } from './features/saved/SavedItemsPage';
import { SavedProvider } from './features/saved/SavedProvider';

function CollectorLayout() {
  return (
    <RequireAuth>
      <SavedProvider>
        <RequestProvider>
          <AuctionNotificationsProvider>
            <Outlet />
          </AuctionNotificationsProvider>
        </RequestProvider>
      </SavedProvider>
    </RequireAuth>
  );
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
        <Route path="/auctions" element={<AuctionListPage />} />
        <Route path="/auctions/notifications" element={<AuctionNotificationsPage />} />
        <Route path="/auctions/:id" element={<AuctionEventPage />} />
        <Route path="/auctions/lots/:lotId" element={<LotDetailPage />} />
        {/* External auction-house results — the old app's "Records" tab, now a
            plain route (the `showRecordsTab` feature flag is gone). */}
        <Route path="/records" element={<RecordsPage />} />
        <Route path="/records/:id" element={<RecordDetailPage />} />
        {/* Admin desk. `RequireAuth` only proves a session exists — the API's
            own admin permissions are the real gate, and a collector token gets
            403s here. A principal-aware guard is Phase 7 proper. */}
        <Route path="/admin/requests" element={<AdminRequestsPage />} />
      </Route>
      <Route path="/_design" element={<App />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
