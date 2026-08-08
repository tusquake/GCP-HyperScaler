# Topic 83: Providers

---

## 1. What Is It?

In Terraform, a **Provider** is a plugin binary responsible for translating HashiCorp Configuration Language (HCL) resource declarations into low-level HTTP REST API calls to interact with a specific cloud platform, SaaS vendor, or infrastructure service.

For Google Cloud Platform, HashiCorp maintains two official providers:
1. **`google` Provider**: The primary, General Availability (GA) provider used for 95%+ of GCP infrastructure management (VPC, Compute Engine, GKE, Cloud SQL, BigQuery).
2. **`google-beta` Provider**: A specialized provider used to provision GCP features, fields, and services currently in public Alpha or Beta preview (e.g., experimental GKE flags, preview Cloud Run capabilities).

Providers encapsulate:
- **Authentication Credentials**: Service Account JSON keys, Application Default Credentials (ADC), or Workload Identity Federation tokens.
- **Project & Region Scoping**: Default project ID, region, and zone settings applied automatically to all resources within the block.
- **Resource Schemas**: Field definitions, validation rules, and state mappings for every GCP resource type.

### Real-World Analogy
Think of a Terraform Provider like an official multi-lingual ambassador and diplomat representing a country:
- **HCL Code (English Instruction Letter)**: You write a letter in English: "Build 3 bridges and 1 school in District 5."
- **`google` Provider (Official GCP Ambassador)**: The ambassador reads your English letter, translates the commands into fluent French (Google Cloud REST API JSON payloads), presents their diplomatic credentials (IAM Authentication Tokens) to the foreign ministry, and coordinates local workers to build the bridges.
- **`google-beta` Provider (Special Operations Attaché)**: A specialized diplomat authorized to test experimental, un-released prototypes (Preview Features) before they become standard international law.

---

## 2. Where Does It Fit?

The `google` and `google-beta` providers translate HCL code into GCP REST API calls, managing authentication and regional scoping.

```mermaid
flowchart TD
    subgraph HCLConfiguration["Terraform HCL Code (`main.tf`)"]
        HCLResourceGA["Resource: `google_compute_instance` (GA)"]
        HCLResourceBeta["Resource: `google_compute_instance` (Beta Feature)"]
    end

    subgraph TerraformProviderPlugins["Terraform Provider Plugin Tier"]
        subgraph GAProvider["`google` Provider (v5.0+)"]
            AuthGA["Authentication (ADC / Service Account / WIF)"]
            ClientGA["GCP GA REST API Client"]
        end

        subgraph BetaProvider["`google-beta` Provider"]
            AuthBeta["Authentication (Shared Credentials)"]
            ClientBeta["GCP Beta / Alpha REST API Client"]
        end
    end

    subgraph GCPRESTAPIs["Google Cloud Platform REST APIs"]
        ComputeAPI["Compute Engine REST API (`compute.googleapis.com`)"]
        GKEAPI["GKE REST API (`container.googleapis.com`)"]
    end

    HCLResourceGA --> GAProvider
    HCLResourceBeta --> BetaProvider
    GAProvider & BetaProvider --> ComputeAPI & GKEAPI
```

---

## 3. Core Concepts

| Provider Concept | HCL Block / Syntax | Description | Best Practice |
|---|---|---|---|
| **Required Providers** | `required_providers { google = ... }` | Declares plugin source and version constraints. | **Mandatory**: Pin provider versions (`version = "~> 5.0"`). |
| **Default Provider** | `provider "google" { project = ... }` | Sets global project, region, and zone defaults. | Declare default `project` and `region` in root. |
| **Provider Alias** | `provider "google" { alias = "europe" }` | Defines multiple instances of a provider (multi-region/project). | Use aliases for multi-project or multi-region setups. |
| **`google-beta` Provider** | `provider "google-beta" {}` | Accesses GCP preview features before GA. | Use `google-beta` strictly for resources needing beta fields. |
| **Impersonation** | `impersonate_service_account` | Impersonates a target Service Account keylessly. | Use service account impersonation for local testing. |

---

## 4. How It Works

Provider initialization, version locking, and API call execution operate deterministically:

```text
Engineer runs `terraform init`
              ↓
Terraform reads `required_providers` block -> Downloads `hashicorp/google` v5.x binary
              ↓
Generates `.terraform.lock.hcl` -> Locks provider binary checksum
              ↓
Engineer runs `terraform apply` -> Provider initializes authentication (ADC / Service Account)
              ↓
Provider converts HCL resource attributes to GCP REST API JSON payloads -> Executes API call!
```

1. **Dependency Lock File (`.terraform.lock.hcl`)**: Automatically records cryptographic checksum hashes of downloaded provider plugins, guaranteeing identical provider binaries across team members.
2. **Provider Aliases**: Allows a single Terraform module to manage resources across different GCP projects or regions simultaneously by passing `provider = google.europe`.

---

## 5. Production Scenario

### Enterprise Dual-Provider (GA + Beta) Multi-Region Terraform Setup

```text
Requirement: Provision production GKE clusters across two regions (`us-central1` and `europe-west1`), using standard GA features for networking and `google-beta` features for experimental GKE Autopilot node auto-provisioning.
    ↓
Architecture: Terraform `google` + `google-beta` Providers + Provider Aliases.
    ↓
HCL Configuration (`providers.tf`):
  ```hcl
  terraform {
    required_version = ">= 1.5.0"
    required_providers {
      google = {
        source  = "hashicorp/google"
        version = "~> 5.0"
      }
      google-beta = {
        source  = "hashicorp/google-beta"
        version = "~> 5.0"
      }
    }
  }

  # Default GA Provider (US Central)
  provider "google" {
    project = var.project_id
    region  = "us-central1"
  }

  # Alias GA Provider (Europe)
  provider "google" {
    alias   = "europe"
    project = var.project_id
    region  = "europe-west1"
  }

  # Default Google-Beta Provider
  provider "google-beta" {
    project = var.project_id
    region  = "us-central1"
  }
  ```
    ↓
Resource Declaration Example:
  ```hcl
  # Uses Europe GA Provider Alias
  resource "google_compute_subnetwork" "eu_subnet" {
    provider      = google.europe
    name          = "sb-prod-europewest1"
    ip_cidr_range = "10.200.0.0/20"
    network       = google_compute_network.vpc.id
  }

  # Uses Google-Beta Provider for preview fields
  resource "google_container_cluster" "preview_gke" {
    provider = google-beta
    name     = "gke-preview-cluster"
    location = "us-central1"
    # ... beta arguments ...
  }
  ```
```

*Why Selected*: Demonstrates combining standard GA providers with `google-beta` for preview fields, while utilizing provider aliases for multi-region resource placement.

---

## 6. Hands-On Lab

### Prerequisites
- Active GCP Project with Compute Engine API enabled.
- Cloud Shell or local machine with `terraform` CLI installed.
- IAM permissions: `roles/viewer` or `roles/editor`.

### CLI Method
Create a multi-alias provider configuration and query data using `terraform`:

```bash
# Set variables
PROJECT_ID="your-gcp-project-id"

# 1. Create working directory
mkdir provider-demo && cd provider-demo

# 2. Create providers.tf
cat <<EOF > providers.tf
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = "$PROJECT_ID"
  region  = "us-central1"
}

provider "google" {
  alias   = "us_east"
  project = "$PROJECT_ID"
  region  = "us-east1"
}

data "google_compute_zones" "us_central_zones" {}

data "google_compute_zones" "us_east_zones" {
  provider = google.us_east
}

output "central_zones" {
  value = data.google_compute_zones.us_central_zones.names
}

output "east_zones" {
  value = data.google_compute_zones.us_east_zones.names
}
EOF

# 3. Initialize and apply
terraform init
terraform apply -auto-approve
```

### Verification
*Expected Result*: Output displays lists of available zones in `us-central1` and `us-east1` fetched using distinct provider configurations.

### Cleanup
Remove demo directory:

```bash
cd .. && rm -rf provider-demo
```

---

## 7. Security

### Provider Authentication & Hardening Rules
- **Never Hardcode Static Credentials**: NEVER hardcode Service Account private keys (`credentials = file("key.json")`) inside provider blocks.
- **Use Application Default Credentials (ADC)**: For local development, authenticate using `gcloud auth application-default login`.
- **Use Workload Identity in CI/CD**: Authenticate Terraform in Cloud Build or GitHub Actions keylessly using **Workload Identity Federation**.
- **Service Account Impersonation**: Configure `impersonate_service_account` in provider blocks to enforce short-lived credentials for team members.

```text
BAD PRACTICE:
Hardcoding `credentials = "key.json"` or raw JSON key strings inside `provider "google"` blocks in HCL files.
Risk: Committing HCL code to Git leaks private key credentials to unauthorized users.

PRODUCTION PRACTICE:
Use **Application Default Credentials (ADC)** or **Workload Identity Federation**. Leave `credentials` omitted in provider blocks.
```

---

## 8. Scaling & High Availability

Lock File Version Governance:

```text
Developer 1 runs `terraform init` (Locks `google` provider v5.10.0 in `.terraform.lock.hcl`)
   ↓ (Git Commit `.terraform.lock.hcl`)
Developer 2 runs `terraform init` (Enforces EXACT same v5.10.0 provider binary -> 100% Consistent Execution)
```

- **Dependency Lock File (`.terraform.lock.hcl`)**: Always commit `.terraform.lock.hcl` to Git to guarantee that all team members and CI/CD pipelines execute identical provider plugin binaries.

---

## 9. Cost

### Provider Economics
- **Google Cloud Providers**: 100% **FREE** open-source plugins maintained by HashiCorp and Google.
- **API Call Volume**: Executing Terraform provider calls to GCP APIs incurs $0 extra charge.

---

## 10. Monitoring & Troubleshooting

### Diagnostic Tools
- **`TF_LOG=TRACE`**: Set environment variable `TF_LOG=TRACE` to log raw HTTP request headers, responses, and API payloads sent by the Google provider.
- **`.terraform.lock.hcl`**: Inspect lock file to verify active provider version constraints.

### Troubleshooting Matrix

| Symptom | Possible Cause | What to Check | Fix |
|---|---|---|---|
| `Error: Unsupported argument` | Resource field exists in `google-beta` but using `google` provider | HCL resource definition | Change resource provider to `provider = google-beta`. |
| `terraform init` fails: `Incompatible provider version` | Version constraint in `required_providers` conflicts with lock file | `providers.tf` vs `.terraform.lock.hcl` | Update `version` constraint or run `terraform init -upgrade`. |
| `Error 403: Couldn't determine project` | Provider block missing default `project` ID | `provider "google"` block | Add `project = var.project_id` to the provider configuration. |

---

## 11. Common Mistakes

```text
Mistake: Attempting to use a Beta GCP feature (like experimental GKE flags) with the standard `google` provider.
Why: Assuming all GCP features are available in the main provider immediately.
Impact: `terraform plan` fails with `Unsupported argument` errors.
Correct approach: Add `provider = google-beta` to the resource block and configure `required_providers` for `google-beta`.

Mistake: Omitting provider version constraints in `required_providers` blocks.
Why: Assuming latest provider version is always desirable.
Impact: Upgrading to a new major provider version (e.g., v4.x to v5.x) introduces breaking schema changes that crash CI/CD builds.
Correct approach: Pin provider versions using pessimistic operator constraints (`version = "~> 5.0"`).
```

---

## 12. Production Best Practices

- [ ] Declare `required_providers` with explicit pessimistic version constraints (`version = "~> 5.0"`).
- [ ] Commit **`.terraform.lock.hcl`** to Git to guarantee consistent team executions.
- [ ] Configure default **`project`** and **`region`** properties in root provider blocks.
- [ ] Omit `credentials` argument; rely on **ADC** or **Workload Identity Federation**.
- [ ] Use **`google-beta`** strictly for resources requiring beta fields.
- [ ] Use **Provider Aliases** (`alias = "..."`) for multi-project or multi-region HCL deployments.

---

## 13. Hyperscaler / Enterprise Perspective

```text
Personal / Learning
  No Provider Constraints → Static `key.json` Credentials → Single Provider → Un-locked Versions
        ↓
Small Production
  `required_providers` Pinned (~> 5.0) → Application Default Credentials → `.terraform.lock.hcl` Committed
        ↓
Enterprise Environment
  `google` + `google-beta` Providers → Workload Identity Federation → Provider Aliases for Multi-Region
        ↓
Hyperscaler Environment
  100% Keyless Service Account Impersonation → Centralized Provider Governance → OPA Policy Compliance Verification
```

In a hyperscaler environment, provider configurations enforce strict **Keyless Governance**. Enterprise security rules forbid static JSON keys. Provider blocks use **Workload Identity Federation** in CI/CD and **Service Account Impersonation** (`impersonate_service_account`) for local developer access. Platform teams pin provider versions in central HCL templates, committing `.terraform.lock.hcl` files to Git to guarantee identical API execution across global regions.

---

## 14. Real Project Questions

### Q1: What is the technical difference between the `google` provider and the `google-beta` provider in Terraform?
**Answer:** The **`google` provider** contains General Availability (GA) resources and fields that have met Google's strict stability SLAs. The **`google-beta` provider** contains resources, arguments, and features currently in public Alpha or Beta preview on GCP. Features are introduced first in `google-beta` and promoted to `google` once they achieve GA status.

### Q2: Why is committing the `.terraform.lock.hcl` file to Git considered a mandatory production best practice?
**Answer:** The **`.terraform.lock.hcl`** file contains cryptographic checksum hashes of the exact provider plugin binaries downloaded during `terraform init`. Committing this file to Git guarantees that every team member and CI/CD pipeline executes the exact same provider binary version, preventing unexpected schema changes or provider bugs from breaking production builds.

### Q3: How do Provider Aliases enable multi-region or multi-project infrastructure deployment in a single HCL module?
**Answer:** **Provider Aliases** (defined via `alias = "name"`) allow developers to instantiate multiple configurations of the `google` provider within the same root module. By passing `provider = google.alias_name` to specific resource blocks, a single Terraform execution can provision resources across different GCP regions or projects simultaneously.

---

## 15. Quick Decision Guide

| Requirement | Recommended Approach | Reason |
|---|---|---|
| Provisioning standard GA Compute Engine VMs, GKE clusters, and Cloud SQL databases | **`google` Provider (`hashicorp/google`)** | Standard production provider for General Availability GCP resources. |
| Provisioning a preview Cloud Run feature or experimental GKE flag before GA release | **`google-beta` Provider (`hashicorp/google-beta`)** | Exposes Alpha and Beta GCP features and arguments in HCL. |
| Deploying resources across two different GCP projects within a single Terraform execution | **Provider Aliases (`provider "google" { alias = "proj2" }`)** | Allows routing specific resource blocks to different GCP projects or regions. |

### When should I use it?
- Essential Terraform component for configuring GCP API authentication, region scoping, and resource schema definitions.

### When should I NOT use it?
- Do not use `google-beta` for standard GA resources when `google` provider contains the identical stable fields.

---

## 16. Related Services

```text
                    [83. Providers]
                   /       |       \
        Terraform CLI  Cloud Storage  Workload Identity
        (Plugin Engine)(Lock Files)   (Keyless Auth)
             |             |                |
        Downloads &    Stores State     Provides Secure
        Executes Plugins Checksums       API Credentials
```

- **Terraform CLI**: Core engine downloading and executing provider plugins.
- **Cloud Storage**: Stores state files and lock checksums.
- **Workload Identity Federation**: Provides keyless API authentication for providers.

---

## 17. Cheat Sheet

### Core Syntax
- **`required_providers`**: Source and version constraint definition.
- **Pessimistic Constraint**: `version = "~> 5.0"` (Allows 5.x updates, blocks 6.0).
- **Beta Resource**: Set `provider = google-beta` in resource block.
- **Alias**: `provider "google" { alias = "custom" }`.

### Code Example
```hcl
terraform {
  required_providers {
    google      = { source = "hashicorp/google", version = "~> 5.0" }
    google-beta = { source = "hashicorp/google-beta", version = "~> 5.0" }
  }
}

provider "google" {
  project = var.project_id
  region  = "us-central1"
}

provider "google-beta" {
  project = var.project_id
  region  = "us-central1"
}
```

---

## 18. Learning Connection

- **Previous Topic**: [82. Terraform on GCP](../82-terraform-on-gcp/README.md)
- **Next Topic**: [84. Variables](../84-variables/README.md)
