# ==================================================================
# Google Cloud Storage (3-Bucket Architecture)
# ==================================================================
#
# Architecture:
#   Browser -> GCS Quarantine Bucket (direct resumable upload)
#   Scanner -> moves to Clean Bucket (if file passes validation)
#   Scanner -> moves to Rejected Bucket (if file fails validation)
#
# Security:
# - Uniform Bucket-Level Access (no per-object ACLs)
# - Public Access Prevention enforced on all buckets
# - No public objects, no public buckets
# - Lifecycle rules for automatic cleanup
# ==================================================================

# Quarantine Bucket: All uploads land here first
resource "google_storage_bucket" "quarantine" {
  name          = "${var.project_id}-quarantine"
  location      = var.region
  project       = var.project_id
  force_destroy = var.environment != "production"

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = false  # Quarantine files are transient
  }

  lifecycle_rule {
    condition {
      age = 7  # Auto-delete unprocessed quarantine files after 7 days
    }
    action {
      type = "Delete"
    }
  }
}

# Clean Bucket: Validated files served to users
resource "google_storage_bucket" "clean" {
  name          = "${var.project_id}-clean"
  location      = var.region
  project       = var.project_id
  force_destroy = var.environment != "production"

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true  # Enable versioning for clean files (disaster recovery)
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 3  # Keep last 3 versions of each file
    }
    action {
      type = "Delete"
    }
  }

  soft_delete_policy {
    retention_duration_seconds = 604800  # 7-day soft delete recovery window
  }
}

# Rejected Bucket: Malicious/invalid files for admin review
resource "google_storage_bucket" "rejected" {
  name          = "${var.project_id}-rejected"
  location      = var.region
  project       = var.project_id
  force_destroy = var.environment != "production"

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = false
  }

  lifecycle_rule {
    condition {
      age = 30  # Auto-delete rejected files after 30 days
    }
    action {
      type = "Delete"
    }
  }
}

# GCS Notification for Pub/Sub (triggers scan on upload)
resource "google_storage_notification" "quarantine_upload" {
  bucket         = google_storage_bucket.quarantine.name
  payload_format = "JSON_API_V1"
  topic          = google_pubsub_topic.file_uploaded.id
  event_types    = ["OBJECT_FINALIZE"]

  depends_on = [google_pubsub_topic_iam_member.gcs_publish]
}
