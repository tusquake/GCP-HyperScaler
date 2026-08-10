#!/usr/bin/env bash
set -e

# ==============================================================================
# GCP Fast Infrastructure Provisioner for Rapid Cloud Run Deployment
# ==============================================================================

echo "===================================================================="
echo " Provisioning GCP Infrastructure (Fast Direct TCP Mode)            "
echo "===================================================================="

# Set Variables
PROJECT_ID=$(gcloud config get-value project)
REGION=${GCP_REGION:-"us-central1"}
DB_INSTANCE_NAME="secure-app-db"
DB_NAME="file_vault_db"
SA_NAME="file-vault-backend-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
BUCKET_NAME="${PROJECT_ID}-secure-file-vault-bucket"

echo "--> Target Project: ${PROJECT_ID}"
echo "--> Target Region:  ${REGION}"
echo "--> Cloud SQL Instance: ${DB_INSTANCE_NAME}"

# Step 1: Enable Required GCP APIs
echo "[1/4] Enabling GCP Service APIs..."
gcloud services enable \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  run.googleapis.com \
  iam.googleapis.com \
  --project="${PROJECT_ID}"

# Step 2: Configure Cloud SQL Instance Networking & Database
echo "[2/4] Configuring Cloud SQL Instance (${DB_INSTANCE_NAME}) for Direct TCP Access..."
gcloud sql instances patch "${DB_INSTANCE_NAME}" \
  --assign-ip \
  --authorized-networks="0.0.0.0/0" \
  --project="${PROJECT_ID}" || true

if ! gcloud sql databases describe "${DB_NAME}" --instance="${DB_INSTANCE_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
    gcloud sql databases create "${DB_NAME}" \
      --instance="${DB_INSTANCE_NAME}" \
      --project="${PROJECT_ID}"
fi

DB_IP=$(gcloud sql instances describe "${DB_INSTANCE_NAME}" --format="value(ipAddresses[0].ipAddress)" --project="${PROJECT_ID}")
echo "--> Cloud SQL Public IP: ${DB_IP}"
echo "${DB_IP}" > /tmp/cloud_sql_ip.txt

# Step 3: Create Google Cloud Storage Bucket
echo "[3/4] Creating Cloud Storage Bucket..."
if ! gcloud storage buckets describe "gs://${BUCKET_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
    gcloud storage buckets create "gs://${BUCKET_NAME}" \
      --location="${REGION}" \
      --public-access-prevention \
      --uniform-bucket-level-access \
      --project="${PROJECT_ID}"

    gcloud storage buckets update "gs://${BUCKET_NAME}" \
      --cors-file="gcp/cors.json" \
      --project="${PROJECT_ID}"
fi

# Step 4: Create Service Account Managed Identity & Assign IAM Roles
echo "[4/4] Provisioning GCP Service Account and IAM Roles..."
if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT_ID}" &>/dev/null; then
    gcloud iam service-accounts create "${SA_NAME}" \
      --display-name="Secure File Vault Backend Service Account" \
      --project="${PROJECT_ID}"
    echo "Waiting 10 seconds for IAM Service Account propagation..."
    sleep 10
fi

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client" || true

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.instanceUser" || true

gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin" || true

echo "===================================================================="
echo " Infrastructure Setup Complete!                                     "
echo "===================================================================="
