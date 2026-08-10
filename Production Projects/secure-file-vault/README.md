# Secure Enterprise File Vault - System Architecture & Operations Manual

## 1. Executive Summary
The Secure Enterprise File Vault is a cloud-native, scalable, low-latency enterprise document management platform built using Node.js (Express), React (Vite Single Page Application), PostgreSQL (Google Cloud SQL), and Google Cloud Storage (GCS). The application enforces enterprise security controls including zero hardcoded credentials, GCP IAM Managed Identities, role-based access control (RBAC) for storage folders, 1.5GB+ direct resumable file uploads with pause/resume capabilities, and audit logging for security compliance.

---

## 2. System Architecture

```
+-----------------------------------------------------------------------------------+
|                              FRONTEND & ACCESS LAYER                              |
|                                                                                   |
|  User Browser (React SPA)                                                         |
|         |                                                                         |
|         +---> Single Cloud Run HTTPS Endpoint (Port 8080)                          |
|               Express API Server + Static React Assets                             |
+---------------------------------------+-------------------------------------------+
                                        |
                   +--------------------+--------------------+
                   |                                         |
                   v                                         v
+--------------------------------------+   +----------------------------------------+
|       DATABASE LAYER (Cloud SQL)     |   |       STORAGE LAYER (Cloud Storage)    |
|                                      |   |                                        |
|  Instance: secure-app-db             |   |  Bucket: ${PROJECT_ID}-secure-vault    |
|  Engine:   PostgreSQL 15             |   |  Access: Uniform Bucket-Level Access   |
|  Database: file_vault_db             |   |  Security: Public Access Prevention    |
|  Connection: Direct TCP / Auth Proxy |   |  Uploads: Direct Resumable + API Stream|
+--------------------------------------+   +----------------------------------------+
```

---

## 3. Core Feature Set & User Personas

### 3.1 Administrative Persona
- Designated Admin Auto-Promotion: The account `tushar.seth@cloudkaptan.com` is automatically assigned the ADMIN role upon registration.
- User Management Module: Administrators can create user accounts, reset credentials, assign folder permissions, and view active users.
- Folder Provisioning & RBAC: Provision custom corporate storage folders (e.g., /Finance, /HR, /Public) and set granular Read and Upload permissions per user.
- Security Audit Log Center: Real-time, immutable audit trail recording all critical system actions including account registrations, folder creation, file uploads, and download link generations.

### 3.2 Standard User Persona
- Streamlined Light-Themed Workspace: Displays assigned folders and file listings without administrative configuration options.
- Direct & Resumable File Uploads: Supports uploading large files up to 1.5GB+ with real-time speed indicators, progress tracking, and Pause/Resume controls.
- Secure Direct Downloads: Retrieves files securely via authorized GCS URLs or backend streaming proxies.

---

## 4. Database Schema & Data Models

### 4.1 Schema Definition (`file_vault_db`)

```sql
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
```

---

## 5. Storage Engine & Resumable Upload Architecture

### 5.1 Direct Resumable Upload Protocol
1. Client requests an upload session URL from `/api/files/generate-upload-url`.
2. Backend invokes `@google-cloud/storage` `createResumableUpload` using Cloud Run IAM Managed Identity credentials.
3. Client streams file chunks directly to `storage.googleapis.com` via `PUT` requests.
4. On Pause, `xhr.abort()` halts the connection. On Resume, client queries GCS with `Content-Range: bytes */[totalSize]`. GCS responds with status `308 Resume Incomplete` and the last byte saved. The client slices `file.slice(offset)` and resumes streaming.

### 5.2 Resilient API Stream Fallback
If client-side CORS or browser policies block direct `PUT` requests to `storage.googleapis.com`, the frontend automatically falls back to streaming file chunks via `/api/files/upload-direct` to guarantee upload completion under all network conditions.

---

## 6. Challenges Encountered & Technical Solutions

### 6.1 Database Socket Error (`connect ECONNREFUSED /cloudsql/...`)
- Root Cause: Cloud Run attempted to connect to Unix socket `/cloudsql/...` without an active VPC Connector or Private IP routing.
- Resolution: Configured direct TCP IP connectivity (`DB_HOST`) with `--assign-ip` on Cloud SQL instance `secure-app-db`, enabling reliable database connectivity in approximately 30 seconds.

### 6.2 Serverless VPC Access Connector Quota Timeout (`Code 13`)
- Root Cause: GCP trial projects hit Compute Engine internal VM quotas during connector creation.
- Resolution: Bypassed slow VPC Connector dependencies by utilizing Cloud SQL Auth Proxy / Direct TCP IP mode and passing `--clear-vpc-connector` to `gcloud run deploy`.

### 6.3 Docker Cloud Build `npm ci` Failure
- Root Cause: `npm ci` failed in `backend/Dockerfile` because `package-lock.json` was ignored by `.gitignore`.
- Resolution: Modified `backend/Dockerfile` to `npm install --omit=dev`, updated `.gitignore` rules, and committed `package-lock.json` to source control.

### 6.4 Storage SDK Signed URL IAM Permission Error
- Root Cause: `@google-cloud/storage` `getSignedUrl` required `signBlob` permissions on Cloud Run IAM Service Accounts.
- Resolution: Adopted native `createResumableUpload` (which utilizes active OAuth2 tokens directly without requiring local private keys) and granted `roles/iam.serviceAccountTokenCreator`.

### 6.5 GCS Browser CORS Policy Block (`ERR_FAILED 200/CORS`)
- Root Cause: GCS bucket CORS configuration was skipped for pre-existing storage buckets inside creation conditional blocks.
- Resolution: Updated `setup_gcp_infra.sh` to enforce `gcloud storage buckets update --cors-file=gcp/cors.json` on every run, and implemented an automatic API stream upload fallback route.

---

## 7. Deployment Instructions

Execute the automated single-command deployment script in Google Cloud Shell:

```bash
git reset --hard origin/main
git pull
chmod +x deploy.sh setup_gcp_infra.sh
./deploy.sh
```

---

## 8. System Design & Enterprise Architectural Improvements

To scale this application for large-scale enterprise production workloads, the following system design enhancements are recommended:

### 8.1 Asynchronous Malware & Antivirus Scanning (Pub/Sub + Cloud Functions)
- Configure GCS Bucket Event Notifications to publish object creation events to a Cloud Pub/Sub topic.
- Deploy a serverless Cloud Function running ClamAV to inspect uploaded objects asynchronously before marking them as verified in `file_metadata`.

### 8.2 Global Edge Caching (Cloud CDN + Signed URLs)
- Place Google Cloud CDN in front of Cloud Storage buckets to cache static assets and frequently downloaded documents at edge locations globally, reducing latency and egress costs.

### 8.3 Connection Pooling (PgBouncer Sidecar)
- Deploy PgBouncer in front of Cloud SQL PostgreSQL to manage database connection pools efficiently, supporting thousands of concurrent user sessions without exhausting backend database limits.

### 8.4 Storage Lifecycle Policies
- Configure GCS Lifecycle Rules to transition files older than 90 days from Standard Storage to Nearline or Coldline Storage classes, optimizing long-term storage expenditure.

### 8.5 Multi-Region High Availability & Disaster Recovery
- Enable Cloud SQL High Availability (HA) with regional standby replicas and configure multi-region GCS buckets (e.g., `US` or `EU`) to guarantee 99.999999999% (11 9s) data durability.
