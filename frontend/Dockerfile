# --- Frontend Next.js — build multi-stage (output: standalone) ---

# Stage 1: dependencias
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Las variables NEXT_PUBLIC_* quedan embebidas en el bundle: van en el build.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_MEDIA_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_MEDIA_URL=$NEXT_PUBLIC_MEDIA_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: runtime
FROM node:22-alpine AS runtime
WORKDIR /app
# HOSTNAME=0.0.0.0: Docker pone el id del contenedor en HOSTNAME y Next
# escucharía solo en esa interfaz.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
