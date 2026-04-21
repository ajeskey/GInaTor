# --- Users table ---
resource "aws_dynamodb_table" "users" {
  name         = var.table_names.users
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }

  tags = { Name = var.table_names.users }
}

# --- Sessions table (with TTL) ---
resource "aws_dynamodb_table" "sessions" {
  name         = var.table_names.sessions
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sessionId"

  attribute {
    name = "sessionId"
    type = "S"
  }

  ttl {
    attribute_name = "expires"
    enabled        = true
  }

  tags = { Name = var.table_names.sessions }
}

# --- Commits table ---
resource "aws_dynamodb_table" "commits" {
  name         = var.table_names.commits
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "repositoryId"
  range_key    = "commitHash"

  attribute {
    name = "repositoryId"
    type = "S"
  }

  attribute {
    name = "commitHash"
    type = "S"
  }

  attribute {
    name = "commitDate"
    type = "S"
  }

  global_secondary_index {
    name            = "repo-date-index"
    hash_key        = "repositoryId"
    range_key       = "commitDate"
    projection_type = "ALL"
  }

  tags = { Name = var.table_names.commits }
}

# --- RepositoryConfigs table ---
resource "aws_dynamodb_table" "repository_configs" {
  name         = var.table_names.repository_configs
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "repoId"

  attribute {
    name = "repoId"
    type = "S"
  }

  tags = { Name = var.table_names.repository_configs }
}

# --- AdminSettings table ---
resource "aws_dynamodb_table" "admin_settings" {
  name         = var.table_names.admin_settings
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "settingKey"

  attribute {
    name = "settingKey"
    type = "S"
  }

  tags = { Name = var.table_names.admin_settings }
}

# --- SprintMarkers table ---
resource "aws_dynamodb_table" "sprint_markers" {
  name         = var.table_names.sprint_markers
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "repositoryId"
  range_key    = "markerId"

  attribute {
    name = "repositoryId"
    type = "S"
  }

  attribute {
    name = "markerId"
    type = "S"
  }

  tags = { Name = var.table_names.sprint_markers }
}

# --- Annotations table ---
resource "aws_dynamodb_table" "annotations" {
  name         = var.table_names.annotations
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "repositoryId"
  range_key    = "annotationId"

  attribute {
    name = "repositoryId"
    type = "S"
  }

  attribute {
    name = "annotationId"
    type = "S"
  }

  tags = { Name = var.table_names.annotations }
}

# --- Bookmarks table ---
resource "aws_dynamodb_table" "bookmarks" {
  name         = var.table_names.bookmarks
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "bookmarkId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "bookmarkId"
    type = "S"
  }

  tags = { Name = var.table_names.bookmarks }
}
