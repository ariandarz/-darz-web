# Notes for Arian — updated 2026-09-23

**Four things need your word. Nothing else is left to build.** Everything that could be
built is built, merged into `development`, and green.

---

## 1 · Release `development` → `main` (2 minutes)

`development` is **18 commits ahead of `main`**, so the live site
(https://darz-web.vercel.app, which auto-deploys `main`) has **none** of the recent
work: the optimistic-lock fix, the questionnaire and membership screens, the component
tests, the i18n engine, the vitest security upgrade and the CI fix.

I did not do this myself on "keep progressing", and that is deliberate: `CLAUDE.md`
records that an instruction to keep things moving is **not** a merge authorisation.
Merging needs you to ask, per request. (You merged #83-#90 yourself — thank you; that
kept the rule clean.)

**Say "release to main" and I will do the whole thing** — open the PR, wait for CI,
merge, fast-forward the merge-back, confirm the branches are level and Vercel has
deployed.

⚠️ **One behaviour change in this release worth knowing about.** The lock fix means
Collectors, Memberships and Team logins now *refuse* a stale save instead of silently
overwriting. That is the fix working — but an admin who hits it will see a "someone else
saved this while you were editing" message where their write previously just went
through, with no warning and the other person's edit lost.

---

## 2 · The real API URL (the biggest one)

`.env.production` is the deliberate `api.invalid` placeholder, so
**https://darz-web.vercel.app is visual-only**: layout, routing, both themes and the
fonts are real; sign-in and data are not.

This is the single thing standing between you and a working site. Everything else is
done. Give me the backend's public address and I will wire it and redeploy — it is one
line, nothing else changes.

---

## 3 · i18n — two decisions (shipped in #88, currently OFF)

The engine is **built and shipped OFF**, exactly as the old app ships it, so nothing
changes until you decide. Enabling Farsi was verified in a browser: the nav translates,
direction flips, the layout mirrors.

What I found while testing is the reason I stopped at the foundation rather than wiring
all ~430 strings:

**English text inside a right-to-left page has bidi artifacts.** The hero line rendered
as `.Contemporary Iranian works, available through darzmarket.art` — the full stop jumps
to the left. That is technically correct bidi behaviour, and it looks broken.

So the remaining work is not "translate the strings". It is:

- **(a) Which languages actually ship?** The old app has real translations for Farsi,
  French, Spanish and Arabic. All of them, or a subset?
- **(b) Does right-to-left get a proper layout pass?** The old engine ships a stylesheet
  of RTL overrides for its left-to-right layout. This port does not carry it, and our CSS
  has never been audited for RTL. **Answering this wrong means redoing the work**, which
  is why I did not guess.
- **(c) Is the language picker visible**, or does the language come only from `theme.langs`
  and `?lang=`?

My recommendation: **Farsi first, with a real RTL pass.** It is the audience that matters
most, and doing one language properly beats four half-done.

---

## 4 · Small one — `/artists` has no menu entry

An old open decision in `docs/TASKLIST.md`. The artist index exists at `/artists` and
nothing links to it. Want it in the nav, on the Market screen, or left as a deep link
only? ~30 minutes once you say.

---

## Where things stand

| | |
| --- | --- |
| `main` | `50215b3` — what the live site is serving |
| `development` | `f580eed` — **18 ahead**, everything below is in it |
| Open PRs | none (bar the doc-sync PR, if it is still open) |
| Gate | 620 unit · 82 E2E · typecheck · lint 0 · format · build · `npm audit` 0 |

**Merged since the last note — all eight by you, on 2026-09-22:**

| PR | What |
| --- | --- |
| #83 / #84 | The questionnaire and membership screens, two admin count strips, the Data Health counts, the invoice bank block, the `admin.css` split — and the release to `main` |
| #85 | The silently-disabled optimistic lock, fixed and pinned by a wire-format test; 40 component tests |
| #86 | The handoff doc, plus `Segment` / `Toast` tests |
| #87 | vitest 3 → 5, clearing a dev-only advisory (`npm audit` now 0) |
| #88 | The i18n engine, off by default |
| #89 | This file |
| #90 | CI: the gate no longer runs twice per release (~18 min saved each time), actions pinned `@v5` |

**Nothing is in flight and nothing is half-built.** The only frontend work that needs
nobody's answer is Phase 5b (the Database desk's four hard filters), and that needs
backend endpoints before there is anything to call.
