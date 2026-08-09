#!/usr/bin/env bash
# ==============================================================================
# Project 7: Serverless Engine Deployment (Free Trial Compatible)
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP Serverless & Event-Driven Engine Deployment${NC}"
echo -e "${BLUE}=====================================================${NC}"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}[ERROR] No active project set in gcloud config.${NC}"
    exit 1
fi
echo -e "${GREEN}[INFO] Active Project: ${PROJECT_ID}${NC}"

REGION="us-central1"
TOPIC_NAME="order-events-topic"
RUN_SERVICE="order-service"
FUNC_NAME="fn-order-notifier"
JOB_NAME="job-order-health-check"

# 1. Enable Serverless APIs
echo -e "${BLUE}[INFO] Enabling Cloud Run, Cloud Functions, Eventarc, Pub/Sub, and Scheduler APIs...${NC}"
gcloud services enable run.googleapis.com \
                       cloudfunctions.googleapis.com \
                       eventarc.googleapis.com \
                       pubsub.googleapis.com \
                       cloudscheduler.googleapis.com \
                       cloudbuild.googleapis.com --quiet

# 2. Create Pub/Sub Topic
echo -e "${BLUE}[INFO] Creating Pub/Sub Topic: ${TOPIC_NAME}...${NC}"
if ! gcloud pubsub topics describe "${TOPIC_NAME}" >/dev/null 2>&1; then
    gcloud pubsub topics create "${TOPIC_NAME}" --quiet
    echo -e "${GREEN}[SUCCESS] Pub/Sub topic created.${NC}"
else
    echo -e "${YELLOW}[INFO] Pub/Sub topic ${TOPIC_NAME} already exists.${NC}"
fi

# 3. Deploy Cloud Run Service
echo -e "${BLUE}[INFO] Deploying Cloud Run Service: ${RUN_SERVICE}...${NC}"
gcloud run deploy "${RUN_SERVICE}" \
  --source=services/order_service \
  --region="${REGION}" \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=${PROJECT_ID},PUBSUB_TOPIC=${TOPIC_NAME}" \
  --min-instances=0 \
  --max-instances=2 --quiet

SERVICE_URL=$(gcloud run services describe "${RUN_SERVICE}" --region="${REGION}" --format="value(status.url)")
echo -e "${GREEN}[SUCCESS] Cloud Run service active: ${SERVICE_URL}${NC}"

# 4. Deploy 2nd Gen Cloud Function (Eventarc / Pub/Sub Event Handler)
echo -e "${BLUE}[INFO] Deploying 2nd Gen Cloud Function: ${FUNC_NAME}...${NC}"
gcloud functions deploy "${FUNC_NAME}" \
  --gen2 \
  --runtime=python310 \
  --region="${REGION}" \
  --source=functions/order_notifier \
  --entry-point=process_order_event \
  --trigger-topic="${TOPIC_NAME}" \
  --min-instances=0 --quiet
echo -e "${GREEN}[SUCCESS] 2nd Gen Cloud Function deployed with Eventarc trigger.${NC}"

# 5. Create Cloud Scheduler Job (Cron every 15 mins)
echo -e "${BLUE}[INFO] Creating Cloud Scheduler Cron Job: ${JOB_NAME}...${NC}"
if ! gcloud scheduler jobs describe "${JOB_NAME}" --location="${REGION}" >/dev/null 2>&1; then
    gcloud scheduler jobs create http "${JOB_NAME}" \
      --location="${REGION}" \
      --schedule="*/15 * * * *" \
      --uri="${SERVICE_URL}/" \
      --http-method=GET --quiet
    echo -e "${GREEN}[SUCCESS] Cloud Scheduler job active.${NC}"
else
    echo -e "${YELLOW}[INFO] Cloud Scheduler job ${JOB_NAME} already exists.${NC}"
fi

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 7 Serverless Engine Deployment Complete!${NC}"
echo -e "${GREEN}=====================================================${NC}"
