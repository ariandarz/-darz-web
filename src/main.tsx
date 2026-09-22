import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Before global.css: the @font-face declarations must exist before the first
// rule that asks for one. Self-hosted rather than fetched from Google — see
// the file's own header for why that matters for this app's collectors.
import './design/fonts.css';
import './design/global.css';
import { ApiProvider } from './api/ApiProvider';
import { themeController } from './design';
import { ActivityProvider } from './features/activity/ActivityProvider';
import { AppRoutes } from './routes.tsx';

// Resolve + apply the stored / OS theme before first paint (app.html does the
// same: the "Black" mode must not flash the paper theme on load).
themeController.start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApiProvider>
      {/* above the router: the first activity row is `login`, on /login */}
      <ActivityProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ActivityProvider>
    </ApiProvider>
  </StrictMode>,
);
