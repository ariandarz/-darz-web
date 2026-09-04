/**
 * Route table. The Phase 2 design-system showcase moves to `/_design`; the
 * catalogue is the real app now. Catalogue + detail require a session
 * (`RequireAuth`) because the API's default permission is `IsAuthenticated`.
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import App from './App';
import { LoginPage } from './features/auth/LoginPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { ArtworkDetailPage } from './features/catalogue/ArtworkDetailPage';
import { CataloguePage } from './features/catalogue/CataloguePage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <CataloguePage />
          </RequireAuth>
        }
      />
      <Route
        path="/artwork/:id"
        element={
          <RequireAuth>
            <ArtworkDetailPage />
          </RequireAuth>
        }
      />
      <Route path="/_design" element={<App />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
