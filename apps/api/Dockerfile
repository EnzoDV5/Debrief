FROM node:26-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @debrief/api -w @debrief/shared --no-fund --no-audit

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3000

USER node

CMD ["sh", "-c", "node --import tsx src/db/migrate.ts && exec node --import tsx src/server.ts"]
