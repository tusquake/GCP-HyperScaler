variable "project_id" {
  type        = string
  description = "Target GCP Project ID"
}

variable "region" {
  type        = string
  description = "Default GCP Region"
  default     = "us-central1"
}

variable "environment" {
  type        = string
  description = "Deployment environment name"
  default     = "prod"
}
