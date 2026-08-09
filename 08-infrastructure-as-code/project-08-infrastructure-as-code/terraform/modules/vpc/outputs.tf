output "vpc_id" {
  value       = google_compute_network.custom_vpc.id
  description = "ID of the created VPC Network"
}

output "subnet_id" {
  value       = google_compute_subnetwork.subnet.id
  description = "ID of the created Subnet"
}
