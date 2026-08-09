#!/usr/bin/env bash
# ==============================================================================
# Project 10: Observability Suite Cleanup Script
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP Observability Suite Cleanup${NC}"
echo -e "${BLUE}=====================================================${NC}"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo -e "${YELLOW}[WARNING] No active project set.${NC}"
    exit 0
fi

# 1. Delete Global Uptime Check
echo -e "${BLUE}[INFO] Deleting Global HTTP Uptime Check...${NC}"
UPTIME_ID=$(gcloud alpha monitoring uptime list-configs --format="value(name)" 2>/dev/null | head -n 1 || true)
if [ -n "$UPTIME_ID" ]; then
    gcloud alpha monitoring uptime delete "${UPTIME_ID}" --quiet 2>/dev/null || true
fi

# 2. Delete Alerting Policies
echo -e "${BLUE}[INFO] Deleting Alerting Policies...${NC}"
POLICY_ID=$(gcloud alpha monitoring policies list --format="value(name)" 2>/dev/null | head -n 1 || true)
if [ -n "$POLICY_ID" ]; then
    gcloud alpha monitoring policies delete "${POLICY_ID}" --quiet 2>/dev/null || true
fi

# 3. Delete Custom Dashboards
echo -e "${BLUE}[INFO] Deleting Custom Dashboards...${NC}"
DASH_ID=$(gcloud monitoring dashboards list --format="value(name)" 2>/dev/null | head -n 1 || true)
if [ -n "$DASH_ID" ]; then
    gcloud monitoring dashboards delete "${DASH_ID}" --quiet 2>/dev/null || true
fi

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 10 Observability Cleanup Completed Successfully!${NC}"
echo -e "${GREEN}=====================================================${NC}"
