resource "google_compute_network" "custom_vpc" {
  name                    = var.network_name
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name                     = var.subnet_name
  network                  = google_compute_network.custom_vpc.id
  region                   = var.region
  ip_cidr_range            = var.ip_cidr
  private_ip_google_access = true
}

resource "google_compute_firewall" "allow_internal" {
  name    = "${var.network_name}-allow-internal"
  network = google_compute_network.custom_vpc.id

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }
  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }
  allow {
    protocol = "icmp"
  }

  source_ranges = [var.ip_cidr]
}
