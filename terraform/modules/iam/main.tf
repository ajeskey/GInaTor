data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# --- ECS Task Execution Role (pulls images, writes logs) ---

resource "aws_iam_role" "execution" {
  name               = "${var.project_name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = { Name = "${var.project_name}-ecs-execution" }
}

data "aws_iam_policy_document" "execution" {
  statement {
    sid = "ECR"
    actions = [
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:GetAuthorizationToken"
    ]
    resources = ["*"]
  }

  statement {
    sid = "Logs"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ]
    resources = ["${var.log_group_arn}:*"]
  }
}

resource "aws_iam_role_policy" "execution" {
  name   = "${var.project_name}-execution-policy"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution.json
}

# --- ECS Task Role (application permissions: DynamoDB, CodeCommit) ---

resource "aws_iam_role" "task" {
  name               = "${var.project_name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = { Name = "${var.project_name}-ecs-task" }
}

data "aws_iam_policy_document" "task" {
  statement {
    sid = "DynamoDB"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:BatchGetItem",
      "dynamodb:BatchWriteItem"
    ]
    resources = concat(
      values(var.dynamodb_table_arns),
      [for arn in values(var.dynamodb_table_arns) : "${arn}/index/*"]
    )
  }

  statement {
    sid = "CodeCommit"
    actions = [
      "codecommit:GetRepository",
      "codecommit:GitPull",
      "codecommit:GetBranch",
      "codecommit:GetCommit",
      "codecommit:GetDifferences",
      "codecommit:BatchGetCommits"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "task" {
  name   = "${var.project_name}-task-policy"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task.json
}
