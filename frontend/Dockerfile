# ─── Stage 1: Build the React SPA with Bun ──────────────────────────
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for caching
COPY frontend/package.json frontend/bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile || bun install

# Copy source code
COPY frontend/ .

# Build with Vite (VITE_API_BASE_URL is baked at build time)
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN bun run build

# ─── Stage 2: Serve static files with Nginx ────────────────────────
FROM nginx:1.27-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
