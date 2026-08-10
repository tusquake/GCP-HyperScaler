import { Storage } from '@google-cloud/storage';

export const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID || 'demo-gcp-project',
});

export const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'secure-file-vault-bucket';

/**
 * Generate a GCP Signed Resumable Upload URL for direct client streaming (up to 1.5GB+)
 */
export async function generateResumableUploadUrl(objectPath, contentType) {
  try {
    const file = storage.bucket(BUCKET_NAME).file(objectPath);
    
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'resumable',
      expires: Date.now() + 15 * 60 * 1000, // 15 mins
      contentType: contentType || 'application/octet-stream',
    });

    return url;
  } catch (error) {
    console.error('[GCP Storage Error] Failed to generate signed upload URL:', error);
    throw error;
  }
}

/**
 * Generate a Signed Download URL for authorized users
 */
export async function generateDownloadUrl(objectPath) {
  try {
    const file = storage.bucket(BUCKET_NAME).file(objectPath);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour validity
    });

    return url;
  } catch (error) {
    console.error('[GCP Storage Error] Failed to generate signed download URL:', error);
    throw error;
  }
}
