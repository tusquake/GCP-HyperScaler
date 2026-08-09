#!/usr/bin/env bash
# ==============================================================================
# Project 5: Storage & Database Cleanup Script
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP Storage & Managed Databases Cleanup${NC}"
echo -e "${BLUE}=====================================================${NC}"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}[WARNING] No active project set.${NC}"
    exit 0
fi

# 1. Delete Cloud SQL Instance
SQL_INSTANCE="sql-postgres-dev"
echo -e "${BLUE}[INFO] Deleting Cloud SQL instance: ${SQL_INSTANCE}...${NC}"
gcloud sql instances delete "${SQL_INSTANCE}" --quiet 2>/dev/null || true

# 2. Empty & Delete GCS Bucket
BUCKET_NAME="${PROJECT_ID}-datalake"
echo -e "${BLUE}[INFO] Removing GCS Bucket: gs://${BUCKET_NAME}...${NC}"
gcloud storage rm --recursive "gs://${BUCKET_NAME}" --quiet 2>/dev/null || true

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 5 Storage Cleanup Completed Successfully!${NC}"
echo -e "${GREEN}=====================================================${NC}"
