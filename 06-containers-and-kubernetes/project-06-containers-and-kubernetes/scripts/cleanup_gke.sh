#!/usr/bin/env bash
# ==============================================================================
# Project 6: GKE Platform Cleanup Script
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP GKE Platform Cleanup${NC}"
echo -e "${BLUE}=====================================================${NC}"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}[WARNING] No active project set.${NC}"
    exit 0
fi

REGION="us-central1"
CLUSTER_NAME="gke-prod-autopilot"
REPO_NAME="gcr-apps-repo"

# 1. Delete GKE Cluster
echo -e "${BLUE}[INFO] Deleting GKE Autopilot Cluster: ${CLUSTER_NAME}...${NC}"
gcloud container clusters delete "${CLUSTER_NAME}" --region="${REGION}" --quiet 2>/dev/null || true

# 2. Delete Artifact Registry Repository
echo -e "${BLUE}[INFO] Deleting Artifact Registry Repository: ${REPO_NAME}...${NC}"
gcloud artifacts repositories delete "${REPO_NAME}" --location="${REGION}" --quiet 2>/dev/null || true

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 6 GKE Cleanup Completed Successfully!${NC}"
echo -e "${GREEN}=====================================================${NC}"
