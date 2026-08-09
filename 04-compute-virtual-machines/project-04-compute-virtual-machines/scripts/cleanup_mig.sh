#!/usr/bin/env bash
# ==============================================================================
# Project 4: MIG Architecture Cleanup Script
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP MIG Compute Architecture Cleanup${NC}"
echo -e "${BLUE}=====================================================${NC}"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}[WARNING] No active project set.${NC}"
    exit 0
fi

ZONE="us-central1-a"
REGION="us-central1"

# 1. Delete Managed Instance Group & Autoscaler
MIG_NAME="mig-web-fleet"
echo -e "${BLUE}[INFO] Deleting Managed Instance Group: ${MIG_NAME}...${NC}"
gcloud compute instance-groups managed delete "${MIG_NAME}" --zone="${ZONE}" --quiet 2>/dev/null || true

# 2. Delete Instance Template
TEMPLATE_NAME="it-web-app-v1"
echo -e "${BLUE}[INFO] Deleting Instance Template: ${TEMPLATE_NAME}...${NC}"
gcloud compute instance-templates delete "${TEMPLATE_NAME}" --quiet 2>/dev/null || true

# 3. Delete Health Check & Firewall Rule
echo -e "${BLUE}[INFO] Deleting Health Check & Firewall Rules...${NC}"
gcloud compute health-checks delete hc-web-autoheal --quiet 2>/dev/null || true
gcloud compute firewall-rules delete allow-http-web --quiet 2>/dev/null || true

# 4. Delete Snapshot Policy
POLICY_NAME="snap-policy-daily"
echo -e "${BLUE}[INFO] Deleting Snapshot Policy: ${POLICY_NAME}...${NC}"
gcloud compute resource-policies delete "${POLICY_NAME}" --region="${REGION}" --quiet 2>/dev/null || true

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 4 MIG Cleanup Completed Successfully!${NC}"
echo -e "${GREEN}=====================================================${NC}"
