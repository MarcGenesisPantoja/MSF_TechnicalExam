data "aws_caller_identity" "current" {}

# One customer-managed key for this stack: EBS, RDS, S3 backups, logs.
resource "aws_kms_key" "main" {
  description             = "${local.name} data encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 30

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AccountAdmin"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "CloudWatchLogs"
        Effect    = "Allow"
        Principal = { Service = "logs.${var.aws_region}.amazonaws.com" }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_kms_alias" "main" {
  name          = "alias/${local.name}"
  target_key_id = aws_kms_key.main.key_id
}

# ---------------------------------------------------------------- security groups
# Traffic path: client -> ALB (443) -> front-ends (443) -> RDS (1433)
# No security group allows RDP/SSH; administration is through SSM Session Manager.

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "Public HTTPS entry point"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  for_each          = toset(var.allowed_ingress_cidrs)
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from allowed range"
  cidr_ipv4         = each.value
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  for_each          = toset(var.allowed_ingress_cidrs)
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from allowed range (redirected to HTTPS)"
  cidr_ipv4         = each.value
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_frontend" {
  security_group_id            = aws_security_group.alb.id
  description                  = "To front-ends"
  referenced_security_group_id = aws_security_group.frontend.id
  from_port                    = 443
  to_port                      = 443
  ip_protocol                  = "tcp"
}

resource "aws_security_group" "frontend" {
  name        = "${local.name}-frontend"
  description = "OutSystems front-end servers (IIS)"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "frontend_from_alb" {
  security_group_id            = aws_security_group.frontend.id
  description                  = "HTTPS from load balancer"
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 443
  to_port                      = 443
  ip_protocol                  = "tcp"
}

resource "aws_security_group" "controller" {
  name        = "${local.name}-controller"
  description = "OutSystems deployment controller"
  vpc_id      = aws_vpc.main.id
}

# Platform services between controller and front-ends, both directions.
resource "aws_vpc_security_group_ingress_rule" "controller_from_frontend" {
  for_each                     = toset([for p in var.platform_ports : tostring(p)])
  security_group_id            = aws_security_group.controller.id
  description                  = "Platform service port ${each.value} from front-ends"
  referenced_security_group_id = aws_security_group.frontend.id
  from_port                    = tonumber(each.value)
  to_port                      = tonumber(each.value)
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "frontend_from_controller" {
  for_each                     = toset([for p in var.platform_ports : tostring(p)])
  security_group_id            = aws_security_group.frontend.id
  description                  = "Platform service port ${each.value} from controller"
  referenced_security_group_id = aws_security_group.controller.id
  from_port                    = tonumber(each.value)
  to_port                      = tonumber(each.value)
  ip_protocol                  = "tcp"
}

# Outbound HTTPS from app tier: data.gov.sg, OutSystems licensing, Windows Update, SSM.
resource "aws_vpc_security_group_egress_rule" "frontend_https_out" {
  security_group_id = aws_security_group.frontend.id
  description       = "Outbound HTTPS via NAT"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "controller_https_out" {
  security_group_id = aws_security_group.controller.id
  description       = "Outbound HTTPS via NAT"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

# Plain HTTP out is needed for certificate revocation (CRL/OCSP) and Windows Update.
resource "aws_vpc_security_group_egress_rule" "frontend_http_out" {
  security_group_id = aws_security_group.frontend.id
  description       = "Outbound HTTP via NAT (CRL, Windows Update)"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "controller_http_out" {
  security_group_id = aws_security_group.controller.id
  description       = "Outbound HTTP via NAT (CRL, Windows Update)"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "frontend_to_controller" {
  for_each                     = toset([for p in var.platform_ports : tostring(p)])
  security_group_id            = aws_security_group.frontend.id
  description                  = "Platform service port ${each.value} to controller"
  referenced_security_group_id = aws_security_group.controller.id
  from_port                    = tonumber(each.value)
  to_port                      = tonumber(each.value)
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "controller_to_frontend" {
  for_each                     = toset([for p in var.platform_ports : tostring(p)])
  security_group_id            = aws_security_group.controller.id
  description                  = "Platform service port ${each.value} to front-ends"
  referenced_security_group_id = aws_security_group.frontend.id
  from_port                    = tonumber(each.value)
  to_port                      = tonumber(each.value)
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "frontend_to_db" {
  security_group_id            = aws_security_group.frontend.id
  description                  = "SQL Server"
  referenced_security_group_id = aws_security_group.db.id
  from_port                    = 1433
  to_port                      = 1433
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "controller_to_db" {
  security_group_id            = aws_security_group.controller.id
  description                  = "SQL Server"
  referenced_security_group_id = aws_security_group.db.id
  from_port                    = 1433
  to_port                      = 1433
  ip_protocol                  = "tcp"
}

resource "aws_security_group" "db" {
  name        = "${local.name}-db"
  description = "RDS SQL Server, reachable only from OutSystems servers"
  vpc_id      = aws_vpc.main.id
}

resource "aws_vpc_security_group_ingress_rule" "db_from_frontend" {
  security_group_id            = aws_security_group.db.id
  description                  = "SQL Server from front-ends"
  referenced_security_group_id = aws_security_group.frontend.id
  from_port                    = 1433
  to_port                      = 1433
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "db_from_controller" {
  security_group_id            = aws_security_group.db.id
  description                  = "SQL Server from controller"
  referenced_security_group_id = aws_security_group.controller.id
  from_port                    = 1433
  to_port                      = 1433
  ip_protocol                  = "tcp"
}

# ---------------------------------------------------------------- WAF

resource "aws_wafv2_web_acl" "main" {
  name  = "${local.name}-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "aws-common"
    priority = 10

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "aws-common"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "aws-known-bad-inputs"
    priority = 20

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "aws-known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  # Count only: shows traffic from VPNs, Tor and hosting providers in the WAF logs
  # without blocking anyone. Switch to block once the traffic pattern is known.
  rule {
    name     = "aws-anonymous-ip"
    priority = 25

    override_action {
      count {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesAnonymousIpList"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "aws-anonymous-ip"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "rate-limit-per-ip"
    priority = 30

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit_per_5min
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit-per-ip"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name}-waf"
    sampled_requests_enabled   = true
  }
}

# WAF requires the log group name to start with aws-waf-logs-.
resource "aws_cloudwatch_log_group" "waf" {
  name              = "aws-waf-logs-${local.name}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.main.arn
}

resource "aws_wafv2_web_acl_logging_configuration" "main" {
  resource_arn            = aws_wafv2_web_acl.main.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]

  # Do not log credentials or session cookies.
  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  redacted_fields {
    single_header {
      name = "cookie"
    }
  }
}

resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}
