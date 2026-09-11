/**
 * ViewInRoom — the "View in Room" overlay (SCREENS.md §14: "the work scaled on
 * a wall photo (Darz wall or the collector's own), zoom, reference height").
 * Ported from app.html's `#dzRoom` (the artwork-extras style block): a wall
 * over a floor, the work framed on the wall, a bench for scale and a caption.
 * The work is scaled from its dimension line against a 300 cm wall; without
 * dimensions it is shown at a neutral size and the caption says so.
 *
 * Not ported: the collector's own wall photo and zoom — those read from
 * `localStorage` in the old app and have no server model; flagged, not
 * silently dropped.
 */
import { useEffect } from 'react';
import type { Artwork } from '../../api/types';
import { parseDimensionsCm, primaryImage } from './format';

const WALL_CM = 300; // the Darz wall the mock-up is drawn against

export function ViewInRoom({
  artwork,
  open,
  onClose,
}: {
  artwork: Artwork;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const image = primaryImage(artwork);
  const dims = parseDimensionsCm(artwork.dimensions);
  // the frame is sized in vw against the 300 cm wall (the wall spans the screen)
  const wPct = dims ? Math.min(90, (dims.w / WALL_CM) * 100) : 34;
  const ratio = dims ? dims.h / dims.w : 1.25;

  return (
    <div
      id="dzRoom"
      className="show"
      role="dialog"
      aria-modal="true"
      aria-label="View in Room"
    >
      <div className="dz-room-wall" />
      <div className="dz-room-floor" />
      <div
        className="dz-room-frame"
        style={{ width: `${wPct}vw`, aspectRatio: `1 / ${ratio}` }}
      >
        <div
          className="dz-room-art"
          style={image ? { backgroundImage: `url(${image})` } : undefined}
        />
      </div>
      <div className="dz-room-bench" />
      <div className="dz-room-cap">
        {dims
          ? `${artwork.dimensions} on a ${WALL_CM / 100} m wall.`
          : 'Shown at a reference size — this work has no dimensions on file.'}
      </div>
      <button type="button" className="dz-room-x" onClick={onClose} aria-label="Close">
        ×
      </button>
    </div>
  );
}
