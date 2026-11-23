<powershell>
# Rendered by Terraform templatefile(): a doubled dollar sign before a brace is
# written out as a single literal dollar sign.
# Prepares a Windows Server 2022 instance to receive the OutSystems Platform Server.
# The Platform Server installer itself is licensed and installed in a separate,
# documented step (see infra/README.md) so this script stays free of licence material.

$ErrorActionPreference = "Stop"
Start-Transcript -Path "C:\ProgramData\bootstrap.log" -Append

# IIS and the .NET features OutSystems 11 requires
Install-WindowsFeature -Name `
    Web-Server, Web-Default-Doc, Web-Http-Errors, Web-Static-Content, Web-Http-Redirect, `
    Web-Http-Logging, Web-Request-Monitor, Web-Http-Tracing, `
    Web-Stat-Compression, Web-Dyn-Compression, Web-Filtering, Web-Windows-Auth, `
    Web-Net-Ext45, Web-Asp-Net45, Web-ISAPI-Ext, Web-ISAPI-Filter, `
    Web-Mgmt-Console, Web-Scripting-Tools, `
    NET-Framework-45-Core, NET-WCF-HTTP-Activation45, NET-WCF-TCP-PortSharing45, `
    WAS-Process-Model, WAS-Config-APIs `
    -IncludeManagementTools

# Remove the IIS default page so the health check only passes once the platform is installed
Remove-Item "C:\inetpub\wwwroot\iisstart.*" -ErrorAction SilentlyContinue

# Disable legacy protocols (TLS 1.2+ only)
$protocols = "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols"
foreach ($p in "SSL 3.0", "TLS 1.0", "TLS 1.1") {
    foreach ($side in "Server", "Client") {
        New-Item -Path "$protocols\$p\$side" -Force | Out-Null
        Set-ItemProperty -Path "$protocols\$p\$side" -Name Enabled -Value 0 -Type DWord
        Set-ItemProperty -Path "$protocols\$p\$side" -Name DisabledByDefault -Value 1 -Type DWord
    }
}

# CloudWatch agent: ship Windows event logs and IIS logs
$agentMsi = "$env:TEMP\amazon-cloudwatch-agent.msi"
Invoke-WebRequest -UseBasicParsing `
    -Uri "https://amazoncloudwatch-agent.s3.amazonaws.com/windows/amd64/latest/amazon-cloudwatch-agent.msi" `
    -OutFile $agentMsi
Start-Process msiexec.exe -ArgumentList "/i `"$agentMsi`" /qn" -Wait

$agentConfig = @"
{
  "logs": {
    "logs_collected": {
      "windows_events": {
        "collect_list": [
          { "event_name": "Application", "event_levels": ["ERROR", "WARNING"], "log_group_name": "${log_group}", "log_stream_name": "{instance_id}/application" },
          { "event_name": "System",      "event_levels": ["ERROR", "WARNING"], "log_group_name": "${log_group}", "log_stream_name": "{instance_id}/system" }
        ]
      },
      "files": {
        "collect_list": [
          { "file_path": "C:\\inetpub\\logs\\LogFiles\\W3SVC1\\*.log", "log_group_name": "${log_group}", "log_stream_name": "{instance_id}/iis" }
        ]
      }
    }
  },
  "metrics": {
    "namespace": "SupportFinder/Windows",
    "metrics_collected": {
      "LogicalDisk": { "measurement": ["% Free Space"], "resources": ["C:"] },
      "Memory":      { "measurement": ["% Committed Bytes In Use"] }
    },
    "append_dimensions": { "InstanceId": "`$${aws:InstanceId}" }
  }
}
"@
$configPath = "C:\ProgramData\Amazon\AmazonCloudWatchAgent\config.json"
$agentConfig | Out-File -FilePath $configPath -Encoding ascii
& "C:\Program Files\Amazon\AmazonCloudWatchAgent\amazon-cloudwatch-agent-ctl.ps1" `
    -a fetch-config -m ec2 -c "file:$configPath" -s

Stop-Transcript
</powershell>
