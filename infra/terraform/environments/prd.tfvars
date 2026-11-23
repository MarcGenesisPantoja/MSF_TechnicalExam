environment = "prd"
owner       = "supportfinder-team"

az_count           = 3
single_nat_gateway = false

frontend_count         = 3
frontend_instance_type = "m6i.xlarge"

db_instance_class        = "db.m6i.xlarge"
db_multi_az              = true
db_backup_retention_days = 35
db_deletion_protection   = true

allowed_ingress_cidrs = ["203.0.113.0/24"]

certificate_arn = "arn:aws:acm:ap-southeast-1:111111111111:certificate/00000000-0000-0000-0000-000000000000"

alarm_email = "ops@example.gov.sg"

log_retention_days = 365
