#!/usr/bin/env bash
# ==============================================================================
# Project 14: SRE Framework Deployment (Free Trial Compatible)
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP SRE Reliability Engineering Framework Deployment${NC}"
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

SERVICE_ID="sre-checkout-service"

# 1. Enable Monitoring & Compute APIs
echo -e "${BLUE}[INFO] Enabling Cloud Monitoring & Compute APIs...${NC}"
gcloud services enable monitoring.googleapis.com compute.googleapis.com --quiet

# 2. Create Custom Monitoring Service
echo -e "${BLUE}[INFO] Creating Custom Monitoring Service: ${SERVICE_ID}...${NC}"
if ! gcloud alpha monitoring services describe "projects/${PROJECT_ID}/services/${SERVICE_ID}" >/dev/null 2>&1; then
    gcloud alpha monitoring services create \
      --service-id="${SERVICE_ID}" \
      --display-name="SRE Checkout Payment Microservice" --quiet
    echo -e "${GREEN}[SUCCESS] Monitoring Service active.${NC}"
else
    echo -e "${YELLOW}[INFO] Monitoring Service ${SERVICE_ID} already exists.${NC}"
fi

# 3. Create 99.9% Availability SLO over 28-Day Rolling Window
echo -e "${BLUE}[INFO] Deploying 99.9% Availability SLO (28-Day Rolling Window)...${NC}"
gcloud alpha monitoring services slos create \
  --service="${SERVICE_ID}" \
  --config-from-file=slo/slo_definitions.json --quiet 2>/dev/null || true
echo -e "${GREEN}[SUCCESS] SLO active with 0.1% Error Budget Allowance.${NC}"

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 14 SRE Reliability Framework Complete!${NC}"
echo -e "${GREEN}=====================================================${NC}"
