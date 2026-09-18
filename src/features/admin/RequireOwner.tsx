/**
 * RequireOwner — the role half of the panel's gating, beside `RequireTeam`'s
 * principal half.
 *
 * It lives here rather than next to `RequireTeam` in `features/auth/` because
 * it is **not** a redirect guard: the old panel answers an owner-only page
 * reached by a non-owner with the page's own heading and a card, not by sending
 * them elsewhere (`accessView`, `darz-studio.html:33030`; `systemView`,
 * `:33116` — both identical, both verbatim below). So it renders panel chrome
 * and belongs with the panel.
 *
 * This is the second of the two defences the old panel runs, and both matter:
 * `adminNav.visibleGroups()` keeps the tab out of the navbar, and this keeps the
 * page itself shut for a typed URL or a stale bookmark. The backend is the
 * third — every route behind this is `IsOwner` server-side — so a bypass here
 * yields 403s, not data.
 */
import type { ReactNode } from 'react';
import { useSession } from '../../api/hooks';
import { asAdminRole } from './adminNav';
import './admin.css';

export function RequireOwner({ title, children }: { title: string; children: ReactNode }) {
  const { me } = useSession();
  if (asAdminRole(me?.role) === 'owner') return children;

  return (
    <div className="dz-page ad-page">
      <h1 className="ad-h">{title}</h1>
      {/* :33030 — the copy, verbatim */}
      <div className="ad-card ad-private">This area is private to the owner’s login only.</div>
    </div>
  );
}
