# Notes for Arian — 2026-09-22

Four things need your word. Everything else that could be built, is built and
sitting in a green PR.

---

## 1 · Release `development` → `main` (2 minutes)

`development` is **6 commits ahead of `main`**, so the live site does not have
the optimistic-lock fix, the component tests or the Node 22 CI fix.

I did not do this myself on "keep progressing", and that is deliberate:
`CLAUDE.md` records that an instruction to keep things moving is **not** a merge
authorisation, and names the 2026-09-22 case where that exact distinction
mattered. Merging needs you to ask, per request.

**Say "release to main" and I will do the whole thing** — open the PR, wait for
CI, merge, fast-forward the merge-back, confirm the branches are level and
Vercel has deployed.

⚠️ **One behaviour change in this release worth knowing about.** The lock fix
means Collectors, Memberships and Team logins now *refuse* a stale save instead
of silently overwriting. That is the fix working — but an admin who hits it will
see a "someone else saved this while you were editing" message where their write
previously just went through, with no warning and the other person's edit lost.

---

## 2 · The real API URL (the biggest one)

`.env.production` is the deliberate `api.invalid` placeholder, so
**https://darz-web.vercel.app is visual-only**: layout, routing, both themes and
the fonts are real; sign-in and data are not.

This is the single thing standing between you and a working site. Everything
else is done. Give me the backend's public address and I will wire it and
redeploy.

---

## 3 · i18n — two decisions (PR #88)

The engine is **built and shipped OFF**, exactly as the old app ships it, so
nothing changes until you decide. Enabling Farsi was verified in a browser: the
nav translates, direction flips, the layout mirrors.

What I found while testing is the reason I stopped at the foundation rather than
wiring all ~430 strings:

**English text inside a right-to-left page has bidi artifacts.** The hero line
rendered as `.Contemporary Iranian works, available through darzmarket.art` —
the full stop jumps to the left. That is technically correct bidi behaviour, and
it looks broken.

So the remaining work is not "translate the strings". It is:

- **(a) Which languages actually ship?** The old app has real translations for
  Farsi, French, Spanish and Arabic. All of them, or a subset?
- **(b) Does right-to-left get a proper layout pass?** The old engine ships a
  stylesheet of RTL overrides for its left-to-right layout. This port does not
  carry it, and our CSS has never been audited for RTL. **Answering this wrong
  means redoing the work**, which is why I did not guess.

My recommendation: **Farsi first, with a real RTL pass.** It is the audience that
matters most, and doing one language properly beats four half-done.

---

## 4 · Small one — `/artists` has no menu entry

An old open decision in `docs/TASKLIST.md`. The artist index exists at
`/artists` and nothing links to it. Want it in the nav, on the Market screen, or
left as a deep link only? ~30 minutes once you say.

---

## Open PRs, all green

| PR | What |
| --- | --- |
| **#86** | The handoff doc + `Segment`/`Toast` component tests |
| **#87** | vitest 3 → 5, clearing a path-traversal advisory (`npm audit` now 0) |
| **#88** | The i18n engine, off by default |

They are independent and can be merged in any order.

---

## One thing I paused rather than touched

Release PRs run CI **twice** (once for `pull_request`, once for the push to
`development`). That is ~18 wasted minutes per release.

I did not fix it: another of your sessions is titled *"Stop CI running twice per
pull request"* and reports a fix in its own PR #75. I could not confirm which
repository that is, and two sessions editing `.github/workflows/quality.yml`
would conflict. **If that session was working on a different repo, tell me and I
will fix it here — it is a two-line change.**
