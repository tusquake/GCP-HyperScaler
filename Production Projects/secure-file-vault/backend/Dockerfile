# Production Multi-stage Dockerfile for Backend Cloud Run Deployment
# Stage 1: Install production dependencies
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Production runtime
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copy only production node_modules and source code
COPY --from=builder /app/node_modules ./node_modules
COPY src/ ./src/
COPY package.json ./

EXPOSE 8080

# Run as non-root user for security
USER node

# Health check for container orchestrators
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1

CMD ["node", "src/server.js"]
