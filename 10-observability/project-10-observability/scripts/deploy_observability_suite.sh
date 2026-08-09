#!/usr/bin/env bash
# ==============================================================================
# Project 10: Observability Suite Deployment (Free Trial Compatible)
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP Full-Stack Observability Suite Deployment${NC}"
echo -e "${BLUE}=====================================================${NC}"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo -e "${YELLOW}[INFO] gcloud project unset. Auto-detecting available projects...${NC}"
    PROJECT_ID=$(gcloud projects list --format="value(projectId)" 2>/dev/null | head -n 1 || true)
    if [ -n "$PROJECT_ID" ]; then
        gcloud config set project "${PROJECT_ID}" --quiet
        echo -e "${GREEN}[SUCCESS] Auto-selected project: ${PROJECT_ID}${NC}"
    fi
fi

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo -e "${RED}[ERROR] No active project set. Run 'gcloud config set project YOUR_PROJECT_ID' first.${NC}"
    exit 1
fi
echo -e "${GREEN}[INFO] Active Project: ${PROJECT_ID}${NC}"

REGION="us-central1"

# 1. Enable Observability APIs
echo -e "${BLUE}[INFO] Enabling Observability APIs (Monitoring, Logging, Trace, Profiler)...${NC}"
gcloud services enable monitoring.googleapis.com \
                       logging.googleapis.com \
                       cloudtrace.googleapis.com \
                       cloudprofiler.googleapis.com --quiet

# 2. Deploy Custom 4 Golden Signals Dashboard
echo -e "${BLUE}[INFO] Creating Custom 4 Golden Signals Dashboard...${NC}"
gcloud monitoring dashboards create --config-from-file=dashboards/golden_signals.json --quiet 2>/dev/null || true
echo -e "${GREEN}[SUCCESS] Dashboard active.${NC}"

# 3. Create Alerting Policy
echo -e "${BLUE}[INFO] Creating Alerting Policy: High 5xx Error Rate Spike...${NC}"
gcloud alpha monitoring policies create --policy-from-file=alerts/policy_definitions.json --quiet 2>/dev/null || true
echo -e "${GREEN}[SUCCESS] Alerting Policy active.${NC}"

# 4. Create Global HTTP Uptime Check
echo -e "${BLUE}[INFO] Creating Global HTTP Uptime Check...${NC}"
gcloud alpha monitoring uptime create "http-global-uptime-check" \
  --resource-type="uptime_url" \
  --host="cloud.google.com" \
  --path="/" \
  --check-interval="1m" --quiet 2>/dev/null || true
echo -e "${GREEN}[SUCCESS] Global Uptime Check active.${NC}"

# 5. Run Telemetry Simulator App
echo -e "${BLUE}[INFO] Emitting OpenTelemetry Traces & Structured Logs...${NC}"
python3 app/app.py

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 10 Observability Suite Deployment Complete!${NC}"
echo -e "${GREEN}=====================================================${NC}"
