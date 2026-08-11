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

// Create new normal user with granular Read / Upload folder permissions
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, folder_permissions } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existing = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'A user with this email address already exists' });
    }

    const userId = `usr_${Date.now()}`;
    const salt = await bcrypt.genSalt(10);
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
      'INSERT INTO audit_logs (id, user_id, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [`log_${Date.now()}`, req.user.id, 'USER_CREATED', `Created user account ${email}`, req.ip || '10.0.1.2']
    );

    res.status(201).json({
      id: userId,
      name,
      email,
      role: userRole,
      assigned_folders: folder_permissions || []
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user in database' });
  }
});

// Update folder permissions for a user (Granular Read & Upload controls)
router.post('/permissions', async (req, res) => {
  try {
    const { user_id, folder_permissions } = req.body;

    if (!user_id || !Array.isArray(folder_permissions)) {
      return res.status(400).json({ error: 'user_id and folder_permissions array are required' });
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
      'INSERT INTO audit_logs (id, user_id, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [`log_${Date.now()}`, req.user.id, 'PERMISSIONS_UPDATED', `Updated granular permissions for user ${user_id}`, req.ip || '10.0.1.2']
    );

    res.json({ message: 'Permissions updated successfully' });
  } catch (error) {
    console.error('Error updating permissions:', error);
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
