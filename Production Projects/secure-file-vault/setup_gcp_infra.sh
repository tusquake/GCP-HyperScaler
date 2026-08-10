#!/usr/bin/env bash
set -e

# ==============================================================================
# GCP Pure gcloud CLI Infrastructure Provisioner
# 
# Provisions:
# 1. GCP APIs
# 2. Custom VPC Network & Private Subnet (10.0.1.0/24)
# 3. Private Service Access Peering & Serverless VPC Connector (10.0.2.0/28)
# 4. Cloud SQL PostgreSQL Instance with Private IP Only (No Public IP)
# 5. Google Cloud Storage Bucket (Public Access Prevention Enforced & CORS)
# 6. Service Account Managed Identity & Least-Privilege IAM Roles
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
DB_INSTANCE_NAME="file-vault-db-instance"
DB_NAME="file_vault_db"
SA_NAME="file-vault-backend-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
BUCKET_NAME="${PROJECT_ID}-secure-file-vault-bucket"

echo "--> Target Project: ${PROJECT_ID}"
echo "--> Target Region:  ${REGION}"

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

gcloud services peering connect \
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

# Step 4: Create Cloud SQL PostgreSQL (Private IP Only - No Public IP)
echo "[4/7] Creating Cloud SQL Instance with Private IP Only..."
if ! gcloud sql instances describe "${DB_INSTANCE_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
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

# Step 5: Create Google Cloud Storage Bucket with CORS & Public Access Prevention Enforced
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
fi

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client" \
  --condition=None

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.instanceUser" \
  --condition=None

gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin"

echo "===================================================================="
echo " Infrastructure Provisioning Complete via gcloud CLI!               "
echo " Cloud SQL Instance:  ${DB_INSTANCE_NAME} (Private IP Only)"
echo " Storage Bucket:      gs://${BUCKET_NAME}"
echo " Service Account:     ${SA_EMAIL}"
echo " VPC Connector:       ${CONNECTOR_NAME}"
echo "===================================================================="
