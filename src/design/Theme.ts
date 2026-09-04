/**
 * Theme — an immutable value object describing one Darz surface theme.
 *
 * OOP core of the design system (per the owner's "follow OOP" instruction):
 * the React components stay function components — the React idiom, and what
 * the lint config targets — while the *design-system logic* (themes, tokens,
 * later the API client and services) is modelled as classes.
 *
 * A `Theme` bundles a palette + the shared token groups and knows how to
 * serialise itself to a CSS `:root` block. `ThemeController` owns the runtime
 * (which theme is active, persistence, the `html.dz-bw` class).
 */
import {
  palette,
  paletteDark,
  typography,
  fontSize,
  radius,
  space,
  motion,
  chroma,
  type ThemeName,
} from './tokens';

type TokenMap = Record<string, string>;

export class Theme {
  readonly name: ThemeName;
  readonly label: string;
  /** the CSS class applied to <html> for this theme ('' for the default) */
  readonly htmlClass: string;
  readonly colors: TokenMap;

  private constructor(init: {
    name: ThemeName;
    label: string;
    htmlClass: string;
    colors: TokenMap;
  }) {
    this.name = init.name;
    this.label = init.label;
    this.htmlClass = init.htmlClass;
    this.colors = init.colors;
    Object.freeze(this);
    Object.freeze(this.colors);
  }

  /** The paper theme — the app.html default `:root`. */
  static light(): Theme {
    return new Theme({
      name: 'light',
      label: 'Paper',
      htmlClass: '',
      colors: { ...palette },
    });
  }

  /** The "Black" app mode — `html.dz-bw`. Dark keys layered over the base. */
  static bw(): Theme {
    return new Theme({
      name: 'bw',
      label: 'Black',
      htmlClass: 'dz-bw',
      colors: { ...palette, ...paletteDark },
    });
  }

  static all(): Theme[] {
    return [Theme.light(), Theme.bw()];
  }

  static byName(name: ThemeName): Theme {
    return name === 'bw' ? Theme.bw() : Theme.light();
  }

  isDark(): boolean {
    return this.name === 'bw';
  }

  /** Every token as `--var: value` pairs — colours plus the theme-invariant
   * groups. Handy for a docs page, snapshot tests, or an SSR style tag. */
  toCssVars(): TokenMap {
    const out: TokenMap = {};
    for (const [k, v] of Object.entries(this.colors)) {
      out[`--${camelToKebab(k)}`] = v;
    }
    out['--sans'] = typography.sans;
    out['--font-head'] = typography.head;
    out['--font-body'] = typography.body;
    out['--font-mono'] = typography.mono;
    out['--dz-seam'] = chroma.h;
    out['--dz-seam-v'] = chroma.v;
    out['--dz-seam-135'] = chroma.d135;
    for (const [k, v] of Object.entries(fontSize)) {
      out[`--f-${camelToKebab(k)}`] = v;
    }
    out['--radius'] = radius.base;
    for (const [k, v] of Object.entries(space)) {
      out[`--sp-${k}`] = v;
    }
    out['--dz-t-fast'] = motion.fast;
    out['--dz-t'] = motion.base;
    out['--dz-t-slow'] = motion.slow;
    return out;
  }

  toCssText(selector = ':root'): string {
    const body = Object.entries(this.toCssVars())
      .map(([k, v]) => `  ${k}: ${v};`)
      .join('\n');
    return `${selector} {\n${body}\n}`;
  }
}

function camelToKebab(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}
