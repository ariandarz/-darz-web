/** The one `ActivityLogger` (see `ActivityProvider`). */
import { useContext } from 'react';
import { ActivityContext } from './activityContext';
import type { ActivityLogger } from './ActivityLogger';

export function useActivity(): ActivityLogger {
  const logger = useContext(ActivityContext);
  if (!logger) throw new Error('useActivity must be used within <ActivityProvider>.');
  return logger;
}
