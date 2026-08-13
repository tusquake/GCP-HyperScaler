import { Storage } from '@google-cloud/storage';
import { logger } from '../services/logger.js';

// -------------------------------------------------------------------
// GCS Client (uses Application Default Credentials on Cloud Run)
// -------------------------------------------------------------------
export const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID || 'demo-gcp-project',
});

// -------------------------------------------------------------------
// 3-Bucket Architecture (Fix C6: was single bucket)
// -------------------------------------------------------------------
// All uploads go to QUARANTINE first. After scanning:
//   CLEAN files -> CLEAN_BUCKET (users download from here)
//   INFECTED/INVALID files -> REJECTED_BUCKET (admin review only)
//
// This ensures no file is served to users before it has been validated.

export const QUARANTINE_BUCKET = process.env.GCS_QUARANTINE_BUCKET
  || process.env.GCS_BUCKET_NAME
  || 'secure-file-vault-quarantine';

export const CLEAN_BUCKET = process.env.GCS_CLEAN_BUCKET
  || 'secure-file-vault-clean';

export const REJECTED_BUCKET = process.env.GCS_REJECTED_BUCKET
  || 'secure-file-vault-rejected';

// Legacy single-bucket support (backwards compatibility)
export const BUCKET_NAME = QUARANTINE_BUCKET;

/**
 * Generate a GCP Resumable Upload URL for direct client streaming (up to 1.5GB+)
 * 
 * Uploads always target the QUARANTINE bucket. Files are moved to the CLEAN
 * bucket only after passing malware scanning and validation.
 * 
 * @param {string} objectPath - GCS object path within the bucket
 * @param {string} contentType - MIME type of the file
 * @param {string} originHeader - Origin header for CORS configuration
 * @returns {Promise<string>} Resumable upload session URL
 */
export async function generateResumableUploadUrl(objectPath, contentType, originHeader) {
  try {
    const file = storage.bucket(QUARANTINE_BUCKET).file(objectPath);

    const [url] = await file.createResumableUpload({
      metadata: {
        contentType: contentType || 'application/octet-stream'
      },
      origin: originHeader || undefined
    });

    logger.info('Generated GCS resumable upload URL', {
      bucket: QUARANTINE_BUCKET,
      objectPath,
      contentType
    });

    return url;
  } catch (error) {
    logger.warn('createResumableUpload failed, attempting getSignedUrl fallback', {
      error: error.message,
      bucket: QUARANTINE_BUCKET,
      objectPath
    });

    try {
      const file = storage.bucket(QUARANTINE_BUCKET).file(objectPath);
      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'resumable',
        expires: Date.now() + 15 * 60 * 1000,  // 15 minutes (reduced from implicit longer)
        contentType: contentType || 'application/octet-stream',
      });
      return url;
    } catch (fallbackError) {
      logger.error('Signed upload URL generation failed', {
        error: fallbackError.message,
        bucket: QUARANTINE_BUCKET,
        objectPath
      });
      throw error;
    }
  }
}

/**
 * Generate a Signed Download URL for authorized users.
 * 
 * Downloads are served ONLY from the CLEAN bucket.
 * Files in QUARANTINE or REJECTED buckets cannot be downloaded.
 * 
 * Fix H8: Reduced expiry from 1 hour to 15 minutes.
 * Shorter-lived signed URLs reduce the window for URL sharing/leaking.
 * 
 * @param {string} objectPath - GCS object path within the clean bucket
 * @returns {Promise<string>} Signed download URL (15-minute validity)
 */
export async function generateDownloadUrl(objectPath) {
  try {
    const file = storage.bucket(CLEAN_BUCKET).file(objectPath);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes (Fix H8: was 1 hour)
    });

    logger.info('Generated GCS signed download URL', {
      bucket: CLEAN_BUCKET,
      objectPath,
      expiryMinutes: 15
    });

    return url;
  } catch (error) {
    logger.error('Failed to generate signed download URL', {
      error: error.message,
      bucket: CLEAN_BUCKET,
      objectPath
    });
    throw error;
  }
}

/**
 * Move a GCS object from one bucket to another.
 * 
 * Used by the scanner service to promote clean files or quarantine infected ones:
 *   QUARANTINE -> CLEAN (file passed scanning)
 *   QUARANTINE -> REJECTED (file failed scanning)
 * 
 * The source object is deleted after successful copy.
 * 
 * @param {string} srcBucket - Source bucket name
 * @param {string} destBucket - Destination bucket name
 * @param {string} objectPath - Object path (same in both buckets)
 * @returns {Promise<void>}
 */
export async function moveObject(srcBucket, destBucket, objectPath) {
  try {
    const srcFile = storage.bucket(srcBucket).file(objectPath);
    const destFile = storage.bucket(destBucket).file(objectPath);

    await srcFile.copy(destFile);
    await srcFile.delete();

    logger.info('GCS object moved', {
      from: `gs://${srcBucket}/${objectPath}`,
      to: `gs://${destBucket}/${objectPath}`
    });
  } catch (error) {
    logger.error('Failed to move GCS object', {
      error: error.message,
      srcBucket,
      destBucket,
      objectPath
    });
    throw error;
  }
}
