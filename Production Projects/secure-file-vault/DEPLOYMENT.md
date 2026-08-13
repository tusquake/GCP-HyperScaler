# Step-by-Step GCP Production Deployment Guide

**Target GCP Project ID**: `my-gcp-learning-demo`  
**Target GCP Region**: `us-central1`

This guide provides the exact `gcloud` CLI terminal commands pre-configured for your project `my-gcp-learning-demo`.

---

## 1. Prerequisites & Initial GCP Project Setup

Open Google Cloud Shell or your local terminal (authenticated with `gcloud auth login`) and run:

```bash
# 1. Set environment variables for your project
export PROJECT_ID="my-gcp-learning-demo"
export REGION="us-central1"

gcloud config set project "${PROJECT_ID}"
gcloud config set compute/region "${REGION}"

# 2. Enable Required GCP Service APIs
gcloud services enable \
  compute.googleapis.com \
  servicenetworking.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  pubsub.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  --project="${PROJECT_ID}"
```

---

## Step 1: Networking -- Private VPC & Private Service Access

Provision custom VPC `file-vault-vpc` and establish Private Service Access peering so Cloud SQL has no public IP address.

```bash
# 1. Create Custom VPC Network
gcloud compute networks create file-vault-vpc \
  --subnet-mode=custom \
  --project="${PROJECT_ID}"

# 2. Create Private Subnet (10.0.1.0/24) with Private Google Access
gcloud compute networks subnets create file-vault-private-subnet \
  --network=file-vault-vpc \
  --range=10.0.1.0/24 \
  --region="${REGION}" \
  --enable-private-ip-google-access \
  --project="${PROJECT_ID}"

# 3. Allocate Internal IP Range for Private Service Access Peering
gcloud compute addresses create file-vault-private-ip \
  --global \
  --purpose=VPC_PEERING \
  --prefix-length=16 \
  --network=file-vault-vpc \
  --project="${PROJECT_ID}"

# 4. Establish Private VPC Peering with Google Managed Services (Cloud SQL)
gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --ranges=file-vault-private-ip \
  --network=file-vault-vpc \
  --project="${PROJECT_ID}"

# 5. Create Firewall Rule allowing Cloud Run Subnet to reach Cloud SQL (Port 5432)
gcloud compute firewall-rules create allow-cloud-run-to-cloudsql \
  --network=file-vault-vpc \
  --direction=INGRESS \
  --priority=1000 \
  --action=ALLOW \
  --rules=tcp:5432 \
  --source-ranges=10.0.1.0/24 \
  --project="${PROJECT_ID}"
```

---

## Step 2: Private Cloud SQL PostgreSQL Setup

Provision a private-only PostgreSQL instance connected via Private Service Access.

```bash
# 1. Generate a strong random database password
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9')
echo "Generated DB Password for vault_app: ${DB_PASSWORD}"

# 2. Provision Cloud SQL PostgreSQL Instance (No Public IP)
gcloud sql instances create secure-app-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-7680 \
  --region="${REGION}" \
  --network=file-vault-vpc \
  --no-assign-ip \
  --allocated-ip-range=file-vault-private-ip \
  --backup-start-time=03:00 \
  --enable-point-in-time-recovery \
  --retained-backups-count=7 \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=3 \
  --project="${PROJECT_ID}"

# 3. Create the Database
gcloud sql databases create file_vault_db \
  --instance=secure-app-db \
  --project="${PROJECT_ID}"

# 4. Create Database User
gcloud sql users create vault_app \
  --instance=secure-app-db \
  --password="${DB_PASSWORD}" \
  --project="${PROJECT_ID}"

# 5. Get Private IP of Cloud SQL Instance
DB_PRIVATE_IP=$(gcloud sql instances describe secure-app-db --format="value(ipAddresses[0].ipAddress)" --project="${PROJECT_ID}")
echo "Cloud SQL Private IP: ${DB_PRIVATE_IP}"
```

---

## Step 3: Secret Manager Setup

Store database password and JWT signing keys in GCP Secret Manager.

```bash
# 1. Create Secret for Database Password
gcloud secrets create db-password \
  --replication-policy="automatic" \
  --project="${PROJECT_ID}"

echo -n "${DB_PASSWORD}" | gcloud secrets versions add db-password \
  --data-file=- \
  --project="${PROJECT_ID}"

# 2. Generate and Store JWT Signing Secret
JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9')

gcloud secrets create jwt-secret \
  --replication-policy="automatic" \
  --project="${PROJECT_ID}"

echo -n "${JWT_SECRET}" | gcloud secrets versions add jwt-secret \
  --data-file=- \
  --project="${PROJECT_ID}"
```

---

## Step 4: 3-Bucket GCS Setup (`my-gcp-learning-demo`)

Create `Quarantine`, `Clean`, and `Rejected` GCS buckets with Public Access Prevention.

```bash
# 1. Create Quarantine Bucket
gcloud storage buckets create "gs://my-gcp-learning-demo-quarantine" \
  --location="${REGION}" \
  --public-access-prevention \
  --uniform-bucket-level-access \
  --project="${PROJECT_ID}"

# 2. Create Clean Bucket (Enable versioning for Disaster Recovery)
gcloud storage buckets create "gs://my-gcp-learning-demo-clean" \
  --location="${REGION}" \
  --public-access-prevention \
  --uniform-bucket-level-access \
  --project="${PROJECT_ID}"

gcloud storage buckets update "gs://my-gcp-learning-demo-clean" --versioning

# 3. Create Rejected Bucket
gcloud storage buckets create "gs://my-gcp-learning-demo-rejected" \
  --location="${REGION}" \
  --public-access-prevention \
  --uniform-bucket-level-access \
  --project="${PROJECT_ID}"

# 4. Apply CORS Policy to Quarantine Bucket
gcloud storage buckets update "gs://my-gcp-learning-demo-quarantine" --cors-file=gcp/cors.json
```

---

## Step 5: Pub/Sub Setup for Asynchronous Malware Scanning

```bash
# 1. Create Pub/Sub Topic
gcloud pubsub topics create file-uploaded-topic --project="${PROJECT_ID}"

# 2. Grant GCS Service Agent Permission to Publish to Pub/Sub
GCS_SA=$(gcloud storage service-agent --project="${PROJECT_ID}")

gcloud pubsub topics add-iam-policy-binding file-uploaded-topic \
  --member="serviceAccount:${GCS_SA}" \
  --role="roles/pubsub.publisher" \
  --project="${PROJECT_ID}"
```

---

## Step 6: Service Accounts & IAM Roles (`my-gcp-learning-demo`)

```bash
# 1. Create Backend Service Account
gcloud iam service-accounts create file-vault-backend-sa \
  --display-name="File Vault Backend Service Account" \
  --project="${PROJECT_ID}"

SA_BACKEND="file-vault-backend-sa@my-gcp-learning-demo.iam.gserviceaccount.com"

# Grant Backend SA access to Cloud SQL, Secret Manager, GCS, and Pub/Sub
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_BACKEND}" \
  --role="roles/cloudsql.client"

gcloud secrets add-iam-policy-binding db-password \
  --member="serviceAccount:${SA_BACKEND}" \
  --role="roles/secretmanager.secretAccessor" \
  --project="${PROJECT_ID}"

gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:${SA_BACKEND}" \
  --role="roles/secretmanager.secretAccessor" \
  --project="${PROJECT_ID}"

gcloud storage buckets add-iam-policy-binding "gs://my-gcp-learning-demo-quarantine" \
  --member="serviceAccount:${SA_BACKEND}" \
  --role="roles/storage.objectAdmin"

gcloud storage buckets add-iam-policy-binding "gs://my-gcp-learning-demo-clean" \
  --member="serviceAccount:${SA_BACKEND}" \
  --role="roles/storage.objectAdmin"

gcloud storage buckets add-iam-policy-binding "gs://my-gcp-learning-demo-rejected" \
  --member="serviceAccount:${SA_BACKEND}" \
  --role="roles/storage.objectAdmin"

gcloud pubsub topics add-iam-policy-binding file-uploaded-topic \
  --member="serviceAccount:${SA_BACKEND}" \
  --role="roles/pubsub.publisher" \
  --project="${PROJECT_ID}"

# 2. Create Frontend Service Account (Minimal permissions)
gcloud iam service-accounts create file-vault-frontend-sa \
  --display-name="File Vault Frontend Service Account" \
  --project="${PROJECT_ID}"

SA_FRONTEND="file-vault-frontend-sa@my-gcp-learning-demo.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_FRONTEND}" \
  --role="roles/logging.logWriter"
```

---

## Step 7: Artifact Registry & Docker Builds

```bash
# 1. Create Docker Repository in Artifact Registry
gcloud artifacts repositories create secure-vault-repo \
  --repository-format=docker \
  --location="${REGION}" \
  --description="Secure File Vault Docker Repository" \
  --project="${PROJECT_ID}"

# 2. Build & Push Backend Container Image
gcloud builds submit \
  --tag="us-central1-docker.pkg.dev/my-gcp-learning-demo/secure-vault-repo/backend:v1.0.0" \
  ./backend \
  --project="${PROJECT_ID}"

# 3. Build & Push Frontend Container Image
gcloud builds submit \
  --tag="us-central1-docker.pkg.dev/my-gcp-learning-demo/secure-vault-repo/frontend:v1.0.0" \
  ./frontend \
  --project="${PROJECT_ID}"
```

---

## Step 8: Cloud Run Deployments (`my-gcp-learning-demo`)

```bash
# 1. Deploy Backend Cloud Run API Service with Direct VPC Subnet Egress
gcloud run deploy secure-file-vault-backend \
  --image="us-central1-docker.pkg.dev/my-gcp-learning-demo/secure-vault-repo/backend:v1.0.0" \
  --region="${REGION}" \
  --platform=managed \
  --service-account="file-vault-backend-sa@my-gcp-learning-demo.iam.gserviceaccount.com" \
  --network=file-vault-vpc \
  --subnet=file-vault-private-subnet \
  --vpc-egress=all-traffic \
  --min-instances=1 \
  --max-instances=10 \
  --concurrency=50 \
  --cpu=2 \
  --memory=1024Mi \
  --set-env-vars="NODE_ENV=production,GCP_PROJECT_ID=my-gcp-learning-demo,DB_HOST=${DB_PRIVATE_IP},DB_NAME=file_vault_db,DB_USER=vault_app,SECRET_DB_PASSWORD_NAME=projects/my-gcp-learning-demo/secrets/db-password/versions/latest,GCS_QUARANTINE_BUCKET=my-gcp-learning-demo-quarantine,GCS_CLEAN_BUCKET=my-gcp-learning-demo-clean,GCS_REJECTED_BUCKET=my-gcp-learning-demo-rejected,PUBSUB_ENABLED=true,PUBSUB_TOPIC=file-uploaded-topic" \
  --ingress=all \
  --project="${PROJECT_ID}"

# Capture Backend Cloud Run URL
BACKEND_URL=$(gcloud run services describe secure-file-vault-backend --region="${REGION}" --format="value(status.url)" --project="${PROJECT_ID}")
echo "Backend API URL: ${BACKEND_URL}"

# 2. Rebuild Frontend Container with Live Backend API URL
gcloud builds submit \
  --tag="us-central1-docker.pkg.dev/my-gcp-learning-demo/secure-vault-repo/frontend:v1.0.0" \
  --substitutions="_VITE_API_BASE_URL=${BACKEND_URL}/api" \
  ./frontend \
  --project="${PROJECT_ID}"

# 3. Deploy Frontend Cloud Run SPA Service
gcloud run deploy secure-file-vault-frontend \
  --image="us-central1-docker.pkg.dev/my-gcp-learning-demo/secure-vault-repo/frontend:v1.0.0" \
  --region="${REGION}" \
  --platform=managed \
  --service-account="file-vault-frontend-sa@my-gcp-learning-demo.iam.gserviceaccount.com" \
  --min-instances=0 \
  --max-instances=10 \
  --concurrency=80 \
  --cpu=1 \
  --memory=256Mi \
  --allow-unauthenticated \
  --ingress=all \
  --project="${PROJECT_ID}"

# Capture Frontend Live Application URL
FRONTEND_URL=$(gcloud run services describe secure-file-vault-frontend --region="${REGION}" --format="value(status.url)" --project="${PROJECT_ID}")
echo "Live Application Frontend SPA URL: ${FRONTEND_URL}"

# 4. Restrict Backend CORS Allowed Origins to Frontend Domain
gcloud run services update secure-file-vault-backend \
  --region="${REGION}" \
  --update-env-vars="ALLOWED_ORIGINS=${FRONTEND_URL}" \
  --project="${PROJECT_ID}"
```

---

## Step 9: Pub/Sub Subscription Setup

```bash
gcloud pubsub subscriptions create file-scan-subscription \
  --topic=file-uploaded-topic \
  --push-endpoint="${BACKEND_URL}/api/files/pubsub-scan" \
  --push-auth-service-account="file-vault-backend-sa@my-gcp-learning-demo.iam.gserviceaccount.com" \
  --ack-deadline=60 \
  --project="${PROJECT_ID}"
```

---

## Summary Checklist for `my-gcp-learning-demo`

| Resource | Value / Name |
| :--- | :--- |
| **GCP Project ID** | `my-gcp-learning-demo` |
| **VPC / Subnet** | `file-vault-vpc` / `file-vault-subnet` (`10.0.1.0/24`) |
| **Cloud SQL Instance** | `secure-app-db` (PostgreSQL 15, Private IP only) |
| **Quarantine Bucket** | `gs://my-gcp-learning-demo-quarantine` |
| **Clean Bucket** | `gs://my-gcp-learning-demo-clean` |
| **Rejected Bucket** | `gs://my-gcp-learning-demo-rejected` |
| **Backend Service Account** | `file-vault-backend-sa@my-gcp-learning-demo.iam.gserviceaccount.com` |
| **Frontend Service Account**| `file-vault-frontend-sa@my-gcp-learning-demo.iam.gserviceaccount.com` |
| **Artifact Repository** | `us-central1-docker.pkg.dev/my-gcp-learning-demo/secure-vault-repo` |
