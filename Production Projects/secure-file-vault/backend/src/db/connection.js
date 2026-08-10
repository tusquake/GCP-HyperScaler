import pg from 'pg';

const { Pool } = pg;

const isCloudSql = process.env.CLOUD_SQL_CONNECTION_NAME || process.env.DB_HOST;

// Configure PostgreSQL pool with Cloud SQL Unix Socket / Private IP support
const poolConfig = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'SecurePassword123!',
  database: process.env.DB_NAME || 'file_vault_db',
  port: parseInt(process.env.DB_PORT || '5432'),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

if (process.env.CLOUD_SQL_CONNECTION_NAME) {
  // Cloud SQL Unix Socket connection format used by Cloud Run
  poolConfig.host = `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME}`;
} else if (process.env.DB_HOST) {
  poolConfig.host = process.env.DB_HOST;
} else {
  poolConfig.host = 'localhost';
}

if (process.env.DB_SSL === 'true') {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[Cloud SQL Pool Error]:', err);
});

export const memoryStore = {
  users: [],
  folders: [],
  user_folder_permissions: [],
  file_metadata: [],
  audit_logs: []
};

/**
 * Execute SQL query against PostgreSQL DB with graceful local fallback
 */
export async function query(text, params = []) {
  if (isCloudSql) {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`[Cloud SQL Query] Executed in ${duration}ms (rows: ${res.rowCount})`);
    return res;
  }

  return mockQueryHandler(text, params);
}

/**
 * Initialize DDL tables automatically in Cloud SQL PostgreSQL
 */
export async function initDb() {
  if (!isCloudSql) return;

  try {
    console.log('[Database Init] Running DDL table migrations on Cloud SQL PostgreSQL...');
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
          uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
          action VARCHAR(64) NOT NULL,
          details TEXT,
          ip_address VARCHAR(45),
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[Database Init] Cloud SQL PostgreSQL DDL schema migration complete.');
  } catch (err) {
    console.error('[Database Init Error] Migration failed:', err);
  }
}

function mockQueryHandler(text, params) {
  const sql = text.trim();

  if (sql.includes('FROM users WHERE LOWER(email) = LOWER($1)') || sql.includes('FROM users WHERE id = $1')) {
    const emailOrId = (params[0] || '').toLowerCase();
    const user = memoryStore.users.find(u => u.email.toLowerCase() === emailOrId || u.id === emailOrId);
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  }

  if (sql.includes('FROM users')) {
    return { rows: memoryStore.users, rowCount: memoryStore.users.length };
  }

  if (sql.includes('INSERT INTO users')) {
    const [id, name, email, passwordHash, role] = params;
    const newUser = { id, name, email, password_hash: passwordHash, role, created_at: new Date().toISOString() };
    memoryStore.users.unshift(newUser);
    return { rows: [newUser], rowCount: 1 };
  }

  if (sql.includes('FROM folders')) {
    return { rows: memoryStore.folders, rowCount: memoryStore.folders.length };
  }

  if (sql.includes('INSERT INTO folders')) {
    const [id, name, path] = params;
    const newFolder = { id, name, path, created_at: new Date().toISOString() };
    memoryStore.folders.push(newFolder);
    return { rows: [newFolder], rowCount: 1 };
  }

  if (sql.includes('FROM user_folder_permissions')) {
    return { rows: memoryStore.user_folder_permissions, rowCount: memoryStore.user_folder_permissions.length };
  }

  if (sql.includes('INSERT INTO user_folder_permissions')) {
    const [user_id, folder_id, can_upload, can_read] = params;
    memoryStore.user_folder_permissions.push({ user_id, folder_id, can_upload: true, can_read: true });
    return { rows: [], rowCount: 1 };
  }

  if (sql.includes('FROM file_metadata')) {
    const folderId = params[0];
    const files = folderId ? memoryStore.file_metadata.filter(f => f.folder_id === folderId) : memoryStore.file_metadata;
    return { rows: files, rowCount: files.length };
  }

  if (sql.includes('INSERT INTO file_metadata')) {
    const [id, folder_id, name, size_bytes, uploaded_by, gcs_path] = params;
    const newFile = { id, folder_id, name, size_bytes, uploaded_by, gcs_path, uploaded_at: new Date().toISOString() };
    memoryStore.file_metadata.unshift(newFile);
    return { rows: [newFile], rowCount: 1 };
  }

  if (sql.includes('FROM audit_logs')) {
    return { rows: memoryStore.audit_logs, rowCount: memoryStore.audit_logs.length };
  }

  if (sql.includes('INSERT INTO audit_logs')) {
    const [id, user_id, action, details, ip_address] = params;
    const newLog = { id, user_id, action, details, ip_address, timestamp: new Date().toISOString() };
    memoryStore.audit_logs.unshift(newLog);
    return { rows: [newLog], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
}

export default pool;
