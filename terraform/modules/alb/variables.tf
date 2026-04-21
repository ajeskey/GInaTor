variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "public_subnets" {
  description = "Public subnet IDs for the ALB"
  type        = list(string)
}

variable "security_groups" {
  description = "Security group IDs for the ALB"
  type        = list(string)
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS listener"
  type        = string
  default     = ""
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
}
