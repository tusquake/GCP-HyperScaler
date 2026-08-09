#!/usr/bin/env bash
# ==============================================================================
# Project 3: Multi-Region Secure Hybrid VPC Deployment (Free Trial Compatible)
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP Multi-Region Secure VPC Deployment${NC}"
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

# 1. Enable Compute Engine & Network APIs
echo -e "${BLUE}[INFO] Enabling Compute Engine and Network APIs...${NC}"
gcloud services enable compute.googleapis.com dns.googleapis.com --quiet

# 2. Create Custom Mode VPC
VPC_NAME="vpc-prod-network"
echo -e "${BLUE}[INFO] Creating Custom VPC: ${VPC_NAME}...${NC}"
if gcloud compute networks describe "${VPC_NAME}" >/dev/null 2>&1; then
    echo -e "${YELLOW}[INFO] VPC ${VPC_NAME} already exists.${NC}"
else
    gcloud compute networks create "${VPC_NAME}" \
      --subnet-mode=custom \
      --bgp-routing-mode=global --quiet
    echo -e "${GREEN}[SUCCESS] Custom VPC created.${NC}"
fi

# 3. Create Dual-Region Subnets
echo -e "${BLUE}[INFO] Creating Subnets: sb-us-central1 (10.1.0.0/24), sb-us-east4 (10.2.0.0/24)...${NC}"
if ! gcloud compute networks subnets describe sb-us-central1 --region=us-central1 >/dev/null 2>&1; then
    gcloud compute networks subnets create sb-us-central1 \
      --network="${VPC_NAME}" \
      --region=us-central1 \
      --range=10.1.0.0/24 \
      --enable-private-ip-google-access --quiet
fi

if ! gcloud compute networks subnets describe sb-us-east4 --region=us-east4 >/dev/null 2>&1; then
    gcloud compute networks subnets create sb-us-east4 \
      --network="${VPC_NAME}" \
      --region=us-east4 \
      --range=10.2.0.0/24 \
      --enable-private-ip-google-access --quiet
fi
echo -e "${GREEN}[SUCCESS] Dual-region subnets active.${NC}"

# 4. Configure Cloud Router and Cloud NAT
ROUTER_NAME="cr-nat-router-us-central1"
NAT_NAME="nat-gateway-us-central1"

echo -e "${BLUE}[INFO] Configuring Cloud Router & Cloud NAT in us-central1...${NC}"
if ! gcloud compute routers describe "${ROUTER_NAME}" --region=us-central1 >/dev/null 2>&1; then
    gcloud compute routers create "${ROUTER_NAME}" \
      --network="${VPC_NAME}" \
      --region=us-central1 \
      --asn=65001 --quiet
fi

if ! gcloud compute routers nats describe "${NAT_NAME}" --router="${ROUTER_NAME}" --region=us-central1 >/dev/null 2>&1; then
    gcloud compute routers nats create "${NAT_NAME}" \
      --router="${ROUTER_NAME}" \
      --region=us-central1 \
      --auto-allocate-nat-external-ips \
      --nat-all-subnet-ip-ranges --quiet
fi
echo -e "${GREEN}[SUCCESS] Cloud NAT gateway deployed.${NC}"

# 5. Stateful Firewall Rules (Zero-Trust Ingress)
echo -e "${BLUE}[INFO] Establishing Firewall Rules (Zero-Trust Ingress)...${NC}"

# Allow Internal Traffic
if ! gcloud compute firewall-rules describe allow-internal-vpc >/dev/null 2>&1; then
    gcloud compute firewall-rules create allow-internal-vpc \
      --network="${VPC_NAME}" \
      --allow=tcp:0-65535,udp:0-65535,icmp \
      --source-ranges=10.1.0.0/16 --quiet
fi

# Allow IAP SSH Access (35.191.0.0/16 and 130.211.0.0/22)
if ! gcloud compute firewall-rules describe allow-ssh-iap >/dev/null 2>&1; then
    gcloud compute firewall-rules create allow-ssh-iap \
      --network="${VPC_NAME}" \
      --allow=tcp:22 \
      --source-ranges=35.191.0.0/16,130.211.0.0/22 --quiet
fi
echo -e "${GREEN}[SUCCESS] Firewall rules configured.${NC}"

# 6. Deploy Private Test Instance (No Public IP)
VM_NAME="vm-private-test"
echo -e "${BLUE}[INFO] Deploying Private Test Instance: ${VM_NAME}...${NC}"
if ! gcloud compute instances describe "${VM_NAME}" --zone=us-central1-a >/dev/null 2>&1; then
    gcloud compute instances create "${VM_NAME}" \
      --zone=us-central1-a \
      --machine-type=e2-micro \
      --subnet=sb-us-central1 \
      --no-address \
      --tags=private-workload --quiet
    echo -e "${GREEN}[SUCCESS] Private VM ${VM_NAME} deployed without public IP.${NC}"
else
    echo -e "${YELLOW}[INFO] Private VM ${VM_NAME} already exists.${NC}"
fi

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 3 Network Deployment Completed Successfully!${NC}"
echo -e "${GREEN}=====================================================${NC}"
