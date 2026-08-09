#!/usr/bin/env bash
# ==============================================================================
# Project 11: Security Perimeter Deployment (Free Trial Compatible)
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP Zero-Trust Security Perimeter Deployment${NC}"
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
SECRET_NAME="sec-db-password"
KEYRING_NAME="kms-ring-prod"
KEY_NAME="key-cmek-data"
POLICY_NAME="ca-policy-waf"

# 1. Enable Security APIs
echo -e "${BLUE}[INFO] Enabling Security APIs (Secret Manager, KMS, SCC, Cloud Armor, IAP, BinAuth)...${NC}"
gcloud services enable secretmanager.googleapis.com \
                       cloudkms.googleapis.com \
                       securitycenter.googleapis.com \
                       compute.googleapis.com \
                       iap.googleapis.com \
                       binaryauthorization.googleapis.com --quiet

# 2. Create Secret in Secret Manager
echo -e "${BLUE}[INFO] Creating Secret in Secret Manager: ${SECRET_NAME}...${NC}"
if ! gcloud secrets describe "${SECRET_NAME}" >/dev/null 2>&1; then
    gcloud secrets create "${SECRET_NAME}" --replication-policy="automatic" --quiet
    echo "P@ssw0rd_SuperSecret_2026!" | gcloud secrets versions add "${SECRET_NAME}" --data-file=- --quiet
    echo -e "${GREEN}[SUCCESS] Secret created with Version 1.${NC}"
else
    echo -e "${YELLOW}[INFO] Secret ${SECRET_NAME} already exists.${NC}"
fi

# 3. Provision Cloud KMS KeyRing and CMEK Key
echo -e "${BLUE}[INFO] Provisioning Cloud KMS KeyRing & CMEK Key...${NC}"
if ! gcloud kms keyrings describe "${KEYRING_NAME}" --location="${REGION}" >/dev/null 2>&1; then
    gcloud kms keyrings create "${KEYRING_NAME}" --location="${REGION}" --quiet
fi

if ! gcloud kms keys describe "${KEY_NAME}" --keyring="${KEYRING_NAME}" --location="${REGION}" >/dev/null 2>&1; then
    gcloud kms keys create "${KEY_NAME}" \
      --keyring="${KEYRING_NAME}" \
      --location="${REGION}" \
      --purpose="encryption" \
      --rotation-period="90d" \
      --next-rotation-time="$(date -u -d '+90 days' +%Y-%m-%dT%H:%M:%SZ)" --quiet
    echo -e "${GREEN}[SUCCESS] CMEK Key active: ${KEY_NAME}.${NC}"
else
    echo -e "${YELLOW}[INFO] CMEK Key ${KEY_NAME} already exists.${NC}"
fi

# 4. Deploy Cloud Armor WAF Security Policy
echo -e "${BLUE}[INFO] Deploying Cloud Armor WAF Security Policy: ${POLICY_NAME}...${NC}"
if ! gcloud compute security-policies describe "${POLICY_NAME}" >/dev/null 2>&1; then
    gcloud compute security-policies create "${POLICY_NAME}" \
      --description="Cloud Armor WAF policy blocking OWASP SQLi and XSS" --quiet

    # Add Rule for SQL Injection
    gcloud compute security-policies rules create 1000 \
      --security-policy="${POLICY_NAME}" \
      --expression="evaluatePreconfiguredExpr('sqli-v33-stable')" \
      --action="deny-403" --quiet

    # Add Rule for XSS
    gcloud compute security-policies rules create 1001 \
      --security-policy="${POLICY_NAME}" \
      --expression="evaluatePreconfiguredExpr('xss-v33-stable')" \
      --action="deny-403" --quiet
    echo -e "${GREEN}[SUCCESS] Cloud Armor WAF active.${NC}"
else
    echo -e "${YELLOW}[INFO] Cloud Armor Policy ${POLICY_NAME} already exists.${NC}"
fi

# 5. Apply Binary Authorization Policy
echo -e "${BLUE}[INFO] Applying Binary Authorization Policy (binauth/policy.yaml)...${NC}"
gcloud container binauth policy import binauth/policy.yaml --quiet
echo -e "${GREEN}[SUCCESS] Binary Authorization enforced.${NC}"

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 11 Security Perimeter Deployment Complete!${NC}"
echo -e "${GREEN}=====================================================${NC}"
