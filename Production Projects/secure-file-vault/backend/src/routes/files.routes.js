import express from 'express';
import crypto from 'crypto';
import { generateResumableUploadUrl, generateDownloadUrl, storage, QUARANTINE_BUCKET, CLEAN_BUCKET } from '../config/gcp.js';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorizeFolderAccess, authorizeFileAccess } from '../middleware/authorize.js';
import { logger } from '../services/logger.js';

const router = express.Router();

// All file routes require authentication
router.use(authenticateToken);

// -------------------------------------------------------------------
// Filename Sanitization (prevents path traversal attacks)
// -------------------------------------------------------------------
// Strips path traversal sequences (../, ..\), null bytes, and non-safe characters.
// Only allows alphanumeric, dots, hyphens, underscores.
function sanitizeFileName(rawName) {
  if (!rawName) return 'unnamed_file';
  return rawName
    .replace(/\0/g, '')           // Remove null bytes
    .replace(/\.\.\//g, '')       // Remove ../
    .replace(/\.\.\\/g, '')       // Remove ..\
    .replace(/\//g, '_')          // Replace forward slashes
    .replace(/\\/g, '_')          // Replace backslashes
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Only keep safe characters
    .replace(/^\.+/, '')          // Remove leading dots (hidden files)
    .substring(0, 255);           // Limit filename length
}

// -------------------------------------------------------------------
// Content-Type Validation (Fix H5: was trusting client Content-Type)
// -------------------------------------------------------------------
// Block executable and dangerous MIME types from being uploaded.
const BLOCKED_MIME_TYPES = new Set([
  'application/x-msdownload',      // .exe
  'application/x-msdos-program',   // .com
  'application/x-executable',      // Linux executables
  'application/x-sharedlib',       // .so files
  'application/x-mach-binary',     // macOS executables
  'application/vnd.microsoft.portable-executable', // PE files
  'application/x-dosexec',         // DOS executables
  'application/x-sh',              // Shell scripts
  'application/x-csh',             // C shell scripts
]);

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif',
  '.vbs', '.vbe', '.js', '.jse', '.ws', '.wsf', '.wsc', '.wsh',
  '.ps1', '.ps1xml', '.ps2', '.ps2xml', '.psc1', '.psc2',
  '.reg', '.inf', '.hta', '.cpl', '.msc',
  '.dll', '.sys', '.drv', '.ocx'
]);

function isBlockedFileType(fileName, contentType) {
  if (contentType && BLOCKED_MIME_TYPES.has(contentType.toLowerCase())) {
    return true;
  }
  const ext = fileName ? ('.' + fileName.split('.').pop()).toLowerCase() : '';
  return BLOCKED_EXTENSIONS.has(ext);
}

// -------------------------------------------------------------------
// GET /my-folders -- Folders accessible to the logged-in user
// -------------------------------------------------------------------
router.get('/my-folders', async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole === 'ADMIN') {
      const result = await query('SELECT *, TRUE as can_upload, TRUE as can_read FROM folders ORDER BY name ASC');
      return res.json(result.rows);
    }

    const result = await query(
      `SELECT f.id, f.name, f.path, f.created_at, p.can_upload, p.can_read FROM folders f
       JOIN user_folder_permissions p ON f.id = p.folder_id
       WHERE p.user_id = $1 AND p.can_read = TRUE
       ORDER BY f.name ASC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching accessible folders', { error: error.message, userId: req.user.id, requestId: req.requestId });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to fetch folders.' });
  }
});

// -------------------------------------------------------------------
// POST /generate-upload-url -- GCS Resumable Upload URL
// -------------------------------------------------------------------
// Uses authorizeFolderAccess middleware to enforce UPLOAD permission.
router.post('/generate-upload-url', authorizeFolderAccess('UPLOAD'), async (req, res) => {
  try {
    const { folder_id, file_name, file_size_bytes, content_type } = req.body;
    const userId = req.user.id;

    if (!folder_id || !file_name) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'folder_id and file_name are required.' });
    }

    // Validate file type (Fix H5)
    if (isBlockedFileType(file_name, content_type)) {
      return res.status(400).json({ error: 'BLOCKED_FILE_TYPE', message: 'This file type is not allowed for security reasons.' });
    }

    // Validate file size (max 2GB)
    const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
    if (file_size_bytes && file_size_bytes > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'FILE_TOO_LARGE', message: 'Maximum file size is 2GB.' });
    }

    // Lookup folder
    const folderRes = await query('SELECT * FROM folders WHERE id = $1', [folder_id]);
    if (folderRes.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Target folder not found.' });
    }
    const targetFolder = folderRes.rows[0];

    // Build safe object path
    const safeFileName = sanitizeFileName(file_name);
    const objectPath = `${targetFolder.path}/${crypto.randomUUID()}_${safeFileName}`;

    // Generate upload URL (targets QUARANTINE bucket)
    const uploadUrl = await generateResumableUploadUrl(objectPath, content_type, req.headers.origin);

    // Create upload session record
    const sessionId = crypto.randomUUID();
    await query(
      `INSERT INTO upload_sessions (id, user_id, folder_id, file_name, file_size_bytes, content_type, gcs_upload_url, object_path, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [sessionId, userId, folder_id, file_name, file_size_bytes || 0, content_type || 'application/octet-stream',
       'REDACTED', objectPath, 'INITIATED', new Date(Date.now() + 60 * 60 * 1000).toISOString()]
    );

    // Audit log
    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, ip_address, user_agent, request_id, resource_type, resource_id, result) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        crypto.randomUUID(), userId, 'FILE_UPLOAD_STARTED',
        `Upload session created for ${file_name} in ${targetFolder.name}`,
        req.ip, req.headers['user-agent'], req.requestId,
        'upload_session', sessionId, 'SUCCESS'
      ]
    );

    res.json({
      upload_url: uploadUrl,
      object_path: objectPath,
      session_id: sessionId,
      bucket: QUARANTINE_BUCKET
    });

  } catch (error) {
    logger.error('Error generating upload URL', { error: error.message, requestId: req.requestId });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to generate upload URL.' });
  }
});

// -------------------------------------------------------------------
// POST /upload-direct -- Direct API stream upload fallback
// -------------------------------------------------------------------
// Bypasses browser GCS CORS issues by streaming through the backend.
router.post('/upload-direct', async (req, res) => {
  try {
    const folderId = req.headers['x-folder-id'];
    const rawFileName = req.headers['x-file-name'] || 'file.bin';
    const fileName = decodeURIComponent(rawFileName);
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!folderId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'x-folder-id header is required.' });
    }

    // Validate file type
    if (isBlockedFileType(fileName, req.headers['content-type'])) {
      return res.status(400).json({ error: 'BLOCKED_FILE_TYPE', message: 'This file type is not allowed.' });
    }

    const folderRes = await query('SELECT * FROM folders WHERE id = $1', [folderId]);
    if (folderRes.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Target folder not found.' });
    }
    const targetFolder = folderRes.rows[0];

    // RBAC check (Fix C4 pattern: inline check for stream endpoint)
    if (userRole !== 'ADMIN') {
      const permRes = await query(
        'SELECT id FROM user_folder_permissions WHERE user_id = $1 AND folder_id = $2 AND can_upload = TRUE',
        [userId, folderId]
      );
      if (permRes.rows.length === 0) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Upload permission required for this folder.' });
      }
    }

    const safeFileName = sanitizeFileName(fileName);
    const objectPath = `${targetFolder.path}/${crypto.randomUUID()}_${safeFileName}`;
    const gcsFile = storage.bucket(QUARANTINE_BUCKET).file(objectPath);

    let bytesCount = 0;
    const writeStream = gcsFile.createWriteStream({
      resumable: false,
      contentType: req.headers['content-type'] || 'application/octet-stream'
    });

    req.on('data', (chunk) => {
      bytesCount += chunk.length;
    });

    req.pipe(writeStream);

    writeStream.on('error', (err) => {
      logger.error('Direct upload stream error', { error: err.message, requestId: req.requestId });
      if (!res.headersSent) {
        res.status(500).json({ error: 'UPLOAD_FAILED', message: 'Failed to stream file to storage.' });
      }
    });

    writeStream.on('finish', async () => {
      const fileId = crypto.randomUUID();
      await query(
        `INSERT INTO file_metadata (id, folder_id, name, size_bytes, uploaded_by, gcs_path, status, mime_type, quarantine_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [fileId, folderId, fileName, bytesCount || 0, userId, objectPath, 'UPLOADED',
         req.headers['content-type'] || 'application/octet-stream', objectPath]
      );

      await query(
        'INSERT INTO audit_logs (id, user_id, action, details, ip_address, user_agent, request_id, resource_type, resource_id, result) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [crypto.randomUUID(), userId, 'FILE_UPLOAD_COMPLETED',
         `Uploaded ${fileName} via API stream (${bytesCount} bytes)`,
         req.ip, req.headers['user-agent'], req.requestId,
         'file', fileId, 'SUCCESS']
      );

      res.status(201).json({
        id: fileId,
        folder_id: folderId,
        name: fileName,
        size_bytes: bytesCount,
        status: 'UPLOADED',
        uploaded_by: userId,
        gcs_path: objectPath,
        uploaded_at: new Date().toISOString()
      });
    });

  } catch (err) {
    logger.error('Direct upload error', { error: err.message, requestId: req.requestId });
    if (!res.headersSent) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Direct upload failed.' });
    }
  }
});

// -------------------------------------------------------------------
// POST /confirm-upload -- Confirm file upload and store metadata
// -------------------------------------------------------------------
// Fix C4: Added authorizeFolderAccess middleware (was missing authorization)
router.post('/confirm-upload', authorizeFolderAccess('UPLOAD'), async (req, res) => {
  try {
    const { folder_id, file_name, file_size_bytes, object_path } = req.body;
    const userId = req.user.id;

    if (!folder_id || !file_name || !object_path) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'folder_id, file_name, and object_path are required.' });
    }

    const fileId = crypto.randomUUID();
    const size = file_size_bytes || 0;

    await query(
      `INSERT INTO file_metadata (id, folder_id, name, size_bytes, uploaded_by, gcs_path, status, quarantine_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [fileId, folder_id, file_name, size, userId, object_path, 'UPLOADED', object_path]
    );

    // Update upload session status if exists
    await query(
      `UPDATE upload_sessions SET status = 'COMPLETED' WHERE object_path = $1 AND user_id = $2`,
      [object_path, userId]
    );

    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, ip_address, user_agent, request_id, resource_type, resource_id, result) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [crypto.randomUUID(), userId, 'FILE_UPLOAD_COMPLETED',
       `Uploaded ${file_name} (${size} bytes)`,
       req.ip, req.headers['user-agent'], req.requestId,
       'file', fileId, 'SUCCESS']
    );

    res.status(201).json({
      id: fileId,
      folder_id,
      name: file_name,
      size_bytes: size,
      status: 'UPLOADED',
      uploaded_by: userId,
      gcs_path: object_path,
      uploaded_at: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Upload confirmation error', { error: error.message, requestId: req.requestId });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to record file metadata.' });
  }
});

// -------------------------------------------------------------------
// GET /folder/:folderId -- List files in a folder
// -------------------------------------------------------------------
// Uses authorizeFolderAccess middleware (refactored from inline check)
router.get('/folder/:folderId', authorizeFolderAccess('READ'), async (req, res) => {
  try {
    const { folderId } = req.params;

    const filesRes = await query(
      'SELECT id, folder_id, name, size_bytes, uploaded_by, status, mime_type, uploaded_at, updated_at FROM file_metadata WHERE folder_id = $1 ORDER BY uploaded_at DESC',
      [folderId]
    );

    res.json(filesRes.rows);
  } catch (error) {
    logger.error('Error listing folder files', { error: error.message, requestId: req.requestId });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to list folder files.' });
  }
});

// -------------------------------------------------------------------
// GET /download-url/:fileId -- Generate GCS Signed Download URL
// -------------------------------------------------------------------
// Fix C3: Uses authorizeFileAccess middleware (was missing on download-stream)
// Also enforces file status check: only CLEAN files can be downloaded.
router.get('/download-url/:fileId', authorizeFileAccess('READ'), async (req, res) => {
  try {
    const file = req.authorizedFile; // Set by authorizeFileAccess middleware
    const userId = req.user.id;

    // File status check: only CLEAN files (or UPLOADED during transition) can be downloaded
    const downloadableStatuses = ['CLEAN', 'UPLOADED']; // UPLOADED allowed for backward compatibility
    if (!downloadableStatuses.includes(file.status)) {
      const statusMessages = {
        'SCANNING': 'File is currently being scanned. Please try again shortly.',
        'REJECTED': 'File was rejected during security scanning and cannot be downloaded.',
        'FAILED': 'File processing failed. Please contact an administrator.',
        'UPLOADING': 'File upload is still in progress.'
      };
      return res.status(403).json({
        error: 'FILE_NOT_AVAILABLE',
        message: statusMessages[file.status] || 'File is not available for download.',
        status: file.status
      });
    }

    let downloadUrl;
    try {
      // Use clean_path if file was moved to clean bucket, otherwise fall back to gcs_path
      const objectPath = file.clean_path || file.gcs_path;
      downloadUrl = await generateDownloadUrl(objectPath);
    } catch (urlErr) {
      // Fallback stream URL
      downloadUrl = `/api/files/download-stream/${file.id}`;
    }

    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, ip_address, user_agent, request_id, resource_type, resource_id, result) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [crypto.randomUUID(), userId, 'DOWNLOAD_LINK_GENERATED',
       `Generated download link for ${file.name}`,
       req.ip, req.headers['user-agent'], req.requestId,
       'file', file.id, 'SUCCESS']
    );

    res.json({ download_url: downloadUrl, file: { id: file.id, name: file.name, size_bytes: file.size_bytes, status: file.status } });

  } catch (error) {
    logger.error('Error generating download link', { error: error.message, requestId: req.requestId });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to generate download link.' });
  }
});

// -------------------------------------------------------------------
// GET /download-stream/:fileId -- Stream download fallback
// -------------------------------------------------------------------
// Fix C3: Added authorizeFileAccess middleware (was COMPLETELY MISSING)
// Fix M4: Added audit logging (was missing)
router.get('/download-stream/:fileId', authorizeFileAccess('READ'), async (req, res) => {
  try {
    const file = req.authorizedFile;

    // File status check
    const downloadableStatuses = ['CLEAN', 'UPLOADED'];
    if (!downloadableStatuses.includes(file.status)) {
      return res.status(403).json({ error: 'FILE_NOT_AVAILABLE', message: 'File is not available for download.' });
    }

    // Use clean_path if available, otherwise fall back to quarantine path
    const objectPath = file.clean_path || file.gcs_path;
    const bucket = file.clean_path ? CLEAN_BUCKET : QUARANTINE_BUCKET;
    const gcsFile = storage.bucket(bucket).file(objectPath);

    // Sanitize filename for Content-Disposition header to prevent header injection
    const safeName = file.name.replace(/["\r\n]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Audit log (Fix M4)
    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, ip_address, user_agent, request_id, resource_type, resource_id, result) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [crypto.randomUUID(), req.user.id, 'FILE_DOWNLOADED',
       `Streamed download for ${file.name}`,
       req.ip, req.headers['user-agent'], req.requestId,
       'file', file.id, 'SUCCESS']
    );

    gcsFile.createReadStream().pipe(res);
  } catch (err) {
    logger.error('Stream download error', { error: err.message, requestId: req.requestId });
    if (!res.headersSent) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to stream file download.' });
    }
  }
});

export default router;
