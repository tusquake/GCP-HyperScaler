#!/usr/bin/env bash
set -e

# ==============================================================================
# GCP Pure gcloud CLI Infrastructure Provisioner
# ==============================================================================

echo "===================================================================="
echo " Provisioning GCP Infrastructure via pure gcloud CLI                "
echo "===================================================================="

# Set Variables
PROJECT_ID=$(gcloud config get-value project)
REGION=${GCP_REGION:-"us-central1"}
VPC_NAME="file-vault-vpc"
SUBNET_NAME="file-vault-private-subnet"
CONNECTOR_NAME="vault-serverless-vpc"
DB_INSTANCE_NAME="secure-app-db"
DB_NAME="file_vault_db"
SA_NAME="file-vault-backend-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
BUCKET_NAME="${PROJECT_ID}-secure-file-vault-bucket"

echo "--> Target Project: ${PROJECT_ID}"
echo "--> Target Region:  ${REGION}"
echo "--> Cloud SQL Instance: ${DB_INSTANCE_NAME}"

# Step 1: Enable Required GCP APIs
echo "[1/7] Enabling GCP Service APIs..."
gcloud services enable \
  compute.googleapis.com \
  servicenetworking.googleapis.com \
  vpcaccess.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  run.googleapis.com \
  iam.googleapis.com \
  --project="${PROJECT_ID}"

# Step 2: Create Custom VPC & Private Subnet
echo "[2/7] Creating Custom VPC Network and Private Subnet..."
if ! gcloud compute networks describe "${VPC_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
    gcloud compute networks create "${VPC_NAME}" \
      --subnet-mode=custom \
      --project="${PROJECT_ID}"
fi

if ! gcloud compute networks subnets describe "${SUBNET_NAME}" --region="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
    gcloud compute networks subnets create "${SUBNET_NAME}" \
      --network="${VPC_NAME}" \
      --range="10.0.1.0/24" \
      --region="${REGION}" \
      --enable-private-ip-google-access \
      --project="${PROJECT_ID}"
fi

# Step 3: Private Service Access Peering & Serverless VPC Connector
echo "[3/7] Setting up Private Service Access & Serverless VPC Access Connector..."
if ! gcloud compute addresses describe "google-managed-services-${VPC_NAME}" --global --project="${PROJECT_ID}" &>/dev/null; then
    gcloud compute addresses create "google-managed-services-${VPC_NAME}" \
      --global \
      --purpose=VPC_PEERING \
      --prefix-length=16 \
      --network="${VPC_NAME}" \
      --project="${PROJECT_ID}"
fi

gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --ranges="google-managed-services-${VPC_NAME}" \
  --network="${VPC_NAME}" \
  --project="${PROJECT_ID}" || true

if ! gcloud compute networks vpc-access connectors describe "${CONNECTOR_NAME}" --region="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
    gcloud compute networks vpc-access connectors create "${CONNECTOR_NAME}" \
      --network="${VPC_NAME}" \
      --region="${REGION}" \
      --range="10.0.2.0/28" \
      --min-instances=2 \
      --max-instances=5 \
      --project="${PROJECT_ID}"
fi

# Wait for Serverless VPC Access Connector to reach READY state
echo "Checking Serverless VPC Connector readiness status..."
for i in {1..30}; do
  CONNECTOR_STATE=$(gcloud compute networks vpc-access connectors describe "${CONNECTOR_NAME}" --region="${REGION}" --format="value(state)" --project="${PROJECT_ID}" 2>/dev/null || echo "UNKNOWN")
  if [ "${CONNECTOR_STATE}" = "READY" ]; then
    echo "Serverless VPC Access Connector [${CONNECTOR_NAME}] is READY."
    break
  fi
  echo "Connector state is '${CONNECTOR_STATE}'. Waiting 10 seconds (${i}/30)..."
  sleep 10
done

# Step 4: Configure Database on Existing Cloud SQL Instance (secure-app-db)
echo "[4/7] Verifying Existing Cloud SQL Instance (${DB_INSTANCE_NAME}) and Creating Database..."
if ! gcloud sql instances describe "${DB_INSTANCE_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
    echo "Cloud SQL instance ${DB_INSTANCE_NAME} not found. Creating..."
    gcloud sql instances create "${DB_INSTANCE_NAME}" \
      --database-version=POSTGRES_15 \
      --tier=db-f1-micro \
      --region="${REGION}" \
      --network="${VPC_NAME}" \
      --no-assign-ip \
      --enable-database-flag cloudsql.iam_authentication=on \
      --project="${PROJECT_ID}"
fi

if ! gcloud sql databases describe "${DB_NAME}" --instance="${DB_INSTANCE_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
    gcloud sql databases create "${DB_NAME}" \
      --instance="${DB_INSTANCE_NAME}" \
      --project="${PROJECT_ID}"
fi

# Step 5: Create Google Cloud Storage Bucket
echo "[5/7] Creating Cloud Storage Bucket..."
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

# Step 6: Create Service Account Managed Identity & Assign IAM Roles
echo "[6/7] Provisioning GCP Service Account and IAM Roles..."
if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT_ID}" &>/dev/null; then
    gcloud iam service-accounts create "${SA_NAME}" \
      --display-name="Secure File Vault Backend Service Account" \
      --project="${PROJECT_ID}"
    echo "Waiting 10 seconds for IAM Service Account directory propagation..."
    sleep 10
fi

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.instanceUser"

gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin"

echo "===================================================================="
echo " Infrastructure Setup Complete!                                     "
echo " Cloud SQL Instance:  ${DB_INSTANCE_NAME}"
echo " Storage Bucket:      gs://${BUCKET_NAME}"
echo " Service Account:     ${SA_EMAIL}"
echo " VPC Connector:       ${CONNECTOR_NAME}"
echo "===================================================================="
