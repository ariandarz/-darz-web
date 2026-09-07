/**
 * SaveButton — the one save/unsave control, used in both places Phase 6 needs
 * it: overlaid on a catalogue `ArtworkCard` (`variant="icon"`) and as the
 * artwork detail's action (`variant="action"`).
 *
 * All state comes from `SavedController` (server-derived), so a card, the
 * detail page and the Saved page can never show different answers for the same
 * work, and a refresh re-reads the truth instead of trusting the browser.
 *
 * Duplicate-action guard: while this artwork's own call is in flight the
 * button is `disabled` + `aria-busy`, and `SavedController.toggle()` refuses a
 * second call for the same id anyway — so neither a double-tap nor a
 * keyboard-repeat can fire two writes.
 *
 * Copy: "Save" / "Saved" — the label the shipped app uses for this control
 * (ported into the Phase 2 showcase as `<Button variant="outline">Save</Button>`,
 * `src/App.tsx`). The heart glyph could NOT be re-checked against
 * `../DarzStudio/app.html` in this session (that repo isn't reachable here) —
 * flagged to the owner rather than presented as verified.
 */
import { Button } from '../../components';
import { cx } from '../../lib/cx';
import './saved.css';
import { useSaved } from './useSaved';

export interface SaveButtonProps {
  artworkId: string;
  /** the work's title — used to make the control's accessible name specific */
  title?: string;
  variant?: 'icon' | 'action';
  className?: string;
}

export function SaveButton({
  artworkId,
  title,
  variant = 'icon',
  className,
}: SaveButtonProps) {
  const { ids, pending, controller } = useSaved();
  const saved = ids.has(artworkId);
  const busy = pending.has(artworkId);
  const what = title ? `“${title}”` : 'this work';
  const label = saved ? 'Saved' : 'Save';
  const description = saved ? `Remove ${what} from your saved works` : `Save ${what}`;

  // Guarded here too so the click never even reaches the controller twice.
  const onClick = () => {
    if (busy) return;
    void controller.toggle(artworkId);
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
      className={cx('dz-save', saved && 'on', className)}
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
      <Heart filled={saved} size={17} />
    </button>
  );
}

/** Outline when unsaved, filled when saved — the state is carried by the glyph
 * itself, not by colour alone. */
function Heart({ filled, size }: { filled: boolean; size: number }) {
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
