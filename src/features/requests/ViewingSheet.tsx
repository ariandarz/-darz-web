/**
 * ViewingSheet — "Request viewing".
 *
 * The old app filed a viewing straight from the `.act-box` with no form
 * (`DZ.act(id,'visit')`, app.html:10462) because its backend took nothing but
 * the intent. The new backend's `ViewingDetailSerializer`
 * (apps/crm/serializers.py:29-31) REQUIRES `preferred_time` and `mode`
 * (`in_person` | `virtual`), so this sheet collects the two — owner decision
 * D1 (2026-09-17, docs/PHASE_5_PLAN.md) — in the offer-sheet chrome
 * (`.dz-offerwrap`, app.html:11074) the design package's SCREENS.md §14 lists
 * for "24h hold · Request viewing: short confirmation forms". The confirmation
 * afterwards is the old copy unchanged ("Viewing request received…").
 *
 * New copy in this file, not in app.html (flagged, D1): the "Preferred time"
 * field label, the hint line, and the empty-field message. The two mode
 * labels come from `GET /api/options/` (`crm.viewing_mode`, G-P5-10).
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useOptions } from '../../api/hooks';
import type { Artwork, ViewingMode } from '../../api/types';
import { Segment, Sheet } from '../../components';
import { RequestController, workLine } from './RequestController';
import './requests.css';
import { useRequests } from './useRequests';
import { viewingModeChoices } from './viewingMode';
import { toLocalInputValue } from './viewingTime';

export function ViewingSheet({
  artwork,
  open,
  onClose,
}: {
  artwork: Artwork;
  open: boolean;
  onClose: () => void;
}) {
  const { pending, error, controller } = useRequests();
  const modes = viewingModeChoices(useOptions());
  const [when, setWhen] = useState('');
  const [mode, setMode] = useState<ViewingMode>('in_person');
  const [min, setMin] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = pending.has(RequestController.actKey(artwork.id, 'visit'));

  // app.html:11084 — the field takes focus a beat after the sheet opens.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const at = when ? new Date(when) : null;
    if (!at || Number.isNaN(at.getTime())) {
      setLocalError('Please choose a preferred time.');
      inputRef.current?.focus();
      return;
    }
    setLocalError(null);
    // The controller opens the confirmation on success; on a failure the
    // message shows inline below and the sheet stays open.
    const ok = await controller.requestViewing(artwork, at.toISOString(), mode);
    if (ok) onClose();
  };

  const shown = localError ?? error;

  return (
    <Sheet open={open} onClose={onClose} aria-label="Request viewing">
      <form className="dz-offerwrap" onSubmit={(e) => void submit(e)}>
        <h3>Request viewing</h3>
        <div className="dz-seamline" />
        <div className="si">{workLine(artwork)}</div>

        <label className="dz-fieldlab" htmlFor="vwWhen">
          Preferred time
        </label>
        <div className="dz-offerfield">
          <input
            ref={inputRef}
            id="vwWhen"
            className="dz-field"
            type="datetime-local"
            min={min || undefined}
            value={when}
            // the picker's floor is "now" — a viewing in the past is never
            // meant; set from the focus event, not during render
            onFocus={() => setMin(toLocalInputValue(new Date()))}
            onChange={(e) => {
              setWhen(e.target.value);
              setLocalError(null);
              controller.clearError();
            }}
            aria-invalid={shown ? true : undefined}
          />
        </div>

        <Segment
          className="dz-viewmode"
          label="In person or virtual"
          options={modes.map((m) => ({ value: m.value, content: m.label }))}
          value={mode}
          onChange={setMode}
        />

        <div className="dz-offerhint">
          Choose a time that suits you — a Darz specialist will confirm the appointment.
        </div>
        <div className="dz-offererr" role="alert">
          {shown}
        </div>

        <button
          type="submit"
          className="dz-sheetcta"
          disabled={busy}
          aria-busy={busy || undefined}
        >
          {busy ? 'Sending…' : 'Request viewing'}
        </button>
      </form>
    </Sheet>
  );
}
