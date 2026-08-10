import express from 'express';
import { generateResumableUploadUrl, generateDownloadUrl, storage, BUCKET_NAME } from '../config/gcp.js';
import { query } from '../db/connection.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get folders accessible to the logged-in user
router.get('/my-folders', async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole === 'ADMIN') {
      const result = await query('SELECT * FROM folders ORDER BY name ASC');
      return res.json(result.rows);
    }

    const result = await query(
      `SELECT f.* FROM folders f
       JOIN user_folder_permissions p ON f.id = p.folder_id
       WHERE p.user_id = $1 AND p.can_read = TRUE
       ORDER BY f.name ASC`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching accessible folders:', error);
    res.status(500).json({ error: error.message || 'Database error fetching accessible folders' });
  }
});

// Generate GCS Resumable Upload URL (Handles 1.5GB+ direct uploads)
router.post('/generate-upload-url', async (req, res) => {
  try {
    const { folder_id, file_name, file_size_bytes, content_type } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!folder_id || !file_name) {
      return res.status(400).json({ error: 'folder_id and file_name are required' });
    }

    // Lookup folder in PostgreSQL
    const folderRes = await query('SELECT * FROM folders WHERE id = $1', [folder_id]);
    if (folderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Target folder not found' });
    }
    const targetFolder = folderRes.rows[0];

    // Check RBAC upload permission
    if (userRole !== 'ADMIN') {
      const permRes = await query(
        'SELECT id FROM user_folder_permissions WHERE user_id = $1 AND folder_id = $2 AND can_upload = TRUE',
        [userId, folder_id]
      );
      if (permRes.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied: Upload permission required for this folder' });
      }
    }

    const safeFileName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `${targetFolder.path}/${Date.now()}_${safeFileName}`;

    const uploadUrl = await generateResumableUploadUrl(objectPath, content_type, req.headers.origin);

    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [
        `log_${Date.now()}`,
        userId,
        'GCS_SIGNED_UPLOAD_URL_REQUESTED',
        `Generated GCS signed upload session for ${file_name} in ${targetFolder.name}`,
        req.ip || '10.0.1.2'
      ]
    );

    res.json({
      upload_url: uploadUrl,
      object_path: objectPath,
      bucket: BUCKET_NAME
    });

  } catch (error) {
    console.error('Error generating signed upload URL:', error);
    res.status(500).json({ error: error.message || 'Failed to generate GCS signed upload URL' });
  }
});

// Direct API stream upload fallback (Bypasses browser GCS CORS policy if needed)
router.post('/upload-direct', async (req, res) => {
  try {
    const folderId = req.headers['x-folder-id'];
    const rawFileName = req.headers['x-file-name'] || 'file.bin';
    const fileName = decodeURIComponent(rawFileName);
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!folderId) {
      return res.status(400).json({ error: 'x-folder-id header is required' });
    }

    const folderRes = await query('SELECT * FROM folders WHERE id = $1', [folderId]);
    if (folderRes.rows.length === 0) {
      return res.status(404).json({ error: 'Target folder not found' });
    }
    const targetFolder = folderRes.rows[0];

    if (userRole !== 'ADMIN') {
      const permRes = await query(
        'SELECT id FROM user_folder_permissions WHERE user_id = $1 AND folder_id = $2 AND can_upload = TRUE',
        [userId, folderId]
      );
      if (permRes.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied to upload into this folder' });
      }
    }

    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `${targetFolder.path}/${Date.now()}_${safeFileName}`;
    const gcsFile = storage.bucket(BUCKET_NAME).file(objectPath);

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
      console.error('[Direct Upload Stream Error]', err);
      res.status(500).json({ error: 'Failed to stream file to GCS' });
    });

    writeStream.on('finish', async () => {
      const fileId = `file_${Date.now()}`;
      await query(
        'INSERT INTO file_metadata (id, folder_id, name, size_bytes, uploaded_by, gcs_path) VALUES ($1, $2, $3, $4, $5, $6)',
        [fileId, folderId, fileName, bytesCount || 1024, userId, objectPath]
      );

      await query(
        'INSERT INTO audit_logs (id, user_id, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
        [`log_${Date.now()}`, userId, 'FILE_UPLOAD_COMPLETED', `Uploaded ${fileName} to GCS via API Stream`, req.ip || '10.0.1.2']
      );

      res.status(201).json({
        id: fileId,
        folder_id: folderId,
        name: fileName,
        size_bytes: bytesCount,
        uploaded_by: userId,
        gcs_path: objectPath,
        uploaded_at: new Date().toISOString()
      });
    });

  } catch (err) {
    console.error('Error in direct stream upload:', err);
    res.status(500).json({ error: err.message || 'Direct upload failed' });
  }
});

// Confirm file upload and store metadata
router.post('/confirm-upload', async (req, res) => {
  try {
    const { folder_id, file_name, file_size_bytes, object_path } = req.body;
    const userId = req.user.id;

    const fileId = `file_${Date.now()}`;
    const size = file_size_bytes || 1048576;

    await query(
      'INSERT INTO file_metadata (id, folder_id, name, size_bytes, uploaded_by, gcs_path) VALUES ($1, $2, $3, $4, $5, $6)',
      [fileId, folder_id, file_name, size, userId, object_path]
    );

    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [`log_${Date.now()}`, userId, 'FILE_UPLOAD_COMPLETED', `Uploaded ${file_name} to GCS`, req.ip || '10.0.1.2']
    );

    res.status(201).json({
      id: fileId,
      folder_id,
      name: file_name,
      size_bytes: size,
      uploaded_by: userId,
      gcs_path: object_path,
      uploaded_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error confirming upload:', error);
    res.status(500).json({ error: error.message || 'Failed to record file metadata' });
  }
});

// List files in a folder
router.get('/folder/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'ADMIN') {
      const permRes = await query(
        'SELECT id FROM user_folder_permissions WHERE user_id = $1 AND folder_id = $2 AND can_read = TRUE',
        [userId, folderId]
      );
      if (permRes.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied to read files in this folder' });
      }
    }

    const filesRes = await query(
      'SELECT * FROM file_metadata WHERE folder_id = $1 ORDER BY uploaded_at DESC',
      [folderId]
    );

    res.json(filesRes.rows);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to list folder files' });
  }
});

// Generate GCS Signed Download URL
router.get('/download-url/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const fileRes = await query('SELECT * FROM file_metadata WHERE id = $1', [fileId]);
    if (fileRes.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    const file = fileRes.rows[0];

    if (userRole !== 'ADMIN') {
      const permRes = await query(
        'SELECT id FROM user_folder_permissions WHERE user_id = $1 AND folder_id = $2 AND can_read = TRUE',
        [userId, file.folder_id]
      );
      if (permRes.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied to download file' });
      }
    }

    let downloadUrl;
    try {
      downloadUrl = await generateDownloadUrl(file.gcs_path);
    } catch (urlErr) {
      // Fallback stream URL
      downloadUrl = `/api/files/download-stream/${file.id}`;
    }

    await query(
      'INSERT INTO audit_logs (id, user_id, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [`log_${Date.now()}`, userId, 'GCS_DOWNLOAD_URL_REQUESTED', `Generated download link for ${file.name}`, req.ip || '10.0.1.2']
    );

    res.json({ download_url: downloadUrl, file });

  } catch (error) {
    console.error('Error generating download link:', error);
    res.status(500).json({ error: error.message || 'Failed to generate signed download link' });
  }
});

// Stream download fallback directly from GCS bucket
router.get('/download-stream/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const fileRes = await query('SELECT * FROM file_metadata WHERE id = $1', [fileId]);
    if (fileRes.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }
    const file = fileRes.rows[0];
    const gcsFile = storage.bucket(BUCKET_NAME).file(file.gcs_path);

    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    gcsFile.createReadStream().pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Failed to stream file download' });
  }
});

export default router;
