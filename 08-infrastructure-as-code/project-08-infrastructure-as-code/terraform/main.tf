provider "google" {
  project = var.project_id
  region  = var.region
}

module "vpc" {
  source       = "./modules/vpc"
  network_name = "vpc-tf-${var.environment}"
  subnet_name  = "sb-tf-${var.region}"
  region       = var.region
  ip_cidr      = "10.10.0.0/24"
}
