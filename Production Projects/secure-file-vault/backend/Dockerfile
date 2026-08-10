# Production Multi-stage Dockerfile for Cloud Run Deployment
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Production runner stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app ./

EXPOSE 8080
USER node

CMD ["node", "src/server.js"]
