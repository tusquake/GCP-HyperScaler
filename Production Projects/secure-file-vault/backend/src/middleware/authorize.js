import { query } from '../db/connection.js';

/**
 * Centralized RBAC Authorization Middleware
 * 
 * Prevents BOLA (Broken Object Level Authorization) and IDOR (Insecure Direct
 * Object Reference) attacks by enforcing server-side permission checks.
 * 
 * Every file/folder operation must verify:
 * 1. User is authenticated (handled by authenticateToken middleware upstream)
 * 2. User has the required permission (can_read / can_upload) for the folder
 * 3. If accessing a file, the file belongs to a folder the user has access to
 * 
 * ADMIN role bypasses folder permission checks (has access to all folders).
 * 
 * Attack prevented:
 *   User A changes /api/files/download-url/file_123 to /api/files/download-url/file_456
 *   and accesses User B's file. This middleware ensures the file's parent folder
 *   is in User A's permission set before allowing access.
 */

/**
 * Middleware factory: checks if user has the required permission on a folder.
 * 
 * The folder ID is resolved from (in order of priority):
 * 1. req.body.folder_id
 * 2. req.params.folderId
 * 3. req.headers['x-folder-id']
 * 
 * @param {'READ'|'UPLOAD'} permission - Required permission level
 * @returns Express middleware function
 */
export function authorizeFolderAccess(permission) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
      }

      // ADMIN bypasses folder-level permission checks
      if (userRole === 'ADMIN') {
        return next();
      }

      const folderId = req.body?.folder_id || req.params?.folderId || req.headers['x-folder-id'];

      if (!folderId) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'Folder identifier is required.' });
      }

      // Verify folder exists
      const folderResult = await query('SELECT id FROM folders WHERE id = $1', [folderId]);
      if (folderResult.rows.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'Folder not found.' });
      }

      // Check user's permission on this folder
      const permColumn = permission === 'UPLOAD' ? 'can_upload' : 'can_read';
      const permResult = await query(
        `SELECT id FROM user_folder_permissions WHERE user_id = $1 AND folder_id = $2 AND ${permColumn} = TRUE`,
        [userId, folderId]
      );

      if (permResult.rows.length === 0) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You do not have permission to access this resource.'
        });
      }

      next();
    } catch (err) {
      console.error('[Authorization Error]', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Authorization check failed.' });
    }
  };
}

/**
 * Middleware factory: checks if user has access to a file.
 * 
 * Resolves file ID from req.params.fileId, looks up the file's parent folder,
 * then checks if the user has the required permission on that folder.
 * 
 * Also attaches the resolved file record to req.authorizedFile for downstream use,
 * eliminating the need for route handlers to re-query the file.
 * 
 * @param {'READ'|'UPLOAD'} permission - Required permission level
 * @returns Express middleware function
 */
export function authorizeFileAccess(permission) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
      }

      const fileId = req.params?.fileId;
      if (!fileId) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'File identifier is required.' });
      }

      // Look up the file record
      const fileResult = await query('SELECT * FROM file_metadata WHERE id = $1', [fileId]);
      if (fileResult.rows.length === 0) {
        return res.status(404).json({ error: 'NOT_FOUND', message: 'File not found.' });
      }

      const file = fileResult.rows[0];

      // ADMIN bypasses folder-level permission checks
      if (userRole === 'ADMIN') {
        req.authorizedFile = file;
        return next();
      }

      // Check user's permission on the file's parent folder
      const permColumn = permission === 'UPLOAD' ? 'can_upload' : 'can_read';
      const permResult = await query(
        `SELECT id FROM user_folder_permissions WHERE user_id = $1 AND folder_id = $2 AND ${permColumn} = TRUE`,
        [userId, file.folder_id]
      );

      if (permResult.rows.length === 0) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You do not have permission to access this resource.'
        });
      }

      // Attach the file record for downstream route handlers
      req.authorizedFile = file;
      next();
    } catch (err) {
      console.error('[Authorization Error]', err);
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Authorization check failed.' });
    }
  };
}
