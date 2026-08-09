#!/usr/bin/env bash
# ==============================================================================
# Project 7: Serverless Engine Cleanup Script
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP Serverless Engine Cleanup${NC}"
echo -e "${BLUE}=====================================================${NC}"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}[WARNING] No active project set.${NC}"
    exit 0
fi

REGION="us-central1"

# 1. Delete Cloud Scheduler Job
echo -e "${BLUE}[INFO] Deleting Cloud Scheduler Job: job-order-health-check...${NC}"
gcloud scheduler jobs delete job-order-health-check --location="${REGION}" --quiet 2>/dev/null || true

# 2. Delete 2nd Gen Cloud Function
echo -e "${BLUE}[INFO] Deleting 2nd Gen Cloud Function: fn-order-notifier...${NC}"
gcloud functions delete fn-order-notifier --region="${REGION}" --gen2 --quiet 2>/dev/null || true

# 3. Delete Cloud Run Service
echo -e "${BLUE}[INFO] Deleting Cloud Run Service: order-service...${NC}"
gcloud run services delete order-service --region="${REGION}" --quiet 2>/dev/null || true

# 4. Delete Pub/Sub Topic
echo -e "${BLUE}[INFO] Deleting Pub/Sub Topic: order-events-topic...${NC}"
gcloud pubsub topics delete order-events-topic --quiet 2>/dev/null || true

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 7 Serverless Cleanup Completed Successfully!${NC}"
echo -e "${GREEN}=====================================================${NC}"
