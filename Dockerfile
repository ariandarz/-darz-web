# Darz Market Web — production image.
#
# Written for the ArvanCloud migration (`docs/DEPLOY_ARVAN.md`), but there is
# nothing provider-specific in it: it builds the SPA and serves it with nginx,
# so it runs on any container host, and `docker run -p 8080:8080` reproduces
# production locally.
#
# ── The one thing to understand before using this ────────────────────────────
#
# **Vite bakes `VITE_*` into the JavaScript at BUILD time.** They are not read
# at runtime, so setting them with `docker run -e` or in a platform's
# "environment variables" panel does NOTHING — the bundle was already written.
# They are `ARG`s here for exactly that reason, and pointing the app at a new
# backend means **rebuilding the image**, not restarting it.
#
# `src/api/index.ts::resolveBaseUrl()` throws when `VITE_API_BASE_URL` is
# unset, and the API client is constructed at module load — so a forgotten
# build-arg is a blank white page, not a warning. Hence the guard in the build
# stage: fail here, loudly, rather than ship a broken bundle.
#
#   docker build \
#     --build-arg VITE_API_BASE_URL=https://api.example.ir/api \
#     --build-arg VITE_API_WS_URL=wss://api.example.ir \
#     --build-arg VITE_FEATURE_SET=v0.1 \
#     -t darz-web .

# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Dependencies first, so a source-only change does not reinstall them.
# `npm ci` and not `npm install`: the lockfile is the input.
COPY package.json package-lock.json ./
RUN npm ci

ARG VITE_API_BASE_URL
ARG VITE_API_WS_URL
ARG VITE_FEATURE_SET=v0.1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_API_WS_URL=$VITE_API_WS_URL \
    VITE_FEATURE_SET=$VITE_FEATURE_SET

# Fail the build rather than the browser. Both are required and neither has a
# fallback in code, by design (CLAUDE.md, "Env config").
RUN test -n "$VITE_API_BASE_URL" || (echo "ERROR: --build-arg VITE_API_BASE_URL is required (include the /api suffix)" >&2; exit 1) && \
    test -n "$VITE_API_WS_URL"  || (echo "ERROR: --build-arg VITE_API_WS_URL is required (no /api, no trailing slash)" >&2; exit 1)

COPY . .
# `npm run build` is `tsc -b && vite build` — a type error stops the image.
RUN npm run build

# ── Stage 2: serve ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS serve

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# 8080, not 80: unprivileged, so the container can run as a non-root user on
# hosts that require it (most managed container platforms do).
EXPOSE 8080

# **`USER nginx` alone does NOT work, and fails at boot rather than at build.**
# The stock nginx image runs its master as root and drops privileges for the
# workers, so its writable paths are root-owned. Run the master as `nginx` and
# it dies immediately with
#   [emerg] mkdir() "/var/cache/nginx/client_temp" failed (13: Permission denied)
# — an exit code 1 a couple of seconds after `docker run`, which on a platform
# with restart-on-failure looks like a crash loop with no obvious cause.
#
# An earlier version of this file asserted these paths were "already
# world-writable, so this needs no extra chown". They are not. Found
# 2026-09-22 by actually running the image.
#
# So hand the nginx user what the master needs: the cache tree it creates its
# temp dirs under, and the pid file. (`nginxinc/nginx-unprivileged` is the
# published image that does exactly this; the four lines are cheaper than a
# second base image to track.)
RUN mkdir -p /var/cache/nginx/client_temp \
 && chown -R nginx:nginx /var/cache/nginx \
 && touch /var/run/nginx.pid \
 && chown nginx:nginx /var/run/nginx.pid

USER nginx

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
