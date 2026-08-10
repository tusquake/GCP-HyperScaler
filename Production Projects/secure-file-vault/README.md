# Secure Enterprise File Vault (GCP IAM & Private Subnet Architecture)

A production-ready, scalable, low-latency enterprise file management system built with **React**, **Node.js**, **Google Cloud Platform (GCP)**, and **`gcloud` CLI scripts**.

Designed specifically to comply with enterprise cloud security benchmarks: **zero static credentials/connection strings**, **VPC private subnet isolation**, **IAM Service Account Managed Identities**, and **direct client-to-bucket 1.5GB+ resumable uploads**.

---

## 🏛 Architecture & Security Design

```
+-----------------------------------------------------------------------------------+
|                              PUBLIC ACCESS LAYER                                  |
|  React SPA (Vite)  ---> Request Upload URL ---> Node.js API (Cloud Run)           |
|         |                                              |                          |
|         +------------ Stream 1.5GB+ File -------------> + (GCS Bucket)            |
+--------------------------------------------------------|--------------------------+
                                                         | VPC Connector Egress
+--------------------------------------------------------v--------------------------+
|                             CUSTOM VPC: file-vault-vpc                            |
|                                                                                   |
|  Subnet: Serverless VPC Connector (10.0.2.0/28)                                  |
|         |                                                                         |
|         +---> Private Service Access Peering (10.0.1.0/24)                        |
|                     |                                                             |
|                     v                                                             |
|          Cloud SQL PostgreSQL (PRIVATE IP ONLY - Public IPv4 Disabled)           |
+-----------------------------------------------------------------------------------+
```

---

## 🔒 Key Security Highlights

1. **Managed Identity & Zero Static Credentials**:
   - The Node.js backend uses **Application Default Credentials (ADC)** and GCP IAM Service Account (`file-vault-backend-sa@PROJECT.iam.gserviceaccount.com`).
   - Cloud SQL uses **IAM Database Authentication** (`roles/cloudsql.instanceUser`).
2. **VPC Subnet Network Isolation**:
   - **Cloud SQL Private IP Only**: Public IPv4 disabled (`--no-assign-ip`).
   - **Private Subnet (`10.0.1.0/24`)**: Database resides in a private CIDR block peered via GCP Private Service Access.
   - **Serverless VPC Access Connector (`10.0.2.0/28`)**: Cloud Run routes internal traffic into the VPC.
3. **1.5GB+ Direct Uploads**:
   - Large files stream directly to GCS via **Resumable Signed URLs**, bypassing Node.js server RAM/bandwidth limits.

---

## 💻 `gcloud` CLI Commands Guide

### 1. Enable Required GCP APIs
```bash
gcloud services enable \
  compute.googleapis.com \
  servicenetworking.googleapis.com \
  vpcaccess.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  run.googleapis.com \
  iam.googleapis.com
```

### 2. Create VPC & Private Subnet
```bash
# Create Custom VPC Network
gcloud compute networks create file-vault-vpc --subnet-mode=custom

# Create Private Subnet (10.0.1.0/24)
gcloud compute networks subnets create file-vault-private-subnet \
  --network=file-vault-vpc \
  --range=10.0.1.0/24 \
  --region=us-central1 \
  --enable-private-ip-google-access
```

### 3. Create Serverless VPC Access Connector
```bash
gcloud compute networks vpc-access connectors create vault-serverless-vpc \
  --network=file-vault-vpc \
  --region=us-central1 \
  --range=10.0.2.0/28
```

### 4. Create Cloud SQL Instance (Private IP Only)
```bash
gcloud sql instances create file-vault-db-instance \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --network=file-vault-vpc \
  --no-assign-ip \
  --enable-database-flag cloudsql.iam_authentication=on
```

### 5. Create Cloud Storage Bucket
```bash
gcloud storage buckets create gs://YOUR_PROJECT_ID-secure-file-vault-bucket \
  --location=us-central1 \
  --public-access-prevention \
  --uniform-bucket-level-access
```

---

## 🚀 One-Command GCP Deployment

To provision all GCP infrastructure and deploy Cloud Run automatically using `gcloud` CLI:

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## ⚡ Local Development

```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

Open **`http://127.0.0.1:3005`** in your browser.
