import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design/global.css';
import { themeController } from './design';
import App from './App.tsx';

// Resolve + apply the stored / OS theme before first paint (app.html does the
// same: the "Black" mode must not flash the paper theme on load).
themeController.start();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
