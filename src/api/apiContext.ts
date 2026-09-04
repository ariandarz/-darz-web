/** The React context holding the app's `DarzApi`. Its own file so both
 * `ApiProvider.tsx` (component only) and `hooks.ts` keep clean exports. */
import { createContext } from 'react';
import type { DarzApi } from './index';

export const ApiContext = createContext<DarzApi | null>(null);
