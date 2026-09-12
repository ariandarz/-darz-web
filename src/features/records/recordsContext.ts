import { createContext } from 'react';
import type { RecordsArchiveController } from './RecordsArchiveController';

export const RecordsArchiveContext = createContext<RecordsArchiveController | null>(null);
