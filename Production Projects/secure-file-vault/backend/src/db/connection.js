import pg from 'pg';

const { Pool } = pg;

// PostgreSQL database pool configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'file_vault_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 1000,
});

pool.on('error', (err) => {
  // Silent pool error handler
});

// Clean storage arrays (Zero hardcoded seed users, folders, or permissions)
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
  if (process.env.CLOUD_SQL_CONNECTION_NAME || process.env.DB_HOST) {
    try {
      const res = await pool.query(text, params);
      return res;
    } catch (err) {
      console.warn('[Cloud SQL Error] Failed to execute PostgreSQL query:', err.message);
      throw err;
    }
  }

  // Local standalone mode handler
  return mockQueryHandler(text, params);
}

function mockQueryHandler(text, params) {
  const sql = text.trim();

  // SELECT user by email
  if (sql.includes('FROM users WHERE LOWER(email) = LOWER($1)') || sql.includes('FROM users WHERE id = $1')) {
    const emailOrId = (params[0] || '').toLowerCase();
    const user = memoryStore.users.find(u => u.email.toLowerCase() === emailOrId || u.id === emailOrId);
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  }

  // SELECT users list
  if (sql.includes('FROM users')) {
    return { rows: memoryStore.users, rowCount: memoryStore.users.length };
  }

  // INSERT INTO users
  if (sql.includes('INSERT INTO users')) {
    const [id, name, email, passwordHash, role] = params;
    const newUser = { id, name, email, password_hash: passwordHash, role, created_at: new Date().toISOString() };
    memoryStore.users.unshift(newUser);
    return { rows: [newUser], rowCount: 1 };
  }

  // SELECT folders
  if (sql.includes('FROM folders')) {
    return { rows: memoryStore.folders, rowCount: memoryStore.folders.length };
  }

  // INSERT INTO folders
  if (sql.includes('INSERT INTO folders')) {
    const [id, name, path] = params;
    const newFolder = { id, name, path, created_at: new Date().toISOString() };
    memoryStore.folders.push(newFolder);
    return { rows: [newFolder], rowCount: 1 };
  }

  // SELECT user_folder_permissions
  if (sql.includes('FROM user_folder_permissions')) {
    return { rows: memoryStore.user_folder_permissions, rowCount: memoryStore.user_folder_permissions.length };
  }

  // INSERT user_folder_permissions
  if (sql.includes('INSERT INTO user_folder_permissions')) {
    const [user_id, folder_id, can_upload, can_read] = params;
    memoryStore.user_folder_permissions.push({ user_id, folder_id, can_upload: true, can_read: true });
    return { rows: [], rowCount: 1 };
  }

  // SELECT file_metadata
  if (sql.includes('FROM file_metadata')) {
    const folderId = params[0];
    const files = folderId ? memoryStore.file_metadata.filter(f => f.folder_id === folderId) : memoryStore.file_metadata;
    return { rows: files, rowCount: files.length };
  }

  // INSERT INTO file_metadata
  if (sql.includes('INSERT INTO file_metadata')) {
    const [id, folder_id, name, size_bytes, uploaded_by, gcs_path] = params;
    const newFile = { id, folder_id, name, size_bytes, uploaded_by, gcs_path, uploaded_at: new Date().toISOString() };
    memoryStore.file_metadata.unshift(newFile);
    return { rows: [newFile], rowCount: 1 };
  }

  // SELECT audit_logs
  if (sql.includes('FROM audit_logs')) {
    return { rows: memoryStore.audit_logs, rowCount: memoryStore.audit_logs.length };
  }

  // INSERT INTO audit_logs
  if (sql.includes('INSERT INTO audit_logs')) {
    const [id, user_id, action, details, ip_address] = params;
    const newLog = { id, user_id, action, details, ip_address, timestamp: new Date().toISOString() };
    memoryStore.audit_logs.unshift(newLog);
    return { rows: [newLog], rowCount: 1 };
  }

  return { rows: [], rowCount: 0 };
}

export default pool;
