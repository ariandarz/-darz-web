# Deploying to ArvanCloud

Written 2026-09-22, for the migration off Vercel.

**Why the move:** the collectors this app is built for are in Iran, and a
Vercel-hosted frontend plus a third-party font CDN is two foreign origins on
the critical path of every first load. Hosting inside Iran removes both.

**Scope of this document.** Everything here about *this repository* — the build,
its environment variables, the container, the nginx config — is written from
the code and verified where it says so. Everything about **ArvanCloud's own
console is not**: their product names and menus change, and this was written
without access to the account. Treat the ArvanCloud steps as "what you need to
achieve", and check the exact clicks against their current documentation.

---

## 1 · The two halves move separately

| | What it is | Difficulty |
| --- | --- | --- |
| **Frontend** — this repo | A static SPA. `npm run build` → `dist/`, a folder of files. No server-side runtime at all. | Low. Reversible in seconds. |
| **Backend** — `darzmarket-api` | Django/DRF + PostgreSQL + object storage + **WebSockets** (daphne serves HTTP and WS on one port). | The real project. |

Do the frontend first. It is low-risk, it proves the DNS and TLS path, and the
Vercel project stays as an instant rollback.

**They are coupled in one direction only, and it matters:** the frontend has
the backend's URL *compiled into it* (§3). Moving the backend therefore forces
a frontend rebuild. Moving the frontend does not touch the backend.

---

## 2 · Frontend — three ways, in order of preference

### a) Container (recommended)

The repo now carries a `Dockerfile` and `nginx.conf`. Multi-stage: node builds,
nginx serves. Runs on an ArvanCloud VM with Docker, or on their container /
Kubernetes platform.

```bash
docker build \
  --build-arg VITE_API_BASE_URL=https://api.yourdomain.ir/api \
  --build-arg VITE_API_WS_URL=wss://api.yourdomain.ir \
  --build-arg VITE_FEATURE_SET=v0.1 \
  -t darz-web:latest .

docker run -d -p 8080:8080 --name darz-web --restart unless-stopped darz-web:latest
```

It listens on **8080** and runs as the `nginx` user, so it needs no privileged
port and works on platforms that forbid root.

Preferred because the SPA fallback is exact and the cache headers are yours —
see `nginx.conf`, which is commented line by line.

### b) Object Storage + CDN (cheapest)

ArvanCloud's object storage is S3-compatible, so `dist/` uploads with any S3
tool. But **check one thing before committing to it**: the SPA needs every
unknown path to return `index.html`. On object storage that is the bucket's
*error document* setting, and some providers serve it with a **404 status
code**. The page will render, but the status is a lie — it breaks monitoring,
and search engines and some in-app webviews treat it as a dead page.

If their CDN can rewrite (not redirect) unknown paths to `/index.html` with a
200, this option is fine. If it can only redirect, use (a).

### c) A VM with plain nginx, no container

Copy `dist/` to the server and use this repo's `nginx.conf` directly. Same
correctness as (a), one less moving part, but you rebuild by hand.

---

## 3 · The build-time rule — read this one

**Vite compiles `VITE_*` values into the JavaScript bundle.** They are not read
at runtime. Setting them with `docker run -e`, in a systemd unit, or in a
hosting panel's "environment variables" box does **nothing** — the bundle was
already written when the image was built.

So: **pointing the app at a different backend means rebuilding the frontend.**
Not restarting it, not editing a config file on the server.

The three that matter:

```bash
VITE_API_BASE_URL=https://api.yourdomain.ir/api   # WITH the /api suffix
VITE_API_WS_URL=wss://api.yourdomain.ir           # NO /api, NO trailing slash
VITE_FEATURE_SET=v0.1                             # or `full` for a review build
```

`VITE_API_WS_URL` is deliberately **not** derived from the HTTP base in code
(`src/api/index.ts`), because the socket often needs a different host — see §4.
Both must be set explicitly.

**A missing one is a white page, not a warning.** `resolveBaseUrl()` throws
when unset and the API client is built at module load, so the app dies before
it paints. The `Dockerfile` guards against exactly this: it fails the build,
loudly, rather than shipping a bundle that cannot boot.

**Precedence, verified 2026-09-22:** a real environment variable beats
`.env.production`. A build run with `VITE_API_BASE_URL` set produced a bundle
containing that URL and not the committed placeholder. So the Docker build args
above work, and `.env.production` stays what it is — the fallback for a plain
`npm run build` (the path Vercel uses).

---

## 4 · Backend — and the thing that will bite you

Four pieces:

1. **Compute** — a VM running Docker Compose, or their container platform.
2. **PostgreSQL** — their managed database if offered; otherwise a container
   with real, tested backups. This holds every artwork, collector and ledger
   entry.
3. **Object storage** — ArvanCloud's is S3-compatible, so `django-storages`
   works **unchanged**. You swap `endpoint_url`, the access key and the bucket.
   No code change.
4. **TLS** and a reverse proxy.

### WebSockets

This app opens a real socket for live auction lots
(`src/features/auctions/LotSocket.ts`), and Django serves HTTP and WS on the
same port through daphne. Any nginx, load balancer or CDN in front **must**
pass the upgrade handshake:

```nginx
location /ws/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;   # a lot can sit open for an hour
}
```

**This is the failure that hides.** Everything else in the app keeps working
perfectly with a broken socket — the catalogue, sign-in, every admin desk. Only
live bidding stops updating, and it stops *silently*. If the CDN in front of
the API cannot do WebSockets, point `VITE_API_WS_URL` at a subdomain that
bypasses it.

**Test auctions specifically after cutover.** Nothing else will tell you.

### CORS and CSRF

Django must trust the new frontend origin:

```python
CORS_ALLOWED_ORIGINS  = ["https://app.yourdomain.ir"]
CSRF_TRUSTED_ORIGINS  = ["https://app.yourdomain.ir", "https://api.yourdomain.ir"]
```

A missed entry here looks like "sign-in does nothing" with a CORS error in the
browser console and a clean server log.

---

## 5 · Cutover order

1. Stand the backend up. Prove two things by hand: `GET /api/schema/` returns
   the document, and a WebSocket connects.
2. Rebuild the frontend with the real URLs (§3). Deploy it.
3. Walk it against the real backend: sign-in, the catalogue, an artwork, the
   admin desks, **and an auction lot**.
4. Only then move DNS.
5. **Keep the Vercel project** until you are happy. It is the rollback, and it
   costs nothing to leave sitting there.

---

## 6 · Fonts — already done

The seven Google-hosted font families are gone. The four the app actually uses
(Barlow, Cormorant Garamond, Space Mono, Vazirmatn) are self-hosted and ship
with the build; the other three were being downloaded and rendered nowhere. See
`src/design/fonts.css`.

This mattered more than it looks for an Iran-hosted deployment: when
`fonts.googleapis.com` is slow or blocked, the browser does not error — it
quietly falls back to Helvetica and Times. The app renders "fine" and looks
like a different product.

**We demonstrated it by accident.** Verifying the change, the pre-change build
was measured through Chrome DevTools rather than by eye, and its font request
to `fonts.googleapis.com` came back **failed** — the whole admin panel was
rendering in **Liberation Serif**. Not Barlow, not Cormorant Garamond. No
error, no console warning, nothing on screen to say so; it simply looked a bit
off. That is the exact failure an Iranian collector would have had, reproduced
without trying. The self-hosted build renders Cormorant Garamond and Barlow
correctly from the same machine.

Worth knowing how it was checked, because looking at a screenshot is not
enough here — two serifs at a glance are easy to confuse:

```js
const cdp = await page.context().newCDPSession(page);
await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
const { root } = await cdp.send('DOM.getDocument');
const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.ad-h' });
const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
// → the font the browser ACTUALLY used, not the CSS stack it was offered
```

---

## 7 · What this document has NOT verified

Stated plainly so nobody trusts it further than it has earned:

- **The Docker image has never been built.** The environment this was written
  in has the Docker CLI but no daemon, and no nginx binary, so neither the
  image nor `nginx.conf` has been run. The Vite build itself **is** verified
  (including with the build-arg env vars, §3), and the paths `nginx.conf`
  serves — `/assets/`, `index.html`, `favicon.svg` — were checked against real
  build output. **Run one build and one `curl` of a deep route
  (`/admin/accounting`) before trusting it.** That single check catches the SPA
  fallback, which is the one thing most likely to be wrong.
- **No ArvanCloud console step is verified.** No account access.
- **The backend half is guidance, not a runbook.** `darzmarket-api` is a
  separate repository and was not open when this was written.
