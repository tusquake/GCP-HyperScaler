variable "network_name" {
  type        = string
  description = "Name of the Custom VPC network"
}

variable "subnet_name" {
  type        = string
  description = "Name of the Subnet"
}

variable "region" {
  type        = string
  description = "GCP Region for Subnet"
}

variable "ip_cidr" {
  type        = string
  description = "IP CIDR range for Subnet"
}
