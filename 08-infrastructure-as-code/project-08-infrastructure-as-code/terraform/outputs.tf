output "vpc_id" {
  value       = module.vpc.vpc_id
  description = "ID of the created Custom VPC Network"
}

output "subnet_id" {
  value       = module.vpc.subnet_id
  description = "ID of the created Subnet"
}
