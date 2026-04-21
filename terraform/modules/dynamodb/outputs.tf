output "table_arns" {
  description = "ARNs of all DynamoDB tables"
  value = {
    users              = aws_dynamodb_table.users.arn
    sessions           = aws_dynamodb_table.sessions.arn
    commits            = aws_dynamodb_table.commits.arn
    repository_configs = aws_dynamodb_table.repository_configs.arn
    admin_settings     = aws_dynamodb_table.admin_settings.arn
    sprint_markers     = aws_dynamodb_table.sprint_markers.arn
    annotations        = aws_dynamodb_table.annotations.arn
    bookmarks          = aws_dynamodb_table.bookmarks.arn
  }
}
