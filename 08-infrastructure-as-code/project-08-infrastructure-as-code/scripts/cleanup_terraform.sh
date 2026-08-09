#!/usr/bin/env bash
# ==============================================================================
# Project 8: Terraform Landing Zone Cleanup Script
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP Terraform Landing Zone Cleanup${NC}"
echo -e "${BLUE}=====================================================${NC}"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo -e "${YELLOW}[WARNING] No active project set.${NC}"
    exit 0
fi

REGION="us-central1"
STATE_BUCKET="tf-state-${PROJECT_ID}"

cd terraform

if [ -d ".terraform" ]; then
    echo -e "${BLUE}[INFO] Destroying Terraform Managed Infrastructure (terraform destroy)...${NC}"
    terraform destroy -var="project_id=${PROJECT_ID}" -var="region=${REGION}" -auto-approve || true
fi

cd ..

echo -e "${BLUE}[INFO] Removing GCS State Bucket: gs://${STATE_BUCKET}...${NC}"
gcloud storage rm --recursive "gs://${STATE_BUCKET}" --quiet 2>/dev/null || true

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 8 Terraform Cleanup Completed Successfully!${NC}"
echo -e "${GREEN}=====================================================${NC}"
