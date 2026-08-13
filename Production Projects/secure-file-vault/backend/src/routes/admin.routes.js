import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../db/connection.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { logger } from '../services/logger.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

// -------------------------------------------------------------------
// Input Validation Helpers
// -------------------------------------------------------------------

/**
 * Validate folder path: reject path traversal, absolute paths, special characters.
 * Only allows lowercase alphanumeric and hyphens.
 */
function sanitizeFolderPath(rawPath) {
  if (!rawPath) return null;
  // Reject path traversal attempts
  if (rawPath.includes('..') || rawPath.includes('/') || rawPath.includes('\\')) {
    return null;
  }
  // Only allow lowercase alphanumeric and hyphens
  const safe = rawPath.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return safe || null;
}

// -------------------------------------------------------------------
// GET /users -- Fetch all users with assigned folder permissions
// -------------------------------------------------------------------
router.get('/users', async (req, res) => {
  try {
    const usersResult = await query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
    const permsResult = await query('SELECT user_id, folder_id, can_upload, can_read FROM user_folder_permissions');

    const users = usersResult.rows.map(user => ({
      ...user,
      assigned_folders: permsResult.rows
        .filter(p => p.user_id === user.id)
        .map(p => ({
          folder_id: p.folder_id,
          can_upload: p.can_upload,
          can_read: p.can_read
        }))
    }));

    res.json(users);
  } catch (error) {
    logger.error('Error fetching users', { error: error.message, requestId: req.requestId });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch user directory.' });
  }
});

// -------------------------------------------------------------------
// POST /users -- Create new user with granular folder permissions
// -------------------------------------------------------------------
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, folder_permissions } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Name, email, and password are required.' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid email format.' });
    }

    // Password policy (same as registration)
    if (password.length < 8 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters with uppercase, lowercase, and a digit.' });
    }

    const existing = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'DUPLICATE', message: 'A user with this email address already exists.' });
    }

    const userId = crypto.randomUUID();
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    const userRole = 'USER';

    await query(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
      [userId, name, email, passwordHash, userRole]
    );

    // Assign granular folder permissions (Read & Upload independently)
    if (folder_permissions && Array.isArray(folder_permissions)) {
      for (const perm of folder_permissions) {
        if (perm.can_read || perm.can_upload) {
          await query(
            `INSERT INTO user_folder_permissions (user_id, folder_id, can_upload, can_read)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, folder_id) 
             DO UPDATE SET can_upload = EXCLUDED.can_upload, can_read = EXCLUDED.can_read`,
            [userId, perm.folder_id, perm.can_upload ? true : false, perm.can_read ? true : false]
          );
        }
      }
    }

    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, ip_address, user_agent, request_id, resource_type, resource_id, result) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        crypto.randomUUID(), req.user.id, 'USER_CREATED',
        `Created user account ${email}`,
        req.ip, req.headers['user-agent'], req.requestId,
        'user', userId, 'SUCCESS'
      ]
    );

    logger.info('User created by admin', { adminId: req.user.id, createdUserId: userId, requestId: req.requestId });

    res.status(201).json({
      id: userId,
      name,
      email,
      role: userRole,
      assigned_folders: folder_permissions || []
    });

  } catch (error) {
    logger.error('Error creating user', { error: error.message, requestId: req.requestId });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create user.' });
  }
});

// -------------------------------------------------------------------
// POST /permissions -- Update folder permissions for a user
// -------------------------------------------------------------------
router.post('/permissions', async (req, res) => {
  try {
    const { user_id, folder_permissions } = req.body;

    if (!user_id || !Array.isArray(folder_permissions)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'user_id and folder_permissions array are required.' });
    }

    // Verify user exists
    const userResult = await query('SELECT id FROM users WHERE id = $1', [user_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }

    // Delete previous permissions for this user
    await query('DELETE FROM user_folder_permissions WHERE user_id = $1', [user_id]);

    // Insert updated permissions
    for (const perm of folder_permissions) {
      if (perm.can_read || perm.can_upload) {
        await query(
          `INSERT INTO user_folder_permissions (user_id, folder_id, can_upload, can_read)
           VALUES ($1, $2, $3, $4)`,
          [user_id, perm.folder_id, perm.can_upload ? true : false, perm.can_read ? true : false]
        );
      }
    }

    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, ip_address, user_agent, request_id, resource_type, resource_id, result) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        crypto.randomUUID(), req.user.id, 'FOLDER_PERMISSION_CHANGED',
        `Updated permissions for user ${user_id} (${folder_permissions.length} folders)`,
        req.ip, req.headers['user-agent'], req.requestId,
        'user', user_id, 'SUCCESS'
      ]
    );

    logger.info('Permissions updated', { adminId: req.user.id, targetUserId: user_id, requestId: req.requestId });

    res.json({ message: 'Permissions updated successfully.' });
  } catch (error) {
    logger.error('Error updating permissions', { error: error.message, requestId: req.requestId });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update folder permissions.' });
  }
});

// -------------------------------------------------------------------
// GET /folders -- List all system folders
// -------------------------------------------------------------------
router.get('/folders', async (req, res) => {
  try {
    const result = await query('SELECT * FROM folders ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching folders', { error: error.message, requestId: req.requestId });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch folders.' });
  }
});

// -------------------------------------------------------------------
// POST /folders -- Create new folder
// -------------------------------------------------------------------
router.post('/folders', async (req, res) => {
  try {
    const { name, path } = req.body;
    if (!name || !path) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Folder name and path are required.' });
    }

    // Validate and sanitize folder path
    const safePath = sanitizeFolderPath(path);
    if (!safePath) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Folder path must contain only lowercase letters, numbers, and hyphens. Path traversal is not allowed.'
      });
    }

    // Check for duplicate path
    const existingPath = await query('SELECT id FROM folders WHERE path = $1', [safePath]);
    if (existingPath.rows.length > 0) {
      return res.status(400).json({ error: 'DUPLICATE', message: 'A folder with this path already exists.' });
    }

    const folderId = crypto.randomUUID();

    await query(
      'INSERT INTO folders (id, name, path) VALUES ($1, $2, $3)',
      [folderId, name, safePath]
    );

    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, ip_address, user_agent, request_id, resource_type, resource_id, result) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        crypto.randomUUID(), req.user.id, 'FOLDER_CREATED',
        `Created folder ${name} (${safePath})`,
        req.ip, req.headers['user-agent'], req.requestId,
        'folder', folderId, 'SUCCESS'
      ]
    );

    logger.info('Folder created', { adminId: req.user.id, folderId, folderPath: safePath, requestId: req.requestId });

    res.status(201).json({ id: folderId, name, path: safePath });
  } catch (error) {
    logger.error('Error creating folder', { error: error.message, requestId: req.requestId });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create folder.' });
  }
});

// -------------------------------------------------------------------
// GET /audit-logs -- Fetch system audit logs
// -------------------------------------------------------------------
router.get('/audit-logs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const result = await query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1', [limit]);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching audit logs', { error: error.message, requestId: req.requestId });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch audit logs.' });
  }
});

export default router;
