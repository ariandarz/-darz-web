/**
 * `ApiProvider` — puts a single `DarzApi` on React context.
 *
 * The hooks that read it (`useApi`, `useSession`) live in `./hooks` so this
 * file only exports a component (keeps fast-refresh happy).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiContext } from './apiContext';
import { api as defaultApi, DarzApi } from './index';
import { applyRuntimeFeatures } from '../features/shell/features';
import { applyOwnerSettings } from '../features/shell/ownerSettings';

export function ApiProvider({
  children,
  api = defaultApi,
  /** run `session.resume()` on mount (re-establish a session from the stored
   * refresh token). Set false in tests / storybook. */
  resume = true,
}: {
  children: ReactNode;
  api?: DarzApi;
  resume?: boolean;
}) {
  const [resuming, setResuming] = useState(resume);

  useEffect(() => {
    if (!resume) return;
    let cancelled = false;
    // The theme rides alongside the session resume: the owner's runtime
    // switches (`theme.features`) must be in place before the first paint, or
    // the nav/routes would flash the build-time set and then reshuffle. Both
    // are awaited together; a failed theme fetch applies nothing and the
    // build-time flags stand (docs/ADMIN_ARCHITECTURE.md §4).
    const theme = api.theme
      .publicTheme()
      .then((t) => {
        const theme = t.theme as Record<string, unknown> | null;
        applyRuntimeFeatures(theme?.features);
        // The non-feature half of the same object — see `ownerSettings.ts`.
        applyOwnerSettings(theme);
      })
      .catch(() => {});
    Promise.allSettled([api.session.resume(), theme]).then(() => {
      if (!cancelled) setResuming(false);
    });
    return () => {
      cancelled = true;
    };
  }, [api, resume]);

  const value = useMemo(() => api, [api]);
  // Block first paint only while we're checking a stored token, so the app
  // never flashes "logged out" before a valid session resumes.
  if (resuming) return null;
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>;
}
