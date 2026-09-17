/**
 * Segment — the bordered view switch (`.viewseg`, app.html:1393-1400): a row
 * of equal buttons in one hairline box; the active one carries the 2px
 * cyan→magenta underline (dark: a charcoal fill). Used for the catalogue's
 * [grid | Single view] and the records' [Cards | List].
 */
import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface SegmentOption<V extends string> {
  value: V;
  /** icon and/or text */
  content: ReactNode;
  title?: string;
}

export interface SegmentProps<V extends string> {
  options: Array<SegmentOption<V>>;
  value: V;
  onChange: (value: V) => void;
  label: string;
  className?: string;
}

export function Segment<V extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentProps<V>) {
  return (
    <div className={cx('viewseg', className)} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          className={cx(o.value === value && 'on')}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.content}
        </button>
      ))}
    </div>
  );
}
