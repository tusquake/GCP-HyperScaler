#!/usr/bin/env bash
# ==============================================================================
# Project 13: Analytics Platform Cleanup Script
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP Analytics Platform Cleanup${NC}"
echo -e "${BLUE}=====================================================${NC}"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo -e "${YELLOW}[WARNING] No active project set.${NC}"
    exit 0
fi

# 1. Delete Pub/Sub Subscription & Topic
echo -e "${BLUE}[INFO] Deleting Pub/Sub Subscription & Topic...${NC}"
gcloud pubsub subscriptions delete analytics-bq-sub --quiet 2>/dev/null || true
gcloud pubsub topics delete streaming-analytics-events --quiet 2>/dev/null || true

# 2. Remove BigQuery Dataset & Tables
echo -e "${BLUE}[INFO] Removing BigQuery Dataset: analytics_ds...${NC}"
bq rm -r -f -d "${PROJECT_ID}:analytics_ds" 2>/dev/null || true

# 3. Empty & Delete GCS Bucket
BUCKET_NAME="${PROJECT_ID}-analytics-lake"
echo -e "${BLUE}[INFO] Removing GCS Data Lake Bucket: gs://${BUCKET_NAME}...${NC}"
gcloud storage rm --recursive "gs://${BUCKET_NAME}" --quiet 2>/dev/null || true

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 13 Analytics Cleanup Completed Successfully!${NC}"
echo -e "${GREEN}=====================================================${NC}"
