# ==================================================================
# Cloud Run Services (Frontend & Backend Decoupled)
# ==================================================================
#
# Architecture:
# - Frontend Cloud Run (React SPA via Nginx): Low CPU, high concurrency, public ingress
# - Backend Cloud Run (Express API): Higher CPU, database connection pooling, Direct VPC Egress
# ==================================================================

# -------------------------------------------------------------------
# Backend Cloud Run Service
# -------------------------------------------------------------------
resource "google_cloud_run_v2_service" "backend" {
  name     = "secure-file-vault-backend"
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER" # Restrict to LB + Internal only

  template {
    service_account = google_service_account.backend.email

    # Direct VPC Subnet Egress for Private Cloud SQL access
    vpc_access {
      egress = "ALL_TRAFFIC"
      network_interfaces {
        network    = google_compute_network.vpc.id
        subnetwork = google_compute_subnetwork.subnet.id
      }
    }

    scaling {
      min_instance_count = var.environment == "production" ? 1 : 0
      max_instance_count = 10 # Limits total DB connections to 10 * 5 = 50
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/secure-vault-backend/backend:v1.0.0"

      resources {
        limits = {
          cpu    = "2000m"
          memory = "1024Mi"
        }
        cpu_idle = true
      }

      env {
        name  = "NODE_ENV"
        value = var.environment
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "CLOUD_SQL_CONNECTION_NAME"
        value = google_sql_database_instance.postgres.connection_name
      }
      env {
        name  = "DB_HOST"
        value = google_sql_database_instance.postgres.private_ip_address
      }
      env {
        name  = "DB_USER"
        value = google_sql_user.db_user.name
      }
      env {
        name  = "DB_NAME"
        value = google_sql_database.vault_db.name
      }
      env {
        name  = "SECRET_DB_PASSWORD_NAME"
        value = google_secret_manager_secret_version.db_password_version.name
      }
      env {
        name  = "GCS_QUARANTINE_BUCKET"
        value = google_storage_bucket.quarantine.name
      }
      env {
        name  = "GCS_CLEAN_BUCKET"
        value = google_storage_bucket.clean.name
      }
      env {
        name  = "GCS_REJECTED_BUCKET"
        value = google_storage_bucket.rejected.name
      }
      env {
        name  = "PUBSUB_ENABLED"
        value = "true"
      }
      env {
        name  = "PUBSUB_TOPIC"
        value = google_pubsub_topic.file_uploaded.name
      }

      startup_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
        period_seconds = 15
      }
    }

    max_instance_request_concurrency = 50
    timeout                          = "300s"
  }
}

# -------------------------------------------------------------------
# Frontend Cloud Run Service
# -------------------------------------------------------------------
resource "google_cloud_run_v2_service" "frontend" {
  name     = "secure-file-vault-frontend"
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_ALL" # Public SPA

  template {
    service_account = google_service_account.frontend.email

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/secure-vault-frontend/frontend:v1.0.0"

      resources {
        limits = {
          cpu    = "1000m"
          memory = "256Mi"
        }
        cpu_idle = true
      }

      startup_probe {
        http_get {
          path = "/healthz"
          port = 8080
        }
      }
    }

    max_instance_request_concurrency = 80
    timeout                          = "60s"
  }
}
