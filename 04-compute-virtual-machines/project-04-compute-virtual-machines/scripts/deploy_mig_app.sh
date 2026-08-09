#!/usr/bin/env bash
# ==============================================================================
# Project 4: Managed Instance Group (MIG) Deployment (Free Trial Compatible)
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP Managed Instance Group (MIG) Deployment${NC}"
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

ZONE="us-central1-a"
REGION="us-central1"

# 1. Enable Compute API
echo -e "${BLUE}[INFO] Enabling Compute Engine API...${NC}"
gcloud services enable compute.googleapis.com --quiet

# 2. Create Snapshot Schedule
POLICY_NAME="snap-policy-daily"
echo -e "${BLUE}[INFO] Creating Snapshot Schedule: ${POLICY_NAME}...${NC}"
if ! gcloud compute resource-policies describe "${POLICY_NAME}" --region="${REGION}" >/dev/null 2>&1; then
    gcloud compute resource-policies create snapshot-schedule "${POLICY_NAME}" \
      --region="${REGION}" \
      --start-time="03:00" \
      --daily-schedule \
      --max-retention-days=7 \
      --on-source-disk-delete=keep-auto-snapshots --quiet
    echo -e "${GREEN}[SUCCESS] Snapshot policy created.${NC}"
fi

# 3. Create HTTP Health Check for Auto-Healing
HEALTH_CHECK="hc-web-autoheal"
echo -e "${BLUE}[INFO] Creating Auto-Healing Health Check: ${HEALTH_CHECK}...${NC}"
if ! gcloud compute health-checks describe "${HEALTH_CHECK}" >/dev/null 2>&1; then
    gcloud compute health-checks create http "${HEALTH_CHECK}" \
      --port=80 \
      --request-path="/" \
      --check-interval=10s \
      --timeout=5s \
      --unhealthy-threshold=3 \
      --healthy-threshold=2 --quiet
    echo -e "${GREEN}[SUCCESS] Health check active on port 80.${NC}"
fi

# 4. Create Instance Template
TEMPLATE_NAME="it-web-app-v1"
echo -e "${BLUE}[INFO] Creating Instance Template: ${TEMPLATE_NAME} (e2-micro Always Free)...${NC}"
if ! gcloud compute instance-templates describe "${TEMPLATE_NAME}" >/dev/null 2>&1; then
    gcloud compute instance-templates create "${TEMPLATE_NAME}" \
      --machine-type=e2-micro \
      --network=default \
      --tags=http-server,https-server \
      --metadata-from-file=startup-script=scripts/startup_script.sh \
      --create-disk=auto-delete=yes,boot=yes,image-family=debian-11,image-project=debian-cloud,mode=rw,size=10,type=pd-standard --quiet
    echo -e "${GREEN}[SUCCESS] Instance template created.${NC}"
fi

# 5. Create Firewall Rule for HTTP Traffic
if ! gcloud compute firewall-rules describe allow-http-web >/dev/null 2>&1; then
    gcloud compute firewall-rules create allow-http-web \
      --allow=tcp:80 \
      --target-tags=http-server \
      --source-ranges=0.0.0.0/0 --quiet
fi

# 6. Create Managed Instance Group (MIG)
MIG_NAME="mig-web-fleet"
echo -e "${BLUE}[INFO] Deploying Managed Instance Group: ${MIG_NAME}...${NC}"
if ! gcloud compute instance-groups managed describe "${MIG_NAME}" --zone="${ZONE}" >/dev/null 2>&1; then
    gcloud compute instance-groups managed create "${MIG_NAME}" \
      --zone="${ZONE}" \
      --template="${TEMPLATE_NAME}" \
      --size=1 \
      --health-check="${HEALTH_CHECK}" \
      --initial-delay=180s --quiet
    echo -e "${GREEN}[SUCCESS] MIG deployed in ${ZONE}.${NC}"
fi

# 7. Configure CPU Autoscaling Policy
echo -e "${BLUE}[INFO] Setting CPU Autoscaling Policy (Min: 1, Max: 3, Target CPU: 60%)...${NC}"
gcloud compute instance-groups managed set-autoscaling "${MIG_NAME}" \
  --zone="${ZONE}" \
  --min-num-replicas=1 \
  --max-num-replicas=3 \
  --target-cpu-utilization=0.60 \
  --cool-down-period=90 --quiet

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 4 MIG Deployment Completed Successfully!${NC}"
echo -e "${GREEN}=====================================================${NC}"
