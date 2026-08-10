import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/connection.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);
router.use(requireAdmin);

// Fetch all users with their assigned folder permissions
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
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Database error fetching user directory' });
  }
});

// Create new normal user (Role enforced as USER; no admin selection/signup)
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, folder_ids } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'A user with this email address already exists' });
    }

    const userId = `usr_${Date.now()}`;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Enforce normal USER role
    const userRole = 'USER';

    await query(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)',
      [userId, name, email, passwordHash, userRole]
    );

    // Assign folder permissions if specified
    if (folder_ids && Array.isArray(folder_ids)) {
      for (const folderId of folder_ids) {
        await query(
          'INSERT INTO user_folder_permissions (user_id, folder_id, can_upload, can_read) VALUES ($1, $2, TRUE, TRUE) ON CONFLICT DO NOTHING',
          [userId, folderId]
        );
      }
    }

    // Audit log
    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [`log_${Date.now()}`, req.user.id, 'USER_CREATED', `Created user account ${email}`, req.ip || '10.0.1.2']
    );

    res.status(201).json({
      id: userId,
      name,
      email,
      role: userRole,
      assigned_folders: folder_ids || []
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user in database' });
  }
});

// Update folder permissions for a user
router.post('/permissions', async (req, res) => {
  try {
    const { user_id, folder_id, can_upload, can_read } = req.body;

    if (!user_id || !folder_id) {
      return res.status(400).json({ error: 'user_id and folder_id are required' });
    }

    await query(
      `INSERT INTO user_folder_permissions (user_id, folder_id, can_upload, can_read)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, folder_id) 
       DO UPDATE SET can_upload = EXCLUDED.can_upload, can_read = EXCLUDED.can_read`,
      [user_id, folder_id, can_upload ?? true, can_read ?? true]
    );

    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [`log_${Date.now()}`, req.user.id, 'PERMISSION_UPDATED', `Updated permissions for user ${user_id} on folder ${folder_id}`, req.ip || '10.0.1.2']
    );

    res.json({ message: 'Permissions updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update folder permissions' });
  }
});

// List all system folders
router.get('/folders', async (req, res) => {
  try {
    const result = await query('SELECT * FROM folders ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

// Create new folder
router.post('/folders', async (req, res) => {
  try {
    const { name, path } = req.body;
    if (!name || !path) {
      return res.status(400).json({ error: 'Folder name and path are required' });
    }

    const folderId = `fld_${Date.now()}`;
    const safePath = path.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    await query(
      'INSERT INTO folders (id, name, path) VALUES ($1, $2, $3)',
      [folderId, name, safePath]
    );

    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [`log_${Date.now()}`, req.user.id, 'FOLDER_CREATED', `Created folder ${name} (${safePath})`, req.ip || '10.0.1.2']
    );

    res.status(201).json({ id: folderId, name, path: safePath });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// Fetch system audit logs
router.get('/audit-logs', async (req, res) => {
  try {
    const result = await query('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
