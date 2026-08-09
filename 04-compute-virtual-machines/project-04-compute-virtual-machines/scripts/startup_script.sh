#!/usr/bin/env bash
# ==============================================================================
# Project 4: GCE Instance Startup Metadata Script
# ==============================================================================
set -euo pipefail

# Update packages and install Nginx
apt-get update -y
apt-get install -y nginx stress

# Fetch GCE Instance Metadata
HOSTNAME=$(hostname)
INSTANCE_ZONE=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/zone | awk -F'/' '{print $NF}')
INTERNAL_IP=$(curl -s -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/ip)

# Write custom HTML index page
cat <<EOF > /var/www/html/index.html
<!DOCTYPE html>
<html>
<head>
  <title>GCP MIG Auto-Healing Node</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f6f8; text-align: center; padding: 50px; }
    .card { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: inline-block; }
    h1 { color: #1a73e8; }
    p { font-size: 18px; color: #5f6368; }
    .status { color: #34a853; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <h1>GCP Auto-Healing MIG Replica</h1>
    <p>Instance Hostname: <strong>${HOSTNAME}</strong></p>
    <p>Zone: <strong>${INSTANCE_ZONE}</strong></p>
    <p>Internal IP: <strong>${INTERNAL_IP}</strong></p>
    <p>Health Status: <span class="status">HEALTHY (HTTP 200)</span></p>
  </div>
</body>
</html>
EOF

# Ensure Nginx service is enabled and started
systemctl restart nginx
systemctl enable nginx
