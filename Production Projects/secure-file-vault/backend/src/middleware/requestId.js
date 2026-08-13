import crypto from 'crypto';

/**
 * Request ID Middleware
 * 
 * Generates a unique UUID for every incoming HTTP request and attaches it to:
 * - req.requestId (for downstream middleware and route handlers)
 * - X-Request-ID response header (for client-side correlation)
 * 
 * If the client already sends an X-Request-ID header, it is preserved.
 * This enables end-to-end request tracing across Cloud Run instances,
 * Cloud Logging, and client-side error reporting.
 */
export function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}
