# ==================================================================
# Terraform Configuration for Secure Enterprise File Vault
# ==================================================================
# 
# This Terraform configuration defines the complete GCP infrastructure
# for the production deployment of the Secure File Vault.
#
# IMPORTANT: These files serve as Infrastructure-as-Code documentation.
# The user will create GCP resources manually using gcloud CLI.
# These Terraform files document the target state and can be used
# for automated provisioning in the future.
#
# Usage:
#   1. Copy terraform.tfvars.example to terraform.tfvars
#   2. Fill in your project_id and region
#   3. terraform init
#   4. terraform plan
#   5. terraform apply
# ==================================================================

terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # In production, use a GCS backend for remote state:
  # backend "gcs" {
  #   bucket = "your-project-terraform-state"
  #   prefix = "secure-file-vault"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
