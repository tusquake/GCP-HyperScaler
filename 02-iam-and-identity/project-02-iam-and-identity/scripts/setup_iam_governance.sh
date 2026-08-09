#!/usr/bin/env bash
# ==============================================================================
# Project 2: IAM Governance & Workload Identity Setup (Free Trial Compatible)
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP IAM Governance & Workload Identity Setup${NC}"
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

# 1. Enable IAM & Security APIs
echo -e "${BLUE}[INFO] Enabling IAM, Security, and Workload Identity APIs...${NC}"
gcloud services enable iam.googleapis.com \
                       iamcredentials.googleapis.com \
                       sts.googleapis.com \
                       cloudresourcemanager.googleapis.com --quiet

# 2. Create Custom Role
ROLE_ID="CustomSecurityAuditor"
echo -e "${BLUE}[INFO] Creating Custom Role: ${ROLE_ID}...${NC}"
if gcloud iam roles describe "${ROLE_ID}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    echo -e "${YELLOW}[INFO] Custom Role ${ROLE_ID} already exists. Updating...${NC}"
    gcloud iam roles update "${ROLE_ID}" --project="${PROJECT_ID}" --file="iam/custom_roles.yaml" --quiet
else
    gcloud iam roles create "${ROLE_ID}" --project="${PROJECT_ID}" --file="iam/custom_roles.yaml" --quiet
    echo -e "${GREEN}[SUCCESS] Custom role created: ${ROLE_ID}${NC}"
fi

# 3. Create Service Accounts
SA_RUNNER="sa-app-runner"
SA_DEPLOYER="sa-deployer"

for SA in "$SA_RUNNER" "$SA_DEPLOYER"; do
    SA_EMAIL="${SA}@${PROJECT_ID}.iam.gserviceaccount.com"
    if gcloud iam service-accounts describe "${SA_EMAIL}" >/dev/null 2>&1; then
        echo -e "${YELLOW}[INFO] Service Account ${SA_EMAIL} already exists.${NC}"
    else
        echo -e "${BLUE}[INFO] Creating Service Account: ${SA}...${NC}"
        gcloud iam service-accounts create "${SA}" \
          --display-name="Dedicated ${SA} Service Identity" --quiet
        echo -e "${GREEN}[SUCCESS] Service Account created: ${SA}${NC}"
    fi
done

# 4. Bind Roles to Service Accounts
echo -e "${BLUE}[INFO] Binding IAM roles to Service Accounts...${NC}"
DEPLOYER_EMAIL="${SA_DEPLOYER}@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${DEPLOYER_EMAIL}" \
  --role="projects/${PROJECT_ID}/roles/${ROLE_ID}" --quiet >/dev/null

RUNNER_EMAIL="${SA_RUNNER}@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNNER_EMAIL}" \
  --role="roles/logging.logWriter" --quiet >/dev/null

# Grant Service Account Token Creator to active user for testing impersonation
ACTIVE_USER=$(gcloud config get-value account 2>/dev/null || true)
if [ -n "$ACTIVE_USER" ]; then
    echo -e "${BLUE}[INFO] Granting Service Account Token Creator role on ${SA_DEPLOYER} to ${ACTIVE_USER}...${NC}"
    gcloud iam service-accounts add-iam-policy-binding "${DEPLOYER_EMAIL}" \
      --member="user:${ACTIVE_USER}" \
      --role="roles/iam.serviceAccountTokenCreator" --quiet >/dev/null
fi

# 5. Create Workload Identity Pool and Provider (Keyless Authentication)
POOL_NAME="github-actions-pool"
PROVIDER_NAME="github-actions-provider"

echo -e "${BLUE}[INFO] Creating Workload Identity Pool: ${POOL_NAME}...${NC}"
if gcloud iam workload-identity-pools describe "${POOL_NAME}" --location="global" >/dev/null 2>&1; then
    echo -e "${YELLOW}[INFO] Workload Identity Pool ${POOL_NAME} already exists.${NC}"
else
    gcloud iam workload-identity-pools create "${POOL_NAME}" \
      --location="global" \
      --display-name="GitHub Actions OIDC Pool" --quiet
    echo -e "${GREEN}[SUCCESS] Workload Identity Pool created.${NC}"
fi

echo -e "${BLUE}[INFO] Creating Workload Identity Provider: ${PROVIDER_NAME}...${NC}"
if gcloud iam workload-identity-pools providers describe "${PROVIDER_NAME}" --workload-identity-pool="${POOL_NAME}" --location="global" >/dev/null 2>&1; then
    echo -e "${YELLOW}[INFO] Workload Identity Provider ${PROVIDER_NAME} already exists.${NC}"
else
    GITHUB_ORG="${1:-tusquake}"
    gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_NAME}" \
      --workload-identity-pool="${POOL_NAME}" \
      --location="global" \
      --issuer-uri="https://token.actions.githubusercontent.com" \
      --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
      --attribute-condition="assertion.repository_owner == '${GITHUB_ORG}'" \
      --display-name="GitHub Actions Provider" --quiet
    echo -e "${GREEN}[SUCCESS] Workload Identity Provider created.${NC}"
fi

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 2 IAM Governance & Keyless Setup Complete!${NC}"
echo -e "${GREEN}=====================================================${NC}"
