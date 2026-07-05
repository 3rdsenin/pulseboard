FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies in a separate layer so rebuilds are fast when only source changes
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN pnpm --filter api build && pnpm --filter @pulseboard/shared build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copy only the compiled output and production deps — no devDeps, no source
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=deps /app/apps/api/node_modules ./node_modules

EXPOSE 3001
CMD ["node", "dist/server.js"]
