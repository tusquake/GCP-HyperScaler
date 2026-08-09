#!/usr/bin/env bash
# ==============================================================================
# Project 12: Cost Governance Cleanup Script
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP FinOps Cost Governance Cleanup${NC}"
echo -e "${BLUE}=====================================================${NC}"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo -e "${YELLOW}[WARNING] No active project set.${NC}"
    exit 0
fi

REGION="us-central1"

# 1. Delete 2nd Gen Cloud Function
echo -e "${BLUE}[INFO] Deleting Cloud Function: fn-budget-capper...${NC}"
gcloud functions delete fn-budget-capper --region="${REGION}" --gen2 --quiet 2>/dev/null || true

# 2. Delete Pub/Sub Topic
echo -e "${BLUE}[INFO] Deleting Pub/Sub Topic: cost-alerts-topic...${NC}"
gcloud pubsub topics delete cost-alerts-topic --quiet 2>/dev/null || true

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 12 Cost Governance Cleanup Completed Successfully!${NC}"
echo -e "${GREEN}=====================================================${NC}"
