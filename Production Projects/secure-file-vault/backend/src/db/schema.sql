-- PostgreSQL Schema for Enterprise Secure File Vault
-- Enforces Private IP Access, RBAC, and Audit Logging

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'USER', -- 'ADMIN' or 'USER'
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

-- Indices for low-latency lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_permissions_user ON user_folder_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_files_folder ON file_metadata(folder_id);
