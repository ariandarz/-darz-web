/** Tiny className joiner — drops falsy values, joins with a space.
 * (No dependency; the whole app only needs this much of `clsx`.) */
export type ClassValue = string | number | false | null | undefined;

export function cx(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(' ');
}
