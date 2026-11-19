# Web image. Build from the repo root: docker build -f apps/web/Dockerfile .

# Stage 1: build the static site with Vite.
FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci -w @debrief/web -w @debrief/shared --no-fund --no-audit

# Each workspace tsconfig extends the root one, and Vite reads it while transforming TS.
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @debrief/web

# Stage 2: serve the built files with nginx. The final image has no Node or source code,
# just HTML/JS/CSS plus the nginx config.
FROM nginx:stable-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
