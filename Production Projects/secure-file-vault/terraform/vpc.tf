# ==================================================================
# VPC Network & Private Service Access
# ==================================================================
# 
# Architecture:
#   Cloud Run (Direct VPC Egress) -> file-vault-vpc -> Private Service Access -> Cloud SQL
#
# Why a custom VPC:
# - Cloud SQL Private IP requires a VPC with Private Service Access peering
# - Direct VPC Egress allows Cloud Run to reach private-IP Cloud SQL
# - No VPC Connector needed (Direct VPC Egress is cheaper and simpler)
# - Database is never exposed to the public internet
# ==================================================================

resource "google_compute_network" "vpc" {
  name                    = "file-vault-vpc"
  auto_create_subnetworks = false
  project                 = var.project_id
}

resource "google_compute_subnetwork" "subnet" {
  name          = "file-vault-subnet"
  ip_cidr_range = "10.0.1.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id
  project       = var.project_id

  # Enable Private Google Access so Cloud Run can reach Google APIs
  # without public IP addresses
  private_ip_google_access = true
}

# Private Service Access: Allocates an IP range for Google-managed services
# (Cloud SQL, Memorystore, etc.) within the VPC.
resource "google_compute_global_address" "private_ip_range" {
  name          = "file-vault-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
  project       = var.project_id
}

# Establish the peering connection between the VPC and Google's
# managed services network. This allows Cloud SQL to use a private IP.
resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# Firewall: Allow ingress from Cloud Run to Cloud SQL (PostgreSQL port 5432)
resource "google_compute_firewall" "allow_cloud_run_to_sql" {
  name    = "allow-cloud-run-to-cloudsql"
  network = google_compute_network.vpc.name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["5432"]
  }

  # Allow from the Cloud Run subnet
  source_ranges = [google_compute_subnetwork.subnet.ip_cidr_range]
  direction     = "INGRESS"
}
