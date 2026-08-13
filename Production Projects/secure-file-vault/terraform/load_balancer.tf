# ==================================================================
# Global HTTPS Load Balancer + Cloud Armor WAF + Serverless NEG
# ==================================================================
#
# Architecture:
#   Internet -> Cloud Armor Policy -> Global External HTTPS Load Balancer -> Serverless NEGs -> Cloud Run Services
# ==================================================================

# Serverless NEGs for Cloud Run integration
resource "google_compute_region_network_endpoint_group" "backend_neg" {
  name                  = "secure-vault-backend-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  project               = var.project_id
  cloud_run {
    service = google_cloud_run_v2_service.backend.name
  }
}

resource "google_compute_region_network_endpoint_group" "frontend_neg" {
  name                  = "secure-vault-frontend-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region
  project               = var.project_id
  cloud_run {
    service = google_cloud_run_v2_service.frontend.name
  }
}

# Cloud Armor Security Policy
resource "google_compute_security_policy" "cloud_armor" {
  name    = "secure-vault-armor-policy"
  project = var.project_id

  # Default rule: allow
  rule {
    action   = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow rule"
  }

  # Rate limiting rule: max 500 requests per 1 minute per client IP
  rule {
    action   = "throttle"
    priority = "1000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 500
        interval_sec = 60
      }
    }
    description = "Global IP throttling"
  }
}

# Backend Service for API
resource "google_compute_backend_service" "backend_service" {
  name                  = "secure-vault-backend-lb-service"
  project               = var.project_id
  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  security_policy       = google_compute_security_policy.cloud_armor.id

  backend {
    group = google_compute_region_network_endpoint_group.backend_neg.id
  }
}

# Backend Service for Frontend static SPA
resource "google_compute_backend_service" "frontend_service" {
  name                  = "secure-vault-frontend-lb-service"
  project               = var.project_id
  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  security_policy       = google_compute_security_policy.cloud_armor.id

  backend {
    group = google_compute_region_network_endpoint_group.frontend_neg.id
  }
}

# URL Map (Routing rules: /api/* -> backend, default -> frontend)
resource "google_compute_url_map" "url_map" {
  name            = "secure-vault-url-map"
  project         = var.project_id
  default_service = google_compute_backend_service.frontend_service.id

  host_rule {
    hosts        = ["*"]
    path_matcher = "all-paths"
  }

  path_matcher {
    name            = "all-paths"
    default_service = google_compute_backend_service.frontend_service.id

    path_rule {
      paths   = ["/api/*"]
      service = google_compute_backend_service.backend_service.id
    }
  }
}
