import pg from 'pg';
import { logger } from '../services/logger.js';

const { Pool } = pg;

// -------------------------------------------------------------------
// Secret Manager Integration
// -------------------------------------------------------------------
// In production, DB_PASSWORD and JWT_SECRET are fetched from GCP Secret Manager.
// Set SECRET_DB_PASSWORD_NAME=projects/PROJECT/secrets/db-password/versions/latest
// to enable automatic secret retrieval at startup.
// Falls back to DB_PASSWORD env var for local development.

let secretManagerClient = null;

async function getSecretValue(secretName) {
  if (!secretName) return null;
  try {
    if (!secretManagerClient) {
      const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');
      secretManagerClient = new SecretManagerServiceClient();
    }
    const [version] = await secretManagerClient.accessSecretVersion({ name: secretName });
    return version.payload.data.toString('utf8');
  } catch (err) {
    logger.warn('Secret Manager access failed, falling back to env var', {
      secretName,
      error: err.message
    });
    return null;
  }
}

// -------------------------------------------------------------------
// Connection Pool Configuration
// -------------------------------------------------------------------
// Fix M1: Reduced max from 20 to 5 per instance.
// Cloud Run max_instances(10) * pool_max(5) = 50 total connections
// This stays well under Cloud SQL max_connections (100 default).
//
// Fix M5: Removed mockQueryHandler and memoryStore entirely.
// Production code must not silently fall back to in-memory storage.
// If DB is unreachable, operations fail explicitly.

const dbUser = process.env.DB_USER || 'postgres';
const dbName = process.env.DB_NAME || 'file_vault_db';
const dbPort = parseInt(process.env.DB_PORT || '5432');

let hostPath = 'localhost';
if (process.env.DB_HOST) {
  hostPath = process.env.DB_HOST;
} else if (process.env.CLOUD_SQL_CONNECTION_NAME) {
  hostPath = `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME}`;
}

let pool = null;

/**
 * Initialize the connection pool.
 * Fetches DB password from Secret Manager if configured, otherwise uses env var.
 */
async function createPool() {
  let dbPassword = process.env.DB_PASSWORD || '';

  // Attempt to fetch password from Secret Manager
  if (process.env.SECRET_DB_PASSWORD_NAME) {
    const secretValue = await getSecretValue(process.env.SECRET_DB_PASSWORD_NAME);
    if (secretValue) {
      dbPassword = secretValue;
      logger.info('Database password loaded from Secret Manager');
    }
  }

  const poolConfig = {
    user: dbUser,
    password: dbPassword,
    database: dbName,
    host: hostPath,
    port: dbPort,
    // Fix M1: 5 connections per Cloud Run instance
    // With max_instances=10, worst case = 50 connections
    max: 5,
    // Return idle connections after 30 seconds
    idleTimeoutMillis: 30000,
    // Fail fast if a connection cannot be established in 5 seconds
    connectionTimeoutMillis: 5000,
  };

  // Fix M3: Use proper SSL configuration
  // rejectUnauthorized should be true in production to prevent MITM attacks.
  // Cloud SQL Proxy handles TLS termination, so SSL is only needed for direct TCP.
  if (process.env.DB_SSL === 'true') {
    poolConfig.ssl = {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
    };
  }

  pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    logger.error('PostgreSQL pool error (idle client)', { error: err.message });
  });

  pool.on('connect', () => {
    logger.debug('New PostgreSQL client connected to pool');
  });

  return pool;
}

// -------------------------------------------------------------------
// Query Execution with Retry
// -------------------------------------------------------------------

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 500;

/**
 * Execute SQL query against PostgreSQL with automatic retry on transient failures.
 * 
 * Retries on:
 * - Connection refused / network errors
 * - Connection terminated unexpectedly (Cloud SQL restart)
 * - Statement timeout (if configured)
 * 
 * Does NOT retry on:
 * - Syntax errors
 * - Constraint violations
 * - Permission errors
 */
export async function query(text, params = []) {
  if (!pool) {
    await createPool();
  }

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const start = Date.now();
      const res = await pool.query(text, params);
      const duration = Date.now() - start;

      if (duration > 1000) {
        logger.warn('Slow database query', { durationMs: duration, query: text.substring(0, 100) });
      }

      return res;
    } catch (err) {
      lastError = err;

      // Determine if the error is retryable
      const isRetryable = (
        err.code === 'ECONNREFUSED' ||
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === '57P01' || // admin_shutdown
        err.code === '57P03' || // cannot_connect_now
        err.code === '08006' || // connection_failure
        err.code === '08001' || // sqlclient_unable_to_establish_sqlconnection
        (err.message && err.message.includes('Connection terminated'))
      );

      if (!isRetryable || attempt === MAX_RETRIES) {
        logger.error('Database query failed', {
          error: err.message,
          code: err.code,
          attempt,
          query: text.substring(0, 100)
        });
        throw err;
      }

      // Exponential backoff: 500ms, 1000ms, 2000ms
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      logger.warn(`Database query retry ${attempt}/${MAX_RETRIES} after ${delay}ms`, {
        error: err.message,
        code: err.code
      });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// -------------------------------------------------------------------
// Database Initialization & Migrations
// -------------------------------------------------------------------

export async function initDb() {
  if (!pool) {
    await createPool();
  }

  try {
    logger.info('Connecting to PostgreSQL database', { database: dbName, host: hostPath });
    await runMigrations();
  } catch (err) {
    if (err.code === '3D000' || (err.message && err.message.includes('database') && err.message.includes('does not exist'))) {
      logger.info(`Database ${dbName} does not exist, creating...`);
      try {
        const rootPool = new Pool({
          user: dbUser,
          password: pool.options?.password || process.env.DB_PASSWORD || '',
          database: 'postgres',
          host: hostPath,
          port: dbPort,
          max: 1,
          connectionTimeoutMillis: 5000
        });
        await rootPool.query(`CREATE DATABASE "${dbName}";`);
        await rootPool.end();
        logger.info(`Database ${dbName} created successfully`);
        await runMigrations();
      } catch (createErr) {
        logger.error('Failed to create database', { error: createErr.message });
      }
    } else {
      logger.error('Database initialization failed', { error: err.message });
    }
  }
}

async function runMigrations() {
  logger.info('Running DDL schema migrations...');

  // Core tables
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'USER',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS folders (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        path VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_folder_permissions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        folder_id VARCHAR(64) REFERENCES folders(id) ON DELETE CASCADE,
        can_upload BOOLEAN DEFAULT TRUE,
        can_read BOOLEAN DEFAULT TRUE,
        UNIQUE(user_id, folder_id)
    );

    CREATE TABLE IF NOT EXISTS file_metadata (
        id VARCHAR(64) PRIMARY KEY,
        folder_id VARCHAR(64) REFERENCES folders(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        size_bytes BIGINT NOT NULL,
        uploaded_by VARCHAR(64) REFERENCES users(id),
        gcs_path VARCHAR(512) NOT NULL,
        status VARCHAR(32) DEFAULT 'UPLOADED',
        mime_type VARCHAR(255),
        checksum_sha256 VARCHAR(64),
        quarantine_path VARCHAR(512),
        clean_path VARCHAR(512),
        scan_result TEXT,
        scanned_at TIMESTAMP WITH TIME ZONE,
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS upload_sessions (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        folder_id VARCHAR(64) REFERENCES folders(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_size_bytes BIGINT,
        content_type VARCHAR(255),
        gcs_upload_url TEXT,
        object_path VARCHAR(512),
        status VARCHAR(32) DEFAULT 'INITIATED',
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(64) NOT NULL,
        details TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        request_id VARCHAR(64),
        resource_type VARCHAR(64),
        resource_id VARCHAR(64),
        result VARCHAR(32) DEFAULT 'SUCCESS',
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Schema evolution: Add columns if they don't exist (idempotent)
  const alterStatements = [
    "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'UPLOADED'",
    "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS mime_type VARCHAR(255)",
    "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS checksum_sha256 VARCHAR(64)",
    "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS quarantine_path VARCHAR(512)",
    "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS clean_path VARCHAR(512)",
    "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS scan_result TEXT",
    "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ",
    "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP",
    "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT",
    "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS request_id VARCHAR(64)",
    "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_type VARCHAR(64)",
    "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_id VARCHAR(64)",
    "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS result VARCHAR(32) DEFAULT 'SUCCESS'"
  ];

  for (const stmt of alterStatements) {
    try {
      await pool.query(stmt);
    } catch (err) {
      // Ignore "column already exists" errors (expected on re-runs)
      if (!err.message.includes('already exists')) {
        logger.warn('Migration ALTER statement warning', { statement: stmt, error: err.message });
      }
    }
  }

  // Performance indexes
  const indexStatements = [
    'CREATE INDEX IF NOT EXISTS idx_file_metadata_folder_id ON file_metadata(folder_id)',
    'CREATE INDEX IF NOT EXISTS idx_file_metadata_status ON file_metadata(status)',
    'CREATE INDEX IF NOT EXISTS idx_file_metadata_uploaded_by ON file_metadata(uploaded_by)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)',
    'CREATE INDEX IF NOT EXISTS idx_user_folder_perms ON user_folder_permissions(user_id, folder_id)',
    'CREATE INDEX IF NOT EXISTS idx_upload_sessions_user ON upload_sessions(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON upload_sessions(status)'
  ];

  for (const stmt of indexStatements) {
    try {
      await pool.query(stmt);
    } catch (err) {
      // Index creation is idempotent with IF NOT EXISTS
      logger.debug('Index creation note', { statement: stmt, error: err.message });
    }
  }

  logger.info('Database schema migration complete');
}

export default pool;
