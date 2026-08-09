#!/usr/bin/env bash
# ==============================================================================
# Project 6: GKE Autopilot Platform Deployment (Free Trial Compatible)
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP GKE Autopilot Microservices Platform Deployment${NC}"
echo -e "${BLUE}=====================================================${NC}"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}[ERROR] No active project set in gcloud config.${NC}"
    exit 1
fi
echo -e "${GREEN}[INFO] Active Project: ${PROJECT_ID}${NC}"

REGION="us-central1"
REPO_NAME="gcr-apps-repo"
IMAGE_TAG="us-central1-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/node-api:v1.0"
CLUSTER_NAME="gke-prod-autopilot"

# 1. Enable Artifact Registry & GKE APIs
echo -e "${BLUE}[INFO] Enabling Artifact Registry, Compute Engine, and GKE APIs...${NC}"
gcloud services enable artifactregistry.googleapis.com container.googleapis.com compute.googleapis.com --quiet

# 2. Create Artifact Registry Docker Repository
echo -e "${BLUE}[INFO] Creating Artifact Registry Repository: ${REPO_NAME}...${NC}"
if ! gcloud artifacts repositories describe "${REPO_NAME}" --location="${REGION}" >/dev/null 2>&1; then
    gcloud artifacts repositories create "${REPO_NAME}" \
      --repository-format=docker \
      --location="${REGION}" \
      --description="Docker repository for production microservices" --quiet
    echo -e "${GREEN}[SUCCESS] Artifact Registry repository created.${NC}"
else
    echo -e "${YELLOW}[INFO] Artifact Registry repository ${REPO_NAME} already exists.${NC}"
fi

# 3. Configure Docker Authentication & Build Image via Cloud Build
echo -e "${BLUE}[INFO] Building Docker container image via Cloud Build...${NC}"
gcloud builds submit app/ --tag="${IMAGE_TAG}" --quiet
echo -e "${GREEN}[SUCCESS] Image pushed: ${IMAGE_TAG}${NC}"

# 4. Provision GKE Autopilot Cluster
echo -e "${BLUE}[INFO] Provisioning GKE Autopilot Cluster: ${CLUSTER_NAME} in ${REGION}...${NC}"
if ! gcloud container clusters describe "${CLUSTER_NAME}" --region="${REGION}" >/dev/null 2>&1; then
    gcloud container clusters create-auto "${CLUSTER_NAME}" \
      --region="${REGION}" --quiet
    echo -e "${GREEN}[SUCCESS] GKE Autopilot cluster created.${NC}"
else
    echo -e "${YELLOW}[INFO] GKE Autopilot cluster ${CLUSTER_NAME} already exists.${NC}"
fi

# 5. Fetch Cluster Credentials
echo -e "${BLUE}[INFO] Fetching cluster credentials for kubectl...${NC}"
gcloud container clusters get-credentials "${CLUSTER_NAME}" --region="${REGION}"

# 6. Prepare and Apply Kubernetes Manifests
echo -e "${BLUE}[INFO] Applying Kubernetes Manifests (k8s/deployment.yaml)...${NC}"
sed "s|IMAGE_PLACEHOLDER|${IMAGE_TAG}|g" k8s/deployment.yaml | kubectl apply -f -

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 6 GKE Autopilot Platform Deployment Complete!${NC}"
echo -e "${GREEN}=====================================================${NC}"
