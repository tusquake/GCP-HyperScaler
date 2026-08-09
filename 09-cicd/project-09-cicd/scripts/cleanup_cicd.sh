#!/usr/bin/env bash
# ==============================================================================
# Project 9: CI/CD Pipeline Cleanup Script
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP CI/CD Pipeline Cleanup${NC}"
echo -e "${BLUE}=====================================================${NC}"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo -e "${YELLOW}[WARNING] No active project set.${NC}"
    exit 0
fi

REGION="us-central1"
REPO_NAME="ar-cicd-repo"

# 1. Delete Cloud Run Services
echo -e "${BLUE}[INFO] Deleting Cloud Run Services...${NC}"
gcloud run services delete cicd-app-staging --region="${REGION}" --quiet 2>/dev/null || true
gcloud run services delete cicd-app-prod --region="${REGION}" --quiet 2>/dev/null || true

# 2. Delete Artifact Registry Repository
echo -e "${BLUE}[INFO] Deleting Artifact Registry Repository: ${REPO_NAME}...${NC}"
gcloud artifacts repositories delete "${REPO_NAME}" --location="${REGION}" --quiet 2>/dev/null || true

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 9 CI/CD Cleanup Completed Successfully!${NC}"
echo -e "${GREEN}=====================================================${NC}"
