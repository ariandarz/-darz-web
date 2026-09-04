# Changelog — Darz Market Web

Format rule: **one entry per task/step, at most 3 lines.** Line 1 = date + what was done.
Newest first. Add an entry whenever a task in `docs/TASKLIST.md` moves to done (`[x]`).

---

## 2026-09-04 — Phase 2: design system

Ported the shipped collector app's tokens + base components to React/TS (owner call: match
`app.html` `:root` over the stale guideline — warm palette, Cormorant body). `src/design/`:
`tokens.css`/`tokens/` (verbatim, line-cited), `Theme` + `ThemeController` classes (OOP core,
Paper⇄Black, `dz-theme` persist). `src/components/`: Logo/Wordmark, Chroma, Eyebrow, Button, Input,
Textarea, Card, Pill, Avatar, Toast, Sheet. Prettier added; `src/App.tsx` is now the showcase.
See `docs/adr/0001-styling-and-oop.md`. Branch `phase-2-design-system`; build + typecheck + lint green.

## 2026-08-28 — Phase 1: project scaffold

Vite + React + TypeScript scaffold in a new, separate git repo (local only, no GitHub remote yet).
Design/planning groundwork: confirmed the design-reference approach (DarzStudio `main`, not copied
in), the API-client strategy (live OpenAPI fetch), and wrote the full cross-repo phase breakdown.
