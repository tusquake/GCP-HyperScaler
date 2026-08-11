# GCP Manual Infrastructure & Deployment Terminal Commands

This document contains step-by-step `gcloud` CLI terminal commands executed in Google Cloud Shell. Each command includes a detailed technical explanation of **why it was used** in the enterprise system architecture.

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

### Technical Rationale for Commands:
- `export PROJECT_ID=$(gcloud config get-value project)`: Dynamically retrieves your active GCP project ID to ensure resource naming consistency.
- `export REGION="us-central1"`: Sets the primary deployment region for compute, database, and storage resources.
- `export VPC_NAME="file-vault-vpc"`: Defines the custom Virtual Private Cloud network identifier.
- `export SUBNET_NAME="file-vault-private-subnet"`: Defines the private IP CIDR subnet identifier.
- `export DB_INSTANCE_NAME="secure-app-db"`: Identifies the target Google Cloud SQL PostgreSQL database instance.
- `export DB_NAME="file_vault_db"`: Names the application relational database schema.
- `export SA_NAME` & `SA_EMAIL`: Defines the GCP IAM Service Account managed identity.
- `export BUCKET_NAME`: Constructs a globally unique Google Cloud Storage bucket name.

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

### Technical Rationale for Commands:
- `compute.googleapis.com`: Enables provision of custom VPC networks, private subnets, and internal firewall routing.
- `servicenetworking.googleapis.com`: Enables Private Service Access Peering to connect Cloud SQL over Private IP.
- `vpcaccess.googleapis.com`: Enables Direct VPC Subnet Egress for serverless Cloud Run container workloads.
- `sqladmin.googleapis.com`: Enables database instance provisioning, patching, and administration.
- `storage.googleapis.com`: Enables Google Cloud Storage bucket management and CORS configuration.
- `run.googleapis.com`: Enables serverless container hosting with automatic TLS HTTPS termination and autoscaling.
- `iam.googleapis.com`: Enables Service Account creation and IAM policy role bindings.
- `iamcredentials.googleapis.com`: Enables on-the-fly OAuth2 token generation for GCS resumable signed uploads.

---

## 3. Provision Custom VPC Network & Private Subnet (10.0.1.0/24)

```bash
# Create Custom VPC Network
gcloud compute networks create ${VPC_NAME} \
  --subnet-mode=custom \
  --project=${PROJECT_ID}
```
*Why used*: Provisions an isolated custom VPC network (`file-vault-vpc`) in custom subnet mode to ensure default public subnets are not automatically created.

```bash
# Create Private Subnet (10.0.1.0/24) with Private Google Access
gcloud compute networks subnets create ${SUBNET_NAME} \
  --network=${VPC_NAME} \
  --range=10.0.1.0/24 \
  --region=${REGION} \
  --enable-private-ip-google-access \
  --project=${PROJECT_ID}
```
*Why used*: Provisions a private subnet (`10.0.1.0/24`) and enables Private Google Access so resources without public IP addresses can reach Google APIs internally.

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
```
*Why used*: Reserves an internal `/16` IPv4 address range within `file-vault-vpc` dedicated for GCP service networking peering.

```bash
# Connect Service Peering to Google Managed Services
gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --ranges=google-managed-services-${VPC_NAME} \
  --network=${VPC_NAME} \
  --project=${PROJECT_ID}
```
*Why used*: Establishes private VPC peering between your custom VPC and Google's internal service network, enabling Cloud SQL to operate on a Private IP.

---

## 5. Configure Cloud SQL Instance Private IP & Provision Database

```bash
# Attach Cloud SQL Instance to Custom VPC Network (Private IP Only)
gcloud sql instances patch ${DB_INSTANCE_NAME} \
  --network=${VPC_NAME} \
  --no-assign-ip \
  --project=${PROJECT_ID}
```
*Why used*: Attaches `secure-app-db` directly to `file-vault-vpc` and disables public IPv4 assignment for total network isolation.

```bash
# Create Application Database
gcloud sql databases create ${DB_NAME} \
  --instance=${DB_INSTANCE_NAME} \
  --project=${PROJECT_ID}
```
*Why used*: Provisions the PostgreSQL database schema `file_vault_db` inside `secure-app-db`.

```bash
# Retrieve Database Private IP Address into Environment Variable
export DB_HOST=$(gcloud sql instances describe ${DB_INSTANCE_NAME} --format="value(ipAddresses.filter(type:PRIVATE).ipAddress)" --project=${PROJECT_ID})
echo "Cloud SQL Private IP: ${DB_HOST}"
```
*Why used*: Queries and extracts the internal Private IP (`10.0.1.x`) of the database instance to configure backend environment variables.

---

## 6. Provision Google Cloud Storage Bucket & Configure CORS Policy

```bash
# Create GCS Bucket with Public Access Prevention & Uniform Bucket-Level Access
gcloud storage buckets create gs://${BUCKET_NAME} \
  --location=${REGION} \
  --public-access-prevention \
  --uniform-bucket-level-access \
  --project=${PROJECT_ID}
```
*Why used*: Provisions the storage bucket while enforcing security benchmarks: blocking public access and enforcing uniform IAM bucket-level permissions.

```bash
# Apply CORS Configuration Policy
gcloud storage buckets update gs://${BUCKET_NAME} \
  --cors-file=gcp/cors.json \
  --project=${PROJECT_ID}
```
*Why used*: Applies cross-origin resource sharing (CORS) rules (`gcp/cors.json`) so client web applications can stream 1.5GB+ files directly to GCS via signed URLs.

---

## 7. Provision Service Account Managed Identity & Assign IAM Roles

```bash
# Create Dedicated Service Account
gcloud iam service-accounts create ${SA_NAME} \
  --display-name="Secure File Vault Backend Service Account" \
  --project=${PROJECT_ID}
```
*Why used*: Creates a non-human GCP Managed Identity (`file-vault-backend-sa`) to eliminate hardcoded service keys or credentials.

```bash
# Assign Cloud SQL Client Role
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client"
```
*Why used*: Grants the service account permission to connect securely to Cloud SQL database instances.

```bash
# Assign Cloud SQL Instance User Role
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.instanceUser"
```
*Why used*: Grants permission to perform IAM database authentication without storing plaintext passwords in code.

```bash
# Assign Service Account Token Creator Role (For Resumable Signed Uploads)
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountTokenCreator"
```
*Why used*: Allows the Cloud Run application to generate OAuth2 access tokens and signed URLs on the fly for GCS resumable file uploads.

```bash
# Assign GCS Object Admin Permission on Storage Bucket
gcloud storage buckets add-iam-policy-binding gs://${BUCKET_NAME} \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin"
```
*Why used*: Grants the backend service account permission to create, read, and delete storage objects inside `gs://${BUCKET_NAME}`.

---

## 8. Package React SPA & Build Backend Container Image

```bash
# Build Production React SPA Assets
cd frontend
npm install
npm run build
cd ..
```
*Why used*: Compiles the React Single Page Application into optimized static HTML, CSS, and JS assets inside `frontend/dist/`.

```bash
# Package Frontend Dist into Backend Public Assets Folder
rm -rf backend/public
mkdir -p backend/public
cp -r frontend/dist/* backend/public/
```
*Why used*: Bundles the compiled React frontend into the Express backend's public directory so a single Cloud Run container serves both the web UI and REST API.

```bash
# Submit Build to Google Cloud Build
gcloud builds submit --tag gcr.io/${PROJECT_ID}/secure-file-vault-backend:latest ./backend
```
*Why used*: Packages the Node.js application into a production Docker container image and pushes it to Google Container Registry (`gcr.io`).

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
  --set-env-vars GCP_PROJECT_ID=${PROJECT_ID},GCS_BUCKET_NAME=${BUCKET_NAME},DB_HOST=${DB_HOST},CLOUD_SQL_CONNECTION_NAME=${PROJECT_ID}:${REGION}:${DB_INSTANCE_NAME},DB_NAME=file_vault_db,DB_USER=postgres,DB_PASSWORD=SecurePassword123! \
  --allow-unauthenticated \
  --project ${PROJECT_ID}
```
*Why used*: Deploys the application to Cloud Run attached to `--network file-vault-vpc` and `--subnet file-vault-private-subnet` with `--vpc-egress all-traffic`, routing all internal database traffic directly over Private IP (`10.0.1.x`) inside the private subnet.

---

## 10. Verification & Service Status

```bash
# Retrieve Live Application Endpoint URL
gcloud run services describe secure-file-vault-backend \
  --region=${REGION} \
  --format="value(status.url)" \
  --project=${PROJECT_ID}
```
*Why used*: Queries GCP Cloud Run to output the live HTTPS application endpoint URL.

```bash
# View Real-time Application Logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=secure-file-vault-backend" \
  --limit=30 \
  --project=${PROJECT_ID}
```
*Why used*: Inspects runtime logs for health verification and audit tracking.
