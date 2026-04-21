output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.alb.dns_name
}

output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = module.ecr.repository_url
}

output "dynamodb_table_arns" {
  description = "ARNs of all DynamoDB tables"
  value       = module.dynamodb.table_arns
}
