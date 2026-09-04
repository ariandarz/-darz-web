# `src/design` — Darz design system

Phase 2 output. A **faithful port** of the shipped collector Market App
(`../DarzStudio` `app.html` @ `main`), not a redesign. Owner decision
(2026-09-04): where `DARZ_DESIGN_GUIDELINE.md` and the shipped `app.html`
`:root` disagree, **`app.html` wins** — the warm ink+paper palette and the
Cormorant Garamond body font are the real approved production values.

## Files

| File | Role |
|---|---|
| `tokens.css` | The runtime source of truth. `:root` custom properties + the `html.dz-bw` dark overrides, ported verbatim with `app.html` line citations. |
| `tokens/index.ts` | The same values, typed, for application/domain code. **Keep in lockstep with `tokens.css`.** |
| `base.css` | Global reset + document rules + shared type primitives (`.chroma`, `.eyebrow`). |
| `components.css` | Base-component skins (`.btn`, `.card`, `.pill`, `.sheet` …) — the same class names as `app.html` so the port is verifiable 1:1. |
| `global.css` | The single stylesheet `main.tsx` imports (`@import`s the three above). |
| `Theme.ts` | `Theme` — immutable value object for one surface theme; serialises to a `:root` block. |
| `ThemeController.ts` | `ThemeController` — runtime theme: active `Theme`, `html.dz-bw` class, `localStorage` persistence (`dz-theme`), OS-preference fallback, subscribe(). Singleton `themeController`. |

## Conventions (ADR-light)

- **Styling:** plain CSS + CSS custom properties, one global sheet — mirrors
  `app.html`. Component class names are **global and semantic** (`.btn`,
  `.card`), not hashed modules, so a reviewer can diff them against the
  original. See `docs/adr/0001-styling-and-oop.md`.
- **OOP** (owner instruction): the design-system / domain **logic** is
  class-based (`Theme`, `ThemeController`; later the API client + services).
  React **views** stay function components — the React idiom and what the
  lint config targets. Classes are framework-free and unit-testable without a
  renderer.
- **Component boundary:** one typed module per component under
  `src/components/`; `src/components/index.ts` is the only public entry.
- **Adding a token:** edit `tokens.css` **and** `tokens/index.ts` together.
- **Never** introduce gold / cream-beyond-`app.html` / `Georgia`-as-primary,
  or a coloured button fill, or the chroma as anything but a 2px accent
  (`DARZ_DESIGN_GUIDELINE.md` §6).

## Try it

`npm run dev` renders `src/App.tsx` — the Phase 2 showcase: every token
group, every primitive, and the Paper ⇄ Black toggle.
