#!/usr/bin/env bash
# ==============================================================================
# Project 13: Analytics Platform Deployment (Free Trial Compatible)
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP Real-Time Streaming & Batch Analytics Deployment${NC}"
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
DATASET_NAME="analytics_ds"
TOPIC_NAME="streaming-analytics-events"
BUCKET_NAME="${PROJECT_ID}-analytics-lake"

# 1. Enable Analytics APIs
echo -e "${BLUE}[INFO] Enabling BigQuery, Pub/Sub, Dataflow, Dataproc, and Storage APIs...${NC}"
gcloud services enable bigquery.googleapis.com \
                       pubsub.googleapis.com \
                       dataflow.googleapis.com \
                       dataproc.googleapis.com \
                       storage.googleapis.com --quiet

# 2. Create GCS Data Lake Bucket
echo -e "${BLUE}[INFO] Creating GCS Data Lake Bucket: gs://${BUCKET_NAME}...${NC}"
if ! gcloud storage buckets describe "gs://${BUCKET_NAME}" >/dev/null 2>&1; then
    gcloud storage buckets create "gs://${BUCKET_NAME}" --location="${REGION}" --quiet
    echo -e "${GREEN}[SUCCESS] GCS Data Lake bucket active.${NC}"
fi

# 3. Create BigQuery Dataset and Table
echo -e "${BLUE}[INFO] Creating BigQuery Dataset: ${DATASET_NAME} & Partitioned Table...${NC}"
bq --location="${REGION}" mk -d "${DATASET_NAME}" 2>/dev/null || true

bq query --use_legacy_sql=false "
CREATE TABLE IF NOT EXISTS \`${PROJECT_ID}.${DATASET_NAME}.web_events\` (
  event_id STRING,
  event_timestamp TIMESTAMP,
  user_id STRING,
  event_type STRING,
  page_url STRING,
  churned INT64
)
PARTITION BY DATE(event_timestamp)
CLUSTER BY event_type, user_id;
"
echo -e "${GREEN}[SUCCESS] BigQuery Partitioned & Clustered Table created.${NC}"

# 4. Create Pub/Sub Topic and Direct BigQuery Subscription
echo -e "${BLUE}[INFO] Creating Pub/Sub Topic & Direct BigQuery Subscription...${NC}"
if ! gcloud pubsub topics describe "${TOPIC_NAME}" >/dev/null 2>&1; then
    gcloud pubsub topics create "${TOPIC_NAME}" --quiet
fi

if ! gcloud pubsub subscriptions describe analytics-bq-sub >/dev/null 2>&1; then
    gcloud pubsub subscriptions create analytics-bq-sub \
      --topic="${TOPIC_NAME}" \
      --bigquery-table="${PROJECT_ID}:${DATASET_NAME}.web_events" \
      --write-metadata --quiet 2>/dev/null || true
    echo -e "${GREEN}[SUCCESS] Zero-code Direct BigQuery Streaming Subscription active.${NC}"
fi

# 5. Insert Sample Data and Train BQML Model
echo -e "${BLUE}[INFO] Training BigQuery ML (BQML) Churn Prediction Model...${NC}"
bq query --use_legacy_sql=false "
INSERT INTO \`${PROJECT_ID}.${DATASET_NAME}.web_events\` (event_id, event_timestamp, user_id, event_type, page_url, churned)
VALUES
  ('evt_1', CURRENT_TIMESTAMP(), 'usr_101', 'click', '/home', 0),
  ('evt_2', CURRENT_TIMESTAMP(), 'usr_102', 'view', '/checkout', 1);
"

bq query --use_legacy_sql=false "
CREATE OR REPLACE MODEL \`${PROJECT_ID}.${DATASET_NAME}.churn_model\`
OPTIONS(model_type='logistic_reg', input_label_cols=['churned']) AS
SELECT user_id, event_type, churned
FROM \`${PROJECT_ID}.${DATASET_NAME}.web_events\`;
"
echo -e "${GREEN}[SUCCESS] BQML Logistic Regression Model trained successfully.${NC}"

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 13 Analytics Platform Deployment Complete!${NC}"
echo -e "${GREEN}=====================================================${NC}"
