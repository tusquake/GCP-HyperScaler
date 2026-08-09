terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  backend "gcs" {
    # Bucket name will be dynamically injected during `terraform init -backend-config`
    prefix = "terraform/state/landing-zone"
  }
}
