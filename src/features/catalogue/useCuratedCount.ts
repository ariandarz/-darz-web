/**
 * How many curated works the collector has been granted — the number on the
 * "Curated for You" chip, and what decides whether the chip exists at all —
 * plus the selection's name for the chip's label (G-P24-1: each row of
 * `/catalog/artworks/selections/` carries `selection_name`, the name of the
 * named selection that granted it, or `null`).
 *
 * It is a separate one-shot read rather than something the catalogue list
 * yields, because the chip must show its count **while it is off** and the
 * grid is showing the public catalogue. The old app had the whole `club_items`
 * set in memory and just counted it (`curatedIds().length`, app.html:8585);
 * here it costs one request for `pagination.total_count`.
 *
 * Same shape as `useOptions()`: fetch once, `null` until it answers, and a
 * failure resolves to `0` rather than throwing — a collector who cannot read
 * their selections should see the catalogue without a chip, not an error. The
 * endpoint 403s for a team principal, which lands in exactly that path.
 */
import { useEffect, useState } from 'react';
import { useApi } from '../../api/hooks';
import { asArray } from '../../api/shapes';
import type { ArtworkSelection } from '../../api/types';

export interface Curated {
  count: number;
  /** `selection_name` of the newest grant, `null` when it has none. */
  name: string | null;
}

export function useCuratedCount(): Curated | null {
  const { catalog } = useApi();
  const [count, setCount] = useState<Curated | null>(null);

  useEffect(() => {
    let alive = true;
    // per_page=1 — the count, and the first row for its selection's name.
    // The old label reads the FIRST selection's name (`s[0].name`, app.html
    // :3458); the first row of the list is the nearest thing this API has.
    catalog.artworkSelections({ per_page: 1 }).then(
      (page) => {
        if (!alive) return;
        const first = asArray<ArtworkSelection>(page?.results)[0];
        const name =
          typeof first?.selection_name === 'string' ? first.selection_name.trim() : '';
        setCount({ count: page?.pagination?.total_count ?? 0, name: name || null });
      },
      () => alive && setCount({ count: 0, name: null }),
    );
    return () => {
      alive = false;
    };
  }, [catalog]);

  return count;
}
