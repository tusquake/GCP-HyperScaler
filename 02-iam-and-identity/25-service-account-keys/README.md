# Topic 25: Service Account Keys

---

## 1. What Is It?

A **Service Account Key** is an unmanaged, long-lived RSA private key pair exported as an unencrypted JSON file that allows external systems to authenticate as a GCP Service Account.

While Service Account Keys allow applications running outside Google Cloud (such as legacy on-premises servers or external CI/CD platforms) to authenticate to GCP APIs, they represent one of the **single largest security vulnerabilities** in cloud engineering.

Because JSON key files contain long-lived static private credentials valid for up to 10 years by default, leaking a key file to a public GitHub repository or unencrypted laptop instantly exposes your GCP project to automated project takeover and crypto-mining abuse.

### Real-World Analogy
Think of a Service Account Key like a physical physical brass master key stamped with your company name, cut without an expiration date. If an employee loses the key on the street, drops it in a coffee shop, or leaves it on a public desk, anyone who picks it up can walk into your building and unlock your doors without needing an ID check or password.

---

## 2. Where Does It Fit?

Service Account Keys act as an external authentication entry point into Cloud IAM, bypassing Google's internal Metadata Server auth mechanisms.

```mermaid
flowchart TD
    ExternalApp["External Application / Legacy Server / Developer Laptop"]
    JSONKey["Service Account Private Key (JSON File / RSA Key Pair)"]
    
    subgraph GCPAuthEngine["GCP Authentication & IAM Engine"]
        OAuthExchange["JWT Cryptographic Signature Verification"]
        ShortLivedToken["Ephemeral Bearer Access Token (60 min)"]
        ServiceAccountIdentity["Service Account Identity (sa-app@proj.iam.gserviceaccount.com)"]
        IAMEvaluation["Cloud IAM Policy Evaluation"]
    end

    GCPResource["Target GCP Resource (Cloud Storage / BigQuery)"]

    ExternalApp -- Reads Private Key File --> JSONKey
    JSONKey -- Signs JWT Request --> OAuthExchange
    OAuthExchange --> ShortLivedToken
    ShortLivedToken --> ServiceAccountIdentity
    ServiceAccountIdentity --> IAMEvaluation
    IAMEvaluation --> GCPResource
```

---

## 3. Core Concepts

| Key Type | Managed By | Lifetime | Security Risk | Recommended Usage |
|---|---|---|---|
| **System-Managed Keys** | Google Cloud | 2 weeks (Automated rotation) | **ZERO RISK** (Keys never leave Google datacenters) | **DEFAULT STANDARD** (Used automatically by VMs, Cloud Run, GKE). |
| **User-Managed Keys** | Customer | Up to 10 years (Manual rotation) | **EXTREME CRITICAL RISK** (Long-lived static credentials exported as JSON). | **STRICTLY RESTRICTED / BANNED** (Replace with Workload Identity). |
| **Service Account Impersonation** | Customer / IAM | Short-lived (Max 1 hour) | **VERY LOW RISK** (No static key files exported). | Preferred alternative for local development and emergency access. |
| **Key Rotation** | Customer | Periodic (e.g., every 90 days) | High operational toil | Manual key rotation required if user-managed keys cannot be eliminated. |

---

## 4. How It Works

Authentication using a User-Managed JSON Key file uses asymmetric RSA cryptography:

```text
Application loads JSON Key file (private_key_id, private_key RSA string)
              ↓
Constructs JSON Web Token (JWT) signed with RSA Private Key
              ↓
Sends HTTPS POST request to https://oauth2.googleapis.com/token
              ↓
GCP OAuth2 server verifies JWT signature against Google's public key
              ↓
Returns short-lived OAuth2 Access Token (valid 60 mins)
              ↓
Application uses Access Token to call GCP APIs
```

1. **Static Risk**: Unlike passwords, JSON keys do not support built-in 2FA or interactive login challenges. Anyone possessing the private key string holds full identity rights.
2. **Unencrypted Format**: JSON keys are stored as plain text files containing raw RSA private keys (`-----BEGIN PRIVATE KEY-----`).

---

## 5. Production Scenario

### Key Remediation Pipeline: Moving to Keyless Workload Identity

```text
Requirement: Eliminate 50 legacy Service Account JSON keys used by GitHub Actions CI/CD pipelines.
    ↓
Step 1 (Policy Enforcement): Enable Organization Policy `constraints/iam.disableServiceAccountKeyCreation` at Org Root.
    ↓
Step 2 (Federation): Configure **Workload Identity Federation** between GitHub Actions (OIDC) and GCP.
    ↓
Step 3 (Pipeline Refactor): Update GitHub Actions workflow to use `google-github-actions/auth` with OIDC tokens.
    ↓
Step 4 (Revocation): Delete all existing user-managed JSON keys using `gcloud iam service-accounts keys delete`.
    ↓
Monitoring: Security Command Center verifying zero user-managed service account keys exist in the enterprise.
```

*Why Selected*: Shifting from static JSON keys to Workload Identity Federation replaces 10-year static credentials with ephemeral 60-minute OIDC tokens, eliminating key leakage risks completely.

---

## 6. Hands-On Lab

### Prerequisites
- Active GCP Project.
- Cloud Shell or `gcloud` CLI.
- IAM permissions: `roles/iam.serviceAccountKeyAdmin`.

### Console Method
1. Log into [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **IAM & Admin** → **Service Accounts**.
3. Select a test Service Account → Click **KEYS** tab at top.
4. Click **ADD KEY** → Select **Create new key**.
5. Key type: **JSON** → Click **CREATE**.
6. Observe the automatic browser download of the plain-text `.json` key file.
7. Open the downloaded file in a text editor → Inspect `private_key` and `private_key_id` fields.
8. Return to Console → Click **DELETE** next to the created key to revoke it immediately.

### CLI Method
Audit, create, and delete Service Account keys using `gcloud`:

```bash
# Set variables
PROJECT_ID="your-gcp-project-id"
SA_EMAIL="sa-demo@${PROJECT_ID}.iam.gserviceaccount.com"

# 1. Create a service account
gcloud iam service-accounts create sa-demo --display-name="Demo Key SA"

# 2. List all existing keys for a service account (Observe SYSTEM vs USER managed)
gcloud iam service-accounts keys list --iam-account=$SA_EMAIL

# 3. Export a User-Managed JSON Key file (DANGEROUS IN PRODUCTION)
gcloud iam service-accounts keys create ~/demo-key.json \
    --iam-account=$SA_EMAIL

# 4. Extract Key ID and delete the user-managed key immediately
KEY_ID=$(gcloud iam service-accounts keys list --iam-account=$SA_EMAIL --filter="keyType:USER_MANAGED" --format="value(name)" | head -n 1)
gcloud iam service-accounts keys delete $KEY_ID --iam-account=$SA_EMAIL --quiet

# 5. Clean up key file locally
rm ~/demo-key.json
```

### Verification
*Expected Result*: Querying `gcloud iam service-accounts keys list` confirms zero `USER_MANAGED` keys remain attached to the service account.

---

## 7. Security

### Top Service Account Key Security Risks
- **GitHub Key Leaks**: Public GitHub repos are continuously scraped by automated hacker bots that steal leaked JSON keys in less than 60 seconds.
- **No Inherent Expiration**: Default JSON keys do not expire until the year 9999 unless explicitly configured with an expiration date.
- **No IP Restriction**: JSON keys can be used from any IP address worldwide unless blocked by VPC Service Controls.

```text
BAD PRACTICE:
Creating JSON key files for developers to run local scripts, storing keys on unencrypted laptops, or committing keys to Git.
Risk: Key leakage leads to immediate automated project compromise and crypto-mining charges.

PRODUCTION PRACTICE:
Banish JSON keys completely. Use `gcloud auth application-default login` for local dev; use Workload Identity for GKE/CI-CD.
```

---

## 8. Scaling & High Availability

Key Governance Transition Model:

```text
Unmanaged JSON Key Files (High vulnerability risk - Manual 90-day rotation required)
   ↓ (Enforce Org Policy Restrictions)
`constraints/iam.disableServiceAccountKeyCreation` (Blocks new key creation across all projects)
   ↓ (Modern Keyless Infrastructure)
Workload Identity Federation (AWS / Azure / GitHub OIDC) + Metadata Servers (GCP VMs / Cloud Run)
```

- **Zero-Key Architecture**: Modern cloud-native architectures aim for 100% Zero-Key infrastructure, replacing all static credentials with short-lived federated OIDC tokens.

---

## 9. Cost

### The Financial Cost of Leaked Keys
- **Crypto-Mining Abuse**: Compromised service account keys holding `Editor` or `Compute Admin` roles are used by attackers to launch hundreds of GPU/CPU instances, generating $10,000+ in unauthorized billable charges within hours.
- **Key Elimination is Free**: Disabling key creation costs $0 and eliminates the engineering labor of manual 90-day key rotation pipelines.

---

## 10. Monitoring & Troubleshooting

### Key Security Observability Tools
- **Security Command Center (SCC)**: Automatically flags active user-managed service account keys as high-risk security findings.
- **Key Age Metrics**: Track `iam.googleapis.com/service_account/key/age` in Cloud Monitoring.

### Troubleshooting Matrix

| Symptom | Possible Cause | What to Check | Fix |
|---|---|---|---|
| `Key creation is disabled` error | Organization Policy `constraints/iam.disableServiceAccountKeyCreation` active | `gcloud org-policies describe` | Use keyless Workload Identity Federation instead of downloading key files. |
| Application fails with `Invalid JWT Signature` | Service Account Key was deleted or revoked in GCP | Console Service Account Keys tab | Generate new short-lived credentials or migrate code to Application Default Credentials (ADC). |
| GitHub alerts: "Secret scanning detected GCP key" | JSON key committed to git repository | GitHub Security tab | Revoke/delete key in GCP immediately via `gcloud iam service-accounts keys delete`. |

---

## 11. Common Mistakes

```text
Mistake: Downloading a Service Account JSON key file for local Python script testing instead of using ADC.
Why: Unaware that `gcloud auth application-default login` provides secure local credentials.
Impact: Leaving static key files vulnerable on local developer disk drives.
Correct approach: Run `gcloud auth application-default login` locally; eliminate JSON key files.

Mistake: Revoking a key without auditing which external legacy servers are actively using it.
Why: Attempting fast key cleanup without checking Cloud Audit Logs.
Impact: Sudden outage for legacy on-premises applications relying on the static key.
Correct approach: Audit `protoPayload.authenticationInfo.serviceAccountKeyName` in Cloud Logging before deleting keys.
```

---

## 12. Production Best Practices

- [ ] Enforce Organization Policy `constraints/iam.disableServiceAccountKeyCreation` at the Org Root.
- [ ] Eliminate all user-managed Service Account JSON keys from production systems.
- [ ] Use **Workload Identity Federation** for external CI/CD pipelines (GitHub Actions, GitLab, AWS).
- [ ] Use `gcloud auth application-default login` for local developer workstation testing.
- [ ] Revoke leaked keys immediately upon detection using automated GitHub Secret Scanning webhooks.
- [ ] If keys are unavoidable, enforce strict 90-day automated key rotation pipelines.

---

## 13. Hyperscaler / Enterprise Perspective

```text
Personal / Learning
  Manual JSON key download → Key saved on desktop → No key rotation
        ↓
Small Production
  JSON keys used in CI/CD → Manual 90-day key rotation script
        ↓
Enterprise Environment
  `constraints/iam.disableServiceAccountKeyCreation` active → Key Exemption Approval Process → Workload Identity Migration
        ↓
Hyperscaler Environment
  Zero Static Keys Allowed → 100% Keyless Workload Identity Federation → Real-time Automated Key Revocation Bots
```

In a hyperscaler environment, static Service Account JSON keys are treated as critical security policy violations. Enterprise landing zones enforce strict Organization Policies blocking key creation. CI/CD pipelines and external multi-cloud workloads authenticate keylessly using OpenID Connect (OIDC) Workload Identity Federation, guaranteeing zero static credentials exist anywhere in source code or production systems.

---

## 14. Real Project Questions

### Q1: Why are User-Managed Service Account JSON Keys considered a critical security hazard in cloud engineering?
**Answer:** User-Managed JSON Keys contain static, unencrypted RSA private keys valid for up to 10 years by default. They do not support 2-Step Verification or interactive authentication. If leaked to public repositories, unencrypted laptops, or build logs, malicious bots instantly scrape the keys and use them to compromise projects, steal data, or launch massive unauthorized crypto-mining workloads.

### Q2: What is the difference between System-Managed Keys and User-Managed Keys in GCP?
**Answer:** System-Managed Keys are created, stored, and automatically rotated by Google Cloud every two weeks. They never leave Google datacenters and are used internally by Compute Engine VMs, Cloud Run, and GKE. User-Managed Keys are exported as JSON files to customer systems, requiring manual customer rotation and carrying high leakage risks.

### Q3: What is the recommended alternative to downloading JSON keys for an external GitHub Actions pipeline?
**Answer:** The recommended alternative is **Workload Identity Federation**. GitHub Actions generates a short-lived OpenID Connect (OIDC) token for the build job. GCP federates with GitHub's OIDC issuer, validates the build token, and exchanges it for a short-lived 60-minute GCP access token, allowing keyless deployment without static credentials.

---

## 15. Quick Decision Guide

| Requirement | Recommended Approach | Reason |
|---|---|---|
| Authenticating a Python app running locally on a developer laptop | **`gcloud auth application-default login`** | Uses local ADC credentials; zero static JSON key files required. |
| Authenticating a GitHub Actions CI/CD deployment pipeline | **Workload Identity Federation (OIDC)** | Keyless authentication using short-lived 60-minute federated tokens. |
| Legacy on-premises server that cannot support OIDC or gcloud | **Service Account Key with 90-day Automated Rotation** | Use keys ONLY as a last resort when keyless alternatives are technically impossible. |

### When should I use it?
- Avoid user-managed JSON keys whenever possible—use keyless Workload Identity mechanisms.

### When should I NOT use it?
- Never use JSON key files for internal GCP workloads (VMs, Cloud Run, GKE) or developer laptops.

---

## 16. Related Services

```text
             [25. Service Account Keys]
              /           |           \
     Workload Identity  Org Policy   Cloud KMS
        Federation    (Disable Keys) (Key Management)
            |             |              |
      Keyless Auth   Hard Block      Customer Keys
```

- **Workload Identity Federation**: Keyless OIDC authentication replacing JSON key files.
- **Organization Policy Service**: Blocks user-managed key creation via constraints.
- **Security Command Center (SCC)**: Scans for active user-managed keys across projects.

---

## 17. Cheat Sheet

### Dangers of JSON Keys
- Static credentials valid for 10 years.
- Plain-text RSA private key string.
- Scraped by GitHub hacker bots in <60 seconds.

### Useful Commands
```bash
# List keys for a service account
gcloud iam service-accounts keys list --iam-account=SA_EMAIL

# Create a user-managed key (AVOID IN PRODUCTION)
gcloud iam service-accounts keys create ~/key.json --iam-account=SA_EMAIL

# Delete a service account key
gcloud iam service-accounts keys delete KEY_ID --iam-account=SA_EMAIL
```

---

## 18. Learning Connection

- **Previous Topic**: [24. Organization Policies](../24-organization-policies/README.md)
- **Next Topic**: [26. Workload Identity](../26-workload-identity/README.md)
