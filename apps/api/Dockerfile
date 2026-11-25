# syntax=docker/dockerfile:1
#
# Build from the REPOSITORY ROOT (the workspace needs packages/shared):
#   docker build -f apps/api/Dockerfile -t bomba-certa-api .

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# pnpm version comes from the "packageManager" field in package.json
RUN corepack enable
# Prisma's engines need OpenSSL
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

# ---------- build ----------
FROM base AS build
# Manifests only: this layer is cached until a dependency changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter "@bomba-certa/api..."

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @bomba-certa/shared build \
  && pnpm --filter @bomba-certa/api exec prisma generate \
  && pnpm --filter @bomba-certa/api build

# A self-contained folder with only production dependencies (shared is copied in, not linked).
RUN pnpm --filter @bomba-certa/api deploy --prod --legacy /out \
  && cd /out && node_modules/.bin/prisma generate

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000

# 1) Apply pending migrations over the DIRECT connection when DIRECT_URL is set (a pooled
#    connection such as Neon's PgBouncer cannot run migrations), otherwise DATABASE_URL.
# 2) `exec` makes node PID 1's replacement so SIGTERM reaches Nest's shutdown hooks.
CMD ["sh", "-c", "DATABASE_URL=\"${DIRECT_URL:-$DATABASE_URL}\" node_modules/.bin/prisma migrate deploy && exec node dist/main.js"]
