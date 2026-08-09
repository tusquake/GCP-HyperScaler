#!/usr/bin/env bash
# ==============================================================================
# Project 8: Terraform Landing Zone Deployment (Free Trial Compatible)
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP Terraform Landing Zone Deployment${NC}"
echo -e "${BLUE}=====================================================${NC}"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo -e "${YELLOW}[INFO] gcloud project unset. Auto-detecting available projects...${NC}"
    PROJECT_ID=$(gcloud projects list --format="value(projectId)" 2>/dev/null | head -n 1 || true)
    if [ -n "$PROJECT_ID" ]; then
        gcloud config set project "${PROJECT_ID}" --quiet
        echo -e "${GREEN}[SUCCESS] Auto-selected project: ${PROJECT_ID}${NC}"
    fi
fi

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo -e "${RED}[ERROR] No active project set. Run 'gcloud config set project YOUR_PROJECT_ID' first.${NC}"
    exit 1
fi
echo -e "${GREEN}[INFO] Active Project: ${PROJECT_ID}${NC}"

REGION="us-central1"
STATE_BUCKET="tf-state-${PROJECT_ID}"

# 1. Enable Cloud Storage & Compute APIs
echo -e "${BLUE}[INFO] Enabling Cloud Storage and Compute Engine APIs...${NC}"
gcloud services enable storage.googleapis.com compute.googleapis.com --quiet

# 2. Bootstrap GCS Remote Backend Bucket
echo -e "${BLUE}[INFO] Bootstrapping GCS Remote Backend Bucket: gs://${STATE_BUCKET}...${NC}"
if ! gcloud storage buckets describe "gs://${STATE_BUCKET}" >/dev/null 2>&1; then
    gcloud storage buckets create "gs://${STATE_BUCKET}" \
      --location="${REGION}" \
      --default-storage-class=STANDARD --quiet
    gcloud storage buckets update "gs://${STATE_BUCKET}" --versioning
    echo -e "${GREEN}[SUCCESS] GCS State Bucket ready with Versioning.${NC}"
else
    echo -e "${YELLOW}[INFO] GCS State Bucket gs://${STATE_BUCKET} already exists.${NC}"
fi

# 3. Change Directory to Terraform HCL Root
cd terraform

# 4. Initialize Terraform with Backend Config
echo -e "${BLUE}[INFO] Initializing Terraform (terraform init)...${NC}"
terraform init -backend-config="bucket=${STATE_BUCKET}" -reconfigure

# 5. Apply Terraform Plan
echo -e "${BLUE}[INFO] Applying Terraform Plan (terraform apply)...${NC}"
terraform apply -var="project_id=${PROJECT_ID}" -var="region=${REGION}" -auto-approve

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 8 Terraform Landing Zone Complete!${NC}"
echo -e "${GREEN}=====================================================${NC}"
