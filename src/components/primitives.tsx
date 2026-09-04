/**
 * Darz base component library — the primitives.
 *
 * Faithful port of the shipped collector Market App (`app.html`). Each
 * component owns a typed prop contract and renders the SAME semantic class
 * names as the original (`.btn`, `.card`, `.pill` …) so the skin in
 * `design/components.css` maps 1:1 to app.html. Function components (React
 * idiom); the OOP layer is `design/Theme.ts` + `design/ThemeController.ts`.
 */
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  TextareaHTMLAttributes,
} from 'react';
import { cx } from '../lib/cx';

/* ---- Chroma — the 2px cyan→magenta signature seam --------------------- */
export interface ChromaProps extends HTMLAttributes<HTMLDivElement> {
  direction?: 'h' | 'v';
}
export function Chroma({ direction = 'h', className, style, ...rest }: ChromaProps) {
  return (
    <div
      className={cx('chroma', className)}
      style={{
        background: direction === 'v' ? 'var(--dz-seam-v)' : 'var(--dz-seam)',
        ...style,
      }}
      {...rest}
    />
  );
}

/* ---- Eyebrow — tracked-caps label, often after a chroma dash ---------- */
export interface EyebrowProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}
export function Eyebrow({ children, className, ...rest }: EyebrowProps) {
  return (
    <p className={cx('eyebrow', className)} {...rest}>
      {children}
    </p>
  );
}

/* ---- Button — .btn variants + the detail-page .act-primary ----------- */
export type ButtonVariant =
  'primary' | 'accent' | 'outline' | 'ghost' | 'destructive' | 'act-primary';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  block?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'primary',
  block = false,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const base = variant === 'act-primary' ? 'act-primary' : 'btn';
  const mod = variant === 'act-primary' ? undefined : variant;
  return (
    <button type={type} className={cx(base, mod, block && 'block', className)} {...rest}>
      {children}
    </button>
  );
}

/* ---- Field — labelled text input / textarea ------------------------- */
interface FieldShared {
  label?: string;
  error?: string;
  /** hint text under the field (calm, honest — see VOICE_AND_COPY.md) */
  hint?: string;
}

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'ref'>, FieldShared {
  ref?: Ref<HTMLInputElement>;
  /** extra class(es) on the `<input>` itself — e.g. `"code"` for a masked
   * access-key / OTP field (see `.dz-field.code` in design/components.css) */
  inputClassName?: string;
  /** a trailing adornment inside the field box (e.g. the old app's key
   * show/hide eye toggle). Sets `.dz-field-control.has-trailing` so the
   * input gets the extra right padding automatically. */
  trailing?: ReactNode;
}

export function Input({
  label,
  error,
  hint,
  id,
  className,
  inputClassName,
  trailing,
  ref,
  ...rest
}: InputProps) {
  const fieldId = id ?? rest.name;
  return (
    <div className={cx('dz-field-wrap', className)}>
      {label && (
        <label className="dz-field-label" htmlFor={fieldId}>
          {label}
        </label>
      )}
      <div className={cx('dz-field-control', Boolean(trailing) && 'has-trailing')}>
        <input
          id={fieldId}
          ref={ref}
          className={cx('dz-field', inputClassName)}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
        {trailing && <span className="dz-field-trailing">{trailing}</span>}
      </div>
      {error ? (
        <p className="dz-field-err">{error}</p>
      ) : hint ? (
        <p className="dz-field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'ref'>, FieldShared {
  ref?: Ref<HTMLTextAreaElement>;
}

export function Textarea({ label, error, hint, id, className, ref, ...rest }: TextareaProps) {
  const fieldId = id ?? rest.name;
  return (
    <div className={cx('dz-field-wrap', className)}>
      {label && (
        <label className="dz-field-label" htmlFor={fieldId}>
          {label}
        </label>
      )}
      <textarea
        id={fieldId}
        ref={ref}
        className="dz-field"
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error ? (
        <p className="dz-field-err">{error}</p>
      ) : hint ? (
        <p className="dz-field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

/* ---- Card — surface + optional image / body slots ------------------- */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** hover-lift + pointer cursor (a tappable card) */
  interactive?: boolean;
  /** always-on chroma top bar (a showcase / "people" card) */
  feature?: boolean;
}
export function Card({ interactive, feature, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cx(
        'card',
        interactive && 'is-interactive',
        feature && 'is-feature',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
export function CardImage({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('card__img', className)} {...rest}>
      {children}
    </div>
  );
}
export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('card__body', className)} {...rest}>
      {children}
    </div>
  );
}

/* ---- Pill / chip — filter + toggle chip --------------------------- */
export interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}
export function Pill({ selected, className, type = 'button', children, ...rest }: PillProps) {
  return (
    <button
      type={type}
      className={cx('pill', selected && 'on', className)}
      aria-pressed={selected}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---- Avatar — round ink circle, serif initials (never gold-on-black) - */
export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
}
export function Avatar({ name, src, size = 'md', className, ...rest }: AvatarProps) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span className={cx('avatar', size, className)} {...rest}>
      {src ? <img src={src} alt={name} /> : initials}
    </span>
  );
}
