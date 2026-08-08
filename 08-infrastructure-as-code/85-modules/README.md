# Topic 85: Modules

---

## 1. What Is It?

In Terraform on GCP, a **Module** is a self-contained container package of HashiCorp Configuration Language (HCL) resource declarations that groups related infrastructure components together to create reusable, versioned, composable, and enterprise-standardized building blocks.

Every Terraform configuration has at least one module, known as the **Root Module** (the directory where `terraform apply` is executed). When a root module calls another directory or external repository, that packaged configuration is called a **Child Module**.

Terraform modules enable:
1. **Encapsulation & Abstraction**: Hide complex GCP resource configurations (e.g., secondary IP ranges, firewall tags, master authorized networks for GKE) behind a simple, high-level module interface.
2. **Reusability across Teams**: Publish vetted enterprise modules (e.g., standard VPC module, production Cloud SQL module) for consumption across multiple product engineering teams.
3. **Module Versioning**: Source modules directly from Git tags (`ref=v1.2.0`) or Private Terraform Registries, enabling safe, controlled infrastructure upgrades.

### Real-World Analogy
Think of a Terraform Module like a pre-assembled modular microchip or engine component in car manufacturing:
- **Un-modularized Code (Hand-wiring Individual Transistors)**: Every car assembly line worker soldering 5,000 individual copper wires, resistors, and capacitors by hand. If a wire breaks or a new car model comes out, every worker must hand-solder 5,000 wires all over again.
- **Terraform Module (Pre-packaged Engine Control Unit)**: A specialized supplier packages the entire ignition assembly into a single sealed module (`module "ecu"`). Car assembly workers simply plug 3 input wires (`power`, `sensors`, `fuel_type`) into the ECU module socket. The complex internal wiring is abstracted away, and upgrading to a newer engine version involves plugging in `ECU Module v2.0`.

---

## 2. Where Does It Fit?

Root modules instantiate Child Modules from local paths, Git repositories, or the Terraform Registry, passing variables and receiving outputs.

```mermaid
flowchart TD
    subgraph RootModuleTier["Root Terraform Module (`environments/prod`)"]
        RootMain["`main.tf` (Module Invocations)"]
        TFVars["`prod.tfvars` (Environment Variable Inputs)"]
    end

    subgraph ModuleSourceRegistry["Module Sources"]
        LocalPath["Local Directory (`source = "../../modules/vpc"`)"]
        GitRepo["Git Repository (`source = "git::https://...ref=v1.0.0"`)"]
        GCPPublicRegistry["Google Official Registry (`terraform-google-modules/...`)"]
    end

    subgraph ChildModulesTier["Child Infrastructure Modules"]
        subgraph VPCModule["VPC Subnet Module"]
            VPCRes["`google_compute_network`"]
            SubnetRes["`google_compute_subnetwork`"]
        end

        subgraph GKEModule["GKE Cluster Module"]
            GKERes["`google_container_cluster`"]
            NodePoolRes["`google_container_node_pool`"]
        end
    end

    RootMain & TFVars --> LocalPath & GitRepo & GCPPublicRegistry
    LocalPath --> VPCModule
    GitRepo & GCPPublicRegistry --> GKEModule
```

---

## 3. Core Concepts

| Concept / Setting | HCL Syntax / Parameter | Description | Best Practice |
|---|---|---|---|
| **Root Module** | Execution Directory | Main entry directory where `terraform apply` runs. | Keep root modules thin; delegate to child modules. |
| **Child Module** | Called Module Block | Reusable infrastructure block invoked by root. | Structure child modules with `main.tf`, `variables.tf`, `outputs.tf`. |
| **Module Source** | `source = "..."` | Location of child module code (local, Git, Registry). | Use Git tags (`?ref=v1.0.0`) for remote modules. |
| **Module Inputs** | `project_id = var.id` | Input arguments passed to child module variables. | Pass explicit values; avoid hardcoding defaults in child. |
| **Module Outputs** | `module.vpc.vpc_id` | Attribute values exported by child modules. | Export critical resource IDs and self-links. |

---

## 4. How It Works

Module initialization, source fetching, and parameter mapping operate deterministically:

```text
Engineer runs `terraform init` -> Downloads modules specified in `source = "..."` blocks
              ↓
Local copies stored in `.terraform/modules/` directory
              ↓
Engineer runs `terraform plan` -> Maps root module variables into child module inputs
              ↓
Child module evaluates `locals` -> Provisions underlying GCP resources (`google_compute_network`)
              ↓
Child module exports `outputs` -> Root module consumes child output (`module.vpc.vpc_id`)!
```

1. **`terraform init` Requirement**: Whenever a `module` block's `source` or `version` argument is added or modified, `terraform init` MUST be re-run to download the new module code.
2. **Passing Providers to Modules**: Child modules automatically inherit the default `google` provider configuration from the calling root module.

---

## 5. Production Scenario

### Enterprise Production VPC & Private GKE Landing Zone via Official GCP Modules

```text
Requirement: Provision an enterprise-grade VPC network with secondary IP ranges for pods/services and a private GKE cluster using Google's official verified modules (`terraform-google-modules`), versioning all module imports securely.
    ↓
Architecture: Root Module (`environments/prod`) + Official Google Modules from Terraform Registry.
    ↓
Root HCL Configuration (`main.tf`):
  ```hcl
  module "vpc" {
    source  = "terraform-google-modules/network/google"
    version = "~> 9.0"

    project_id   = var.project_id
    network_name = "vpc-prod-main"
    routing_mode = "GLOBAL"

    subnets = [
      {
        subnet_name   = "sb-prod-uscentral1"
        subnet_ip     = "10.100.0.0/20"
        subnet_region = "us-central1"
      }
    ]

    secondary_ranges = {
      sb-prod-uscentral1 = [
        { range_name = "gke-pods", ip_cidr_range = "10.101.0.0/16" },
        { range_name = "gke-services", ip_cidr_range = "10.102.0.0/20" }
      ]
    }
  }

  module "gke" {
    source  = "terraform-google-modules/kubernetes-engine/google"
    version = "~> 30.0"

    project_id         = var.project_id
    name               = "gke-prod-cluster"
    region             = "us-central1"
    network            = module.vpc.network_name
    subnetwork         = module.vpc.subnets_names[0]
    ip_range_pods      = "gke-pods"
    ip_range_services  = "gke-services"
    ip_allocation_policy = true
  }
  ```
    ↓
Operational Result: Instantiates 20+ underlying GCP network and GKE resources using 30 lines of clean, verified, and versioned HCL code.
```

*Why Selected*: Demonstrates leveraging official Google-maintained modules from the Terraform Registry with strict version constraints (`version = "~> 9.0"`).

---

## 6. Hands-On Lab

### Prerequisites
- Active GCP Project with Compute Engine API enabled.
- Cloud Shell or local machine with `terraform` CLI installed.
- IAM permissions: `roles/viewer` or `roles/editor`.

### CLI Method
Create a local child module and call it from a root module using `terraform`:

```bash
# Set variables
PROJECT_ID="your-gcp-project-id"

# 1. Create directory structure
mkdir -p module-demo/modules/vpc_submodule
mkdir -p module-demo/environments/dev
cd module-demo

# 2. Define child module (modules/vpc_submodule/main.tf)
cat <<EOF > modules/vpc_submodule/main.tf
variable "vpc_name" { type = string }
variable "project_id" { type = string }

resource "google_compute_network" "custom_vpc" {
  project                 = var.project_id
  name                    = var.vpc_name
  auto_create_subnetworks = false
}

output "network_id" {
  value = google_compute_network.custom_vpc.id
}
EOF

# 3. Define root module (environments/dev/main.tf)
cat <<EOF > environments/dev/main.tf
terraform {
  required_providers {
    google = { source = "hashicorp/google", version = "~> 5.0" }
  }
}

provider "google" {
  region = "us-central1"
}

module "my_vpc" {
  source     = "../../modules/vpc_submodule"
  project_id = "$PROJECT_ID"
  vpc_name   = "vpc-local-module-demo"
}

output "dev_vpc_id" {
  value = module.my_vpc.network_id
}
EOF

# 4. Initialize and apply from root module directory
cd environments/dev
terraform init
terraform apply -auto-approve
```

### Verification
*Expected Result*: Output displays `dev_vpc_id` referencing the VPC created by the child module.

### Cleanup
Destroy resources and remove folders:

```bash
terraform destroy -auto-approve
cd ../../.. && rm -rf module-demo
```

---

## 7. Security

### Module Security & Source Auditing Rules
- **Pin Remote Git Module Versions**: ALWAYS append `?ref=vX.Y.Z` Git release tags when sourcing modules from Git repositories (`source = "git::https://...git?ref=v1.2.0"`). Never point to unversioned `main` or `master` branches.
- **Audit Third-Party Registry Modules**: Review open-source module code before importing. Ensure third-party modules do not open un-restricted firewall rules (`0.0.0.0/0`) or create public Cloud Storage buckets.
- **Private Module Registry**: Use a Private Terraform Registry or internal Git repositories with IAM access controls for corporate modules.

```text
BAD PRACTICE:
Sourcing modules directly from Git default branches without release tags:
`source = "git::https://github.com/org/gke-module.git"`
Risk: A commit to the external `main` branch automatically changes your infrastructure during the next `terraform apply`, introducing untested breaking changes.

PRODUCTION PRACTICE:
Pin Git modules to explicit release tags:
`source = "git::https://github.com/org/gke-module.git?ref=v2.1.0"`
```

---

## 8. Scaling & High Availability

Module Standard Reusability:

```text
Team A writes raw Compute HCL -> Team B writes raw Compute HCL (Duplicate code -> Divergent security policies)
   ↓ (Enterprise Centralized Module Adoption)
Central DevOps Team publishes `module "standard_gcp_vm"` v1.0.0 -> Teams A & B consume identical vetted modules
```

- **Enterprise Governance Scaling**: Centralizing infrastructure modules allows platform teams to update security defaults (such as enforcing CMEK encryption or disabling public IPs) once in the module repository, propagating compliance across all consuming teams.

---

## 9. Cost

### Module Financial Impact
- **Terraform Modules**: 100% **FREE** open-source structural HCL language constructs.
- **Cost Savings via Modules**: Modules standardise resource sizes (e.g., enforcing default e2-medium instances in dev), preventing individual engineers from accidentally provisioning expensive machine types.

---

## 10. Monitoring & Troubleshooting

### Diagnostic Tools
- **`.terraform/modules/modules.json`**: Inspect local downloaded module directory mapping.
- **`terraform graph`**: Visualizes module resource dependency trees.

### Troubleshooting Matrix

| Symptom | Possible Cause | What to Check | Fix |
|---|---|---|---|
| `Error: Module not installed` | New `module` block added without running init | Local `.terraform/modules` | Run `terraform init` to download new child modules. |
| `Error: Unsupported attribute` | Attempting to access a child module resource attribute not exported in `outputs.tf` | Child module `outputs.tf` | Add an `output` block to the child module exporting the required attribute. |
| `Error: Duplicate resource` | Child module hardcoded a global resource name | Child module HCL resource block | Parameterize resource names using module input variables (`var.name`). |

---

## 11. Common Mistakes

```text
Mistake: Hardcoding static global resource names (e.g., bucket name `"my-company-bucket"`) inside a reusable child module.
Why: Forgetting that modules are intended to be instantiated multiple times.
Impact: Attempting to call the module twice causes GCP API naming collision errors.
Correct approach: Parameterize all resource names in child modules using input variables (`name = "${var.prefix}-${var.name}"`).

Mistake: Creating massive, monolithic "god modules" that attempt to provision VPCs, GKE, Cloud SQL, and IAM all inside a single module block.
Why: Grouping too many unrelated resources together.
Impact: Slow plan execution times, rigid configurations, and high blast radius on updates.
Correct approach: Build small, single-purpose modules (e.g., `vpc` module, `gke` module, `cloud-sql` module).
```

---

## 12. Production Best Practices

- [ ] Structure child modules with dedicated **`main.tf`**, **`variables.tf`**, and **`outputs.tf`** files.
- [ ] Parameterize all resource names inside child modules using input variables.
- [ ] Pin remote Git module sources to explicit release tags (`?ref=v1.2.0`).
- [ ] Pin Terraform Registry modules using pessimistic version constraints (`version = "~> 5.0"`).
- [ ] Export critical resource IDs and self-links in child module **`outputs.tf`**.
- [ ] Keep child modules focused on a single logical responsibility (e.g., VPC or GKE).

---

## 13. Hyperscaler / Enterprise Perspective

```text
Personal / Learning
  Monolithic Single File → Copy-Pasted Code → Unversioned Modules → Local Directory Paths
        ↓
Small Production
  Local Child Modules → Terraform Registry Public Modules → Basic Version Constraints
        ↓
Enterprise Environment
  Private Module Registry → `terraform-google-modules` Fabric → Git Tag Versioning (`?ref=v1.0.0`)
        ↓
Hyperscaler Environment
  100% Policy-Governed Module Catalog → Automated OPA Compliance Scanning → Centralized Platform Engineering
```

In a hyperscaler environment, Modules are the primary vehicle for **Platform Engineering and Infrastructure Governance**. Enterprise platform teams maintain a **Private Module Registry** containing approved, pre-audited modules for VPCs, GKE clusters, and Cloud SQL databases. Product engineering teams are forbidden from declaring raw GCP resources directly; they must instantiate approved enterprise modules with mandatory security guardrails (CMEK, Shielded VMs, Private IP) pre-configured.

---

## 14. Real Project Questions

### Q1: What is the difference between a Root Module and a Child Module in Terraform?
**Answer:** A **Root Module** is the main working directory containing HCL files where the `terraform` commands (`init`, `plan`, `apply`) are executed. A **Child Module** is a packaged, reusable configuration directory or repository called from a root module (or another child module) via a `module "name" { source = "..." }` block to encapsulate and instantiate infrastructure components.

### Q2: Why should remote Git modules always be sourced with explicit release tags (`?ref=vX.Y.Z`)?
**Answer:** Sourcing remote Git modules with explicit release tags (`source = "git::https://...git?ref=v1.2.0"`) locks the module version to an immutable git tag. This prevents un-tested commits pushed to the remote repository's default branch from automatically altering your production infrastructure during subsequent `terraform apply` executions.

### Q3: How do outputs defined inside a child module become accessible to the root module?
**Answer:** Attributes generated inside a child module are NOT accessible to the root module automatically. The child module MUST explicitly export the attribute inside its own **`outputs.tf`** file (e.g., `output "vpc_id" { value = google_compute_network.vpc.id }`). The root module can then reference that value using the syntax **`module.module_name.output_name`**.

---

## 15. Quick Decision Guide

| Requirement | Recommended Approach | Reason |
|---|---|---|
| Packaging a standard enterprise GKE cluster configuration to reuse across 15 application development teams | **Terraform Child Module (Private Registry / Git Tag)** | Encapsulates complex GKE settings into a versioned, reusable building block. |
| Referencing an attribute (like a subnet self-link) created inside a child module from the root module | **Export attribute in Child `outputs.tf` -> Reference `module.name.output`** | Exports values across module boundaries cleanly. |
| Deploying a production network using Google's official, security-audited HCL code templates | **`terraform-google-modules/network/google` from Registry** | Official Google-maintained HCL modules following GCP Architecture Framework best practices. |

### When should I use it?
- Essential Terraform feature for packaging, abstracting, versioning, and reusing infrastructure code across environments and engineering teams.

### When should I NOT use it?
- Do not create custom child modules for simple single-resource declarations that do not require reusability or abstraction.

---

## 16. Related Services

```text
                     [85. Modules]
                    /      |      \
        Cloud Storage  Cloud Build   Artifact Registry
        (Remote State) (CI/CD Test)  (Private Modules)
             |             |                 |
        Stores State   Executes Module   Stores Private
        Per Module     Integration Tests HCL Packages
```

- **Cloud Storage**: Stores state files generated by root module executions.
- **Cloud Build**: Runs automated unit and integration tests on module pull requests.
- **Artifact Registry / Git**: Hosts private enterprise module packages.

---

## 17. Cheat Sheet

### Syntax Summary
- **Invocation**: `module "vpc" { source = "...", project_id = "..." }`.
- **Local Source**: `source = "../../modules/vpc"`.
- **Git Source**: `source = "git::https://example.com/vpc.git?ref=v1.0.0"`.
- **Registry Source**: `source = "terraform-google-modules/network/google", version = "~> 9.0"`.
- **Output Reference**: `module.vpc.network_id`.

### Code Example
```hcl
module "network" {
  source  = "terraform-google-modules/network/google"
  version = "~> 9.0"

  project_id   = var.project_id
  network_name = "vpc-prod"

  subnets = [
    { subnet_name = "sb-uscentral1", subnet_ip = "10.0.0.0/24", subnet_region = "us-central1" }
  ]
}
```

---

## 18. Learning Connection

- **Previous Topic**: [84. Variables](../84-variables/README.md)
- **Next Topic**: [86. State Management](../86-state-management/README.md)
