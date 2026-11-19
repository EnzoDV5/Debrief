# API image. Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:24-slim

WORKDIR /app

# Install dependencies first (only package files copied) so Docker can cache this layer
# and skip `npm ci` when only source code changed. Every workspace's package.json is needed
# because the shared lockfile references all of them.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @debrief/api -w @debrief/shared --no-fund --no-audit

# Each workspace tsconfig extends the root one, and tsx reads it while running TS.
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3000

# Don't run as root inside the container.
USER node

# 1. Apply pending database migrations (a no-op when up to date), then
# 2. start the server. TypeScript runs through tsx's loader (no build step yet), and `exec`
#    makes node PID 1, so SIGTERM from `docker stop` reaches the shutdown handler in server.ts.
CMD ["sh", "-c", "node --import tsx src/db/migrate.ts && exec node --import tsx src/server.ts"]
