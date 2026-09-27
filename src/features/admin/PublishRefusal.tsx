/**
 * PublishRefusal — the old desk's refusal when a work is not ready for the
 * Market App (`togglePub`, `darz-studio.html:41959-41962`): a `dzConfirm`
 * naming exactly what is missing, with "Complete it now" (opens the editor)
 * and "Not now". Here the list is the publish gate's `details.missing`
 * (G-CAT-8, C-10), worded by `missingEssentials`. Shared by the Database row
 * toggle and the editor's toggle, so the two refuse in one voice.
 */
import { ConfirmDialog } from './kit';
import { publishRefusalLines } from './artworkQuery';

export function PublishRefusal({
  items,
  onComplete,
  onCancel,
}: {
  items: readonly string[];
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [head, list, tail] = publishRefusalLines(items);
  return (
    <ConfirmDialog
      message={
        <>
          {head}
          <br />
          <br />
          <span className="ad-refusal-list">{list}</span>
          <br />
          <br />
          {tail}
        </>
      }
      okLabel="Complete it now"
      cancelLabel="Not now"
      onConfirm={onComplete}
      onCancel={onCancel}
    />
  );
}
