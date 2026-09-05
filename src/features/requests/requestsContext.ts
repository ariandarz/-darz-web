/** Context holding the app's one `RequestController`. Own file so the provider
 * exports only a component and the hooks only hooks (same split as
 * `api/apiContext.ts` and `features/saved/savedContext.ts`). */
import { createContext } from 'react';
import type { RequestController } from './RequestController';

export const RequestContext = createContext<RequestController | null>(null);
