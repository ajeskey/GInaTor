variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "ginator"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "container_image_tag" {
  description = "Docker image tag for the ECS task"
  type        = string
  default     = "latest"
}

variable "desired_task_count" {
  description = "Number of ECS Fargate tasks to run"
  type        = number
  default     = 1
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 3000
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS listener"
  type        = string
  default     = ""
}

variable "dynamodb_table_names" {
  description = "DynamoDB table name overrides"
  type = object({
    users              = string
    sessions           = string
    commits            = string
    repository_configs = string
    admin_settings     = string
    sprint_markers     = string
    annotations        = string
    bookmarks          = string
  })
  default = {
    users              = "Users"
    sessions           = "Sessions"
    commits            = "Commits"
    repository_configs = "RepositoryConfigs"
    admin_settings     = "AdminSettings"
    sprint_markers     = "SprintMarkers"
    annotations        = "Annotations"
    bookmarks          = "Bookmarks"
  }
}

variable "session_secret" {
  description = "Secret for express-session"
  type        = string
  sensitive   = true
  default     = "change-me-in-production"
}

variable "encryption_key" {
  description = "AES-256-GCM encryption key for stored secrets"
  type        = string
  sensitive   = true
  default     = "change-me-in-production"
}
