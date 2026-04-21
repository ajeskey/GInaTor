variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "private_subnets" {
  description = "Private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "security_groups" {
  description = "Security group IDs for ECS tasks"
  type        = list(string)
}

variable "target_group_arn" {
  description = "ALB target group ARN"
  type        = string
}

variable "execution_role_arn" {
  description = "ECS task execution role ARN"
  type        = string
}

variable "task_role_arn" {
  description = "ECS task role ARN"
  type        = string
}

variable "ecr_repository_url" {
  description = "ECR repository URL"
  type        = string
}

variable "container_image_tag" {
  description = "Docker image tag"
  type        = string
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
}

variable "desired_count" {
  description = "Number of tasks to run"
  type        = number
}

variable "log_group_name" {
  description = "CloudWatch Log Group name"
  type        = string
}

variable "session_secret" {
  description = "Express session secret"
  type        = string
  sensitive   = true
}

variable "encryption_key" {
  description = "AES-256-GCM encryption key"
  type        = string
  sensitive   = true
}
