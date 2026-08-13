import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logger } from '../services/logger.js';

// -------------------------------------------------------------------
// JWT Secret Configuration
// -------------------------------------------------------------------
// In production, JWT_SECRET must be set via Secret Manager or env var.
// The fallback generates a random key per process start, which means
// tokens are invalidated on restart. This is intentional for development
// but must be replaced with a persistent secret in production.

export const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// JWT configuration constants
export const JWT_ACCESS_EXPIRY = '1h';    // Fix H3: reduced from 8h to 1h
export const JWT_REFRESH_EXPIRY = '7d';   // Refresh tokens valid for 7 days
export const JWT_ISSUER = 'secure-file-vault';
export const JWT_AUDIENCE = 'secure-file-vault-api';

/**
 * Generate a JWT access token with issuer and audience claims.
 * 
 * @param {Object} payload - Token payload (id, name, email, role)
 * @returns {string} Signed JWT access token
 */
export function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_ACCESS_EXPIRY,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  });
}

/**
 * Generate a JWT refresh token.
 * Contains only the user ID to minimize data exposure.
 * 
 * @param {string} userId - User ID
 * @returns {string} Signed JWT refresh token
 */
export function generateRefreshToken(userId) {
  return jwt.sign({ id: userId, type: 'refresh' }, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRY,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE
  });
}

/**
 * Express middleware to authenticate JWT access token from Authorization header.
 * 
 * Validates:
 * - Token presence in Authorization: Bearer <token>
 * - Token signature
 * - Token expiry
 * - Issuer claim (must be 'secure-file-vault')
 * - Audience claim (must be 'secure-file-vault-api')
 * - Token type is NOT a refresh token (refresh tokens cannot be used for API access)
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Access token required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });

    // Prevent refresh tokens from being used as access tokens
    if (decoded.type === 'refresh') {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Refresh tokens cannot be used for API access.' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'Access token has expired. Please refresh.' });
    }
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Invalid access token.' });
  }
}

/**
 * Express middleware to require ADMIN role.
 * Must be used after authenticateToken.
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    logger.warn('Admin access denied', {
      userId: req.user?.id,
      route: `${req.method} ${req.path}`,
      requestId: req.requestId
    });
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Administrator privileges required.' });
  }
  next();
}
