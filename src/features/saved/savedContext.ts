/** The React context holding the app's one `SavedController`. Its own file so
 * `SavedProvider.tsx` exports only a component and `useSaved.ts` only hooks
 * (same split as `api/apiContext.ts`). */
import { createContext } from 'react';
import type { SavedController } from './SavedController';

export const SavedContext = createContext<SavedController | null>(null);
