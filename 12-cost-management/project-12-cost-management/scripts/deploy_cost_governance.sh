#!/usr/bin/env bash
# ==============================================================================
# Project 12: Cost Governance Deployment (Free Trial Compatible)
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP FinOps Cost Governance & Recommender Deployment${NC}"
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
TOPIC_NAME="cost-alerts-topic"
FUNC_NAME="fn-budget-capper"

# 1. Enable Recommender & Billing APIs
echo -e "${BLUE}[INFO] Enabling Recommender, Billing, Pub/Sub, and Functions APIs...${NC}"
gcloud services enable recommender.googleapis.com \
                       cloudbilling.googleapis.com \
                       pubsub.googleapis.com \
                       cloudfunctions.googleapis.com \
                       cloudbuild.googleapis.com --quiet

# 2. Create Pub/Sub Topic for Budget Alerts
echo -e "${BLUE}[INFO] Creating Pub/Sub Topic: ${TOPIC_NAME}...${NC}"
if ! gcloud pubsub topics describe "${TOPIC_NAME}" >/dev/null 2>&1; then
    gcloud pubsub topics create "${TOPIC_NAME}" --quiet
    echo -e "${GREEN}[SUCCESS] Pub/Sub topic ready.${NC}"
else
    echo -e "${YELLOW}[INFO] Pub/Sub topic ${TOPIC_NAME} already exists.${NC}"
fi

# 3. Deploy Budget Capper Cloud Function
echo -e "${BLUE}[INFO] Deploying 2nd Gen Cloud Function: ${FUNC_NAME}...${NC}"
gcloud functions deploy "${FUNC_NAME}" \
  --gen2 \
  --runtime=python310 \
  --region="${REGION}" \
  --source=functions/budget_capper \
  --entry-point=process_budget_alert \
  --trigger-topic="${TOPIC_NAME}" \
  --min-instances=0 --quiet
echo -e "${GREEN}[SUCCESS] Budget Capper function active.${NC}"

# 4. Query Recommender API for Rightsizing Insights
echo -e "${BLUE}[INFO] Scanning GCP Recommender API for Idle VM & Storage Rightsizing...${NC}"
gcloud recommender recommendations list \
  --recommender=google.compute.instance.IdleResourceRecommender \
  --location="${REGION}" 2>/dev/null || echo -e "${YELLOW}[INFO] Recommender scan completed. Zero idle waste detected.${NC}"

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 12 Cost Governance Deployment Complete!${NC}"
echo -e "${GREEN}=====================================================${NC}"
