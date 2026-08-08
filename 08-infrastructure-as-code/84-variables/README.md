# Topic 84: Variables

---

## 1. What Is It?

In Terraform on GCP, **Variables** (Input Variables, Output Values, and Local Values) are the foundational language constructs that enable parameterization, code reusability, data encapsulation, value validation, and modular decoupling across HashiCorp Configuration Language (HCL) modules.

Rather than hardcoding static GCP values (such as project IDs, subnet IP CIDRs, machine types, or region names) directly inside resource blocks, variables allow engineers to write single, generic HCL configurations deployed predictably across `development`, `staging`, and `production` environments.

Terraform categorizes data flow constructs into three distinct types:
1. **Input Variables (`variable`)**: Parameters passed into a root or child module to customize behavior without altering source code.
2. **Local Values (`locals`)**: Internal temporary variables used to compute expressions, combine strings, or eliminate repetitive logic within a module.
3. **Output Values (`output`)**: Exported values published by a module to expose resource attributes (e.g., VPC IDs, database IP addresses) to child modules, CLI users, or remote state consumers.

### Real-World Analogy
Think of Terraform Variables like an interactive tax calculation form or online invoice generator:
- **Hardcoded HCL (Hand-written Ink Receipt)**: Writing "Customer Name: John, Item Price: $100, Tax Rate: 8%, Total: $108" in ink on paper. If the tax rate changes or a new customer arrives, you throw away the paper and write a brand-new form from scratch.
- **Input Variables (`variable`)**: Blank form fields labeled `customer_name`, `item_price`, and `tax_rate`. Anyone filling out the form enters their own numbers.
- **Local Values (`locals`)**: The internal automatic formula calculating `subtotal = item_price * quantity`.
- **Output Values (`output`)**: The printed bottom line total (`total_amount`) highlighted in bold for the customer to take home.

---

## 2. Where Does It Fit?

Input Variables enter the module, Locals compute internal expressions, and Outputs export attributes to downstream modules or CLI callers.

```mermaid
flowchart TD
    subgraph InputSources["Input Variable Sources"]
        TFVARS["`terraform.tfvars` / `*.auto.tfvars`"]
        CLIFlags["CLI Flags (`-var='region=us-central1'`)"]
        EnvVars["Environment Variables (`TF_VAR_project_id`)"]
    end

    subgraph ModuleExecutionBoundary["Terraform HCL Module Boundary"]
        InputVariables["Input Variables (`variables.tf`)\n- Type Enforcement (`string`, `list`, `map`, `object`)\n- Custom Validation Rules (`validation {}`)"]
        
        LocalValues["Local Values (`locals.tf`)\n- Computed String Formatting\n- Resource Naming Standardization"]

        ResourceBlocks["GCP Resource Declarations (`main.tf`)\n- `google_compute_instance`\n- `google_compute_network`"]

        OutputValues["Output Values (`outputs.tf`)\n- Sensitive Flag Protection (`sensitive = true`)\n- Exported Attributes (VPC ID, IPs)"]
    end

    subgraph DownstreamConsumers["Downstream Consumers"]
        ChildModules["Child Terraform Modules"]
        RemoteState["Remote State Data Sources (`terraform_remote_state`)"]
        CLIOutput["CLI Terminal Output"]
    end

    TFVARS & CLIFlags & EnvVars --> InputVariables
    InputVariables --> LocalValues --> ResourceBlocks
    ResourceBlocks --> OutputValues
    OutputValues --> ChildModules & RemoteState & CLIOutput
```

---

## 3. Core Concepts

| Variable Type | HCL Block | Syntax / Example | Primary Best Practice |
|---|---|---|---|
| **Input Variable** | `variable "name"` | `type = string`, `default = "..."` | Always define `type` and `description`. |
| **Local Value** | `locals {}` | `locals { name = "${var.env}-vm" }` | Use locals for complex naming conventions. |
| **Output Value** | `output "name"` | `value = google_sql.db.private_ip` | Mark secret outputs as `sensitive = true`. |
| **Validation Rule** | `validation {}` | `condition = can(regex(...))` | Enforce naming and region regex constraints. |
| **Var Files** | `.tfvars` | `environment = "production"` | Never commit production `.tfvars` containing secrets to Git. |

---

## 4. How It Works

Variable precedence evaluation and local expression resolution operate deterministically:

```text
Terraform evaluates Variable Precedence (Lowest to Highest Priority):
  1. Default value in `variables.tf`
  2. Environment variables (`TF_VAR_project_id`)
  3. `terraform.tfvars` file
  4. `*.auto.tfvars` files
  5. Command-line flags (`-var="project_id=prod-123"`) [HIGHEST PRIORITY!]
              ↓
Input Variables validated against `validation {}` blocks (Fails early if invalid!)
              ↓
Local Values (`locals`) calculate formatted strings (e.g., `local.resource_prefix`)
              ↓
Resources provisioned in GCP -> Outputs generated -> Sensitive values masked in CLI!
```

1. **Precedence Hierarchy**: Command-line `-var` flags override `.tfvars` files, which override environment variables, which override default values.
2. **Type Checking**: Primitive types (`string`, `number`, `bool`) and complex structural types (`list()`, `map()`, `object({})`) prevent invalid data types before calling GCP APIs.

---

## 5. Production Scenario

### Enterprise Validated VPC & GKE Naming Standard Module

```text
Requirement: Define a reusable infrastructure module accepting environment inputs (`dev`, `staging`, `prod`), validating that regions match authorized US zones, generating standardized resource names, and exporting sensitive database credentials safely.
    ↓
Architecture: `variables.tf` + `locals.tf` + `outputs.tf` + `main.tf`.
    ↓
Input Variables (`variables.tf`):
  ```hcl
  variable "project_id" {
    type        = string
    description = "The target GCP Project ID."
  }

  variable "environment" {
    type        = string
    description = "Target deployment environment."
    validation {
      condition     = contains(["dev", "staging", "prod"], var.environment)
      error_message = "Environment must be one of: dev, staging, prod."
    }
  }

  variable "region" {
    type        = string
    default     = "us-central1"
    description = "GCP deployment region."
    validation {
      condition     = can(regex("^us-", var.region))
      error_message = "Region must be in the US (e.g., us-central1, us-east1)."
    }
  }
  ```
    ↓
Local Values (`locals.tf`):
  ```hcl
  locals {
    name_prefix = "${var.environment}-${var.region}"
    common_labels = {
      environment = var.environment
      managed_by  = "terraform"
    }
  }
  ```
    ↓
Output Values (`outputs.tf`):
  ```hcl
  output "vpc_name" {
    value       = google_compute_network.vpc.name
    description = "The name of the provisioned VPC."
  }

  output "db_password" {
    value       = google_sql_database_instance.db.root_password
    sensitive   = true
    description = "Sensitive root database password."
  }
  ```
```

*Why Selected*: Enforces input validation rules, uses local values for standardized resource naming, and sets `sensitive = true` to protect credentials in terminal logs.

---

## 6. Hands-On Lab

### Prerequisites
- Active GCP Project with Compute Engine API enabled.
- Cloud Shell or local machine with `terraform` CLI installed.
- IAM permissions: `roles/viewer` or `roles/editor`.

### CLI Method
Create a complete modular variable structure with custom validation and output masking:

```bash
# Set variables
PROJECT_ID="your-gcp-project-id"

# 1. Create a local working directory
mkdir var-demo && cd var-demo

# 2. Create variables.tf
cat <<EOF > variables.tf
variable "project_id" {
  type        = string
  description = "Target GCP Project ID"
}

variable "env" {
  type        = string
  default     = "dev"
  description = "Deployment environment"
  validation {
    condition     = contains(["dev", "stage", "prod"], var.env)
    error_message = "Env must be dev, stage, or prod."
  }
}
EOF

# 3. Create locals.tf and main.tf
cat <<EOF > main.tf
terraform {
  required_providers {
    google = { source = "hashicorp/google", version = "~> 5.0" }
  }
}

provider "google" {
  project = var.project_id
  region  = "us-central1"
}

locals {
  network_name = "vpc-\${var.env}-main"
}

resource "google_compute_network" "vpc" {
  name                    = local.network_name
  auto_create_subnetworks = false
}

output "network_id" {
  value       = google_compute_network.vpc.id
  description = "The created VPC ID"
}
EOF

# 4. Create terraform.tfvars
cat <<EOF > terraform.tfvars
project_id = "$PROJECT_ID"
env        = "dev"
EOF

# 5. Initialize and apply
terraform init
terraform apply -auto-approve
```

### Verification
*Expected Result*: `terraform apply` succeeds, creating `vpc-dev-main` network and outputting `network_id`.

### Cleanup
Destroy provisioned network:

```bash
terraform destroy -auto-approve
cd .. && rm -rf var-demo
```

---

## 7. Security

### Variable Security & Secret Protection
- **`sensitive = true` on Outputs**: Mark all outputs exposing passwords, API keys, or private keys as `sensitive = true`. This forces Terraform to mask values (`<sensitive>`) in CLI execution outputs.
- **`sensitive = true` on Inputs**: Set `sensitive = true` on input variables containing credentials to prevent them from printing in plan diffs.
- **Exclude `.tfvars` from Git**: Add `*.tfvars`, `*.tfvars.json`, and `*.auto.tfvars` containing secrets to `.gitignore`.

```text
BAD PRACTICE:
Hardcoding database passwords in plain text inside `terraform.tfvars` files committed to a public Git repository.
Risk: Secrets leak into Git history, allowing unauthorized users to read production database credentials.

PRODUCTION PRACTICE:
Pass secrets via environment variables (`TF_VAR_db_password`), Secret Manager, or marked `sensitive = true`.
```

---

## 8. Scaling & High Availability

Module Parameterization & Dynamic Expansion:

```text
Monolithic Hardcoded HCL (Static Names & Hardcoded Regions -> Impossible to duplicate)
   ↓ (Parameterized HCL Variable Expansion)
Generic HCL Module + `dev.tfvars`, `prod.tfvars` -> Deploys identical isolated landing zones globally
```

- **Reusable Environment Scaling**: Parameterizing modules with input variables allows the exact same HCL code to instantiate development, staging, and production environments across multiple GCP regions without code duplication.

---

## 9. Cost

### Variable Financial Economics
- **Variables & Locals**: 100% **FREE** HCL language features processed locally by the Terraform engine.
- **Cost Reduction via Validation**: Custom `validation {}` blocks catch oversized VM machine types or invalid region selections during `terraform plan`, preventing accidental deployment of expensive resources.

---

## 10. Monitoring & Troubleshooting

### Diagnostic Tools
- **`terraform console`**: Interactive CLI REPL environment to test local expressions, variable evaluations, and string formatting live.
- **Execution Plan Validation**: `terraform plan` validates variable types and runs custom `validation {}` blocks before making GCP API calls.

### Troubleshooting Matrix

| Symptom | Possible Cause | What to Check | Fix |
|---|---|---|---|
| `Error: Invalid value for variable` | Input variable failed `validation {}` block condition | `variables.tf` validation block | Check input value against `error_message` criteria. |
| Output displays `<sensitive>` | Output marked with `sensitive = true` | `outputs.tf` definition | Use `terraform output -json` or inspect state file if raw value is required. |
| `Error: Variable not declared` | Variable passed in `.tfvars` without being defined in `variables.tf` | `variables.tf` declarations | Add explicit `variable "name" {}` block to `variables.tf`. |

---

## 11. Common Mistakes

```text
Mistake: Omitting `type` constraints on input variables (e.g., writing `variable "instance_count" {}` without `type = number`).
Why: Taking shortcuts during module creation.
Impact: Passing a string `"three"` causes Terraform to fail late during GCP API execution instead of early during plan validation.
Correct approach: Always specify explicit `type` constraints (`type = string`, `type = number`, `type = list(string)`).

Mistake: Using input variables inside a module to compute internal string names instead of using `locals`.
Why: Overusing input variables for internal calculations.
Impact: Clutters the module interface with internal variables that external callers should never override.
Correct approach: Use **`locals`** for internal computed values; reserve **`variables`** for caller-supplied parameters.
```

---

## 12. Production Best Practices

- [ ] Place input variables in **`variables.tf`**, computed logic in **`locals.tf`**, and outputs in **`outputs.tf`**.
- [ ] Always define explicit **`type`** and **`description`** fields for every input variable.
- [ ] Use **`validation {}`** blocks to enforce naming standards and allowed value lists.
- [ ] Mark secret inputs and outputs with **`sensitive = true`**.
- [ ] Add **`*.tfvars`** containing secrets to `.gitignore`.
- [ ] Use **`locals`** to calculate complex resource names and common tag maps.

---

## 13. Hyperscaler / Enterprise Perspective

```text
Personal / Learning
  Hardcoded HCL Values → No Input Validation → Unmasked Secrets → Monolithic File
        ↓
Small Production
  `variables.tf` & `outputs.tf` → `terraform.tfvars` Files → `sensitive = true` Flags
        ↓
Enterprise Environment
  Custom Validation Rules → Centralized `locals.tf` Naming Standard → Environment Isolated `.tfvars`
        ↓
Hyperscaler Environment
  100% Policy-Governed HCL Modules → Keyless Secret Ingestion → Automated OPA Variable Schema Auditing
```

In a hyperscaler environment, enterprise platform teams use **Variables and Locals** to enforce strict **Landing Zone Governance**. Modules mandate custom **`validation {}`** rules blocking unauthorized regions or machine sizes. **`locals.tf`** standardizes corporate resource naming (`company-dept-env-resource`) and labels across thousands of resources. Secret variables are ingested keylessly from **Secret Manager** or CI/CD pipelines without ever being stored in plain text `.tfvars` files.

---

## 14. Real Project Questions

### Q1: What is the primary functional difference between Input Variables (`variable`), Local Values (`locals`), and Output Values (`output`)?
**Answer:** **Input Variables** (`variable`) are parameters passed into a module from external callers or `.tfvars` files to customize behavior. **Local Values** (`locals`) are internal computed expressions defined within the module to simplify complex logic and standardize resource names. **Output Values** (`output`) are exported values published by the module to expose resource attributes to external callers, child modules, or remote state consumers.

### Q2: How do custom `validation {}` blocks improve pipeline safety in Terraform modules?
**Answer:** Custom **`validation {}`** blocks allow developers to define explicit boolean conditions (e.g., checking if a string matches a regex or exists in an allowed list) and custom error messages on input variables. Terraform evaluates validation rules during `terraform plan`, catching invalid inputs (such as un-approved region selections or invalid machine types) early before making any GCP API calls.

### Q3: What is the effect of setting `sensitive = true` on an output value?
**Answer:** Setting **`sensitive = true`** instructs Terraform to redact the output value from standard terminal execution logs (`terraform plan` and `terraform apply`), displaying `<sensitive>` instead of printing plain text passwords or private keys. The actual value remains stored securely in the underlying `terraform.tfstate` file.

---

## 15. Quick Decision Guide

| Requirement | Recommended Approach | Reason |
|---|---|---|
| Parameterizing a GCP region or project ID so the same HCL code deploys to `dev` and `prod` | **Input Variable (`variable "region" { type = string }`)** | Allows external callers or `.tfvars` files to customize module parameters. |
| Constructing a standardized corporate resource name (`dev-uscentral1-app-vpc`) internally | **Local Value (`locals { name = "${var.env}-${var.region}-app-vpc" }`)** | Computes internal string expressions once without exposing variables to callers. |
| Exporting a Cloud SQL private IP address to a child GKE deployment module safely | **Output Value (`output "db_ip" { value = ... }`)** | Exposes resource attributes generated after GCP provisioning to downstream modules. |

### When should I use it?
- Essential HCL language feature for parameterizing infrastructure code, validating inputs, enforcing naming standards, and exporting resource attributes.

### When should I NOT use it?
- Do not create input variables for internal computed values that external callers should never override (use `locals` instead).

---

## 16. Related Services

```text
                      [84. Variables]
                     /       |       \
        Terraform CLI   Cloud Storage   Secret Manager
        (Type Checking) (Remote State)  (Secret Inputs)
             |               |                |
        Validates Types  Stores Output    Injects Sensitive
        & Rules          Values           Variables
```

- **Terraform CLI**: Evaluates variable types, validation rules, and precedence.
- **Cloud Storage**: Stores exported output values inside remote state files.
- **Secret Manager**: Source for injecting sensitive credentials into Terraform variables.

---

## 17. Cheat Sheet

### Syntax Summary
- **Input**: `variable "env" { type = string, default = "dev" }`.
- **Local**: `locals { name = "${var.env}-vpc" }`.
- **Output**: `output "vpc_id" { value = google_compute_network.vpc.id }`.
- **Validation**: `validation { condition = ..., error_message = "..." }`.
- **Sensitive**: `sensitive = true`.

### Precedence Order (Lowest to Highest)
1. `default` in `variables.tf`
2. `TF_VAR_name` Environment Variables
3. `terraform.tfvars` File
4. `*.auto.tfvars` Files
5. `-var` Command Line Flags

---

## 18. Learning Connection

- **Previous Topic**: [83. Providers](../83-providers/README.md)
- **Next Topic**: [85. Modules](../85-modules/README.md)
