# Frontend image — Next.js standalone server (SPEC §13, Task 20).
# NEXT_PUBLIC_* values are inlined into the client bundle at BUILD time, so
# the Google client id must arrive as a build arg (it is public, not secret).

FROM node:22-alpine AS deps

WORKDIR /app

# corepack reads "packageManager" from package.json and pins pnpm's version.
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile


FROM node:22-alpine AS builder

ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build


FROM node:22-alpine

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Standalone output ships its own pruned node_modules and server.js; static
# assets and /public are not included and must be copied alongside.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node

EXPOSE 3000

CMD ["node", "server.js"]
