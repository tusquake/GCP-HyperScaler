# Topic 82: Terraform on GCP

---

## 1. What Is It?

**Terraform on GCP** is the industry-standard Infrastructure as Code (IaC) framework and declarative provisioning tool that allows cloud engineers to define, create, update, version, and manage Google Cloud Platform infrastructure resources using human-readable HashiCorp Configuration Language (HCL).

By utilizing the official **Google Cloud Provider (`google` and `google-beta`)**, Terraform translates declarative HCL code into GCP Resource Manager API calls, providing reproducible, audit-tracked infrastructure management across VPC networks, Compute Engine VMs, GKE clusters, Cloud SQL databases, and IAM policy bindings.

Key architectural capabilities of Terraform on GCP include:
1. **Declarative State Tracking**: Maintains a real-world snapshot of GCP infrastructure in a `terraform.tfstate` file, calculating execution plans (`terraform plan`) to reach desired states without step scripting.
2. **Resource Dependency Mapping**: Automatically calculates implicit resource dependencies (e.g., creating a VPC Subnet before provisioning a GKE cluster on it) using a Directed Acyclic Graph (DAG).
3. **Google Cloud Foundation Fabric**: Access to Google's official modular HCL code repository for deploying enterprise cloud landing zones following GCP Architecture Framework best practices.
4. **Idempotent Execution**: Re-running `terraform apply` on unmodified HCL code results in zero changes to active GCP resources.

### Real-World Analogy
Think of Terraform on GCP like an architectural blueprint and robotic construction system for a smart office building:
- **Manual Console Provisioning (Hand-crafting Walls)**: An electrician wiring outlets from memory, a plumber installing pipes without drawings, and a carpenter hanging doors. If you need an identical building in another city, you have to remember every single step and hand-craft it all over again from scratch.
- **Terraform (CAD Blueprint & Automated Robotics)**: You write a single digital CAD blueprint (`main.tf`) specifying 10 office rooms, exact electrical outlets, and plumbing routes. You run `terraform plan` to verify safety, then hit `terraform apply`. Construction robots read the blueprint, query GCP APIs, and build the entire office in 5 minutes. If you need an identical office in Europe, you copy the HCL file, update `region = "europe-west1"`, and run apply again.

---

## 2. Where Does It Fit?

Terraform sits as the foundational Infrastructure as Code layer, declaring GCP projects, networks, IAM roles, compute runtimes, and databases.

```mermaid
flowchart TD
    subgraph HCLCodeRepository["Infrastructure Code (Git Repository)"]
        HCLFiles["HCL Files (`main.tf`, `variables.tf`, `outputs.tf`)"]
        RemoteBackend["Cloud Storage State Bucket (`backend 'gcs'`)"]
    end

    subgraph TerraformEngine["HashiCorp Terraform Engine"]
        TFPlan["`terraform plan` (Execution Diff Calculation)"]
        TFApply["`terraform apply` (GCP REST API Execution)"]
        GCPProvider["Google Cloud Provider (`google` / `google-beta`)"]
    end

    subgraph GCPInfrastructureLayer["Google Cloud Platform Infrastructure"]
        VPCNetwork["VPC Networks & Subnets"]
        GKECluster["GKE Clusters & Node Pools"]
        CloudSQLDB["Cloud SQL Databases"]
        IAMBindings["IAM Roles & Organization Policies"]
    end

    HCLFiles <== State Locking ==> RemoteBackend
    HCLFiles --> TFPlan --> TFApply --> GCPProvider
    GCPProvider -- GCP REST API Calls --> VPCNetwork & GKECluster & CloudSQLDB & IAMBindings
```

---

## 3. Core Concepts

| Terraform Element | Syntax / Parameter | Description | Best Practice |
|---|---|---|---|
| **Google Provider** | `provider "google" {}` | Configures GCP API authentication, project, and region. | Set default `project`, `region`, and `zone` settings. |
| **Resource Block** | `resource "google_compute_instance" "vm"` | Declares a specific GCP infrastructure component. | Use semantic resource identifiers (`vm_app_prod`). |
| **Data Source** | `data "google_compute_network" "vpc"` | Queries existing GCP resources without managing them. | Use Data Sources to reference shared VPC networks. |
| **Execution Plan** | `terraform plan` | Shows proposed additions (`+`), changes (`~`), or deletions (`-`). | Review plan outputs carefully in CI/CD before applying. |
| **State File** | `terraform.tfstate` | Maps HCL declarations to real-world GCP resource IDs. | **Mandatory**: Store state in a GCS Remote Backend. |

---

## 4. How It Works

State locking, plan calculation, and GCP API execution operate deterministically:

```text
Engineer runs `terraform apply` -> Requests state lock on Cloud Storage Remote Backend
              ↓
GCS Backend creates `.tflock` object -> Prevents concurrent developer executions
              ↓
Terraform refreshes state -> Compares `main.tf` HCL code against real-world GCP API state
              ↓
Calculates diff -> Outputs execution plan: `Plan: 2 to add, 1 to change, 0 to destroy.`
              ↓
User approves -> Executes GCP REST API calls -> Updates `terraform.tfstate` -> Releases lock!
```

1. **Implicit Dependency Graph**: Terraform automatically analyzes resource references (e.g., `network = google_compute_network.vpc.id`) to determine resource creation order.
2. **Explicit Dependencies (`depends_on`)**: Use `depends_on = [google_project_service.api]` when API enablement must complete before creating resources.

---

## 5. Production Scenario

### Enterprise Multi-Region GKE & VPC Infrastructure Pipeline

```text
Requirement: Provision a production VPC network with custom subnets, a Regional Private GKE cluster, and a Cloud SQL PostgreSQL instance using Terraform HCL, storing state securely in Cloud Storage with zero manual Console steps.
    ↓
Architecture: Terraform HCL + GCS Remote Backend + Google Provider.
    ↓
HCL Configuration (`main.tf`):
  ```hcl
  terraform {
    required_version = ">= 1.5.0"
    required_providers {
      google = {
        source  = "hashicorp/google"
        version = "~> 5.0"
      }
    }
    backend "gcs" {
      bucket = "prod-tf-state-12345"
      prefix = "infrastructure/state"
    }
  }

  provider "google" {
    project = var.project_id
    region  = "us-central1"
  }

  resource "google_compute_network" "vpc" {
    name                    = "vpc-prod-main"
    auto_create_subnetworks = false
  }

  resource "google_compute_subnetwork" "subnet" {
    name          = "sb-prod-uscentral1"
    ip_cidr_range = "10.100.0.0/20"
    region        = "us-central1"
    network       = google_compute_network.vpc.id
  }
  ```
    ↓
Execution via CI/CD: Automated Cloud Build step runs `terraform plan` on Pull Request and `terraform apply` on merge to `main`.
    ↓
Result: Reproducible, version-controlled GCP infrastructure deployed in minutes with 100% auditability.
```

*Why Selected*: Combines declarative HCL resource blocks, remote state locking in Cloud Storage, and automated CI/CD pipeline execution.

---

## 6. Hands-On Lab

### Prerequisites
- Active GCP Project with Compute Engine API enabled.
- Cloud Shell or local machine with `terraform` CLI installed.
- IAM permissions: `roles/editor` or `roles/resourcemanager.projectIamAdmin`.

### Console Method (State Storage Setup)
1. Log into [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **Cloud Storage** → **Buckets** → Click **CREATE**.
3. Name: `tf-state-demo-PROJECT_ID`, Location: `us-central1`.
4. Enforce **Prevent public access** and **Soft Delete Policy**.
5. Click **CREATE** (Initializes GCS Remote State Bucket).

### CLI Method
Initialize a Terraform working directory, write HCL code, plan, and apply using `terraform`:

```bash
# Set variables
PROJECT_ID="your-gcp-project-id"

# 1. Create a local working directory
mkdir tf-demo && cd tf-demo

# 2. Create main.tf file
cat <<EOF > main.tf
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

resource "google_compute_network" "demo_vpc" {
  name                    = "vpc-tf-demo"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "demo_subnet" {
  name          = "sb-tf-demo-uscentral1"
  ip_cidr_range = "10.200.0.0/24"
  region        = "us-central1"
  network       = google_compute_network.demo_vpc.id
}

output "vpc_id" {
  value = google_compute_network.demo_vpc.id
}
EOF

# 3. Initialize Terraform working directory
terraform init

# 4. Generate and inspect execution plan
terraform plan

# 5. Apply execution plan to provision GCP resources
terraform apply -auto-approve
```

### Verification
*Expected Result*: `terraform apply` outputs `Apply complete! Resources: 2 added, 0 changed, 0 destroyed.` and displays `vpc_id`.

### Cleanup
Destroy provisioned infrastructure:

```bash
terraform destroy -auto-approve
cd .. && rm -rf tf-demo
```

---

## 7. Security

### Terraform State Security & IAM Rules
- **Protect State Secrets**: The `terraform.tfstate` file contains un-encrypted secret strings (such as database passwords or service account keys). Store state files in a **private Cloud Storage bucket** with restricted IAM access (`roles/storage.objectViewer`).
- **Never Commit State Files to Git**: Add `*.tfstate`, `*.tfstate.backup`, and `.terraform/` to `.gitignore`.
- **Keyless CI/CD Authentication**: Authenticate Terraform in Cloud Build or GitHub Actions keylessly using **Workload Identity Federation** instead of downloading static JSON service account keys.

```text
BAD PRACTICE:
Committing local `terraform.tfstate` files containing plaintext Cloud SQL passwords into a public or shared Git repository.
Risk: Secrets leak into Git commit history, granting unauthorized users full access to database credentials.

PRODUCTION PRACTICE:
Configure a **GCS Remote Backend** (`backend "gcs"`). Restrict bucket permissions and add `*.tfstate` to `.gitignore`.
```

---

## 8. Scaling & High Availability

Multi-Environment Directory Structure:

```text
Monolithic Single File (`main.tf` -> Fragile -> Slow plan execution)
   ↓ (Enterprise Modular Terraform Upgrade)
Modular Directory Layout (`environments/dev`, `environments/prod` -> Independent GCS state prefixes -> Isolated blast radius)
```

- **Isolated State Blast Radius**: Separate production state files from development state files using distinct GCS backend prefixes so an error in `dev` cannot affect `prod`.

---

## 9. Cost

### Terraform Pricing Structure
- **Terraform CLI**: 100% **FREE** open-source software.
- **Provisioned GCP Infrastructure**: Standard GCP pricing applies to resources created by Terraform (VMs, Cloud SQL, GKE).
- **GCS Remote State Storage**: Negligible cost (~$0.01/month for storing lightweight `tfstate` files).

---

## 10. Monitoring & Troubleshooting

### Diagnostic Tools
- **`terraform plan` Execution Diffs**: Review proposed additions (`+`), modifications (`~`), and destructions (`-`) before applying.
- **`TF_LOG=DEBUG`**: Set environment variable `TF_LOG=DEBUG` to inspect underlying raw HTTP GCP REST API calls made by the Google provider.

### Troubleshooting Matrix

| Symptom | Possible Cause | What to Check | Fix |
|---|---|---|---|
| `terraform init` fails: `Error locking state` | Previous operation crashed without releasing GCS lock | GCS State Bucket `.tflock` object | Run `terraform force-unlock LOCK_ID` after verifying no active apply is running. |
| `terraform apply` fails: `403 Permission Denied` | Service Account running Terraform lacks required GCP IAM role | IAM Policy Bindings | Grant required role (e.g., `roles/compute.networkAdmin` or `roles/container.admin`). |
| Resource changes on every apply | Drift between real-world GCP resource and HCL code | `terraform plan` diff | Import existing resource using `terraform import` or update HCL to match GCP state. |

---

## 11. Common Mistakes

```text
Mistake: Running `terraform apply` locally using personal developer credentials without using a GCS Remote Backend.
Why: Taking shortcuts during initial prototyping.
Impact: Local `terraform.tfstate` file is lost when the laptop is replaced; two developers overwrite each other's changes.
Correct approach: Configure a **GCS Remote Backend** (`backend "gcs"`) before writing resource code.

Mistake: Modifying GCP resources manually in the GCP Console after they were provisioned by Terraform.
Why: Quick manual fix during an incident.
Impact: Infrastructure Drift; the next `terraform apply` overwrites or reverts manual Console changes.
Correct approach: Always update the underlying HCL Terraform code and run `terraform apply`.
```

---

## 12. Production Best Practices

- [ ] Use a **GCS Remote Backend** (`backend "gcs"`) with state locking for 100% of projects.
- [ ] Add **`*.tfstate`** and **`.terraform/`** to `.gitignore`.
- [ ] Authenticate Terraform in CI/CD pipelines keylessly using **Workload Identity Federation**.
- [ ] Isolate environments using separate state file directories (`environments/dev`, `environments/prod`).
- [ ] Pin Terraform provider versions (`version = "~> 5.0"`) to prevent breaking provider upgrades.
- [ ] Review **`terraform plan`** outputs carefully before running `terraform apply`.

---

## 13. Hyperscaler / Enterprise Perspective

```text
Personal / Learning
  Local `.tfstate` file → Manual CLI apply → Developer IAM Keys → Monolithic HCL
        ↓
Small Production
  GCS Remote Backend → Basic Modules → Cloud Build Execution → Service Account Keys
        ↓
Enterprise Environment
  Google Foundation Fabric Modules → Workload Identity Federation → Automated `terraform plan` PR Reviews
        ↓
Hyperscaler Environment
  100% Terraform Landing Zone Governance → Policy-as-Code Enforcers (Sentinel / OPA) → Multi-Region State Isolation
```

In a hyperscaler environment, Terraform is the mandatory infrastructure delivery platform. Enterprise platform teams deploy **Google Cloud Foundation Fabric** modules. CI/CD pipelines run `terraform plan` automatically on GitHub Pull Requests, using **Open Policy Agent (OPA)** or **Sentinel** to enforce compliance rules (such as blocking public IP creation or unencrypted storage buckets) before merging code to `main`.

---

## 14. Real Project Questions

### Q1: Why is storing the `terraform.tfstate` file in a GCS Remote Backend critical for enterprise teams?
**Answer:** Storing state in a **GCS Remote Backend** (`backend "gcs"`) provides a single, centralized source of truth for infrastructure state. GCS automatically enforces **State Locking** using object generation locks, preventing two engineers from running `terraform apply` concurrently and corrupting infrastructure state. Additionally, it keeps sensitive state data off local developer laptops.

### Q2: What is Infrastructure Drift in Terraform, and how does `terraform plan` detect it?
**Answer:** **Infrastructure Drift** occurs when real-world GCP resources are modified out-of-band (e.g., via the GCP Console or direct `gcloud` commands) after being provisioned by Terraform. When `terraform plan` executes, Terraform queries real-world GCP REST APIs, compares actual resource attributes against `terraform.tfstate` and HCL code, and highlights discrepancies in the diff output (`~` modification or `-` destruction).

### Q3: Why should organizations pin provider versions in `required_providers` blocks?
**Answer:** Pinning provider versions (e.g., `version = "~> 5.0"`) prevents Terraform from automatically upgrading to a new major version of the Google Cloud Provider during `terraform init`. Major provider upgrades may introduce breaking schema changes or deprecate argument fields, which could cause production `terraform apply` executions to fail unexpectedly.

---

## 15. Quick Decision Guide

| Requirement | Recommended Approach | Reason |
|---|---|---|
| Provisioning, updating, and versioning GCP VPC networks, GKE clusters, and Cloud SQL databases declaratively | **Terraform on GCP (Google Provider)** | Industry-standard IaC framework with declarative state management and full GCP API coverage. |
| Multi-developer team collaborating safely on GCP infrastructure code without state corruption | **GCS Remote Backend (`backend "gcs"`)** | Centralizes state in Cloud Storage with automatic state locking and versioning. |
| Executing Terraform pipeline applies inside Cloud Build keylessly without JSON service account keys | **Terraform + Workload Identity Federation** | Authenticates Cloud Build to GCP APIs keylessly using IAM Workload Identity. |

### When should I use it?
- Essential IaC framework for provisioning, configuring, and managing 100% of GCP cloud infrastructure.

### When should I NOT use it?
- Do not use Terraform for continuous application code compilation or unit testing (use Cloud Build instead).

---

## 16. Related Services

```text
                  [82. Terraform on GCP]
                 /          |          \
        Cloud Storage  Workload Identity Cloud Build
        (State Backend) (Keyless IAM)    (CI/CD Pipeline)
             |              |                 |
        Remote State    Secure API        Automated
        Locking         Access            Terraform Apply
```

- **Cloud Storage**: Remote backend storage for `terraform.tfstate` files.
- **Workload Identity Federation**: Enables keyless authentication for Terraform CI/CD pipelines.
- **Cloud Build**: Execution engine running automated `terraform plan` and `apply` steps.

---

## 17. Cheat Sheet

### Core Commands
- `terraform init`: Initializes provider plugins and GCS remote backend.
- `terraform plan`: Calculates diff between HCL code and real-world GCP state.
- `terraform apply`: Executes GCP REST API calls to provision infrastructure.
- `terraform destroy`: Removes all infrastructure declared in HCL files.

### Useful Code Snippet
```hcl
terraform {
  backend "gcs" {
    bucket = "TF_STATE_BUCKET_NAME"
    prefix = "env/prod"
  }
  required_providers {
    google = { source = "hashicorp/google", version = "~> 5.0" }
  }
}

provider "google" {
  project = "PROJECT_ID"
  region  = "us-central1"
}
```

---

## 18. Learning Connection

- **Previous Topic**: [81. Event-Driven Architectures](../../07-serverless-event-driven/81-event-driven-architectures/README.md)
- **Next Topic**: [83. Providers](../83-providers/README.md)
