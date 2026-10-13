/**
 * ArtistCard — one Artists-list tile. Faithful port of app.html's
 * `.dza-acard2` (image-or-initials + name + meta + the "Top price" row,
 * `app.html:5328-5334`). The collector artist serializer carries no image, so
 * every card uses the initials fallback (`.dza-amono2`) — that's the old
 * app's own designed fallback, not a gap.
 *
 * The meta line keeps nationality · birth year and adds the old line's
 * record count ("12 records", `:5329`) now that the row carries
 * `records_count` (G9, 2026-10-01). The old line's other two counts —
 * "N market" and "N lots" — have no field on this serializer, so they are
 * not shown.
 *
 * **Top price** (`:5330`, `.dza-atop2`) is the row's `top_record_price`: the
 * highest SOLD auction result, a raw maximum over every currency the
 * artist's records carry (the backend converts nothing). So the row prints
 * the magnitude with no currency — the old `dzMoneyCur` also printed no
 * code when it had none — rather than a code that could be the wrong one.
 * Two deliberate differences from the old figure, both the backend's
 * definition: it reads sold results only (the old directory also counted
 * asking prices and unsold rows, `:5314-5315`), and the old "Latest"
 * fallback (`:5331`) is not ported — it could never render.
 */
import { Link } from 'react-router-dom';
import type { Artist } from '../../api/types';
import { formatMoney, recordsLine } from './format';

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function ArtistCard({ artist }: { artist: Artist }) {
  const meta = [
    artist.nationality,
    artist.birth_year ? `b. ${artist.birth_year}` : '',
    recordsLine(artist.records_count),
  ]
    .filter(Boolean)
    .join(' · ');
  const top = artist.top_record_price ? formatMoney(artist.top_record_price) : '';

  return (
    <Link to={`/artists/${artist.id}`} className="dza-acard2">
      <div className="dza-aimg2">
        <span className="dza-amono2">{initials(artist.display_name)}</span>
      </div>
      <div className="dza-ab2">
        <div className="dza-aname2">{artist.display_name}</div>
        {meta && <div className="dza-ameta2">{meta}</div>}
        {top && (
          <div className="dza-atop2">
            <span className="k">Top price</span>
            <span className="val">{top}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
