# GCP Manual Infrastructure & Deployment Terminal Commands

This document contains the step-by-step `gcloud` CLI commands executed manually in Google Cloud Shell to provision the enterprise infrastructure and deploy the application.

---

## 1. Set Project & Environment Variables

```bash
export PROJECT_ID=$(gcloud config get-value project)
export REGION="us-central1"
export VPC_NAME="file-vault-vpc"
export SUBNET_NAME="file-vault-private-subnet"
export DB_INSTANCE_NAME="secure-app-db"
export DB_NAME="file_vault_db"
export SA_NAME="file-vault-backend-sa"
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
export BUCKET_NAME="${PROJECT_ID}-secure-file-vault-bucket"
```

---

## 2. Enable Required GCP Service APIs

```bash
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
```

---

## 3. Provision Custom VPC Network & Private Subnet (10.0.1.0/24)

```bash
# Create Custom VPC Network
gcloud compute networks create ${VPC_NAME} \
  --subnet-mode=custom \
  --project=${PROJECT_ID}

# Create Private Subnet (10.0.1.0/24) with Private Google Access
gcloud compute networks subnets create ${SUBNET_NAME} \
  --network=${VPC_NAME} \
  --range=10.0.1.0/24 \
  --region=${REGION} \
  --enable-private-ip-google-access \
  --project=${PROJECT_ID}
```

---

## 4. Setup Private Service Access Peering

```bash
# Reserve Global IP Range for Private Service Access
gcloud compute addresses create google-managed-services-${VPC_NAME} \
  --global \
  --purpose=VPC_PEERING \
  --prefix-length=16 \
  --network=${VPC_NAME} \
  --project=${PROJECT_ID}

# Connect Service Peering to Google Managed Services
gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --ranges=google-managed-services-${VPC_NAME} \
  --network=${VPC_NAME} \
  --project=${PROJECT_ID}
```

---

## 5. Configure Cloud SQL Instance Private IP & Provision Database

```bash
# Attach Cloud SQL Instance to Custom VPC Network (Private IP Only)
gcloud sql instances patch ${DB_INSTANCE_NAME} \
  --network=${VPC_NAME} \
  --no-assign-ip \
  --project=${PROJECT_ID}

# Create Application Database
gcloud sql databases create ${DB_NAME} \
  --instance=${DB_INSTANCE_NAME} \
  --project=${PROJECT_ID}

# Retrieve Database Private IP Address into Environment Variable
export DB_HOST=$(gcloud sql instances describe ${DB_INSTANCE_NAME} --format="value(ipAddresses.filter(type:PRIVATE).ipAddress)" --project=${PROJECT_ID})
echo "Cloud SQL Private IP: ${DB_HOST}"
```

---

## 6. Provision Google Cloud Storage Bucket & Configure CORS Policy

```bash
# Create GCS Bucket with Public Access Prevention & Uniform Bucket-Level Access
gcloud storage buckets create gs://${BUCKET_NAME} \
  --location=${REGION} \
  --public-access-prevention \
  --uniform-bucket-level-access \
  --project=${PROJECT_ID}

# Apply CORS Configuration Policy
gcloud storage buckets update gs://${BUCKET_NAME} \
  --cors-file=gcp/cors.json \
  --project=${PROJECT_ID}
```

---

## 7. Provision Service Account Managed Identity & Assign IAM Roles

```bash
# Create Dedicated Service Account
gcloud iam service-accounts create ${SA_NAME} \
  --display-name="Secure File Vault Backend Service Account" \
  --project=${PROJECT_ID}

# Assign Cloud SQL Client Role
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client"

# Assign Cloud SQL Instance User Role
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.instanceUser"

# Assign Service Account Token Creator Role (For Resumable Signed Uploads)
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountTokenCreator"

# Assign GCS Object Admin Permission on Storage Bucket
gcloud storage buckets add-iam-policy-binding gs://${BUCKET_NAME} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin"
```

---

## 8. Package React SPA & Build Backend Container Image

```bash
# Build Production React SPA Assets
cd frontend
npm install
npm run build
cd ..

# Package Frontend Dist into Backend Public Assets Folder
rm -rf backend/public
mkdir -p backend/public
cp -r frontend/dist/* backend/public/

# Submit Build to Google Cloud Build
gcloud builds submit --tag gcr.io/${PROJECT_ID}/secure-file-vault-backend:latest ./backend
```

---

## 9. Deploy Serverless Cloud Run Service with Direct VPC Subnet Egress

```bash
gcloud run deploy secure-file-vault-backend \
  --image gcr.io/${PROJECT_ID}/secure-file-vault-backend:latest \
  --region ${REGION} \
  --platform managed \
  --service-account ${SA_EMAIL} \
  --network ${VPC_NAME} \
  --subnet ${SUBNET_NAME} \
  --vpc-egress all-traffic \
  --add-cloudsql-instances ${PROJECT_ID}:${REGION}:${DB_INSTANCE_NAME} \
  --set-env-vars GCP_PROJECT_ID=${PROJECT_ID},GCS_BUCKET_NAME=${BUCKET_NAME},DB_HOST=${DB_HOST},CLOUD_SQL_CONNECTION_NAME=${PROJECT_ID}:${REGION}:${DB_INSTANCE_NAME},DB_NAME=${DB_NAME},DB_USER=postgres,DB_PASSWORD=SecurePassword123! \
  --allow-unauthenticated \
  --project ${PROJECT_ID}
```

---

## 10. Verification & Service Status

```bash
# Retrieve Live Application Endpoint URL
gcloud run services describe secure-file-vault-backend \
  --region=${REGION} \
  --format="value(status.url)" \
  --project=${PROJECT_ID}

# View Real-time Application Logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=secure-file-vault-backend" \
  --limit=30 \
  --project=${PROJECT_ID}
```
