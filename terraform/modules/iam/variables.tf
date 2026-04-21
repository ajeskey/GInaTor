variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "ecr_repository_arn" {
  description = "ECR repository ARN"
  type        = string
}

variable "log_group_arn" {
  description = "CloudWatch Log Group ARN"
  type        = string
}

variable "dynamodb_table_arns" {
  description = "Map of DynamoDB table ARNs"
  type        = map(string)
}
