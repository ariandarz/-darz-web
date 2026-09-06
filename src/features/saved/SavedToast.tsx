/**
 * SavedToast — the one confirmation/error surface for save & unsave, rendered
 * once by `SavedProvider` so a card, the detail page and the Saved page all
 * confirm the same way.
 *
 * Reuses the existing `Toast` component (`app.html`'s `.toast`) rather than a
 * bespoke banner. Copy is factual, not celebratory (VOICE_AND_COPY.md):
 * "Saved." / "Removed from your saved works."
 */
import { Toast } from '../../components';
import { useSaved } from './useSaved';

export function SavedToast() {
  const { lastAction, actionError, controller } = useSaved();

  // An error outranks a success: it is the thing the collector needs to know,
  // and it stays up longer because it asks them to try again.
  if (actionError) {
    return (
      <Toast
        key={`err-${actionError.at}`}
        open
        message={actionError.message}
        duration={4200}
        onClose={() => controller.clearActionError()}
      />
    );
  }

  return (
    <Toast
      key={lastAction ? `ok-${lastAction.at}` : 'idle'}
      open={Boolean(lastAction)}
      message={lastAction?.op === 'unsave' ? 'Removed from your saved works.' : 'Saved.'}
      onClose={() => controller.clearLastAction()}
    />
  );
}
