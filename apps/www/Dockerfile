# syntax=docker/dockerfile:1.6

FROM --platform=$BUILDPLATFORM ghcr.io/nubjs/nub:0.6.0-alpine AS base

# Stage 1: Install dependencies
FROM base AS deps
COPY --chown=node:node .node-version package.json pnpm-lock.yaml ./
COPY --chown=node:node apps/www/package.json ./apps/www/package.json
COPY --chown=node:node packages/jsoncrack-react/package.json ./packages/jsoncrack-react/package.json
RUN nub ci

# Stage 2: Build the static export
FROM base AS builder
ARG SITE_URL=https://jsoncrack.com
ENV SITE_URL=$SITE_URL
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=deps --chown=node:node /app/apps/www/node_modules ./apps/www/node_modules
COPY --from=deps --chown=node:node /app/packages/jsoncrack-react/node_modules ./packages/jsoncrack-react/node_modules
COPY --chown=node:node . .
RUN nub run build

# Stage 3: Production image
FROM dhi.io/nginx:1.31.3-alpine AS production
COPY --from=builder --chown=65532:65532 /app/apps/www/out /app
COPY apps/www/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO /dev/null http://localhost:8080/ || exit 1
