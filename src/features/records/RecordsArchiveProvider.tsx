/** One archive per session; loaded on first use by a Records page, reset on logout. */
import { useEffect, useState, type ReactNode } from 'react';
import { useApi, useSession } from '../../api/hooks';
import { RecordsArchiveController } from './RecordsArchiveController';
import { RecordsArchiveContext } from './recordsContext';

export function RecordsArchiveProvider({ children }: { children: ReactNode }) {
  const { auctions } = useApi();
  const { isAuthenticated } = useSession();
  const [controller] = useState(() => new RecordsArchiveController(auctions));
  useEffect(() => {
    if (!isAuthenticated) controller.reset();
  }, [controller, isAuthenticated]);
  return (
    <RecordsArchiveContext.Provider value={controller}>
      {children}
    </RecordsArchiveContext.Provider>
  );
}
