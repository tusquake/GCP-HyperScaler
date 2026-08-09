#!/usr/bin/env bash
# ==============================================================================
# Project 2: IAM Governance Cleanup Script
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP IAM Governance Cleanup${NC}"
echo -e "${BLUE}=====================================================${NC}"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}[WARNING] No active project set.${NC}"
    exit 0
fi

# 1. Delete Workload Identity Pool & Provider
POOL_NAME="github-actions-pool"
PROVIDER_NAME="github-actions-provider"

echo -e "${BLUE}[INFO] Cleaning up Workload Identity Provider & Pool...${NC}"
gcloud iam workload-identity-pools providers delete "${PROVIDER_NAME}" --workload-identity-pool="${POOL_NAME}" --location="global" --quiet 2>/dev/null || true
gcloud iam workload-identity-pools delete "${POOL_NAME}" --location="global" --quiet 2>/dev/null || true

# 2. Delete Service Accounts
for SA in "sa-app-runner" "sa-deployer"; do
    SA_EMAIL="${SA}@${PROJECT_ID}.iam.gserviceaccount.com"
    echo -e "${BLUE}[INFO] Deleting Service Account: ${SA_EMAIL}...${NC}"
    gcloud iam service-accounts delete "${SA_EMAIL}" --quiet 2>/dev/null || true
done

# 3. Delete Custom Role
ROLE_ID="CustomSecurityAuditor"
echo -e "${BLUE}[INFO] Deleting Custom Role: ${ROLE_ID}...${NC}"
gcloud iam roles delete "${ROLE_ID}" --project="${PROJECT_ID}" --quiet 2>/dev/null || true

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 2 IAM Cleanup Completed Successfully!${NC}"
echo -e "${GREEN}=====================================================${NC}"
