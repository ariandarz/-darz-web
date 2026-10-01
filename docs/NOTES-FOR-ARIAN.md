# Notes for Arian: TODO next

**Updated 2026-09-27.** V1 is built. Everything below needs you, in this order.
Nothing is merged without your word.

## TODO

1. [ ] **Merge the backend fix PRs** on `darz-backend-api`: #71–#78. They are drafts, each with tests.
   Merge the security ones, **#74** (login rate limit) and **#76** (gallery portal PIN, uploads), before any real
   portal link goes out. Only the top of the backend `CHANGELOG.md` conflicts between them; keep both entries.
2. [ ] **Set `NUM_PROXIES`** on the production backend. Behind one Caddy, set it to `1`. Until it's set,
   anyone can get around the per-IP limits.
3. [ ] **Give the real API URL** (`VITE_API_BASE_URL`). Until then the live site shows layout only, with no
   sign-in and no data. This is the biggest blocker.
4. [x] ~~Release #113~~. **Done 2026-09-27:** V1 is on `main` (`960d571`) and deployed.
5. [x] ~~Review #114~~. Merged 2026-09-27.
6. [ ] After the backend PRs merge, ask for the **small web follow-up**:
   - regenerate the types;
   - show the admin image preview;
   - add a "too many attempts" message on the portal;
   - use the new option labels;
   - build the portal "Save draft" (needs #78).

## Decisions waiting on you (no rush)

- **Portal lockout:** anyone who holds a portal link can lock it for up to 1 hour by guessing wrong PINs. OK for V1?
- **Owner-deferred screens (API ready):**
  - selection-ready notice;
  - question-set editor;
  - archive;
  - withdraw/cancel;
  - activity read-back;
  - push opt-in;
  - Club "Auction access";
  - counter-offer display, which needs wording.
- **Project money / internal notes** are hidden in the UI only. Should the backend strip them from the API too?
- **Auction date error copy:** confirm "The end must be after the start."
- **Languages (i18n, off today):** which languages ship, and do we do a real right-to-left pass?
  My pick is Farsi first, done properly.
- **`/artists`** has no menu link. Add one, or leave it as a direct link only?
- **Small backend follow-ups:**
  - the admin share can still move a document to another collector;
  - completed and cancelled projects still count in the dashboard tiles;
  - lots don't move when an auction's dates move;
  - `docs/DEPLOY.md` in the backend describes a compose file that has been deleted.

## Where things stand

| | |
| --- | --- |
| Web | V1 **released**: `main` = `development` = `960d571` (2026-09-27) |
| Backend | fix PRs **#71–#78** are open drafts on `darz-backend-api` |
| Gate | 838 unit · 155 E2E · typecheck · lint · format · build, all green |
| Live site | https://darz-web.vercel.app serves `main` and is visual-only until the API URL is set |

Detail: `DARZ_WEB_V1_STATUS.md` (full picture), `V1_CONTRACT_ISSUES.md` § "Backend fix PRs",
`TASKLIST.md`.
