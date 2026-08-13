# ==================================================================
# Outputs
# ==================================================================

output "frontend_cloud_run_url" {
  description = "Frontend Cloud Run URL"
  value       = google_cloud_run_v2_service.frontend.uri
}

output "backend_cloud_run_url" {
  description = "Backend Cloud Run URL"
  value       = google_cloud_run_v2_service.backend.uri
}

output "cloud_sql_private_ip" {
  description = "Private IP of Cloud SQL PostgreSQL Instance"
  value       = google_sql_database_instance.postgres.private_ip_address
}

output "gcs_quarantine_bucket" {
  description = "GCS Quarantine Bucket Name"
  value       = google_storage_bucket.quarantine.name
}

output "gcs_clean_bucket" {
  description = "GCS Clean Bucket Name"
  value       = google_storage_bucket.clean.name
}

output "gcs_rejected_bucket" {
  description = "GCS Rejected Bucket Name"
  value       = google_storage_bucket.rejected.name
}
