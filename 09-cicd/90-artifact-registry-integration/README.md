# Topic 90: Artifact Registry Integration

---

## 1. What Is It?

**Artifact Registry Integration** refers to the architecture, authentication workflows, and automated release pipeline mechanics connecting CI/CD build tools (Cloud Build, GitHub Actions) with Google Cloud's **Artifact Registry**—the central enterprise repository for storing, managing, and securing container images, Helm charts, and language packages (npm, Maven, Python, Go).

Artifact Registry replaces legacy Container Registry (`gcr.io`), adding four critical enterprise supply chain features:
1. **Multi-Format Storage Support**: Standardized single repository platform for OCI container images, Helm charts, Java packages, Maven, npm, Python wheels, and Apt/Yum packages.
2. **Granular IAM Access Controls**: Repository-level and regional IAM permissions enabling fine-grained reader/writer access separation across development teams.
3. **Artifact Analysis & CVE Scanning**: Automatic vulnerability scanning of container images upon push, integrating with Security Command Center.
4. **Customer-Managed Encryption (CMEK)**: Native encryption at rest using Cloud KMS keys.

### Real-World Analogy
Think of Artifact Registry Integration like a high-security automated distribution warehouse:
- **Build Step (The Factory)**: Cloud Build fabricates new products (Container Images) and places them in standard shipping crates (Docker OCI format).
- **Artifact Registry (Distribution Warehouse)**: Receives the crates, scans them through X-ray security (Vulnerability Scanning), tags them with barcoded serial numbers (Git Commit SHAs), stores them in climate-controlled lockers (CMEK Encryption), and verifies driver credentials (IAM Workload Identity) before releasing products to delivery trucks (GKE or Cloud Run).

---

## 2. Where Does It Fit?

Artifact Registry acts as the authoritative security boundary separating CI build systems from CD deployment environments.

```mermaid
flowchart TD
    subgraph BuildPipeline["CI Build Engine (Cloud Build / GitHub Actions)"]
        BuildStep["Build Docker Image / Package"]
        PushStep["Docker Push / Helm Push"]
    end

    subgraph SecurityScanning["Artifact Analysis Engine"]
        Scanner["Container Vulnerability Scanner"]
        SecDB["CVE Vulnerability Database"]
    end

    subgraph ArtifactRegistryCore["Artifact Registry"]
        DockerRepo["Docker OCI Repository (pkg.dev)"]
        HelmRepo["Helm / OCI Repository"]
        LanguageRepo["Language Package Repo (npm/Maven)"]
      End

    subgraph DeploymentTargets["CD & Runtime Environments"]
        CloudRun["Cloud Run Engine"]
        GKE["GKE Workloads"]
        BinAuth["Binary Authorization Gate"]
    end

    BuildPipeline -- Authenticated Push --> ArtifactRegistryCore
    ArtifactRegistryCore --> SecurityScanning
    SecurityScanning <--> SecDB
    DeploymentTargets -- Pull Image Digest --> DockerRepo
    BinAuth -- Validate CVE Scan & Signature --> DockerRepo
```

---

## 3. Core Concepts

| Feature / Concept | Description | Production Best Practice |
|---|---|---|
| **Repository Format** | Specifies the artifact format (Docker, Helm, Maven, npm, Python). | Create dedicated repositories per format type. |
| **Regional / Multi-Regional** | Geographic placement of the repository bucket (`us-central1` vs `us`). | Match repository region to GKE/Cloud Run runtime regions to eliminate egress bandwidth costs. |
| **Immutable Tags** | Feature preventing image tags from being overwritten once pushed. | Enable immutable tags in production repositories. |
| **Artifact Analysis** | Automatic CVE scanning of OS packages and application language dependencies. | Block Binary Authorization deployments if critical CVEs exist. |
| **Cleanup Policies** | Automated rules deleting aged or untagged container image versions. | Configure cleanup policies to delete untagged images older than 30 days. |

---

## 4. How It Works

Authentication and artifact transfer between CI/CD tools and Artifact Registry follow a secure OAuth2 or short-lived token protocol:

```text
1. CI Pipeline starts -> Authenticates using Workload Identity or SA Token
               ↓
2. Pipeline builds image -> Tags image: `REGION-docker.pkg.dev/PROJECT/REPO/IMAGE:TAG`
               ↓
3. Docker Push executed -> Layers uploaded to Artifact Registry
               ↓
4. Artifact Analysis triggers -> Scans OS packages & language dependencies for CVEs
               ↓
5. Runtime (GKE/Cloud Run) pulls image using Immutable SHA Digest (`image@sha256:...`)
```

1. **Docker Credential Helper**: Local machines and CI runners use `gcloud auth configure-docker` to dynamically generate temporary OAuth tokens for authentication instead of static passwords.
2. **SHA Digest Pulling**: Deploying by exact SHA256 digest guarantees that runtime environments execute the precise binary validated by security scans.

---

## 5. Production Scenario

### Enterprise Container Cleanup Policy & Security Gate

```text
Requirement: Enforce automatic deletion of untagged developer container builds older than 14 days and block deployments of images containing Critical CVEs.
    ↓
Architecture: Artifact Registry Repository + Automated Cleanup Policy + Artifact Analysis + Binary Authorization.
    ↓
Step 1: Provision Artifact Registry repository with cleanup policy:
  - Repository: `us-central1-docker.pkg.dev/prod-proj/app-repo`
  - Cleanup Policy Rule: Delete untagged images with age > 14 days.
    ↓
Step 2: Enable Automated Vulnerability Scanning in Artifact Analysis.
    ↓
Step 3: Configure Cloud Build step to push and verify scan results:
  - `gcloud artifacts docker images scan us-central1-docker.pkg.dev/prod-proj/app-repo/web:v1.0`
    ↓
Result: Storage costs reduced by 60% through automated lifecycle cleanup while maintaining strict zero-CVE deployment gates.
```

*Why Selected*: Demonstrates real-world enterprise cost management (cleanup policies) and security gate integration.

---

## 6. Hands-On Lab

### Prerequisites
- GCP Project with Artifact Registry and Artifact Analysis APIs enabled.
- Cloud Shell or local machine with Docker and `gcloud` CLI installed.

### CLI Method

```bash
# 1. Environment configuration
export PROJECT_ID=$(gcloud config get-value project)
export REGION="us-central1"
export REPO_NAME="ar-integration-lab"

# 2. Enable GCP APIs
gcloud services enable artifactregistry.googleapis.com containerscanning.googleapis.com

# 3. Create Artifact Registry Docker repository
gcloud artifacts repositories create ${REPO_NAME} \
  --repository-format=docker \
  --location=${REGION} \
  --description="Enterprise Docker Repository with Cleanup Policy"

# 4. Configure gcloud as Docker credential helper
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

# 5. Create local test application
mkdir -p ar-lab && cd ar-lab
cat <<EOF > Dockerfile
FROM alpine:3.18
RUN apk add --no-cache curl
CMD ["curl", "https://ipinfo.io"]
EOF

# 6. Build and tag image with Git SHA simulation and semantic tag
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/secure-tool"
docker build -t ${IMAGE_URI}:v1.0.0 -t ${IMAGE_URI}:latest .

# 7. Push images to Artifact Registry
docker push ${IMAGE_URI}:v1.0.0
docker push ${IMAGE_URI}:latest

# 8. Inspect pushed image packages and vulnerability scan status
gcloud artifacts docker images list ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}
```

### Verification
List vulnerability findings scanned by Artifact Analysis:

```bash
gcloud artifacts docker images describe ${IMAGE_URI}:v1.0.0 --show-package-vulnerability
```

### Cleanup

```bash
gcloud artifacts repositories delete ${REPO_NAME} --location=${REGION} --quiet
cd .. && rm -rf ar-lab
```

---

## 7. Security

### Enterprise Supply Chain Protection
- **Repository IAM Separation**: Grant `roles/artifactregistry.writer` to CI Build Service Accounts and restrict production runtime nodes (GKE Service Accounts) to `roles/artifactregistry.reader`.
- **CMEK Encryption**: Protect repository contents using Cloud KMS Customer-Managed Encryption Keys.
- **Continuous Scanning**: Artifact Analysis continuously re-scans stored container images against newly published CVE databases.

```text
BAD PRACTICE:
Granting `roles/artifactregistry.admin` to CI/CD pipelines and storing container images in public repositories without vulnerability scanning.

PRODUCTION PRACTICE:
Enforce strict IAM separation (Writer for CI, Reader for CD), mandate vulnerability scanning gates, and store images in regional private repositories with CMEK encryption.
```

---

## 8. Scaling & High Availability

Artifact Registry geo-replication and caching patterns:

```text
Regional Repository (us-central1) -> Primary Storage & Low-latency GKE Pulls
                       ↓ (Multi-Region Backup & Redundancy)
Multi-Regional Repository (us / eu / asia):
├── Automatic cross-zone redundancy within the continent
├── High-bandwidth egress serving massive multi-cluster GKE deployments
└── Integrated Virtual Repositories (Upstream Caching & Fallback)
```

- **Virtual Repositories**: Consolidate multiple upstream Artifact Registry repositories behind a single endpoint for unified access and caching.

---

## 9. Cost

### Pricing Structure

| Component | Free Tier | Standard Rates |
|---|---|---|
| **Storage Capacity** | 0.5 GB per month free | $0.10 per GB / month |
| **Egress Data Transfer** | Free to GCP services in same region | Standard GCP internet egress rates for external pulls |
| **Vulnerability Scanning** | Standard Scanning FREE | On-demand continuous OS + Language scanning: ~$0.26 / image scan |

---

## 10. Monitoring & Troubleshooting

### Repository Visibility & Logs
- **Cloud Audit Logs**: Audit `google.devtools.artifactregistry.v1.ArtifactRegistry` API calls to trace who pushed or deleted image tags.
- **Vulnerability Alerts**: Integrate Security Command Center to alert on `CRITICAL` vulnerability findings.

### Troubleshooting Matrix

| Symptom | Cause | Resolution |
|---|---|---|
| `docker push` fails with `401 Unauthorized` | Docker client not authenticated with GCP | Run `gcloud auth configure-docker <REGION>-docker.pkg.dev`. |
| `gke deployment manifest image pull error` | GKE node service account lacks read permissions | Grant `roles/artifactregistry.reader` to the GKE worker node service account. |
| High monthly GCS storage bill | Accumulated untagged container layer builds | Configure automated repository Cleanup Policies (`gcloud artifacts repositories set-cleanup-policies`). |

---

## 11. Common Mistakes

```text
Mistake: Continuing to use legacy `gcr.io` URLs for new production container workloads.
Why: Following outdated documentation tutorials.
Impact: Missing out on repository-level IAM, cleanup policies, and multi-format support.
Correct Approach: Transition all workloads to Artifact Registry (`pkg.dev`).

Mistake: Deploying container images using mutable tags like `latest` or `dev`.
Why: Convenience in deployment manifests.
Impact: Kubernetes nodes may cache old layers, resulting in unpredictable code versions across pods in the same cluster.
Correct Approach: Always deploy using explicit immutable tags or full SHA256 digests (`image@sha256:...`).
```

---

## 12. Production Best Practices

- [ ] Use **Artifact Registry** (`pkg.dev`) instead of deprecated Container Registry (`gcr.io`).
- [ ] Configure **Cleanup Policies** to prune untagged images older than 14-30 days.
- [ ] Enable **Automated Vulnerability Scanning** via Artifact Analysis.
- [ ] Colocate Artifact Registry repositories in the same region as compute runtimes to avoid egress charges.
- [ ] Use **Workload Identity** for authenticating external CI/CD pipelines (GitHub Actions, GitLab CI).
- [ ] Enforce **Immutable Image Tags** on production repositories.

---

## 13. Hyperscaler / Enterprise Perspective

```text
Personal / Learning
  Public Repository → Manual Docker Push → No Vulnerability Scanning
        ↓
Small Production
  Private Regional Repo → `gcloud auth` CI Push → Basic OS Package Scanning
        ↓
Enterprise Environment
  Virtual Repositories → CMEK Encryption → Continuous OS + Language CVE Scanning
        ↓
Hyperscaler Environment
  Automated Cleanup Lifecycle Policies → Binary Authorization KMS Signing Gates → SLSA Level 4 Provenance Attestation
```

Enterprise hyperscalers leverage Virtual Repositories to cache open-source language dependencies (npm, PyPI) internally, preventing supply chain disruptions if public package indices experience outages.

---

## 14. Real Project Questions

### Q1: What is the key advantage of Artifact Registry over legacy Container Registry (`gcr.io`)?
**Answer:** Artifact Registry supports fine-grained repository-level IAM permissions, CMEK encryption, native cleanup policies, multi-region redundancy, and multi-format artifact support (Helm, Java, npm, Python, Go) beyond Docker container images.

### Q2: How do you prevent GKE from deploying container images that contain critical security vulnerabilities?
**Answer:** Enable Artifact Analysis continuous scanning on your Artifact Registry repository, configure **Binary Authorization** on the GKE cluster, and establish a security policy that requires valid attestations verifying zero critical CVE findings before allowing pod scheduling.

### Q3: How do Artifact Registry Cleanup Policies reduce cloud spending?
**Answer:** Continuous integration pipelines generate hundreds of untagged intermediate image layers. Cleanup policies automatically match rules (e.g., untagged images older than 14 days) and delete them in the background, eliminating wasted GCS storage costs.

---

## 15. Quick Decision Guide

| Requirement | Recommended Artifact Registry Feature | Advantage |
|---|---|---|
| Universal Repository for Images & Helm Charts | Artifact Registry Docker + OCI Repo | Unified storage and single IAM control model. |
| Automated Storage Cost Control | Cleanup Policies | Deletes stale untagged builds automatically. |
| Private Caching of Third-Party Dependencies | Virtual Repositories | Protects pipelines against upstream public package outages. |

### When to Use Artifact Registry
- Mandatory container, Helm chart, and package storage engine across all GCP workloads.

### When NOT to Use Artifact Registry
- Storing unstructured bulk data or raw database backups (use Cloud Storage instead).

---

## 16. Related Services

```text
             [90. Artifact Registry Integration]
            /               |                 \
     Cloud Build    Artifact Analysis    Binary Authorization
    (Pushes Images)  (Scans CVEs)       (Verifies Signatures)
          |                 |                     |
    Builds & Tags    Provides Security    Enforces Deployment
    Artifacts        Vulnerability Data   Gates on GKE
```

- **Cloud Build**: CI engine pushing build artifacts to Artifact Registry.
- **Artifact Analysis**: Automated vulnerability scanner analyzing stored images.
- **Binary Authorization**: GKE deployment gate enforcing image signature checks.

---

## 17. Cheat Sheet

### Common CLI Commands

```bash
# Authenticate Docker client to Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev

# List repositories in a project
gcloud artifacts repositories list

# Describe vulnerability scan findings for an image
gcloud artifacts docker images describe us-central1-docker.pkg.dev/PROJ/REPO/IMAGE:TAG --show-package-vulnerability

# Set cleanup policy on repository
gcloud artifacts repositories set-cleanup-policies REPO_NAME --location=us-central1 --config=policy.json
```

---

## 18. Learning Connection

- **Previous Topic**: [89. Cloud Build](../89-cloud-build/README.md)
- **Next Topic**: [91. Deploy to Cloud Run](../91-deploy-to-cloud-run/README.md)
