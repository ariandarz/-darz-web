/**
 * SignaturePad — the old §80 signing pad (gallery-update.html v1187,
 * :1950-2043; CSS :490-503), now that the sign endpoint takes a drawn image
 * beside the typed name (G-PORT-7: `signature_image`, a base64 PNG data URL,
 * "keep both" — `ExhibitionDocumentService.portal_stamp`).
 *
 * Ported as it was: one canvas sized to its own box at the device pixel ratio
 * (capped at 3) so the line is as sharp as the screen it was drawn on; a
 * re-fit on resize REDRAWS what was there (re-fitting clears the bitmap, and a
 * rotation mid-signature must not wipe a signature the gallery thinks it has
 * given); the name of the person signing beneath it; Clear · Cancel · the
 * caller's confirm label; a click on the backdrop closes it. Its wording is
 * the caller's (v1206: "a second pad never has to be written").
 *
 * Changed, for this stack:
 *  - Pointer Events with pointer capture replace the old mouse + touch
 *    listeners on `window` — capture is what let a stroke that leaves the
 *    canvas still finish, and it needs no window listener to unhook;
 *  - the export keeps the old 900px ceiling (a 3x phone draws a ~1500px
 *    bitmap for a mark printed at ~150px), but the size refusal is the NEW
 *    server's limit — 2 MB decoded — not the old RPC's 400,000 characters.
 */
import { useEffect, useRef, useState } from 'react';
import { signatureAcceptable } from './portalForm';

/** The export width ceiling (old :2027-2034). */
const EXPORT_MAX_W = 900;

export function SignaturePad({
  title,
  sub,
  okLabel,
  defaultName,
  onCancel,
  onSign,
  onRefuse,
}: {
  title: string;
  sub: string;
  okLabel: string;
  /** the header's "Your name" (old `staff()`), prefilled */
  defaultName: string;
  onCancel: () => void;
  /** resolves true when the server took it — the caller then closes the pad */
  onSign: (png: string, name: string) => Promise<boolean>;
  /** the old toasts (`Please sign in the box first.` …) */
  onRefuse: (message: string) => void;
}) {
  const canRef = useRef<HTMLCanvasElement>(null);
  const drawn = useRef(false);
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const can = canRef.current;
    const ctx = can?.getContext('2d');
    if (!can || !ctx) return;
    let down = false;
    let last: { x: number; y: number } | null = null;

    const fit = () => {
      const r = can.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      const keep = drawn.current ? can.toDataURL('image/png') : '';
      can.width = Math.max(1, Math.round(r.width * dpr));
      can.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#111';
      if (keep) {
        const im = new Image();
        im.onload = () => ctx.drawImage(im, 0, 0, r.width, r.height);
        im.src = keep;
      }
    };
    const pt = (e: PointerEvent) => {
      const r = can.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const start = (e: PointerEvent) => {
      e.preventDefault();
      down = true;
      last = pt(e);
      can.setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!down || !last) return;
      e.preventDefault();
      const p = pt(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      drawn.current = true;
    };
    const end = () => {
      down = false;
      last = null;
    };

    can.addEventListener('pointerdown', start);
    can.addEventListener('pointermove', move);
    can.addEventListener('pointerup', end);
    can.addEventListener('pointercancel', end);
    window.addEventListener('resize', fit);
    fit();
    return () => {
      can.removeEventListener('pointerdown', start);
      can.removeEventListener('pointermove', move);
      can.removeEventListener('pointerup', end);
      can.removeEventListener('pointercancel', end);
      window.removeEventListener('resize', fit);
    };
  }, []);

  const clear = () => {
    const can = canRef.current;
    can?.getContext('2d')?.clearRect(0, 0, can.width, can.height);
    drawn.current = false;
  };

  const confirm = async () => {
    const can = canRef.current;
    if (!can || !drawn.current) {
      onRefuse('Please sign in the box first.');
      return;
    }
    const who = name.trim();
    if (!who) {
      onRefuse('Add the name of the person signing.');
      return;
    }
    let png = '';
    try {
      let out = can;
      if (can.width > EXPORT_MAX_W) {
        out = document.createElement('canvas');
        out.width = EXPORT_MAX_W;
        out.height = Math.max(1, Math.round(can.height * (EXPORT_MAX_W / can.width)));
        out.getContext('2d')?.drawImage(can, 0, 0, out.width, out.height);
      }
      png = out.toDataURL('image/png');
    } catch {
      png = '';
    }
    if (!signatureAcceptable(png)) {
      onRefuse('That signature did not come through. Please sign again.');
      return;
    }
    setBusy(true);
    // on success the caller unmounts the pad; only a refusal re-arms it
    if (!(await onSign(png, who))) setBusy(false);
  };

  return (
    <div
      className="sigpad-wrap"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="sigpad" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        <div className="sp-sub">{sub}</div>
        <div className="sp-can">
          <canvas ref={canRef} aria-label="Signature" />
          <div className="sp-rule" />
          <div className="sp-hint">Signature</div>
        </div>
        <div className="fld sp-name">
          <label htmlFor="sigWho">Name of the person signing</label>
          <input
            id="sigWho"
            autoComplete="name"
            placeholder="Who is signing"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="sp-acts">
          <button type="button" className="btn" onClick={clear}>
            Clear
          </button>
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy ? 'Signing…' : okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
