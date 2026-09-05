/**
 * ConfirmSheet — `app.html`'s `dzActConfirm()` (:10181): a centred sheet with
 * the chroma seam, the heading, the "Artist — Title" line, the message and one
 * "Done" button. Rendered once by `RequestProvider`, so every action confirms
 * the same way wherever it was fired from.
 */
import { Button, Sheet } from '../../components';
import './requests.css';
import { useRequests } from './useRequests';

export function ConfirmSheet() {
  const { confirmation, controller } = useRequests();
  const done = () => controller.dismissConfirmation();

  return (
    // `title` is deliberately not passed: `Sheet` would render its own <h3>,
    // and the confirmation's heading belongs inside `.dz-cf` (app.html:10183).
    // `aria-label` lands on the dialog via the rest props instead.
    <Sheet open={Boolean(confirmation)} onClose={done} aria-label={confirmation?.title}>
      {confirmation && (
        <div className="dz-cf">
          <div className="dz-cf-seam" />
          <h3>{confirmation.title}</h3>
          {confirmation.work && <div className="dz-cf-art">{confirmation.work}</div>}
          <p>{confirmation.message}</p>
          <Button variant="primary" block onClick={done}>
            Done
          </Button>
        </div>
      )}
    </Sheet>
  );
}
