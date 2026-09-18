/**
 * How many curated works the collector has been granted — the number on the
 * "Curated for You" chip, and what decides whether the chip exists at all.
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

export function useCuratedCount(): number | null {
  const { catalog } = useApi();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    // per_page=1 — only the count is wanted, not the works
    catalog.artworkSelections({ per_page: 1 }).then(
      (page) => alive && setCount(page.pagination?.total_count ?? 0),
      () => alive && setCount(0),
    );
    return () => {
      alive = false;
    };
  }, [catalog]);

  return count;
}
