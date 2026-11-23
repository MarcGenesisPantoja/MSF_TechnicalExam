resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db"
  subnet_ids = aws_subnet.data[*].id
}

# Native backup/restore lets the platform DBA take .bak files to S3, which is how
# OutSystems databases are usually moved between environments or restored for RCA.
resource "aws_db_option_group" "sqlserver" {
  name                 = "${local.name}-sqlserver"
  engine_name          = var.db_engine
  major_engine_version = join(".", slice(split(".", var.db_engine_version), 0, 2))

  option {
    option_name = "SQLSERVER_BACKUP_RESTORE"

    option_settings {
      name  = "IAM_ROLE_ARN"
      value = aws_iam_role.rds_backup.arn
    }
  }
}

# Reject unencrypted client connections to SQL Server.
resource "aws_db_parameter_group" "sqlserver" {
  name   = "${local.name}-sqlserver"
  family = "${var.db_engine}-${join(".", slice(split(".", var.db_engine_version), 0, 1))}.0"

  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }
}

resource "aws_db_instance" "main" {
  identifier     = "${local.name}-sql"
  engine         = var.db_engine
  engine_version = var.db_engine_version
  license_model  = "license-included"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage_gb
  max_allocated_storage = var.db_max_allocated_storage_gb
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.main.arn

  username                      = "osadmin"
  manage_master_user_password   = true # password generated and rotated in Secrets Manager
  master_user_secret_kms_key_id = aws_kms_key.main.arn

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  option_group_name      = aws_db_option_group.sqlserver.name
  parameter_group_name   = aws_db_parameter_group.sqlserver.name
  publicly_accessible    = false
  multi_az               = var.db_multi_az

  backup_retention_period  = var.db_backup_retention_days
  backup_window            = "17:00-18:00" # 01:00-02:00 SGT, before the 02:00 sync timer
  maintenance_window       = "sun:18:30-sun:19:30"
  copy_tags_to_snapshot    = true
  delete_automated_backups = false

  deletion_protection       = var.db_deletion_protection
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name}-sql-final"

  performance_insights_enabled          = true
  performance_insights_kms_key_id       = aws_kms_key.main.arn
  performance_insights_retention_period = 7
  monitoring_interval                   = 60
  monitoring_role_arn                   = aws_iam_role.rds_monitoring.arn
  enabled_cloudwatch_logs_exports       = ["error", "agent"]

  auto_minor_version_upgrade = true
}

resource "aws_iam_role" "rds_monitoring" {
  name = "${local.name}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}
