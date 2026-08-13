import { logger } from './logger.js';
import { scanFile } from './scanner.js';

/**
 * Pub/Sub Integration Service
 * 
 * Provides publish/subscribe messaging for asynchronous file processing.
 * 
 * Architecture:
 *   Upload API -> publishes FILE_UPLOADED event -> Pub/Sub Topic
 *   Background Worker -> subscribes to topic -> processes file (scan, validate)
 * 
 * This service is designed to work with Google Cloud Pub/Sub in production.
 * In development (when PUBSUB_ENABLED is not set), it falls back to
 * synchronous in-process scanning.
 * 
 * Production setup requires:
 * 1. Pub/Sub topic: projects/{PROJECT_ID}/topics/file-uploaded-topic
 * 2. Pub/Sub subscription: file-scan-subscription (push to Cloud Run worker)
 * 3. Service account with roles/pubsub.publisher (backend) and roles/pubsub.subscriber (worker)
 * 
 * Idempotency: The scanner service checks file status before processing,
 * ensuring at-least-once delivery semantics don't cause duplicate work.
 */

let pubsubClient = null;
let topicRef = null;

const TOPIC_NAME = process.env.PUBSUB_TOPIC || 'file-uploaded-topic';
const PUBSUB_ENABLED = process.env.PUBSUB_ENABLED === 'true';

/**
 * Initialize Pub/Sub client and topic reference.
 * Only attempts initialization if PUBSUB_ENABLED=true.
 */
async function initPubSub() {
  if (!PUBSUB_ENABLED) {
    logger.info('Pub/Sub disabled, using synchronous file processing');
    return false;
  }

  try {
    const { PubSub } = await import('@google-cloud/pubsub');
    pubsubClient = new PubSub({
      projectId: process.env.GCP_PROJECT_ID
    });
    topicRef = pubsubClient.topic(TOPIC_NAME);

    // Verify topic exists
    const [exists] = await topicRef.exists();
    if (!exists) {
      logger.warn('Pub/Sub topic does not exist, creating...', { topicName: TOPIC_NAME });
      await pubsubClient.createTopic(TOPIC_NAME);
    }

    logger.info('Pub/Sub initialized', { topicName: TOPIC_NAME });
    return true;
  } catch (err) {
    logger.error('Pub/Sub initialization failed, falling back to synchronous processing', {
      error: err.message,
      topicName: TOPIC_NAME
    });
    return false;
  }
}

/**
 * Publish a file upload event to Pub/Sub.
 * If Pub/Sub is not available, falls back to synchronous scanning.
 * 
 * @param {string} fileId - File metadata ID
 * @param {Object} metadata - Additional event metadata
 */
export async function publishFileUploadedEvent(fileId, metadata = {}) {
  const event = {
    eventType: 'FILE_UPLOADED',
    fileId,
    timestamp: new Date().toISOString(),
    ...metadata
  };

  if (PUBSUB_ENABLED && topicRef) {
    try {
      const messageId = await topicRef.publishMessage({
        data: Buffer.from(JSON.stringify(event)),
        attributes: {
          eventType: 'FILE_UPLOADED',
          fileId
        }
      });

      logger.info('Published FILE_UPLOADED event to Pub/Sub', {
        messageId,
        fileId,
        topicName: TOPIC_NAME
      });
      return { published: true, messageId };
    } catch (err) {
      logger.error('Failed to publish to Pub/Sub, falling back to sync scan', {
        error: err.message,
        fileId
      });
      // Fall through to synchronous processing
    }
  }

  // Synchronous fallback: scan the file directly
  // This is used in development and as a fallback if Pub/Sub is unavailable.
  // In production, the Pub/Sub subscription handler calls scanFile.
  try {
    logger.info('Processing file synchronously (Pub/Sub unavailable)', { fileId });
    const result = await scanFile(fileId);
    return { published: false, synchronous: true, result };
  } catch (err) {
    logger.error('Synchronous file scan failed', { fileId, error: err.message });
    return { published: false, synchronous: true, error: err.message };
  }
}

/**
 * Handle an incoming Pub/Sub push message.
 * This endpoint is called by Pub/Sub push subscriptions on the worker service.
 * 
 * Expected request body (from Pub/Sub push):
 * {
 *   "message": {
 *     "data": "base64-encoded-json",
 *     "attributes": { "eventType": "FILE_UPLOADED", "fileId": "..." }
 *   }
 * }
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function handlePubSubPush(req, res) {
  try {
    const message = req.body?.message;
    if (!message || !message.data) {
      logger.warn('Invalid Pub/Sub push message received');
      return res.status(400).json({ error: 'Invalid message format' });
    }

    const eventData = JSON.parse(Buffer.from(message.data, 'base64').toString('utf8'));

    if (eventData.eventType !== 'FILE_UPLOADED') {
      logger.info('Ignoring non-upload event', { eventType: eventData.eventType });
      return res.status(200).json({ acknowledged: true });
    }

    logger.info('Processing Pub/Sub push event', { fileId: eventData.fileId });
    await scanFile(eventData.fileId);

    // Acknowledge the message by returning 200
    res.status(200).json({ acknowledged: true, fileId: eventData.fileId });
  } catch (err) {
    logger.error('Pub/Sub push handler error', { error: err.message });
    // Return 500 to trigger Pub/Sub retry
    res.status(500).json({ error: 'Processing failed' });
  }
}

// Initialize on module load
initPubSub().catch(() => {});

export { initPubSub };
