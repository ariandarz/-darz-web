/**
 * Logo + Wordmark — the Darz mark.
 *
 * Three overlapping r=40 circles on a 100×100 viewBox: cyan (54,46),
 * magenta (46,54), black (50,50). Ported from DARZ_DESIGN_GUIDELINE.md §2
 * and app.html. Never recolour, never separate the circles, never add a ring
 * — so the circle geometry is hard-coded and not prop-configurable.
 */
import { cx } from '../lib/cx';

export interface LogoProps {
  /** rendered pixel size (width = height). Default 28. */
  size?: number;
  className?: string;
  title?: string;
}

export function Logo({ size = 28, className, title = 'Darz' }: LogoProps) {
  return (
    <svg
      className={cx('dz-logo', className)}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title}
    >
      <circle cx="54" cy="46" r="40" fill="#00D4CC" />
      <circle cx="46" cy="54" r="40" fill="#E8005C" />
      <circle cx="50" cy="50" r="40" fill="#0A0A0A" />
    </svg>
  );
}

export interface WordmarkProps {
  /** the bold suffix after "darz" — `.art` on the collector app, `Studio` on admin */
  suffix?: string;
  withMark?: boolean;
  className?: string;
}

/** `darz` (weight 300) + suffix (weight 700), set in the display serif. */
export function Wordmark({ suffix = '.art', withMark = true, className }: WordmarkProps) {
  return (
    <span className={cx('wm', className)}>
      {withMark && <Logo size={22} />}
      <span className="wm__t">
        <span className="d">darz</span>
        <span className="s">{suffix}</span>
      </span>
    </span>
  );
}
