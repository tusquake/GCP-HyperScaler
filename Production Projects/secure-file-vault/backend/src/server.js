import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { initDb, query } from './db/connection.js';
import { storage, QUARANTINE_BUCKET } from './config/gcp.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import filesRoutes from './routes/files.routes.js';
import { requestId } from './middleware/requestId.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { requestLogger, logger } from './services/logger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// -------------------------------------------------------------------
// 1. Request ID (must be first -- all downstream middleware uses it)
// -------------------------------------------------------------------
app.use(requestId);

// -------------------------------------------------------------------
// 2. Security Headers (Helmet + custom production headers)
// -------------------------------------------------------------------
// Helmet provides a baseline set of security headers.
// contentSecurityPolicy is handled by our custom securityHeaders middleware
// which sets a stricter policy appropriate for an API-only backend.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(securityHeaders);

// -------------------------------------------------------------------
// 3. CORS -- Strict Origin Whitelist (Fix C1: was origin: '*')
// -------------------------------------------------------------------
// ALLOWED_ORIGINS must be set in production to the frontend Cloud Run URL.
// Example: ALLOWED_ORIGINS=https://vault.example.com,https://frontend-xyz.run.app
// In development, defaults to localhost:3005 (Vite dev server).
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://127.0.0.1:3005', 'http://localhost:3005'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, health checks, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    logger.warn('CORS request blocked', { blockedOrigin: origin, allowedOrigins });
    return callback(new Error('CORS policy: origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Folder-ID', 'X-File-Name'],
  credentials: true,
  maxAge: 600  // Preflight cache: 10 minutes
}));

// -------------------------------------------------------------------
// 4. Body Parsing with Size Limits (Fix H1: was unlimited)
// -------------------------------------------------------------------
// 1MB limit for JSON bodies. Direct file uploads bypass this via streaming.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// -------------------------------------------------------------------
// 5. Structured Request Logging
// -------------------------------------------------------------------
app.use(requestLogger);

// -------------------------------------------------------------------
// 6. Rate Limiters (Fix H9: was single global 300/15min)
// -------------------------------------------------------------------
// Global API rate limiter: 300 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' }
});

// Strict auth rate limiter: 10 login attempts per 15 minutes per IP
// Mitigates brute-force and credential stuffing attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many authentication attempts. Please wait before trying again.' }
});

// Registration rate limiter: 5 registrations per 15 minutes per IP
// Prevents mass account creation / spam
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many registration attempts. Please wait before trying again.' }
});

// Upload session rate limiter: 30 upload URL requests per 15 minutes per IP
// Prevents abuse of GCS signed URL generation
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many upload requests. Please wait before trying again.' }
});

app.use('/api/', globalLimiter);

// -------------------------------------------------------------------
// 7. API Routes
// -------------------------------------------------------------------
// Auth routes with stricter rate limiters on login/register
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth', authRoutes);

app.use('/api/admin', adminRoutes);

// Upload routes with upload-specific rate limiter
app.use('/api/files/generate-upload-url', uploadLimiter);
app.use('/api/files', filesRoutes);

// -------------------------------------------------------------------
// 8. Health & Readiness Probes (Fix M6: was always HEALTHY)
// -------------------------------------------------------------------

/**
 * Liveness probe: /healthz
 * Returns 200 if the process is running.
 * Cloud Run uses this to determine if the container is alive.
 * Does NOT check dependencies -- that's what /ready is for.
 */
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'HEALTHY',
    service: 'secure-file-vault-backend',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

/**
 * Readiness probe: /ready
 * Returns 200 only if all dependencies (Cloud SQL, GCS) are reachable.
 * Cloud Run uses this to determine if the instance should receive traffic.
 * If this fails, the instance is taken out of the load balancer rotation.
 */
app.get('/ready', async (req, res) => {
  const checks = { database: 'UNKNOWN', storage: 'UNKNOWN' };

  try {
    // Check Cloud SQL connectivity
    await query('SELECT 1');
    checks.database = 'CONNECTED';
  } catch (err) {
    checks.database = 'DISCONNECTED';
    logger.error('Readiness check: database connection failed', { error: err.message });
  }

  try {
    // Check GCS bucket accessibility
    const [exists] = await storage.bucket(QUARANTINE_BUCKET).exists();
    checks.storage = exists ? 'CONNECTED' : 'BUCKET_NOT_FOUND';
  } catch (err) {
    checks.storage = 'DISCONNECTED';
    logger.error('Readiness check: storage connection failed', { error: err.message });
  }

  const allHealthy = checks.database === 'CONNECTED' && checks.storage === 'CONNECTED';

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'READY' : 'NOT_READY',
    checks,
    timestamp: new Date().toISOString()
  });
});

// -------------------------------------------------------------------
// 9. Global Error Handler
// -------------------------------------------------------------------
// Fix M2: Never expose internal error details (stack traces, SQL errors)
app.use((err, req, res, next) => {
  // CORS errors from the origin check
  if (err.message && err.message.includes('CORS policy')) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Cross-origin request blocked.' });
  }

  logger.error('Unhandled application error', {
    requestId: req.requestId,
    error: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    route: `${req.method} ${req.path}`
  });

  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' });
});

// -------------------------------------------------------------------
// 10. Start Server
// -------------------------------------------------------------------
app.listen(PORT, async () => {
  logger.info(`Secure Enterprise File Vault Backend starting on port ${PORT}`, {
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    allowedOrigins
  });
  await initDb();
  logger.info('Database initialization complete');
});
