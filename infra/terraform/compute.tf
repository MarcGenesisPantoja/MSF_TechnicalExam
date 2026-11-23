data "aws_ssm_parameter" "windows_2022" {
  name = "/aws/service/ami-windows-latest/Windows_Server-2022-English-Full-Base"
}

# ---------------------------------------------------------------- instance role
# SSM for administration (no RDP port, no key pair), CloudWatch agent for logs/metrics.

resource "aws_iam_role" "server" {
  name = "${local.name}-server"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "server_ssm" {
  role       = aws_iam_role.server.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "server_cloudwatch" {
  role       = aws_iam_role.server.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# Servers may read the database credentials secret managed by RDS, nothing else.
resource "aws_iam_role_policy" "server_db_secret" {
  name = "read-db-secret"
  role = aws_iam_role.server.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = aws_db_instance.main.master_user_secret[0].secret_arn
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = aws_kms_key.main.arn
      }
    ]
  })
}

resource "aws_iam_instance_profile" "server" {
  name = "${local.name}-server"
  role = aws_iam_role.server.name
}

# ---------------------------------------------------------------- servers

locals {
  server_user_data = templatefile("${path.module}/scripts/bootstrap-windows.ps1", {
    log_group = aws_cloudwatch_log_group.servers.name
  })
}

resource "aws_instance" "controller" {
  ami                    = data.aws_ssm_parameter.windows_2022.value
  instance_type          = var.controller_instance_type
  subnet_id              = aws_subnet.app[0].id
  vpc_security_group_ids = [aws_security_group.controller.id]
  iam_instance_profile   = aws_iam_instance_profile.server.name
  user_data              = local.server_user_data
  monitoring             = true
  ebs_optimized          = true

  metadata_options {
    http_tokens   = "required" # IMDSv2 only
    http_endpoint = "enabled"
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = var.root_volume_size_gb
    encrypted   = true
    kms_key_id  = aws_kms_key.main.arn
  }

  tags = {
    Name   = "${local.name}-controller"
    Role   = "deployment-controller"
    Backup = "daily"
  }

  lifecycle {
    ignore_changes = [ami, user_data] # patching is done in place through SSM Patch Manager
  }
}

resource "aws_instance" "frontend" {
  count                  = var.frontend_count
  ami                    = data.aws_ssm_parameter.windows_2022.value
  instance_type          = var.frontend_instance_type
  subnet_id              = aws_subnet.app[count.index % var.az_count].id
  vpc_security_group_ids = [aws_security_group.frontend.id]
  iam_instance_profile   = aws_iam_instance_profile.server.name
  user_data              = local.server_user_data
  monitoring             = true
  ebs_optimized          = true

  metadata_options {
    http_tokens   = "required"
    http_endpoint = "enabled"
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = var.root_volume_size_gb
    encrypted   = true
    kms_key_id  = aws_kms_key.main.arn
  }

  tags = {
    Name   = "${local.name}-fe-${count.index + 1}"
    Role   = "front-end"
    Backup = "daily"
  }

  lifecycle {
    ignore_changes = [ami, user_data]
  }
}

# ---------------------------------------------------------------- patching

resource "aws_ssm_patch_baseline" "windows" {
  name             = "${local.name}-windows"
  operating_system = "WINDOWS"

  approval_rule {
    approve_after_days = 7

    patch_filter {
      key    = "CLASSIFICATION"
      values = ["CriticalUpdates", "SecurityUpdates"]
    }

    patch_filter {
      key    = "MSRC_SEVERITY"
      values = ["Critical", "Important"]
    }
  }
}

resource "aws_ssm_patch_group" "windows" {
  baseline_id = aws_ssm_patch_baseline.windows.id
  patch_group = local.name
}
