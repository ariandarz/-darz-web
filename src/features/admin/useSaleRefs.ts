/**
 * useSaleRefs — resolves the bare uuids on sale rows (G-SALE-3: the
 * serializer nests nothing) into display shapes: artworks and collectors by
 * page-scoped parallel retrieves behind a session-long cache, team users by
 * one roster fetch when (and only when) the viewer is the owner — the
 * team-users list endpoint is owner-only.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApi, useSession } from '../../api/hooks';
import { asAdminRole } from './adminNav';
import type { SaleAdmin } from '../../api/types';

export interface SaleRefs {
  artwork: (id: string) => { title: string; artist: string } | null;
  collector: (id: string) => string | null;
  responsible: (id: string | null | undefined) => string | null;
}

export function useSaleRefs(rows: readonly SaleAdmin[]): SaleRefs {
  const { catalogAdmin, adminAccounts } = useApi();
  const { me } = useSession();
  const artCache = useRef(new Map<string, { title: string; artist: string }>());
  const colCache = useRef(new Map<string, string>());
  const [, setTick] = useState(0);
  const [team, setTeam] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let alive = true;
    const missingArt = [...new Set(rows.map((s) => s.artwork))].filter(
      (id) => !artCache.current.has(id),
    );
    const missingCol = [...new Set(rows.map((s) => s.collector))].filter(
      (id) => !colCache.current.has(id),
    );
    if (missingArt.length === 0 && missingCol.length === 0) return;
    void Promise.allSettled([
      ...missingArt.map(async (id) => {
        const a = await catalogAdmin.artwork(id);
        artCache.current.set(id, { title: a.title, artist: a.artist_name_raw || '' });
      }),
      ...missingCol.map(async (id) => {
        const c = await adminAccounts.collector(id);
        colCache.current.set(id, c.display_name);
      }),
    ]).then(() => alive && setTick((t) => t + 1));
    return () => {
      alive = false;
    };
  }, [rows, catalogAdmin, adminAccounts]);

  const isOwner = asAdminRole(me?.role) === 'owner';
  useEffect(() => {
    if (!isOwner) return;
    let alive = true;
    adminAccounts.teamUsers().then(
      (page) => alive && setTeam(new Map(page.results.map((t) => [t.id, t.name || t.email]))),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [isOwner, adminAccounts]);

  return useMemo<SaleRefs>(
    () => ({
      artwork: (id) => artCache.current.get(id) ?? null,
      collector: (id) => colCache.current.get(id) ?? null,
      responsible: (id) => {
        if (!id) return null;
        if (me && id === me.id) return 'you';
        return team.get(id) ?? null;
      },
    }),
    // the two caches are refs read at call time — the tick state above only
    // forces consumers to re-render once a resolution lands
    [team, me],
  );
}
