import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../db/connection.js';
import {
  JWT_SECRET,
  JWT_ISSUER,
  JWT_AUDIENCE,
  authenticateToken,
  generateAccessToken,
  generateRefreshToken
} from '../middleware/auth.js';
import { logger } from '../services/logger.js';

const router = express.Router();

// -------------------------------------------------------------------
// Password Policy (Fix H4: was only checking truthy)
// -------------------------------------------------------------------
// Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 digit.
// Does NOT enforce special characters (NIST 800-63B recommends against
// overly complex password composition rules).

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

function validatePassword(password) {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return 'Password must be at least 8 characters long.';
  }
  if (!PASSWORD_REGEX.test(password)) {
    return 'Password must contain at least one uppercase letter, one lowercase letter, and one digit.';
  }
  return null;
}

// -------------------------------------------------------------------
// User Registration
// -------------------------------------------------------------------
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Name, email, and password are required.' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid email format.' });
    }

    // Enforce password policy
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: passwordError });
    }

    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length > 0) {
      // Fix M8: Generic error message to prevent account enumeration
      // Attacker cannot determine if an email is registered by observing different error messages.
      return res.status(400).json({ error: 'REGISTRATION_FAILED', message: 'Registration could not be completed. Please try again or contact support.' });
    }

    // Fix H6: Use crypto.randomUUID() instead of predictable Date.now() IDs
    const userId = crypto.randomUUID();
    const salt = await bcrypt.genSalt(12); // Increased from 10 to 12 rounds
    const passwordHash = await bcrypt.hash(password, salt);

    // Designated System Administrator email auto-promotion
    const isAdmin = email.toLowerCase() === 'tushar.seth@cloudkaptan.com';
    const userRole = isAdmin ? 'ADMIN' : 'USER';

    await query(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
      [userId, name, email, passwordHash, userRole]
    );

    // Audit log
    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, ip_address, user_agent, request_id, resource_type, resource_id, result) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        crypto.randomUUID(), userId, 'USER_REGISTERED',
        `Registered account (Role: ${userRole})`,
        req.ip, req.headers['user-agent'], req.requestId,
        'user', userId, 'SUCCESS'
      ]
    );

    // Generate tokens
    const tokenPayload = { id: userId, name, email, role: userRole };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(userId);

    logger.info('User registered', { userId, role: userRole, requestId: req.requestId });

    return res.status(201).json({
      token: accessToken,
      refreshToken,
      user: { id: userId, name, email, role: userRole }
    });

  } catch (error) {
    logger.error('Registration error', { error: error.message, requestId: req.requestId });
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Registration failed. Please try again.' });
  }
});

// -------------------------------------------------------------------
// User Login
// -------------------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Email and password are required.' });
    }

    const result = await query('SELECT id, name, email, password_hash, role FROM users WHERE LOWER(email) = LOWER($1)', [email]);

    if (result.rows.length === 0) {
      // Audit failed login attempt
      await query(
        'INSERT INTO audit_logs (id, user_id, action, details, ip_address, user_agent, request_id, result) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [crypto.randomUUID(), null, 'AUTH_LOGIN_FAILED', 'Unknown email', req.ip, req.headers['user-agent'], req.requestId, 'FAILURE']
      );
      // Generic error message prevents account enumeration (Fix M8)
      return res.status(401).json({ error: 'AUTH_FAILED', message: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      // Audit failed login attempt with user context
      await query(
        'INSERT INTO audit_logs (id, user_id, action, details, ip_address, user_agent, request_id, resource_type, resource_id, result) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [crypto.randomUUID(), user.id, 'AUTH_LOGIN_FAILED', 'Invalid password', req.ip, req.headers['user-agent'], req.requestId, 'user', user.id, 'FAILURE']
      );
      return res.status(401).json({ error: 'AUTH_FAILED', message: 'Invalid email or password.' });
    }

    // Generate tokens
    const tokenPayload = { id: user.id, name: user.name, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(user.id);

    // Audit successful login
    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, ip_address, user_agent, request_id, resource_type, resource_id, result) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [crypto.randomUUID(), user.id, 'AUTH_LOGIN', 'Successful login', req.ip, req.headers['user-agent'], req.requestId, 'user', user.id, 'SUCCESS']
    );

    logger.info('User logged in', { userId: user.id, role: user.role, requestId: req.requestId });

    return res.json({
      token: accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });

  } catch (error) {
    logger.error('Login error', { error: error.message, requestId: req.requestId });
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Authentication failed. Please try again.' });
  }
});

// -------------------------------------------------------------------
// Refresh Token
// -------------------------------------------------------------------
// Allows clients to get a new access token without re-entering credentials.
// The refresh token has a longer lifetime (7 days) and can only be used
// to generate new access tokens, not to access API endpoints directly.

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Refresh token is required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE
      });
    } catch (err) {
      return res.status(401).json({ error: 'TOKEN_INVALID', message: 'Invalid or expired refresh token.' });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'TOKEN_INVALID', message: 'Invalid token type.' });
    }

    // Look up the user to ensure they still exist and get current role
    const result = await query('SELECT id, name, email, role FROM users WHERE id = $1', [decoded.id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'TOKEN_INVALID', message: 'User no longer exists.' });
    }

    const user = result.rows[0];
    const tokenPayload = { id: user.id, name: user.name, email: user.email, role: user.role };
    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(user.id);

    logger.info('Token refreshed', { userId: user.id, requestId: req.requestId });

    return res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken
    });

  } catch (error) {
    logger.error('Token refresh error', { error: error.message, requestId: req.requestId });
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Token refresh failed.' });
  }
});

// -------------------------------------------------------------------
// Fetch current user details
// -------------------------------------------------------------------
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT id, name, email, role, created_at FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User record not found.' });
    }
    res.json({ user: result.rows[0] });
  } catch (error) {
    logger.error('Profile fetch error', { error: error.message, userId: req.user?.id, requestId: req.requestId });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve profile.' });
  }
});

export default router;
