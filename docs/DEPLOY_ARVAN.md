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

## 1 · Scope — frontend only, for now

**Owner's decision, 2026-09-22: the frontend moves; the backend does not.**

| | What it is | In scope? |
| --- | --- | --- |
| **Frontend** — this repo | A static SPA. `npm run build` → `dist/`, a folder of files. No server-side runtime at all. | **Yes.** Low risk, reversible in seconds. |
| **Backend** — `darzmarket-api` | Django/DRF + PostgreSQL + object storage + **WebSockets** (daphne serves HTTP and WS on one port). | **No.** §4 is kept as guidance for when it is. |

**Be clear-eyed about what a frontend-only move buys, and what it does not.**
`darzmarket-api` is not deployed *anywhere* today — `.env.production` points at
`https://api.invalid/api`, a reserved address that can never resolve, on
purpose (frontend Phase 14 is still waiting on the API's own Phase 18). So the
ArvanCloud deployment will be the same **visual-only** build as the Vercel one:

- **Real:** every screen, the layout, the chrome, routing, both themes, deep
  links, and now the brand fonts, served from inside Iran with no foreign
  origin on the critical path.
- **Not real:** sign-in, and all data. Every API call fails immediately and
  visibly, which is the designed behaviour rather than a bug to chase.

That is a perfectly good reason to do it — it is how the UI gets reviewed on a
real device at real latency — as long as nobody expects to log in.

**The two are coupled in one direction, and it matters later:** the frontend
has the backend's URL *compiled into it* (§3). So whenever the backend does get
a home, the frontend must be **rebuilt**, not reconfigured. Moving the frontend
does not touch the backend.

**One thing to decide before the backend lands anywhere.** If the frontend is
served from Iran and the API ends up on a foreign host, the blocked foreign
origin problem simply moves: it stops being the fonts and becomes every single
API call — which is worse, because that is the data path and it cannot be
self-hosted away. Putting the API in Iran too is the decision that makes this
migration coherent; a split leaves the app slower and more fragile than it is
on Vercel today.

---

## 2 · Frontend — three ways, in order of preference

### a) Container (recommended)

The repo carries a `Dockerfile` and `nginx.conf`. Multi-stage: node builds,
nginx serves. Runs on an ArvanCloud VM with Docker, or on their container /
Kubernetes platform. **Built and run end to end on 2026-09-22 — see §7.**

```bash
docker build \
  --build-arg VITE_API_BASE_URL=https://api.yourdomain.ir/api \
  --build-arg VITE_API_WS_URL=wss://api.yourdomain.ir \
  --build-arg VITE_FEATURE_SET=v0.1 \
  -t darz-web:latest .

docker run -d -p 8080:8080 --name darz-web --restart unless-stopped darz-web:latest
```

It listens on **8080** and runs as the `nginx` user — verified: the master
process is `nginx`, and the container reports `(healthy)` from its own
healthcheck. So it needs no privileged port and works on platforms that forbid
root. Final image: **80.9 MB**.

The one command worth running after any change to either file:

```bash
curl -I http://localhost:8080/admin/accounting   # 200 — the SPA fallback
curl -I http://localhost:8080/assets/nope.js     # 404 — and assets still 404
```

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

## 4 · Backend — NOT in this migration (kept for when it is)

> Out of scope per §1. Nothing below needs doing now. It is kept because the
> frontend rebuild in §3 is triggered by exactly this work, and because the
> WebSocket note is the one thing most likely to be missed when it happens.

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

## 7 · What has been verified, and what has not

Updated 2026-09-22, after actually building and running the image. The
container and the nginx config are no longer "written but untested" — and
running them found **three real bugs** that `nginx -t` and a code review had
both passed.

### Verified, by running it

- **The image builds.** `docker build` through the multi-stage Dockerfile,
  with the build args. 80.9 MB final image.
- **It starts and stays up**, reporting `(healthy)` from its own HEALTHCHECK,
  with the nginx **master process running as `nginx`**, not root.
- **The SPA fallback works.** `/`, `/admin/accounting`, `/artwork/<id>` and
  `/records/artist/<id>` all return **200** on a direct request — no click-path
  needed, which is the case that breaks.
- **A missing asset still 404s.** `/assets/nope.js` → 404, not a fallback to
  `index.html`. Both halves matter: routes fall through, assets do not.
- **Cache headers.** `index.html` → `no-cache, must-revalidate`; hashed assets
  → `public, max-age=31536000, immutable`.
- **Security headers** on every response — the document, deep routes, and
  assets.
- **gzip.** The JS bundle goes 928 KB → 245 KB. woff2 is correctly left alone.
- **Content types.** `application/javascript`, `text/css`, `font/woff2`,
  `image/svg+xml`.
- **The app actually runs through it**: loaded `/admin/login` directly (the
  fallback path), signed in, opened the Market Sales desk, headings rendering
  in **Cormorant Garamond** from the self-hosted fonts, **zero JS errors**.

### The three bugs that only running it could find

1. **`listen [::]:8080;` crashed nginx on any host without IPv6.** Not a
   warning — `socket() [::]:8080 failed (97: Address family not supported by
   protocol)` and the process refuses to start. `nginx -t` passes. Now IPv4
   only, which is also what the official nginx image's own default config
   does.
2. **Every security header was silently absent from every response.**
   nginx's `add_header` **replaces rather than merges**: a location declaring
   any `add_header` of its own discards all of them from the enclosing block.
   Both cache-control locations did, so `X-Content-Type-Options`,
   `Referrer-Policy` and `X-Frame-Options` shipped nowhere — including on
   deep routes, which `try_files` redirects internally into
   `location = /index.html`. The config read as completely correct. They are
   now repeated in all three places, with a note saying why.
3. **`USER nginx` killed the container at boot.** The stock nginx image runs
   its master as root, so its writable paths are root-owned; as `nginx` it
   dies with `mkdir() "/var/cache/nginx/client_temp" failed (13: Permission
   denied)` seconds after `docker run` — a crash loop with no obvious cause on
   a platform that restarts on failure. This file previously *asserted* those
   paths were world-writable. They are not. The image now chowns the cache
   tree and the pid file.

### Still not verified

- **No ArvanCloud console step.** No account access from here. Their product
  names and menus change; check the current documentation.
- **The backend half (§4) is guidance, not a runbook** — and out of scope per
  §1 anyway. `darzmarket-api` is a separate repository.
- **TLS, DNS and the CDN in front** are deployment-time concerns this image
  knows nothing about; it serves plain HTTP on 8080 and expects something in
  front of it.

> **A note on building this image behind a corporate or filtering proxy.**
> The build was done in a sandbox whose egress proxy uses a private CA, which
> made `npm ci` fail inside the container with a TLS verification error
> (`Exit handler never called!` is npm's unhelpful surface for it) even though
> the host could reach the registry. If you hit that, the fix is to trust your
> proxy's CA in the **build stage only** — `COPY` it into
> `/usr/local/share/ca-certificates/`, append it to
> `/etc/ssl/certs/ca-certificates.crt` and set `NODE_EXTRA_CA_CERTS`. It is
> deliberately **not** in the committed Dockerfile: a normal host needs none
> of it, and baking someone's private CA into a published image is a bad
> habit.
