/**
 * The secondary-action glyphs, ported verbatim from `app.html`'s `ACTIC` map
 * (:9221): 17×17, stroke 1.6, round caps/joins. `access` and `inquire` reuse
 * the eye / tag paths exactly as the original does.
 */
import type { ReactNode } from 'react';
import type { ActionVerb } from './RequestController';

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const CLOCK = (
  <Glyph>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 1.8" />
  </Glyph>
);
const EYE = (
  <Glyph>
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.6" />
  </Glyph>
);
const TAG = (
  <Glyph>
    <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z" />
    <circle cx="7" cy="7" r="1.2" />
  </Glyph>
);

/** app.html:9221 falls back to the eye glyph for anything unmapped. */
export function ActionIcon({ verb }: { verb: ActionVerb }) {
  if (verb === 'hold') return CLOCK;
  if (verb === 'offer' || verb === 'price') return TAG;
  return EYE;
}
