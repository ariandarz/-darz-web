# ADR 0001 — Styling approach and the "OOP" instruction

- **Status:** Accepted
- **Date:** 2026-09-04
- **Phase:** 2 (design system)

## Context

`CLAUDE.md` requires a faithful port of the shipped DarzStudio collector app
(`app.html`), whose entire UI is one global stylesheet of CSS custom
properties and semantic class names (`.btn`, `.card`, `.qchip` …). The owner
also instructed: build this "component based" and "follow OOP".

Two questions had to be settled before writing any UI:

1. How do we style components — CSS Modules, CSS-in-JS, Tailwind, or plain CSS?
2. What does "OOP" mean in a React + TS codebase where class components are
   effectively deprecated and the lint config only targets hooks?

## Decision

**Styling — plain CSS + custom properties, one global sheet, global semantic
class names.**

- `src/design/tokens.css` holds `:root` + `html.dz-bw`, ported verbatim from
  `app.html` with line citations. `src/design/components.css` holds the
  base-component skins using the **same class names** as `app.html`.
- A reviewer can diff our CSS against the original line-for-line. Hashed
  CSS-Module class names or Tailwind utilities would destroy that
  verifiability, which is the whole point of a "faithful port".
- `tokens/index.ts` mirrors the values in TypeScript for domain code and
  tests; it must be kept in lockstep with `tokens.css`.

**OOP — class-based domain/logic layer, function-component views.**

- Design-system and (later) application logic is modelled as classes:
  `Theme` (immutable value object), `ThemeController` (runtime theme +
  persistence + observers). Phase 3+ adds `ApiClient`, `AuthSession`, and
  per-resource service classes the same way.
- These classes are framework-free: unit-testable with no renderer, reusable
  outside React.
- React components stay function components with typed prop contracts. This
  is the current React idiom, matches `.oxlintrc.json`
  (`react/rules-of-hooks`, `react/only-export-components`), and keeps the
  view layer thin over the OOP core.

## Consequences

- No CSS-Modules / styled-components / Tailwind dependency.
- Global class names can collide in principle; mitigated by the `dz-`/`__`
  naming already used by `app.html` and by keeping all component CSS in one
  reviewed file.
- The `tokens.css` ↔ `tokens/index.ts` duplication needs discipline; a later
  build step could generate one from the other.
- "OOP" is satisfied where it adds value (testable logic), not by forcing
  class components.
