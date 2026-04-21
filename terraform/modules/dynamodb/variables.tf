variable "table_names" {
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
}
