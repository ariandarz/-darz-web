/**
 * RequestProvider — one `RequestController` on context, plus the single
 * confirmation sheet every action shares (`app.html`'s `dzActConfirm`).
 * Mounted inside the authenticated layout: `POST /api/crm/requests/` needs a
 * collector session.
 */
import { useState, type ReactNode } from 'react';
import { useApi } from '../../api/hooks';
import { ConfirmSheet } from './ConfirmSheet';
import { RequestController } from './RequestController';
import { RequestContext } from './requestsContext';

export function RequestProvider({ children }: { children: ReactNode }) {
  const { crm } = useApi();
  const [controller] = useState(() => new RequestController(crm));

  return (
    <RequestContext.Provider value={controller}>
      {children}
      <ConfirmSheet />
    </RequestContext.Provider>
  );
}
