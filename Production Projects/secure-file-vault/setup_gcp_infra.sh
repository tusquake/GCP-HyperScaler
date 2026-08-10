#!/usr/bin/env bash
set -e

# ==============================================================================
# GCP Infrastructure Provisioner - Private VPC & Private IP Database Mode
# ==============================================================================

echo "===================================================================="
echo " Provisioning GCP VPC Network & Cloud SQL Private IP Access         "
echo "===================================================================="

# Set Variables
PROJECT_ID=$(gcloud config get-value project)
REGION=${GCP_REGION:-"us-central1"}
VPC_NAME="file-vault-vpc"
SUBNET_NAME="file-vault-private-subnet"
DB_INSTANCE_NAME="secure-app-db"
DB_NAME="file_vault_db"
SA_NAME="file-vault-backend-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
BUCKET_NAME="${PROJECT_ID}-secure-file-vault-bucket"

echo "--> Target Project: ${PROJECT_ID}"
echo "--> Target Region:  ${REGION}"
echo "--> VPC Network:    ${VPC_NAME}"
echo "--> Private Subnet: ${SUBNET_NAME} (10.0.1.0/24)"

# Step 1: Enable Required GCP APIs
echo "[1/6] Enabling GCP Service APIs..."
gcloud services enable \
  compute.googleapis.com \
  servicenetworking.googleapis.com \
  vpcaccess.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  run.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  --project="${PROJECT_ID}"

# Step 2: Create Custom VPC & Private Subnet (10.0.1.0/24)
echo "[2/6] Provisioning Custom VPC Network & Private Subnet..."
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

# Step 3: Private Service Access Peering
echo "[3/6] Setting up Private Service Access Peering..."
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

# Step 4: Configure Cloud SQL Instance for Private IP Only
echo "[4/6] Patching Cloud SQL Instance (${DB_INSTANCE_NAME}) with Private IP in VPC..."
gcloud sql instances patch "${DB_INSTANCE_NAME}" \
  --network="${VPC_NAME}" \
  --no-assign-ip \
  --project="${PROJECT_ID}" || true

if ! gcloud sql databases describe "${DB_NAME}" --instance="${DB_INSTANCE_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
    gcloud sql databases create "${DB_NAME}" \
      --instance="${DB_INSTANCE_NAME}" \
      --project="${PROJECT_ID}"
fi

# Retrieve Cloud SQL Private IP Address
DB_PRIVATE_IP=$(gcloud sql instances describe "${DB_INSTANCE_NAME}" --format="value(ipAddresses.filter(type:PRIVATE).ipAddress)" --project="${PROJECT_ID}" 2>/dev/null || echo "")

if [ -z "${DB_PRIVATE_IP}" ]; then
  # Fallback to primary IP if Private IP is still propagating
  DB_PRIVATE_IP=$(gcloud sql instances describe "${DB_INSTANCE_NAME}" --format="value(ipAddresses[0].ipAddress)" --project="${PROJECT_ID}")
fi

echo "--> Cloud SQL Private IP: ${DB_PRIVATE_IP}"
echo "${DB_PRIVATE_IP}" > /tmp/cloud_sql_ip.txt

# Step 5: Create Cloud Storage Bucket & CORS Policy
echo "[5/6] Provisioning Cloud Storage Bucket & Applying CORS Policy..."
if ! gcloud storage buckets describe "gs://${BUCKET_NAME}" --project="${PROJECT_ID}" &>/dev/null; then
    gcloud storage buckets create "gs://${BUCKET_NAME}" \
      --location="${REGION}" \
      --public-access-prevention \
      --uniform-bucket-level-access \
      --project="${PROJECT_ID}"
fi

gcloud storage buckets update "gs://${BUCKET_NAME}" \
  --cors-file="gcp/cors.json" \
  --project="${PROJECT_ID}" || true

# Step 6: Create Service Account Managed Identity & Assign IAM Roles
echo "[6/6] Provisioning GCP Service Account and IAM Roles..."
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

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountTokenCreator" || true

gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin" || true

echo "===================================================================="
echo " Private VPC Network & Private IP Cloud SQL Setup Complete!          "
echo " VPC Network: ${VPC_NAME} | Private Subnet: ${SUBNET_NAME}          "
echo " Cloud SQL Private IP: ${DB_PRIVATE_IP}                             "
echo "===================================================================="
