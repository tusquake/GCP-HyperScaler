#!/usr/bin/env bash
# ==============================================================================
# Project 9: CI/CD Pipeline Deployment (Free Trial Compatible)
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP CI/CD Pipeline & Supply Chain Deployment${NC}"
echo -e "${BLUE}=====================================================${NC}"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo -e "${YELLOW}[INFO] gcloud project unset. Auto-detecting available projects...${NC}"
    PROJECT_ID=$(gcloud projects list --format="value(projectId)" 2>/dev/null | head -n 1 || true)
    if [ -n "$PROJECT_ID" ]; then
        gcloud config set project "${PROJECT_ID}" --quiet
        echo -e "${GREEN}[SUCCESS] Auto-selected project: ${PROJECT_ID}${NC}"
    fi
fi

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo -e "${RED}[ERROR] No active project set. Run 'gcloud config set project YOUR_PROJECT_ID' first.${NC}"
    exit 1
fi
echo -e "${GREEN}[INFO] Active Project: ${PROJECT_ID}${NC}"

REGION="us-central1"
REPO_NAME="ar-cicd-repo"

# 1. Enable CI/CD & Security APIs
echo -e "${BLUE}[INFO] Enabling Cloud Build, Artifact Registry, Cloud Run, and Container Analysis APIs...${NC}"
gcloud services enable cloudbuild.googleapis.com \
                       artifactregistry.googleapis.com \
                       run.googleapis.com \
                       containeranalysis.googleapis.com \
                       containerscanning.googleapis.com --quiet

# 2. Create Artifact Registry Docker Repository
echo -e "${BLUE}[INFO] Creating Artifact Registry Repository: ${REPO_NAME}...${NC}"
if ! gcloud artifacts repositories describe "${REPO_NAME}" --location="${REGION}" >/dev/null 2>&1; then
    gcloud artifacts repositories create "${REPO_NAME}" \
      --repository-format=docker \
      --location="${REGION}" \
      --description="CI/CD container image repository" --quiet
    echo -e "${GREEN}[SUCCESS] Artifact Registry repository ready.${NC}"
else
    echo -e "${YELLOW}[INFO] Artifact Registry repository ${REPO_NAME} already exists.${NC}"
fi

# 3. Grant IAM Permissions to Cloud Build Service Account
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")
BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

echo -e "${BLUE}[INFO] Granting Cloud Run Admin role to Cloud Build Service Account...${NC}"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/run.admin" --quiet >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/iam.serviceAccountUser" --quiet >/dev/null

# 4. Submit Build Pipeline to Cloud Build
echo -e "${BLUE}[INFO] Submitting Build Pipeline to Cloud Build (cloudbuild.yaml)...${NC}"
gcloud builds submit --config=cloudbuild.yaml --substitutions=SHORT_SHA="v1.0" .

SERVICE_URL=$(gcloud run services describe cicd-app-staging --region="${REGION}" --format="value(status.url)" 2>/dev/null || true)

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 9 CI/CD Pipeline Execution Complete!${NC}"
if [ -n "$SERVICE_URL" ]; then
    echo -e "${GREEN}Staging Endpoint: ${SERVICE_URL}${NC}"
fi
echo -e "${GREEN}=====================================================${NC}"
