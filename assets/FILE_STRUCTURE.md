# Secure Enterprise File Vault - Technical File Structure & Component Reference

This document provides a technical breakdown of every file across the backend microservice and frontend Single Page Application (SPA).

---

## 1. Backend Microservice Architecture (`backend/src`)

### 1.1 `server.js` - Application Entry Point
- **Role**: Primary Express server entry point.
- **Responsibilities**:
  - Configures security middleware (`helmet`, `cors`, `express.json`).
  - Registers REST API routers (`/api/auth`, `/api/admin`, `/api/files`).
  - Initializes database connection and DDL schema migrations (`initDb()`).
  - Serves compiled React Single Page Application (SPA) static files from `public/` with a catch-all fallback route (`* -> public/index.html`).

### 1.2 `config/gcp.js` - Google Cloud Storage Integration
- **Role**: Google Cloud Storage SDK client wrapper.
- **Responsibilities**:
  - Initializes `@google-cloud/storage` SDK using GCP IAM Managed Identity credentials.
  - Generates GCS Resumable Upload session URLs (`file.createResumableUpload`) for 1.5GB+ client uploads.
  - Generates V4 Signed Download URLs (`file.getSignedUrl`) for authorized file downloads.

### 1.3 `db/connection.js` - Database Pool & Migrations
- **Role**: PostgreSQL driver and DDL migration engine.
- **Responsibilities**:
  - Manages `pg.Pool` connection pool connecting to Cloud SQL (`secure-app-db`).
  - Automatically creates database `file_vault_db` on server startup if missing.
  - Automatically executes DDL table migrations (`runMigrations()`) for `users`, `folders`, `user_folder_permissions`, `file_metadata`, and `audit_logs`.

### 1.4 `middleware/auth.js` - Security & RBAC Middleware
- **Role**: Authentication and Role-Based Access Control handler.
- **Responsibilities**:
  - `authenticateToken`: Parses `Authorization: Bearer <token>` HTTP headers and verifies JWT signatures.
  - `requireAdmin`: Enforces RBAC restrictions to ensure non-admin users cannot access administrative endpoints.
  - Generates cryptographically secure 256-bit runtime keys (`crypto.randomBytes(32)`) if `JWT_SECRET` environment variables are omitted.

### 1.5 `routes/auth.routes.js` - Authentication API Endpoints
- **Role**: Manages user authentication and session lifecycle.
- **Responsibilities**:
  - `POST /api/auth/register`: Hashes passwords with bcrypt (10 rounds) and auto-promotes `tushar.seth@cloudkaptan.com` to `ADMIN`.
  - `POST /api/auth/login`: Authenticates credentials against bcrypt hashes in Cloud SQL and issues 8-hour JWT session tokens.
  - `GET /api/auth/me`: Retrieves current authenticated user profile details.

### 1.6 `routes/admin.routes.js` - Admin Control Center API
- **Role**: Administrative operations (protected by `requireAdmin`).
- **Responsibilities**:
  - `GET /api/admin/users`: Lists all system accounts with assigned folder rights.
  - `POST /api/admin/users`: Provisions user accounts with initial folder permissions.
  - `POST /api/admin/permissions`: Updates granular `View/Download` (`can_read`) and `Upload` (`can_upload`) rights per folder.
  - `POST /api/admin/folders`: Provisions corporate storage folders.
  - `GET /api/admin/audit-logs`: Retrieves immutable security audit log history.

### 1.7 `routes/files.routes.js` - File & Storage API Endpoints
- **Role**: File operations, permissions validation, and GCS streaming.
- **Responsibilities**:
  - `GET /api/files/my-folders`: Returns accessible folders along with `can_read` and `can_upload` boolean flags.
  - `POST /api/files/generate-upload-url`: Validates `can_upload` permission and returns GCS resumable upload sessions.
  - `POST /api/files/upload-direct`: API direct streaming upload fallback to bypass browser CORS blocks.
  - `POST /api/files/confirm-upload`: Records file size and GCS path metadata in PostgreSQL.
  - `GET /api/files/download-url/:fileId`: Generates 1-hour signed download URLs for authorized users.

### 1.8 `Dockerfile` - Containerization Engine
- **Role**: Docker image specification for Cloud Run deployment.
- **Responsibilities**:
  - Sets up lightweight Node.js base container image.
  - Installs production dependencies (`npm install --omit=dev`).
  - Bundles backend source code and React static build (`public/`).
  - Exposes port 8080 and starts the server via `node src/server.js`.

---

## 2. Frontend Single Page Application Architecture (`frontend/src`)

### 2.1 `src/App.jsx` - Application Router & Auth State Manager
- **Role**: Root React component and authentication controller.
- **Responsibilities**:
  - Reads and validates the active session token (`vault_auth_token`) from `localStorage`.
  - Manages globally shared user state (`user`, `token`, `loading`).
  - Renders the global `Navbar` component.
  - Dynamically routes users to `AdminDashboard` (if `role === 'ADMIN'`) or `UserDashboard` (if `role === 'USER'`), or presents `LoginPage` if unauthenticated.

### 2.2 `src/index.css` - Global Design System & Tokens
- **Role**: Custom Vanilla CSS styling system.
- **Responsibilities**:
  - Defines cohesive design tokens (`--primary`, `--bg-subtle`, `--border-subtle`).
  - Styles custom tables (`custom-table`), badges (`badge-admin`, `badge-user`, `badge-neutral`), form inputs (`form-input`), and card panels (`card-panel`).
  - Configures Inter typography, responsive layouts, and modal overlay animations.

### 2.3 `src/api/client.js` - Axios API Client
- **Role**: Centralized HTTP network client.
- **Responsibilities**:
  - Configured with relative base URL `/api` so API requests route seamlessly to the same Cloud Run origin.
  - Intercepts outgoing requests to automatically inject `Authorization: Bearer <token>` HTTP headers.
  - Intercepts 401 Unauthorized responses to automatically clear stale session tokens and redirect to login.

### 2.4 `src/components/Navbar.jsx` - Top Header Bar
- **Role**: Primary navigation header.
- **Responsibilities**:
  - Displays application branding ("Enterprise File Vault").
  - Displays GCP security badge ("IAM Managed Identity").
  - Shows logged-in user name and role badge (`ADMIN` / `USER`).
  - Provides a 1-click Sign Out button to clear local storage and reset session state.

### 2.5 `src/components/LargeFileUploader.jsx` - GCS Resumable Uploader Engine
- **Role**: Handles 1.5GB+ direct file streaming to Google Cloud Storage.
- **Responsibilities**:
  - Streams file chunks directly to `storage.googleapis.com` using `XMLHttpRequest`.
  - Calculates real-time upload speed (`MB/s`) and percentage progress.
  - Pause & Resume: Implements Pause (`xhr.abort()`) and Resume (queries GCS `308 Resume Incomplete` range headers and streams remaining bytes via `file.slice()`).
  - Automatic API Stream Fallback: Seamlessly falls back to streaming via `/api/files/upload-direct` if client browser CORS policies block direct GCS `PUT` requests.

### 2.6 `src/pages/LoginPage.jsx` - User Sign In & Registration
- **Role**: Entry authentication page.
- **Responsibilities**:
  - Renders tabs for Sign In and Create Account.
  - Enforces client-side validation for Name, Email, and Password fields.
  - Auto-promotes `tushar.seth@cloudkaptan.com` to `ADMIN` on registration while defaulting all other accounts to `USER`.

### 2.7 `src/pages/AdminDashboard.jsx` - Admin Control Center
- **Role**: Full-featured administrative control panel.
- **Responsibilities**:
  - Displays tabbed navigation for Users, Folders, and Audit Logs.
  - New User Modal: Provisions accounts with explicit `View/Download` (`can_read`) and `Upload` (`can_upload`) checkboxes for each folder.
  - Edit Permissions Modal: Allows Admins to modify existing user folder access rights anytime.
  - New Folder Modal: Provisions GCS prefix paths (e.g., `operations`).
  - Renders real-time security audit log entries.

### 2.8 `src/pages/UserDashboard.jsx` - User Workspace
- **Role**: End-user document management workspace.
- **Responsibilities**:
  - Lists assigned storage folders with `View Only` badges on restricted folders.
  - Read-Only Access Notice: Hides `LargeFileUploader` and displays a Read-Only notice if `can_upload` is `false`.
  - Lists files stored in the active folder with 1-click Download buttons.
