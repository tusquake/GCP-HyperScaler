#!/usr/bin/env bash
# ==============================================================================
# Project 3: Network Cleanup Script
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP Network Architecture Cleanup${NC}"
echo -e "${BLUE}=====================================================${NC}"

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}[WARNING] No active project set.${NC}"
    exit 0
fi

# 1. Delete VM Instances
VM_NAME="vm-private-test"
echo -e "${BLUE}[INFO] Deleting VM Instance: ${VM_NAME}...${NC}"
gcloud compute instances delete "${VM_NAME}" --zone=us-central1-a --quiet 2>/dev/null || true

# 2. Delete Firewall Rules
echo -e "${BLUE}[INFO] Deleting Firewall Rules...${NC}"
gcloud compute firewall-rules delete allow-internal-vpc allow-ssh-iap --quiet 2>/dev/null || true

# 3. Delete Cloud NAT & Router
echo -e "${BLUE}[INFO] Deleting Cloud NAT & Router...${NC}"
gcloud compute routers nats delete nat-gateway-us-central1 --router=cr-nat-router-us-central1 --region=us-central1 --quiet 2>/dev/null || true
gcloud compute routers delete cr-nat-router-us-central1 --region=us-central1 --quiet 2>/dev/null || true

# 4. Delete Subnets & Custom VPC
echo -e "${BLUE}[INFO] Deleting Subnets & Custom VPC...${NC}"
gcloud compute networks subnets delete sb-us-central1 --region=us-central1 --quiet 2>/dev/null || true
gcloud compute networks subnets delete sb-us-east4 --region=us-east4 --quiet 2>/dev/null || true
gcloud compute networks delete vpc-prod-network --quiet 2>/dev/null || true

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Project 3 Network Cleanup Completed Successfully!${NC}"
echo -e "${GREEN}=====================================================${NC}"
