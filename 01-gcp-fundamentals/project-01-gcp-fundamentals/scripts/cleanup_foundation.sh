#!/usr/bin/env bash
# ==============================================================================
# Project 1: Foundation Cleanup Script
# ==============================================================================
set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}GCP Fundamentals Foundation Cleanup${NC}"
echo -e "${BLUE}=====================================================${NC}"

CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || true)

if [ -z "$CURRENT_PROJECT" ]; then
    echo -e "${YELLOW}[WARNING] No active project set in gcloud config.${NC}"
    exit 0
fi

if [[ "$CURRENT_PROJECT" =~ ^proj-fund-[0-9]{4}$ ]]; then
    echo -e "${YELLOW}[WARNING] Deleting project: ${CURRENT_PROJECT}...${NC}"
    gcloud projects delete "${CURRENT_PROJECT}" --quiet
    echo -e "${GREEN}[SUCCESS] Project ${CURRENT_PROJECT} scheduled for deletion.${NC}"
    gcloud config unset project --quiet
else
    echo -e "${RED}[SKIP] Current project '${CURRENT_PROJECT}' does not match Project 1 naming pattern (proj-fund-XXXX). Skipping auto-deletion for safety.${NC}"
fi

echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}Cleanup Completed Successfully!${NC}"
echo -e "${GREEN}=====================================================${NC}"
