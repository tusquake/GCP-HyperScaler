#!/usr/bin/env bash
set -e

echo "===================================================================="
echo " Deploying Secure Enterprise File Vault to GCP via gcloud CLI       "
echo " VPC Network | Cloud SQL Private IP | GCS Signed URLs | IAM Auth    "
echo "===================================================================="

# Check for GCP CLI
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed or not in PATH."
    exit 1
fi

PROJECT_ID=$(gcloud config get-value project)
REGION=${GCP_REGION:-"us-central1"}
CONNECTOR_NAME="vault-serverless-vpc"
SA_EMAIL="file-vault-backend-sa@${PROJECT_ID}.iam.gserviceaccount.com"
BUCKET_NAME="${PROJECT_ID}-secure-file-vault-bucket"
DB_INSTANCE_NAME="secure-app-db"
DB_NAME="file_vault_db"
DB_USER="postgres"
DB_PASSWORD="SecurePassword123!"

echo "--> Target GCP Project ID: ${PROJECT_ID}"
echo "--> Target GCP Region:     ${REGION}"
echo "--> Cloud SQL Instance:    ${DB_INSTANCE_NAME}"

# 1. Run pure gcloud infrastructure setup
echo "[1/4] Provisioning Infrastructure via gcloud CLI..."
chmod +x ./setup_gcp_infra.sh
./setup_gcp_infra.sh

# 2. Build & Containerize Backend via Cloud Build
echo "[2/4] Containerizing Backend with Google Cloud Build..."
gcloud builds submit --tag "gcr.io/${PROJECT_ID}/secure-file-vault-backend:latest" ./backend

# 3. Deploy Backend to Cloud Run with Serverless VPC Connector & Service Account
echo "[3/4] Deploying Backend Container to Cloud Run..."
gcloud run deploy secure-file-vault-backend \
  --image "gcr.io/${PROJECT_ID}/secure-file-vault-backend:latest" \
  --region "${REGION}" \
  --platform managed \
  --service-account "${SA_EMAIL}" \
  --vpc-connector "${CONNECTOR_NAME}" \
  --vpc-egress all-traffic \
  --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID},GCS_BUCKET_NAME=${BUCKET_NAME},CLOUD_SQL_CONNECTION_NAME=${PROJECT_ID}:${REGION}:${DB_INSTANCE_NAME},DB_NAME=${DB_NAME},DB_USER=${DB_USER},DB_PASSWORD=${DB_PASSWORD}" \
  --allow-unauthenticated \
  --project "${PROJECT_ID}"

CLOUD_RUN_URL=$(gcloud run services describe secure-file-vault-backend --region="${REGION}" --format="value(status.url)" --project="${PROJECT_ID}")

# 4. Build Frontend for Production
echo "[4/4] Building React SPA Frontend..."
cd frontend
npm install
VITE_API_URL="${CLOUD_RUN_URL}" npm run build
cd ..

echo "===================================================================="
echo " Deployment Successfully Completed via gcloud CLI!                 "
echo " Cloud Run Backend URL: ${CLOUD_RUN_URL}                           "
echo " Cloud Storage Bucket:  gs://${BUCKET_NAME}                         "
echo " Cloud SQL Instance:    ${DB_INSTANCE_NAME}                         "
echo "===================================================================="
