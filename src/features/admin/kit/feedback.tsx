/**
 * The desk kit's answers to "did that work?" and "why did my save bounce?" —
 * **TD-4** and **TD-5** from `docs/ADMIN_V1_AUDIT.md` §9.
 *
 * The audit measured both as inconsistency rather than absence: a toast
 * appeared on 10 of ~50 desks and the rest confirmed a write only by the list
 * re-reading underneath, and 24 files carry a `version` while several editors
 * showed a 409 as a plain error, which reads as "your edit was wrong" when it
 * means "someone else got there first". Neither is a missing feature; both are
 * a missing shared piece, which is what this file is. (The hook and the
 * `isConflict` test live in `feedbackState.ts`, beside it.)
 *
 * ---
 *
 * **Success** ports the old panel's pair, which say different things and so are
 * both worth having (`darz-studio.html`):
 *
 *  - `toast(msg)` (`:7291`) — one line, ~1.8s, centred. Its copy convention is
 *    worth keeping too: a success ends in ` ✓` ("Draft saved on this device ✓",
 *    `:6542`) and a failure opens with "Could not …" ("Could not save the
 *    draft"). `useDeskToast` + `DeskToast` are that function with React's state
 *    in it.
 *  - `dzSavedFlash(btn)` (the v510 block, `:43743-43775`) — the Save button
 *    turns green and reads "✓ Saved" for 2s. The old file installed one
 *    delegated click listener over the whole panel so that *every* Save button
 *    got it for free; `DeskSave` is the equivalent bargain here, since a desk
 *    is assembled from the kit rather than from loose buttons.
 *
 * **Conflict** has no old-panel counterpart to port: the old admin is a
 * single-device localStorage app, so there is nothing for a second person to
 * have saved in the meantime. The banner below is this repo's own line, taken
 * verbatim from the six Projects desks that had already converged on it
 * independently — consolidating a repeated shape, not designing a new one.
 */
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { cx } from '../../../lib/cx';
import '../admin.css';

/* ---- Success: the toast ---------------------------------------------- */

/**
 * The panel's transient line — `.dz-toast`, a centred charcoal card with the
 * seam along its top edge. Rendered once per desk; `message` is `null` when
 * there is nothing to say, and the node stays mounted so it fades rather than
 * appearing and vanishing.
 *
 * Not the collector app's `<Toast>`: that is `.toast`, the bottom pill from
 * `app.html:1246`. Two surfaces, two shipped recipes.
 */
export function DeskToast({ message }: { message: string | null }) {
  return (
    <div className={cx('dz-toast', message && 'show')} role="status" aria-live="polite">
      {message}
    </div>
  );
}

/* ---- Success: the button flash --------------------------------------- */

/** The old flash held for 2000ms (`:43758`). */
const FLASH_MS = 2000;

/**
 * A Save button that confirms itself: on a click whose work resolves, it turns
 * Darz green and reads "✓ Saved" for two seconds, then goes back to its label.
 *
 * `onClick` may be async — the flash waits for it and is skipped if it throws,
 * because a button that says "✓ Saved" after a failed write is the one lie a
 * confirmation must never tell. The desk keeps its own error handling exactly
 * as it was (every one of them already sets a banner in its own `catch`); a
 * rejection reaching here only decides whether to flash, and is then let go,
 * since a click handler has nowhere to throw to. So: a desk whose save can
 * fail must still catch it — and then re-throw, or the button will congratulate
 * the person on a write that did not happen.
 *
 * The flashing width is the button's own, measured at click (the old code's
 * `btn.style.minWidth`, `:43753`), so the toolbar does not jump as the label
 * changes length.
 */
export function DeskSave({
  children = 'Save',
  savedLabel = 'Saved',
  onClick,
  className,
  disabled,
  busy,
}: {
  children?: ReactNode;
  /** The word after the ✓. The old default is "Saved" (`:43757`). */
  savedLabel?: string;
  onClick: () => void | Promise<unknown>;
  className?: string;
  disabled?: boolean;
  /** The desk's own in-flight flag, if it keeps one. */
  busy?: boolean;
}) {
  /** The pinned width while flashing; `null` when the button reads its label. */
  const [flashWidth, setFlashWidth] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const run = async (e: MouseEvent<HTMLButtonElement>) => {
    const width = e.currentTarget.offsetWidth;
    try {
      await onClick();
    } catch {
      return; // the desk has already said what went wrong; don't claim a save
    }
    setFlashWidth(width || 0);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlashWidth(null), FLASH_MS);
  };

  const saved = flashWidth !== null;
  return (
    <button
      type="button"
      className={cx(className, saved && 'dz-saved')}
      style={flashWidth ? { minWidth: flashWidth } : undefined}
      onClick={(e) => void run(e)}
      disabled={disabled || busy}
    >
      {saved ? `✓ ${savedLabel}` : children}
    </button>
  );
}

/* ---- Conflict -------------------------------------------------------- */

/**
 * What a 409 looks like on a desk: what happened, and the only move that helps.
 *
 * `noun` is the thing that was being saved, in the desk's own words — "partner",
 * "package", "entry" — so the sentence reads as the desk's, not the kit's.
 *
 * The Reload button is the point. A conflict is the one error where retrying
 * the same write is wrong (it would clobber the other person's), so the banner
 * offers re-reading instead of a retry, and never dismisses itself.
 *
 * `reloadClassName` exists for one real case rather than on principle: the
 * Projects desks are a separate ported surface with their own `dzp-*` controls
 * (Phase 11c), and they wrote this banner first. They keep their own button so
 * that sharing the sentence changes nothing on screen.
 */
export function ConflictBanner({
  noun,
  onReload,
  reloadClassName = 'ad-chip',
}: {
  noun: string;
  onReload: () => void;
  reloadClassName?: string;
}) {
  return (
    <p className="dz-state err" role="alert">
      {`Someone else saved this ${noun} in the meantime — reload to continue.`}{' '}
      <button type="button" className={reloadClassName} onClick={onReload}>
        Reload
      </button>
    </p>
  );
}
