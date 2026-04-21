terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "vpc" {
  source       = "./modules/vpc"
  project_name = var.project_name
  vpc_cidr     = var.vpc_cidr
}

module "ecr" {
  source       = "./modules/ecr"
  project_name = var.project_name
}

module "dynamodb" {
  source      = "./modules/dynamodb"
  table_names = var.dynamodb_table_names
}

module "cloudwatch" {
  source       = "./modules/cloudwatch"
  project_name = var.project_name
}

module "iam" {
  source              = "./modules/iam"
  project_name        = var.project_name
  ecr_repository_arn  = module.ecr.repository_arn
  log_group_arn       = module.cloudwatch.log_group_arn
  dynamodb_table_arns = module.dynamodb.table_arns
}

module "alb" {
  source          = "./modules/alb"
  project_name    = var.project_name
  vpc_id          = module.vpc.vpc_id
  public_subnets  = module.vpc.public_subnet_ids
  security_groups = [module.vpc.alb_security_group_id]
  certificate_arn = var.certificate_arn
  container_port  = var.container_port
}

module "ecs" {
  source                 = "./modules/ecs"
  project_name           = var.project_name
  aws_region             = var.aws_region
  private_subnets        = module.vpc.private_subnet_ids
  security_groups        = [module.vpc.ecs_security_group_id]
  target_group_arn       = module.alb.target_group_arn
  execution_role_arn     = module.iam.execution_role_arn
  task_role_arn          = module.iam.task_role_arn
  ecr_repository_url     = module.ecr.repository_url
  container_image_tag    = var.container_image_tag
  container_port         = var.container_port
  desired_count          = var.desired_task_count
  log_group_name         = module.cloudwatch.log_group_name
  session_secret         = var.session_secret
  encryption_key         = var.encryption_key
}
