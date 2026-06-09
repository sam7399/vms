# Monorepo-aware Dockerfile for the NestJS API.
# Build from the repo root:  docker build -f apps/api/Dockerfile .

FROM node:20-alpine AS builder
WORKDIR /repo
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/config/package.json ./packages/config/
COPY packages/ui/package.json ./packages/ui/
RUN npm ci

COPY . .
RUN cd packages/database && npx prisma generate
RUN cd apps/api && npm run build

FROM node:20-alpine
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=builder /repo/package.json /repo/package-lock.json ./
COPY --from=builder /repo/apps/api/package.json ./apps/api/
COPY --from=builder /repo/packages/database ./packages/database
RUN npm ci --omit=dev
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
# Ship operational scripts (seed, wipe) alongside the runtime so the
# client can run them via `docker compose exec api node /repo/scripts/...`.
COPY --from=builder /repo/scripts ./scripts
COPY --from=builder /repo/railway.json ./railway.json
EXPOSE 4000
WORKDIR /repo/apps/api
CMD ["node", "dist/main.js"]
