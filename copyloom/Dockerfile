# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Copyloom container image.
#
# Three stages so that the runtime layer contains no source, no build cache and
# no dev dependencies. Next.js `output: "standalone"` (see next.config.ts) traces
# the exact node_modules the server needs and emits them next to a generated
# server.js, which is what makes the final image small enough for fast Cloud Run
# cold starts.
# ---------------------------------------------------------------------------

# --- Stage 1: dependencies -------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# Only the manifests, so this layer is cached until dependencies actually change.
COPY package.json package-lock.json ./
RUN npm ci


# --- Stage 2: build --------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# No secrets are needed here: src/lib/env.ts reads every variable lazily at
# request time, so the build succeeds without production configuration.
RUN npm run build


# --- Stage 3: runtime ------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0

# Dedicated unprivileged user. node:22-alpine ships a `node` user at uid 1000,
# so pick free ids for ours.
# busybox short flags, which alpine's adduser/addgroup always support.
RUN addgroup -S -g 1001 nodejs \
 && adduser  -S -u 1001 -G nodejs nextjs

# `.next/standalone` already contains server.js at its root plus the traced
# node_modules, so it is copied to /app directly (not to /app/.next/standalone).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets are deliberately NOT part of standalone output; copy them in.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 8080

CMD ["node", "server.js"]
