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
import { RequestProvider } from './features/requests/RequestProvider';
import { SavedItemsPage } from './features/saved/SavedItemsPage';
import { SavedProvider } from './features/saved/SavedProvider';

function CollectorLayout() {
  return (
    <RequireAuth>
      <SavedProvider>
        <RequestProvider>
          <Outlet />
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
