# ==================================================================
# IAM Service Accounts & Least-Privilege Bindings
# ==================================================================
#
# Service Account Matrix:
#
# | Service Account          | Purpose              | IAM Roles                                        |
# |--------------------------|----------------------|--------------------------------------------------|
# | file-vault-backend-sa    | Backend Cloud Run    | cloudsql.client, secretmanager.secretAccessor,   |
# |                          |                      | storage.objectAdmin (3 buckets), pubsub.publisher|
# | file-vault-frontend-sa   | Frontend Cloud Run   | logging.logWriter (minimal)                      |
# | file-vault-scanner-sa    | Background scanner   | storage.objectAdmin (3 buckets),                 |
# |                          |                      | pubsub.subscriber, cloudsql.client               |
# ==================================================================

# Backend Service Account
resource "google_service_account" "backend" {
  account_id   = "file-vault-backend-sa"
  display_name = "File Vault Backend Service Account"
  project      = var.project_id
}

# Frontend Service Account (minimal permissions)
resource "google_service_account" "frontend" {
  account_id   = "file-vault-frontend-sa"
  display_name = "File Vault Frontend Service Account"
  project      = var.project_id
}

# Scanner Service Account
resource "google_service_account" "scanner" {
  account_id   = "file-vault-scanner-sa"
  display_name = "File Vault Scanner Service Account"
  project      = var.project_id
}

# -------------------------------------------------------------------
# Backend IAM Bindings
# -------------------------------------------------------------------

# Cloud SQL access (connect to private PostgreSQL)
resource "google_project_iam_member" "backend_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.backend.email}"
}

# Secret Manager read access (fetch db-password, jwt-secret)
resource "google_secret_manager_secret_iam_member" "backend_db_password" {
  secret_id = google_secret_manager_secret.db_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_secret_manager_secret_iam_member" "backend_jwt_secret" {
  secret_id = google_secret_manager_secret.jwt_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}

# GCS access (read/write to all 3 buckets for upload URL generation and file management)
resource "google_storage_bucket_iam_member" "backend_quarantine" {
  bucket = google_storage_bucket.quarantine.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_storage_bucket_iam_member" "backend_clean" {
  bucket = google_storage_bucket.clean.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_storage_bucket_iam_member" "backend_rejected" {
  bucket = google_storage_bucket.rejected.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.backend.email}"
}

# Pub/Sub publish access (publish FILE_UPLOADED events)
resource "google_project_iam_member" "backend_pubsub" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.backend.email}"
}

# -------------------------------------------------------------------
# Frontend IAM Bindings (minimal)
# -------------------------------------------------------------------

resource "google_project_iam_member" "frontend_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.frontend.email}"
}

# -------------------------------------------------------------------
# Scanner IAM Bindings
# -------------------------------------------------------------------

resource "google_project_iam_member" "scanner_cloudsql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.scanner.email}"
}

resource "google_storage_bucket_iam_member" "scanner_quarantine" {
  bucket = google_storage_bucket.quarantine.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.scanner.email}"
}

resource "google_storage_bucket_iam_member" "scanner_clean" {
  bucket = google_storage_bucket.clean.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.scanner.email}"
}

resource "google_storage_bucket_iam_member" "scanner_rejected" {
  bucket = google_storage_bucket.rejected.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.scanner.email}"
}

resource "google_project_iam_member" "scanner_pubsub" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  member  = "serviceAccount:${google_service_account.scanner.email}"
}

# -------------------------------------------------------------------
# GCS -> Pub/Sub Permission
# -------------------------------------------------------------------
# Allow GCS to publish notifications to the Pub/Sub topic
data "google_storage_project_service_account" "gcs_account" {
  project = var.project_id
}

resource "google_pubsub_topic_iam_member" "gcs_publish" {
  topic  = google_pubsub_topic.file_uploaded.id
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:${data.google_storage_project_service_account.gcs_account.email_address}"
}
