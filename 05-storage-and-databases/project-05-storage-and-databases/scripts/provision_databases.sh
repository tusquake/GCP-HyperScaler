#!/usr/bin/env bash
# ==============================================================================
# Project 5: Storage & Database Provisioning Script (Free Trial Compatible)
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP Storage & Managed Databases Deployment${NC}"
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
BUCKET_NAME="${PROJECT_ID}-datalake"

# 1. Enable Storage & Database APIs
echo -e "${BLUE}[INFO] Enabling Cloud Storage, Cloud SQL, and Firestore APIs...${NC}"
gcloud services enable storage.googleapis.com sqladmin.googleapis.com firestore.googleapis.com --quiet

# 2. Provision GCS Bucket with Versioning & Lifecycle
echo -e "${BLUE}[INFO] Creating GCS Bucket: gs://${BUCKET_NAME}...${NC}"
if ! gcloud storage buckets describe "gs://${BUCKET_NAME}" >/dev/null 2>&1; then
    gcloud storage buckets create "gs://${BUCKET_NAME}" \
      --location="${REGION}" \
      --default-storage-class=STANDARD --quiet
    
    # Enable Versioning
    gcloud storage buckets update "gs://${BUCKET_NAME}" --versioning
    echo -e "${GREEN}[SUCCESS] GCS Bucket created with Versioning enabled.${NC}"
else
    echo -e "${YELLOW}[INFO] GCS Bucket gs://${BUCKET_NAME} already exists.${NC}"
fi

# Apply Storage Lifecycle Policy
echo -e "${BLUE}[INFO] Applying Storage Lifecycle Policy (configs/gcs_lifecycle.json)...${NC}"
gcloud storage buckets update "gs://${BUCKET_NAME}" --lifecycle-file="configs/gcs_lifecycle.json"
echo -e "${GREEN}[SUCCESS] Storage lifecycle policy applied.${NC}"

# 3. Provision Cloud SQL PostgreSQL Instance (db-f1-micro)
SQL_INSTANCE="sql-postgres-dev"
echo -e "${BLUE}[INFO] Provisioning Cloud SQL PostgreSQL (${SQL_INSTANCE})...${NC}"
if ! gcloud sql instances describe "${SQL_INSTANCE}" >/dev/null 2>&1; then
    gcloud sql instances create "${SQL_INSTANCE}" \
      --database-version=POSTGRES_15 \
      --tier=db-f1-micro \
      --region="${REGION}" \
      --backup-start-time=03:00 \
      --enable-bin-log=false --quiet
    echo -e "${GREEN}[SUCCESS] Cloud SQL instance active: ${SQL_INSTANCE}.${NC}"
else
    echo -e "${YELLOW}[INFO] Cloud SQL instance ${SQL_INSTANCE} already exists.${NC}"
fi

# 4. Initialize Firestore Database (Native Mode)
echo -e "${BLUE}[INFO] Initializing Firestore NoSQL database...${NC}"
if ! gcloud firestore databases describe --database="(default)" >/dev/null 2>&1; then
    gcloud firestore databases create --location="${REGION}" --type=firestore-native --quiet || true
    echo -e "${GREEN}[SUCCESS] Firestore initialized in Native Mode.${NC}"
else
    echo -e "${YELLOW}[INFO] Firestore database already initialized.${NC}"
fi

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 5 Storage & DB Deployment Completed!${NC}"
echo -e "${GREEN}=====================================================${NC}"
