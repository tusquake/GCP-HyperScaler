# ==================================================================
# Cloud SQL PostgreSQL (Private IP Only)
# ==================================================================
#
# Architecture:
#   Cloud Run -> Direct VPC Egress -> VPC -> Private Service Access -> Cloud SQL
#
# Security:
# - No public IP (ipv4_enabled = false)
# - Only accessible from within the VPC
# - Automated backups with 7-day retention
# - Point-in-time recovery enabled
# - Maintenance window set for Sunday 3 AM
# ==================================================================

resource "google_sql_database_instance" "postgres" {
  name             = "secure-app-db"
  database_version = "POSTGRES_15"
  region           = var.region
  project          = var.project_id

  # Wait for Private Service Access peering to be established
  depends_on = [google_service_networking_connection.private_vpc_connection]

  settings {
    tier              = var.db_tier
    availability_type = var.environment == "production" ? "REGIONAL" : "ZONAL"
    disk_autoresize   = true
    disk_size         = 10  # GB, auto-resizes as needed

    ip_configuration {
      # CRITICAL: No public IP. Database is private-only.
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"  # 3 AM UTC
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }
    }

    maintenance_window {
      day          = 7  # Sunday
      hour         = 3  # 3 AM UTC
      update_track = "stable"
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }

    insights_config {
      query_insights_enabled  = true
      record_application_tags = true
    }
  }

  deletion_protection = var.environment == "production" ? true : false
}

resource "google_sql_database" "vault_db" {
  name     = "file_vault_db"
  instance = google_sql_database_instance.postgres.name
  project  = var.project_id
}

# Database user (password stored in Secret Manager)
resource "google_sql_user" "db_user" {
  name     = "vault_app"
  instance = google_sql_database_instance.postgres.name
  password = random_password.db_password.result
  project  = var.project_id
}

resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!@#$%^&*"
}
