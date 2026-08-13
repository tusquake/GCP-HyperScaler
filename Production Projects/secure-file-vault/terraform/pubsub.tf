# ==================================================================
# Pub/Sub Messaging Pipeline
# ==================================================================
#
# Architecture:
#   GCS Object Creation -> GCS Notification -> Pub/Sub Topic -> Push Subscription -> Cloud Run Worker
# ==================================================================

resource "google_pubsub_topic" "file_uploaded" {
  name    = "file-uploaded-topic"
  project = var.project_id

  message_storage_policy {
    allowed_persistence_regions = [var.region]
  }
}

resource "google_pubsub_subscription" "file_scan_sub" {
  name                 = "file-scan-subscription"
  topic                = google_pubsub_topic.file_uploaded.name
  project              = var.project_id
  ack_deadline_seconds = 60

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.backend.uri}/api/files/pubsub-scan"

    oidc_token {
      service_account_email = google_service_account.scanner.email
    }
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }
}

resource "google_pubsub_topic" "dead_letter" {
  name    = "file-scan-dead-letter-topic"
  project = var.project_id
}
