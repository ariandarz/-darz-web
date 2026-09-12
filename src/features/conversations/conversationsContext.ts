/** Context holding the app's one `ConversationsController` (same split as
 * `savedContext.ts`). */
import { createContext } from 'react';
import type { ConversationsController } from './ConversationsController';

export const ConversationsContext = createContext<ConversationsController | null>(null);
