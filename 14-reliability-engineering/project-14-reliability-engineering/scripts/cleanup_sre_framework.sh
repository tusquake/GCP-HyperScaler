#!/usr/bin/env bash
# ==============================================================================
# Project 14: SRE Framework Cleanup Script
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP SRE Framework Cleanup${NC}"
echo -e "${BLUE}=====================================================${NC}"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo -e "${YELLOW}[WARNING] No active project set.${NC}"
    exit 0
fi

SERVICE_ID="sre-checkout-service"

# 1. Delete SLO & Service
echo -e "${BLUE}[INFO] Deleting Custom Monitoring Service: ${SERVICE_ID}...${NC}"
SLO_ID=$(gcloud alpha monitoring services slos list --service="${SERVICE_ID}" --format='value(name)' 2>/dev/null | head -n 1 || true)
if [ -n "$SLO_ID" ]; then
    gcloud alpha monitoring services slos delete "${SLO_ID}" --quiet 2>/dev/null || true
fi

gcloud alpha monitoring services delete "projects/${PROJECT_ID}/services/${SERVICE_ID}" --quiet 2>/dev/null || true

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 14 SRE Cleanup Completed Successfully!${NC}"
echo -e "${GREEN}=====================================================${NC}"
