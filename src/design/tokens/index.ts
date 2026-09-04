/**
 * Darz Market — design tokens, typed.
 *
 * The single source of truth in TypeScript, mirroring `tokens.css` value for
 * value (owner decision 2026-09-04: match the shipped `app.html` `:root`).
 * The CSS file drives the runtime; this module lets application/domain code
 * reference the same values with types instead of magic strings, and lets
 * `Theme` emit a `:root` block programmatically (used in tests / SSR / docs).
 *
 * Keep the two in lockstep: if you change a value here, change `tokens.css`.
 */

export const palette = {
  white: '#FAF8F3',
  ink: '#1A1714',
  ink2: '#403A33',
  ink3: '#968F86',
  card: '#FAF8F3',
  soft: '#F3EFE7',
  paper: '#FAF8F3',
  bg: '#ECE9E2',
  hair: '#E2DED4',
  hair2: '#EFEBE2',
  cyan: '#00D4CC',
  magenta: '#E8005C',
  accent: '#E11D48',
} as const;

/** The dark ("Black") app mode — `html.dz-bw`. Only the keys that change. */
export const paletteDark = {
  white: '#16161A',
  ink: '#F1EFE9',
  ink2: '#D3D0C8',
  ink3: '#969189',
  card: '#1A1A1F',
  soft: '#212129',
  paper: '#16161A',
  hair: '#2E2E35',
  hair2: '#26262C',
} as const;

export const status = {
  ok: '#1F9D57',
  okInk: '#1F7A4D',
  info: '#4A4AD0',
  warnInk: '#9A6A00',
  badInk: '#C0392B',
} as const;

export const typography = {
  sans: "'Barlow','Helvetica Neue',Helvetica,Arial,sans-serif",
  head: "'Cormorant Garamond',Georgia,'Times New Roman',serif",
  body: "'Cormorant Garamond',Georgia,'Times New Roman',serif",
  mono: "'Space Mono',ui-monospace,SFMono-Regular,Menlo,monospace",
  fa: "'Vazirmatn','Barlow',sans-serif",
} as const;

/** Inline-sized headings app.html drives from `:root`. */
export const fontSize = {
  hero: '34px',
  detail: '28px',
  sec: '22px',
  artist: '13px',
  cardTitle: '11.5px',
  price: '40px',
  body: '13.5px',
  nav: '9.5px',
} as const;

export const radius = {
  control: '9px',
  base: '13px',
  pill: '20px',
  round: '999px',
} as const;

export const space = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
} as const;

export const motion = {
  fast: '0.12s',
  base: '0.14s',
  slow: '0.18s',
} as const;

/** The one signature gradient. Built from `cyan`/`magenta` so a white-label
 * brand restyles it in one place. */
export const chroma = {
  h: `linear-gradient(90deg, ${palette.cyan}, ${palette.magenta})`,
  v: `linear-gradient(180deg, ${palette.cyan}, ${palette.magenta})`,
  d135: `linear-gradient(135deg, ${palette.cyan}, ${palette.magenta})`,
} as const;

export type Palette = typeof palette;
export type ThemeName = 'light' | 'bw';
