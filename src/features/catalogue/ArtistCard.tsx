/**
 * ArtistCard — one Artists-list tile. Faithful port of app.html's
 * `.dza-acard2` (image-or-initials + name + meta). The collector artist
 * serializer carries no image, so every card uses the initials fallback
 * (`.dza-amono2`) — that's the old app's own designed fallback, not a gap.
 */
import { Link } from 'react-router-dom';
import type { Artist } from '../../api/types';

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function ArtistCard({ artist }: { artist: Artist }) {
  const meta = [artist.nationality, artist.birth_year ? `b. ${artist.birth_year}` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <Link to={`/artists/${artist.id}`} className="dza-acard2">
      <div className="dza-aimg2">
        <span className="dza-amono2">{initials(artist.display_name)}</span>
      </div>
      <div className="dza-ab2">
        <div className="dza-aname2">{artist.display_name}</div>
        {meta && <div className="dza-ameta2">{meta}</div>}
      </div>
    </Link>
  );
}
