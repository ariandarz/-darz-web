import { createContext } from 'react';
import type { ActivityLogger } from './ActivityLogger';

export const ActivityContext = createContext<ActivityLogger | null>(null);
