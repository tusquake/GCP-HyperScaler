/**
 * Structured JSON Logger for Google Cloud Logging
 * 
 * Emits structured JSON log entries compatible with Cloud Logging's
 * LogEntry format. When running on Cloud Run, Cloud Logging automatically
 * parses JSON stdout and extracts structured fields for indexing.
 * 
 * Log fields:
 * - severity: DEBUG | INFO | WARNING | ERROR | CRITICAL (Cloud Logging severity levels)
 * - message: Human-readable log message
 * - timestamp: ISO 8601 timestamp
 * - requestId: Correlation ID from X-Request-ID header
 * - userId: Authenticated user ID (never logs email/password)
 * - action: Application action (e.g., FILE_UPLOAD_COMPLETED, AUTH_LOGIN_FAILED)
 * - resourceType: Type of resource (e.g., 'file', 'folder', 'user')
 * - resourceId: ID of the affected resource
 * - ipAddress: Client IP address
 * - userAgent: Client user-agent string
 * - route: HTTP method + path
 * - statusCode: HTTP response status code
 * - durationMs: Request duration in milliseconds
 * - error: Error message (only for ERROR/CRITICAL)
 * 
 * Security: NEVER logs passwords, tokens, signed URLs, or secret values.
 */

const SEVERITY_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

/**
 * Emit a structured log entry to stdout (captured by Cloud Logging).
 * 
 * @param {string} severity - Log severity level
 * @param {string} message - Human-readable message
 * @param {Object} [fields={}] - Additional structured fields
 */
export function log(severity, message, fields = {}) {
  const entry = {
    severity: SEVERITY_LEVELS[severity] || 'INFO',
    message,
    timestamp: new Date().toISOString(),
    ...fields
  };

  // Remove undefined/null fields to keep logs clean
  Object.keys(entry).forEach(key => {
    if (entry[key] === undefined || entry[key] === null) {
      delete entry[key];
    }
  });

  const output = JSON.stringify(entry);

  if (severity === 'ERROR' || severity === 'CRITICAL') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

/**
 * Convenience methods for each severity level.
 */
export const logger = {
  debug: (message, fields) => log('DEBUG', message, fields),
  info: (message, fields) => log('INFO', message, fields),
  warn: (message, fields) => log('WARNING', message, fields),
  error: (message, fields) => log('ERROR', message, fields),
  critical: (message, fields) => log('CRITICAL', message, fields)
};

/**
 * Express middleware that logs every HTTP request/response.
 * 
 * Attaches to the response 'finish' event to capture status code and duration.
 * Skips logging for health check endpoints to reduce noise.
 */
export function requestLogger(req, res, next) {
  const startTime = Date.now();

  // Skip logging for health/readiness probes to reduce log volume
  if (req.path === '/healthz' || req.path === '/ready') {
    return next();
  }

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const severity = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARNING' : 'INFO';

    log(severity, `${req.method} ${req.path} ${res.statusCode}`, {
      requestId: req.requestId,
      route: `${req.method} ${req.path}`,
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  });

  next();
}

/**
 * Log an audit event (business-level action).
 * 
 * Use this for security-relevant actions like login, file upload, permission changes.
 * Unlike request logging, audit logs capture the semantic meaning of what happened.
 * 
 * @param {Object} event - Audit event details
 * @param {string} event.action - Action name (e.g., AUTH_LOGIN, FILE_UPLOAD_COMPLETED)
 * @param {string} [event.userId] - Actor's user ID
 * @param {string} [event.resourceType] - Type of resource affected
 * @param {string} [event.resourceId] - ID of resource affected
 * @param {string} [event.result] - Result (SUCCESS, FAILURE, DENIED)
 * @param {string} [event.details] - Additional context
 * @param {string} [event.requestId] - Correlation ID
 * @param {string} [event.ipAddress] - Client IP
 * @param {string} [event.userAgent] - Client user-agent
 */
export function auditLog(event) {
  log('INFO', `[AUDIT] ${event.action}`, {
    audit: true,
    action: event.action,
    userId: event.userId,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    result: event.result || 'SUCCESS',
    details: event.details,
    requestId: event.requestId,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent
  });
}
