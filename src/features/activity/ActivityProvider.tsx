/**
 * ActivityProvider — one `ActivityLogger` for the app.
 *
 * Mounted ABOVE the router (`main.tsx`), not inside the collector layout,
 * because the first event is `login` and that happens on `/login`, outside
 * the authenticated tree. The logger is reset when the session ends or a
 * different collector signs into the same tab, so one collector's
 * once-per-session memory never suppresses another's rows.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useApi, useSession } from '../../api/hooks';
import { ActivityLogger } from './ActivityLogger';
import { ActivityContext } from './activityContext';

export function ActivityProvider({ children }: { children: ReactNode }) {
  const { crm } = useApi();
  const { isAuthenticated, me } = useSession();
  const [logger] = useState(() => new ActivityLogger(crm));

  const identity = isAuthenticated ? (me?.id ?? 'pending') : null;
  useEffect(() => {
    logger.reset();
  }, [logger, identity]);

  return <ActivityContext.Provider value={logger}>{children}</ActivityContext.Provider>;
}
