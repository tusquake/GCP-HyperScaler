#!/usr/bin/env bash
# ==============================================================================
# Project 11: Security Perimeter Cleanup Script
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP Zero-Trust Security Perimeter Cleanup${NC}"
echo -e "${BLUE}=====================================================${NC}"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo -e "${YELLOW}[WARNING] No active project set.${NC}"
    exit 0
fi

# 1. Delete Cloud Armor Policy
echo -e "${BLUE}[INFO] Deleting Cloud Armor WAF Policy: ca-policy-waf...${NC}"
gcloud compute security-policies delete ca-policy-waf --quiet 2>/dev/null || true

# 2. Delete Secret Manager Secret
echo -e "${BLUE}[INFO] Deleting Secret: sec-db-password...${NC}"
gcloud secrets delete sec-db-password --quiet 2>/dev/null || true

# Note: Cloud KMS KeyRings cannot be deleted in GCP; KMS keys are disabled instead.
REGION="us-central1"
echo -e "${BLUE}[INFO] Disabling KMS Keys in kms-ring-prod...${NC}"
gcloud kms keys versions disable 1 --key=key-cmek-data --keyring=kms-ring-prod --location="${REGION}" --quiet 2>/dev/null || true

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 11 Security Cleanup Completed Successfully!${NC}"
echo -e "${GREEN}=====================================================${NC}"
