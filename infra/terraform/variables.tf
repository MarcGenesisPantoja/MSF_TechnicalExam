variable "project" {
  description = "Short project name, used as a prefix for resource names."
  type        = string
  default     = "supportfinder"
}

variable "environment" {
  description = "Environment name (dev, tst, prd)."
  type        = string

  validation {
    condition     = contains(["dev", "tst", "prd"], var.environment)
    error_message = "environment must be one of dev, tst, prd."
  }
}

variable "owner" {
  description = "Team or person accountable for the stack (tag value)."
  type        = string
}

variable "aws_region" {
  description = "AWS region. ap-southeast-1 for Singapore / GCC."
  type        = string
  default     = "ap-southeast-1"
}

# ---------------------------------------------------------------- network

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "availability_zones" {
  description = "Zones the stack may use, in order. The first az_count are used."
  type        = list(string)
  default     = ["ap-southeast-1a", "ap-southeast-1b", "ap-southeast-1c"]
}

variable "az_count" {
  description = "Number of availability zones to spread subnets across (2 or 3)."
  type        = number
  default     = 2

  validation {
    condition     = var.az_count >= 2 && var.az_count <= 3
    error_message = "az_count must be 2 or 3 for high availability."
  }
}

variable "single_nat_gateway" {
  description = "Use one NAT gateway for all AZs (cheaper, not AZ-resilient). Set false in production."
  type        = bool
  default     = true
}

variable "allowed_ingress_cidrs" {
  description = "CIDRs allowed to reach the load balancer on HTTPS (e.g. agency network ranges)."
  type        = list(string)
}

# ---------------------------------------------------------------- compute

variable "frontend_count" {
  description = "Number of OutSystems front-end servers behind the load balancer."
  type        = number
  default     = 2
}

variable "frontend_instance_type" {
  description = "EC2 instance type for front-end servers."
  type        = string
  default     = "m6i.large"
}

variable "controller_instance_type" {
  description = "EC2 instance type for the deployment controller server."
  type        = string
  default     = "m6i.large"
}

variable "root_volume_size_gb" {
  description = "Root EBS volume size for Windows servers."
  type        = number
  default     = 100
}

variable "platform_ports" {
  description = "TCP ports used between OutSystems servers (deployment controller, deployment service, scheduler, cache invalidation). Confirm against the network requirements of the Platform Server version being installed."
  type        = list(number)
  default     = [12000, 12001, 12002, 12003, 5672]
}

# ---------------------------------------------------------------- database

variable "db_engine" {
  description = "RDS SQL Server edition (sqlserver-se or sqlserver-ee)."
  type        = string
  default     = "sqlserver-se"
}

variable "db_engine_version" {
  description = "RDS SQL Server engine version."
  type        = string
  default     = "16.00.4165.4.v1"
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.m6i.large"
}

variable "db_allocated_storage_gb" {
  description = "Initial allocated storage for the database."
  type        = number
  default     = 100
}

variable "db_max_allocated_storage_gb" {
  description = "Upper limit for storage autoscaling."
  type        = number
  default     = 500
}

variable "db_multi_az" {
  description = "Run the database as Multi-AZ (synchronous standby in another AZ)."
  type        = bool
  default     = false
}

variable "db_backup_retention_days" {
  description = "Days to keep automated RDS backups (point-in-time recovery window)."
  type        = number
  default     = 7
}

variable "db_deletion_protection" {
  description = "Prevent the database from being deleted by mistake."
  type        = bool
  default     = true
}

# ---------------------------------------------------------------- edge

variable "certificate_arn" {
  description = "ACM certificate ARN for the HTTPS listener."
  type        = string
}

variable "health_check_path" {
  description = "Path the load balancer polls on each front-end."
  type        = string
  default     = "/"
}

variable "waf_rate_limit_per_5min" {
  description = "Requests per 5 minutes per client IP before WAF blocks it."
  type        = number
  default     = 2000
}

# ---------------------------------------------------------------- operations

variable "alarm_email" {
  description = "Email address subscribed to operational alarms. Leave empty to skip the subscription."
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch log retention."
  type        = number
  default     = 90
}

variable "backup_bucket_retention_days" {
  description = "Days to keep native SQL Server backup files in S3."
  type        = number
  default     = 365
}
