output "alb_dns_name" {
  description = "Point the application DNS record (CNAME/alias) here."
  value       = aws_lb.main.dns_name
}

output "controller_instance_id" {
  description = "Connect with: aws ssm start-session --target <id>"
  value       = aws_instance.controller.id
}

output "frontend_instance_ids" {
  description = "Front-end server instance IDs."
  value       = aws_instance.frontend[*].id
}

output "db_endpoint" {
  description = "SQL Server endpoint used in the Platform Server Configuration Tool."
  value       = aws_db_instance.main.address
}

output "db_master_secret_arn" {
  description = "Secrets Manager ARN holding the database admin credentials."
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}

output "backup_bucket" {
  description = "S3 bucket for native SQL Server .bak files."
  value       = aws_s3_bucket.backups.bucket
}

output "alarm_topic_arn" {
  description = "SNS topic for operational alarms."
  value       = aws_sns_topic.alarms.arn
}
