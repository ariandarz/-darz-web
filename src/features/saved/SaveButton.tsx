/**
 * SaveButton — the one save/unsave control, used in both places Phase 6 needs
 * it: overlaid on a catalogue `ArtworkCard` (`variant="icon"`) and as the
 * artwork detail's action (`variant="action"`).
 *
 * Takes the full `Artwork` (not just an id) since `docs/PHASE_6_API_GAPS.md`
 * G-P6-1: `artwork.is_saved` is the server's own answer, computed in the same
 * request that fetched the artwork. `SavedController.isSaved()` overlays this
 * tab's own writes on top of it, so a save/unsave here is reflected
 * immediately everywhere else the same artwork is rendered this session,
 * without a refetch — but the baseline truth always comes from the server.
 *
 * Duplicate-action guard: while this artwork's own call is in flight the
 * button is `disabled` + `aria-busy`, and `SavedController.toggle()` refuses a
 * second call for the same id anyway — so neither a double-tap nor a
 * keyboard-repeat can fire two writes.
 *
 * The icon variant is app.html's glass `.save` disc with its `heart()` glyph
 * (:3485), verified against the design package (COMPONENTS.md § Artwork card)
 * on 2026-09-11.
 */
import type { Artwork } from '../../api/types';
import { Button } from '../../components';
import { cx } from '../../lib/cx';
import './saved.css';
import { useSaved } from './useSaved';

export interface SaveButtonProps {
  artwork: Pick<Artwork, 'id' | 'title' | 'is_saved'>;
  variant?: 'icon' | 'action';
  className?: string;
}

export function SaveButton({ artwork, variant = 'icon', className }: SaveButtonProps) {
  const { pending, controller } = useSaved();
  const saved = controller.isSaved(artwork);
  const busy = pending.has(artwork.id);
  const what = artwork.title ? `“${artwork.title}”` : 'this work';
  const label = saved ? 'Saved' : 'Save';
  const description = saved ? `Remove ${what} from your saved works` : `Save ${what}`;

  // Guarded here too so the click never even reaches the controller twice.
  const onClick = () => {
    if (busy) return;
    void controller.toggle(artwork);
  };

  if (variant === 'action') {
    return (
      <Button
        variant="outline"
        block
        className={cx('dz-save-action', saved && 'on', className)}
        onClick={onClick}
        disabled={busy}
        aria-busy={busy || undefined}
        aria-pressed={saved}
        aria-label={description}
      >
        <Heart filled={saved} size={16} />
        <span>{busy ? (saved ? 'Removing…' : 'Saving…') : label}</span>
      </Button>
    );
  }

  return (
    <button
      type="button"
      className={cx('save', saved && 'on', className)}
      onClick={(e) => {
        // The card is a link; keep a save from navigating to the detail page.
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      disabled={busy}
      aria-busy={busy || undefined}
      aria-pressed={saved}
      aria-label={description}
      title={description}
    >
      <Heart filled={saved} size={15} glyph />
    </button>
  );
}

/** Outline when unsaved, filled when saved — the state is carried by the glyph
 * itself, not by colour alone. `glyph` renders app.html's `heart()` (:3485):
 * 15px, #9A9A9A stroke, #C0453E fill + stroke when saved. */
function Heart({ filled, size, glyph }: { filled: boolean; size: number; glyph?: boolean }) {
  if (glyph) {
    return (
      <svg
        className={cx('dz-heart', filled && 'on')}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={filled ? '#C0453E' : 'none'}
        stroke={filled ? '#C0453E' : '#9A9A9A'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 20.4l-1.35-1.23C5.9 14.86 3 12.24 3 9a4.5 4.5 0 0 1 8.06-2.76L12 7.4l.94-1.16A4.5 4.5 0 0 1 21 9c0 3.24-2.9 5.86-7.65 10.17L12 20.4z" />
    </svg>
  );
}
