# Secure Enterprise File Vault -- Production Platform

An enterprise-grade, secure file management platform built with React, Node.js Express, Google Cloud SQL (PostgreSQL), Google Cloud Storage (GCS), Google Cloud Run, Cloud Armor WAF, and GCP Secret Manager.

---

## 1. Architecture Overview

```
                                  INTERNET
                                     |
                                     v
                          Global HTTPS Load Balancer
                                     |
                                     v
                         Cloud Armor (WAF & DDoS)
                                     |
                                     v
                              Serverless NEG
                                     |
         +---------------------------+---------------------------+
         |                                                       |
         v                                                       v
  Frontend Cloud Run                                      Backend Cloud Run
 (React SPA on Nginx)                                   (Express REST API)
  [Service Account:                                       [Service Account:
   file-vault-frontend-sa]                                 file-vault-backend-sa]
                                                                 |
                                                      Direct VPC Subnet Egress (10.0.1.0/24)
                                                                 |
                                                                 v
                                                       Private VPC Network
                                                       (file-vault-vpc)
                                                                 |
                                                     Private Service Access
                                                                 |
                                                                 v
                                                        Private Cloud SQL
                                                        PostgreSQL Instance
                                                        (No Public IP)
```

---

## 2. Key Enterprise Features

- **Service Decoupling**: Separate Frontend Cloud Run (React SPA on Nginx) and Backend Cloud Run (Express API) services for independent scaling and minimal compute waste.
- **Private Cloud SQL**: PostgreSQL instance configured with private IP only (public IP disabled) accessible solely via Direct VPC Subnet Egress (`10.0.1.0/24`).
- **3-Bucket GCS Pipeline**: Files land in a `Quarantine` bucket, are validated asynchronously via a Pub/Sub file scanner state machine, and move to `Clean` or `Rejected` buckets before being made downloadable.
- **Centralized RBAC Policy Layer**: Server-side authorization middleware (`authorizeFolderAccess` and `authorizeFileAccess`) defending against BOLA/IDOR attacks across all file and folder operations.
- **Secret Manager Integration**: Database credentials and JWT secrets loaded dynamically from GCP Secret Manager at runtime. Zero hardcoded secrets in source code or environment files.
- **Hardened Authentication**: Passwords hashed with bcrypt (12 salt rounds), strict password complexity policies, 1-hour access tokens, 7-day refresh tokens, and account enumeration defenses.
- **Infrastructure as Code**: Complete Terraform definitions in `terraform/` for reproducible infrastructure management.

---

## 3. Directory Structure

```
secure-file-vault/
├── ARCHITECTURE.md             # Technical architecture & design specification
├── PRODUCTION_READINESS.md     # Production audit checklist
├── backend/
│   ├── Dockerfile              # Multi-stage production Node.js Alpine build
│   ├── package.json
│   └── src/
│       ├── server.js           # Express API server, security headers, rate limiters
│       ├── config/
│       │   └── gcp.js          # GCS 3-bucket storage client & signed URLs
│       ├── db/
│       │   └── connection.js   # Cloud SQL pool, Secret Manager, schema migrations
│       ├── middleware/
│       │   ├── auth.js         # JWT access & refresh token verification
│       │   ├── authorize.js    # Centralized RBAC & BOLA/IDOR authorization
│       │   ├── requestId.js    # X-Request-ID correlation tracking
│       │   └── securityHeaders.js # Production HSTS, CSP, & security headers
│       ├── routes/
│       │   ├── admin.routes.js # User & folder administrative management
│       │   ├── auth.routes.js  # Registration, login, token refresh
│       │   └── files.routes.js # Upload URL generation, confirm, download
│       └── services/
│           ├── logger.js       # Structured JSON logger for Cloud Logging
│           ├── pubsub.js       # Pub/Sub event messaging
│           └── scanner.js      # Async malware & validation state machine
├── frontend/
│   ├── Dockerfile              # Multi-stage Nginx Alpine build for React SPA
│   ├── nginx.conf              # SPA routing, caching, & security headers
│   └── src/
│       ├── api/client.js       # Axios client with token refresh & configurable base URL
│       ├── context/AuthContext.jsx # Auth state management
│       ├── components/         # LargeFileUploader, Navbar
│       └── pages/              # AdminDashboard, UserDashboard, LoginPage
└── terraform/                  # Infrastructure as Code
    ├── main.tf, variables.tf, vpc.tf, database.tf, storage.tf
    ├── secrets.tf, iam.tf, cloud_run.tf, load_balancer.tf, pubsub.tf, outputs.tf
```

---

## 4. Environment Variables

### Backend Configuration (`backend/.env`)

```env
PORT=8080
GCP_PROJECT_ID=your-gcp-project-id

# Cloud SQL Private IP settings
CLOUD_SQL_CONNECTION_NAME=your-project:us-central1:secure-app-db
DB_HOST=10.0.1.5
DB_USER=postgres
DB_NAME=file_vault_db
DB_PORT=5432
# DB_PASSWORD is fetched from Secret Manager in production:
# SECRET_DB_PASSWORD_NAME=projects/PROJECT_ID/secrets/db-password/versions/latest

# Google Cloud Storage (3-Bucket Architecture)
GCS_QUARANTINE_BUCKET=your-project-quarantine
GCS_CLEAN_BUCKET=your-project-clean
GCS_REJECTED_BUCKET=your-project-rejected

# CORS Allowed Origins (comma-separated)
ALLOWED_ORIGINS=https://vault.example.com

# Pub/Sub Integration
PUBSUB_ENABLED=true
PUBSUB_TOPIC=file-uploaded-topic
```

---

## 5. Development & Build Verification

### Local Development

```bash
# Start backend API (port 8080)
cd backend
npm run dev

# Start frontend dev server (port 3005)
cd frontend
npm run dev
```

### Production Build Verification

```bash
# Verify backend syntax
cd backend && node --check src/server.js

# Build frontend SPA bundle
cd frontend && npm run build

# Container builds
docker build -t secure-vault-backend:v1.0.0 ./backend
docker build -t secure-vault-frontend:v1.0.0 ./frontend
```
