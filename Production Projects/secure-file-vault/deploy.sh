#!/usr/bin/env bash
set -e

echo "===================================================================="
echo " Deploying Secure Enterprise File Vault (VPC Private Subnet Mode)   "
echo " Custom VPC Network | Private Subnet 10.0.1.0/24 | Cloud SQL Priv IP"
echo "===================================================================="

if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed or not in PATH."
    exit 1
fi

PROJECT_ID=$(gcloud config get-value project)
REGION=${GCP_REGION:-"us-central1"}
VPC_NAME="file-vault-vpc"
SUBNET_NAME="file-vault-private-subnet"
SA_EMAIL="file-vault-backend-sa@${PROJECT_ID}.iam.gserviceaccount.com"
BUCKET_NAME="${PROJECT_ID}-secure-file-vault-bucket"
DB_INSTANCE_NAME="secure-app-db"
DB_NAME="file_vault_db"
DB_USER="postgres"
DB_PASSWORD="SecurePassword123!"

echo "--> Target GCP Project ID: ${PROJECT_ID}"
echo "--> Target GCP Region:     ${REGION}"
echo "--> VPC Network:           ${VPC_NAME}"
echo "--> Private Subnet:        ${SUBNET_NAME} (10.0.1.0/24)"
echo "--> Cloud SQL Instance:    ${DB_INSTANCE_NAME}"

# 1. Infrastructure Setup (Custom VPC, Private Subnet, Private Service Access, Cloud SQL Private IP)
echo "[1/4] Provisioning Infrastructure via gcloud CLI..."
chmod +x ./setup_gcp_infra.sh
./setup_gcp_infra.sh

DB_HOST=$(cat /tmp/cloud_sql_ip.txt || echo "")
echo "--> Cloud SQL Private IP Host: ${DB_HOST}"

# 2. Build React SPA Frontend & Copy into Backend public/ folder
echo "[2/4] Building React SPA Frontend & Packaging with Backend..."
cd frontend
npm install
npm run build
cd ..

rm -rf backend/public
mkdir -p backend/public
cp -r frontend/dist/* backend/public/

# 3. Containerize Backend & Frontend into single Cloud Run container image
echo "[3/4] Containerizing Application with Google Cloud Build..."
gcloud builds submit --tag "gcr.io/${PROJECT_ID}/secure-file-vault-backend:latest" ./backend

# 4. Deploy Full-Stack Container to Cloud Run with Direct VPC Subnet Egress to Private IP Cloud SQL
echo "[4/4] Deploying Full-Stack Application to Cloud Run inside VPC Private Subnet..."
gcloud run deploy secure-file-vault-backend \
  --image "gcr.io/${PROJECT_ID}/secure-file-vault-backend:latest" \
  --region "${REGION}" \
  --platform managed \
  --service-account "${SA_EMAIL}" \
  --network "${VPC_NAME}" \
  --subnet "${SUBNET_NAME}" \
  --vpc-egress all-traffic \
  --add-cloudsql-instances "${PROJECT_ID}:${REGION}:${DB_INSTANCE_NAME}" \
  --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID},GCS_BUCKET_NAME=${BUCKET_NAME},DB_HOST=${DB_HOST},CLOUD_SQL_CONNECTION_NAME=${PROJECT_ID}:${REGION}:${DB_INSTANCE_NAME},DB_NAME=${DB_NAME},DB_USER=${DB_USER},DB_PASSWORD=${DB_PASSWORD}" \
  --allow-unauthenticated \
  --project "${PROJECT_ID}"

CLOUD_RUN_URL=$(gcloud run services describe secure-file-vault-backend --region="${REGION}" --format="value(status.url)" --project="${PROJECT_ID}")

echo "===================================================================="
echo " Full-Stack Application Successfully Deployed in VPC Private Mode!   "
echo " Live Application URL: ${CLOUD_RUN_URL}                             "
echo " VPC Network:          ${VPC_NAME}                                  "
echo " Private Subnet:       ${SUBNET_NAME} (10.0.1.0/24)                "
echo " Cloud SQL Private IP: ${DB_HOST}                                   "
echo " Cloud Storage Bucket: gs://${BUCKET_NAME}                          "
echo "===================================================================="
