#!/usr/bin/env bash
# ==============================================================================
# Project 1: Foundation Bootstrap Script (Free Trial & Standalone Compatible)
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP Fundamentals Foundation Bootstrap (Free Trial)${NC}"
echo -e "${BLUE}=====================================================${NC}"

# 1. Verify gcloud authentication
ACTIVE_ACCOUNT=$(gcloud config get-value account 2>/dev/null || true)
if [ -z "$ACTIVE_ACCOUNT" ]; then
    echo -e "${RED}[ERROR] No active gcloud account found. Please run 'gcloud auth login' first.${NC}"
    exit 1
fi
echo -e "${GREEN}[INFO] Active Account: ${ACTIVE_ACCOUNT}${NC}"

# 2. Detect Operating Mode (Organization vs Standalone)
ORG_ID=$(gcloud organizations list --format="value(name)" 2>/dev/null | head -n 1 || true)
if [ -n "$ORG_ID" ]; then
    echo -e "${GREEN}[INFO] Operating Mode: Organization Hierarchy (${ORG_ID})${NC}"
else
    echo -e "${YELLOW}[INFO] Operating Mode: Standalone Free Trial Account (No Org Node)${NC}"
fi

# 3. Get Active Billing Account ID
BILLING_ACCOUNT_ID=$(gcloud billing accounts list --format="value(name)" --filter="open=true" 2>/dev/null | head -n 1 || true)
if [ -z "$BILLING_ACCOUNT_ID" ]; then
    echo -e "${YELLOW}[WARNING] No active billing account found. Proceeding with current project context.${NC}"
else
    echo -e "${GREEN}[INFO] Billing Account ID: ${BILLING_ACCOUNT_ID}${NC}"
fi

# 4. Determine Target Project ID
RANDOM_SUFFIX=$((1000 + RANDOM % 9000))
PROJECT_ID="proj-fund-${RANDOM_SUFFIX}"

echo -e "${BLUE}[INFO] Creating foundation project: ${PROJECT_ID}...${NC}"
if [ -n "$ORG_ID" ]; then
    gcloud projects create "${PROJECT_ID}" --organization="${ORG_ID}" --name="Fundamentals Dev Project" --quiet
else
    gcloud projects create "${PROJECT_ID}" --name="Fundamentals Dev Project" --quiet
fi

# 5. Link Billing Account if available
if [ -n "$BILLING_ACCOUNT_ID" ]; then
    echo -e "${BLUE}[INFO] Linking billing account to project...${NC}"
    gcloud billing projects link "${PROJECT_ID}" --billing-account="${BILLING_ACCOUNT_ID}" --quiet
fi

# 6. Set gcloud default project
gcloud config set project "${PROJECT_ID}" --quiet
echo -e "${GREEN}[SUCCESS] Active project set to: ${PROJECT_ID}${NC}"

# 7. Enable Core Baseline APIs
echo -e "${BLUE}[INFO] Enabling core baseline APIs (compute, storage)...${NC}"
gcloud services enable compute.googleapis.com storage.googleapis.com --quiet
echo -e "${GREEN}[SUCCESS] APIs enabled: compute.googleapis.com, storage.googleapis.com${NC}"

# 8. Query Regional Quotas (us-central1)
echo -e "${BLUE}[INFO] Auditing Regional Quotas in us-central1...${NC}"
gcloud compute regions describe us-central1 --format="table(quotas.metric, quotas.limit, quotas.usage)" | grep -E "CPUS|DISKS_TOTAL_GB|IN_USE_ADDRESSES" || true

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Foundation Bootstrap Completed Successfully!${NC}"
echo -e "${GREEN}Project Created: ${PROJECT_ID}${NC}"
echo -e "${GREEN}=====================================================${NC}"
