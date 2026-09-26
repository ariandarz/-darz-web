/**
 * useSaleRefs — display shapes for the refs on sale rows. Since G-SALE-3 the
 * row nests `artwork {id,title}`, `collector {id,display_name}` and
 * `responsible {id,name}`, so title, collector and responsible read straight
 * off the row — no per-row retrieves (that N+1 was the pre-G-SALE-3 path, and
 * against the nested shape it called `artwork(<object>)`, so nothing resolved).
 *
 * The one thing the nested artwork lacks is the artist line the desk shows
 * under the title. That alone is still resolved by a page-scoped retrieve per
 * distinct work behind a session-long cache; the title never waits on it.
 * (Backend candidate: `artist_name` on `_SaleArtworkBrief` would remove it.)
 *
 * `lot` is still a bare uuid on the row. An auction sale links to its lot, and
 * the admin has no lot page — a lot lives on its auction's page — so the lot
 * is resolved the same way (one cached `GET …/admin/lots/{id}/` per distinct
 * lot) for its `auction` and `lot_number`. Only auction sales carry one.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApi, useSession } from '../../api/hooks';
import type { SaleAdmin } from '../../api/types';

/** A resolved lot: where it lives, and the number the desk prints. */
export interface SaleLotRef {
  auction: string;
  number: number;
}

export interface SaleRefs {
  artwork: (ref: SaleAdmin['artwork']) => { title: string; artist: string };
  /** `null` while unresolved, when the sale has no lot, or if the read failed. */
  lot: (id: SaleAdmin['lot']) => SaleLotRef | null;
  collector: (ref: SaleAdmin['collector']) => string;
  responsible: (ref: SaleAdmin['responsible'] | undefined) => string | null;
}

export function useSaleRefs(rows: readonly SaleAdmin[]): SaleRefs {
  const { catalogAdmin, auctionsAdmin } = useApi();
  const { me } = useSession();
  const artistCache = useRef(new Map<string, string>());
  const lotCache = useRef(new Map<string, SaleLotRef>());
  const [, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const missing = [...new Set(rows.map((s) => s.artwork.id))].filter(
      (id) => !artistCache.current.has(id),
    );
    if (missing.length === 0) return;
    void Promise.allSettled(
      missing.map(async (id) => {
        const a = await catalogAdmin.artwork(id);
        artistCache.current.set(id, a.artist_name || a.artist_name_raw || '');
      }),
    ).then(() => alive && setTick((t) => t + 1));
    return () => {
      alive = false;
    };
  }, [rows, catalogAdmin]);

  useEffect(() => {
    let alive = true;
    const missing = [
      ...new Set(rows.map((s) => s.lot).filter((id): id is string => !!id)),
    ].filter((id) => !lotCache.current.has(id));
    if (missing.length === 0) return;
    void Promise.allSettled(
      missing.map(async (id) => {
        const l = await auctionsAdmin.lot(id);
        if (l?.auction) lotCache.current.set(id, { auction: l.auction, number: l.lot_number });
      }),
    ).then(() => alive && setTick((t) => t + 1));
    return () => {
      alive = false;
    };
  }, [rows, auctionsAdmin]);

  return useMemo<SaleRefs>(
    () => ({
      artwork: (ref) => ({ title: ref.title, artist: artistCache.current.get(ref.id) ?? '' }),
      lot: (id) => (id ? (lotCache.current.get(id) ?? null) : null),
      collector: (ref) => ref.display_name,
      responsible: (ref) => {
        if (!ref) return null;
        if (me && ref.id === me.id) return 'you';
        return ref.name || null;
      },
    }),
    // the artist and lot caches are refs read at call time — the tick state above only
    // forces consumers to re-render once a resolution lands
    [me],
  );
}
