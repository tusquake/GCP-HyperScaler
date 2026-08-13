# Production Multi-stage Dockerfile for Frontend Cloud Run Deployment
# Serves React SPA as static files via Nginx

# Stage 1: Build React SPA with Vite
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .

# Build-time env var: backend API URL
# This is PUBLIC (bundled into JavaScript) -- only use for API base URL.
# NEVER put secrets, database passwords, or private keys here.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# Stage 2: Serve static files with Nginx
FROM nginx:1.27-alpine AS runner

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built SPA assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Cloud Run expects port 8080
EXPOSE 8080

# Run Nginx in foreground (required for containers)
CMD ["nginx", "-g", "daemon off;"]
