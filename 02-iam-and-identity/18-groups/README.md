# Topic 18: Groups

---

## 1. What Is It?

In Google Cloud IAM, a **Group** (Google Group) is a named collection of user accounts and service accounts managed inside Google Workspace or Cloud Identity (`group:group-name@company.com`).

**Group-Based Access Control (GBAC)** is the fundamental best practice for enterprise IAM management in GCP. Instead of binding IAM roles directly to individual user accounts (`user:alice@company.com`), security administrators grant IAM roles to Google Groups. Individual users inherit all cloud permissions automatically by being added to the appropriate group.

### Real-World Analogy
Think of a Google Group like a job title badge assigned to a department, such as "Finance Team". When a new employee joins the department, HR simply adds them to the "Finance Team" group. They instantly gain access to the finance filing cabinets and software tools. When they transfer to Marketing, HR removes them from the Finance group, revoking all finance access in a single step without needing to reconfigure individual locks.

---

## 2. Where Does It Fit?

Google Groups sit inside Cloud Identity or Google Workspace, acting as the primary abstraction layer between enterprise identity management and GCP IAM resource role bindings.

```mermaid
flowchart TD
    subgraph UsersTier["Enterprise Identities"]
        UserAlice["User: Alice (Backend Dev)"]
        UserBob["User: Bob (Backend Dev)"]
        UserCharlie["User: Charlie (Security Admin)"]
    end

    subgraph GroupsTier["Google Workspace / Cloud Identity Groups"]
        GroupDevs["Group: gcp-backend-devs@company.com"]
        GroupSec["Group: gcp-security-admins@company.com"]
    end

    subgraph GCPIAM["GCP Resource Hierarchy IAM Bindings"]
        RoleDev["Predefined Role: Compute Instance Admin"]
        RoleSec["Predefined Role: Security Admin"]
        ProjA["Project: Production Backend"]
        ProjB["Organization Root Node"]
    end

    UserAlice --> GroupDevs
    UserBob --> GroupDevs
    UserCharlie --> GroupSec
    GroupDevs -- Bound to -- RoleDev
    RoleDev -- Applied to -- ProjA
    GroupSec -- Bound to -- RoleSec
    RoleSec -- Applied to -- ProjB
```

---

## 3. Core Concepts

| Group Pattern | Group Email Example | Assigned IAM Roles | Member Accounts |
|---|---|---|---|
| **Job-Function Group** | `gcp-network-admins@company.com` | `roles/compute.networkAdmin`, `roles/dns.admin` | Network Infrastructure Engineers |
| **Environment Group** | `gcp-dev-environment-users@company.com` | `roles/editor` (in Dev Projects only) | All Software Developers & QA Testers |
| **Security Operations** | `gcp-secops-auditors@company.com` | `roles/securityCenter.admin`, `roles/logging.viewer` | Security Operations Center (SOC) Team |
| **Break-Glass Emergency** | `gcp-emergency-breakglass@company.com` | `roles/owner` (Bound via IAM Condition) | Senior Cloud Architects (Requires JIT Approval) |

---

## 4. How It Works

IAM permission resolution evaluates group memberships dynamically at request execution time:

```text
User executes gcloud command (Principal: alice@company.com)
              ↓
GCP IAM Engine queries Cloud Identity for group memberships of alice@company.com
              ↓
Cloud Identity returns: Member of [gcp-backend-devs@company.com, all-employees@company.com]
              ↓
IAM Engine retrieves all IAM policies bound to group:gcp-backend-devs@company.com
              ↓
Inherited Roles evaluated across Org -> Folder -> Project hierarchy
              ↓
Request Allowed or Denied based on collective group permissions
```

1. **Dynamic Membership**: Adding a user to a group in Cloud Identity or Active Directory grants them the group's GCP IAM permissions within seconds.
2. **Policy Stability**: Project IAM policies remain static and unchanged when team members join or leave the company.

---

## 5. Production Scenario

### Enterprise Group-Based Access Control (GBAC) Framework

```text
Requirement: Manage cloud access for 2,000 engineers across 300 projects without administrative policy drift.
    ↓
Architecture: Define standardized Google Groups in Cloud Identity mapped to Job Roles and Environments.
    ↓
Configuration:
  - `gcp-devs-frontend@company.com` bound to `roles/run.developer` on Frontend Projects.
  - `gcp-data-engineers@company.com` bound to `roles/bigquery.admin` on Data Projects.
    ↓
Security: Zero direct user email IAM bindings allowed (`constraints/iam.allowedPolicyMemberDomains` enforced).
    ↓
Scaling: Automated Directory Sync (GCDS / SCIM) updates group memberships when HR updates employee department records.
    ↓
Monitoring: Security Command Center scanning for direct `user:` IAM bindings in project policies.
```

*Why Selected*: Group-based access control scales linearly without increasing IAM policy complexity, policy size limit risks, or manual administration overhead.

---

## 6. Hands-On Lab

### Prerequisites
- Active GCP Project.
- Access to Cloud Shell or `gcloud` CLI.
- Google Workspace or Cloud Identity group (e.g., `gcp-developers@yourdomain.com`).
- IAM permissions: `roles/resourcemanager.projectIamAdmin`.

### Console Method
1. Log into [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **IAM & Admin** → **IAM**.
3. Click **GRANT ACCESS** at the top.
4. Under **New principals**, enter the group email address (e.g., `gcp-developers@yourdomain.com`).
5. Select a Predefined Role: `Compute Instance Admin (v1)` (`roles/compute.instanceAdmin.v1`).
6. Click **+ ADD ANOTHER ROLE** → Select `Storage Object Viewer` (`roles/storage.objectViewer`).
7. Click **SAVE**.
8. Filter the IAM table by Principal: `gcp-developers@` to observe the group role binding.

### CLI Method
Bind IAM roles to a Google Group using `gcloud`:

```bash
# Set project and group variables
PROJECT_ID="your-gcp-project-id"
GROUP_EMAIL="group:gcp-developers@yourdomain.com"

# 1. Add a predefined role binding to a Google Group
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member=$GROUP_EMAIL \
    --role="roles/compute.viewer"

# 2. Query IAM policy to verify group role assignment
gcloud projects get-iam-policy $PROJECT_ID \
    --flatten="bindings[].members" \
    --format="table(bindings.role)" \
    --filter="bindings.members:$GROUP_EMAIL"

# 3. Remove the role binding
gcloud projects remove-iam-policy-binding $PROJECT_ID \
    --member=$GROUP_EMAIL \
    --role="roles/compute.viewer"
```

### Verification
*Expected Result*: The CLI returns the updated IAM policy showing `group:gcp-developers@yourdomain.com` bound to `roles/compute.viewer`.

### Cleanup
Remove test group role bindings using CLI command #3.

---

## 7. Security

### Principles of Group Access Security
- **Strictly Ban Direct User Bindings**: Enforce an internal policy requiring all human access to be granted through Google Groups (`group:` prefix).
- **Group Audit Logging**: Enable Group Audit Logs in `admin.google.com` to track who adds or removes members from administrative Google Groups.
- **Nested Groups Caution**: While Google Groups support nesting (Group A inside Group B), keep nesting depth to a maximum of 2 levels to prevent hidden privilege escalation.

```text
BAD PRACTICE:
Adding individual user emails (`user:alice@company.com`, `user:bob@company.com`) directly to IAM policies across 50 projects.
Risk: When Bob leaves the company, his direct role bindings remain active across projects, creating security vulnerabilities.

PRODUCTION PRACTICE:
Bind IAM roles exclusively to Google Groups (`group:gcp-backend-devs@company.com`). Manage user memberships centrally in Cloud Identity / Active Directory.
```

---

## 8. Scaling & High Availability

Group Scaling and Policy Limits:

```text
Direct User Role Assignments (Fails at scale - 20 KB IAM Policy limit per resource)
   ↓ (Transition to Group-Based IAM)
Google Group Abstraction (Scales to 100,000s of users - 1 Group entry in IAM policy)
   ↓ (Automated Access Governance)
SCIM / GCDS Automated Group Sync from Enterprise Identity Provider (Okta / Entra ID)
```

- **IAM Policy Size Ceiling**: A single GCP resource policy has a maximum size cap of **20 KB**. Using Google Groups condenses hundreds of user permissions into a single `group:` string entry in the JSON policy.

---

## 9. Cost

### Group Management Costs
- **100% Free Core Service**: Google Groups and Cloud IAM Group bindings are provided completely free of charge in both Cloud Identity Free and Google Workspace editions.
- **Operational Cost Savings**: Saves hundreds of administrative engineering hours annually by eliminating manual project-by-project permission updates.

---

## 10. Monitoring & Troubleshooting

### Group Observability Tools
- **Cloud Identity Groups Audit Logs**: Tracks group creation, member additions, and member removals in `admin.google.com`.
- **Policy Analyzer**: Query effective permissions for a user by expanding their inherited group memberships.

### Troubleshooting Matrix

| Symptom | Possible Cause | What to Check | Fix |
|---|---|---|---|
| User in group cannot access GCP resource | IAM policy propagation delay or user added to wrong group email | `gcloud asset analyze-iam-policy` | Verify exact group email spelling and wait 60s for policy sync. |
| User retains access after leaving department | User account still listed as a member inside the Google Group | Group membership list in `admin.google.com` | Remove user from the Google Group or run GCDS sync. |
| `Group email not found` error during IAM binding | Group does not exist in Cloud Identity or typo in domain name | Cloud Identity Groups directory | Create the group in `admin.google.com` before applying IAM binding. |

---

## 11. Common Mistakes

```text
Mistake: Creating Google Groups directly inside GCP Console instead of central Identity Provider / Cloud Identity.
Why: Misunderstanding that Google Groups are identity objects, not GCP project objects.
Impact: Fragmented group definitions that cannot be reused across other projects or services.
Correct approach: Create and manage Google Groups centrally in `admin.google.com` or sync them from Active Directory / Okta.

Mistake: Assigning basic primitive roles (`roles/editor`) to large company-wide groups like `all-employees@company.com`.
Why: Attempting to grant broad read/write access quickly.
Impact: Massive security breach risk; every employee gets write access to production cloud infrastructure.
Correct approach: Create role-specific groups (`gcp-devs-frontend@company.com`) and assign scoped predefined roles.
```

---

## 12. Production Best Practices

- [ ] Adopt Group-Based Access Control (GBAC) for 100% of human IAM role assignments.
- [ ] Maintain a standardized naming convention for GCP Google Groups (e.g., `gcp-[project/env]-[role]@domain.com`).
- [ ] Sync Google Group memberships automatically from your primary Identity Provider (Okta / Entra ID).
- [ ] Audit group membership changes regularly using Cloud Identity Audit Logs.
- [ ] Avoid nesting Google Groups deeper than 2 levels to maintain clear policy visibility.
- [ ] Automate all Group IAM policy bindings using Infrastructure as Code (Terraform).

---

## 13. Hyperscaler / Enterprise Perspective

```text
Personal / Learning
  Direct user email role assignment → Manual ClickOps → No group structure
        ↓
Small Production
  Manual Google Group creation → Basic role assignments → Dev/Prod split
        ↓
Enterprise Environment
  Automated SCIM / GCDS Group Sync from Entra ID / Okta → Standardized Group Naming Convention → Zero Direct User Bindings
        ↓
Hyperscaler Environment
  Entitlement-Driven Access Governance → Automated Just-In-Time (JIT) Group Membership Escalation → Continuous Compliance Auditing via SCC
```

In a hyperscaler environment, developers never receive direct IAM role assignments. HR and Identity Governance platforms automatically manage group memberships. When an engineer requires elevated production access, a JIT approval tool temporarily adds them to an emergency Google Group for 4 hours, logging all activities for security compliance.

---

## 14. Real Project Questions

### Q1: Why is Group-Based Access Control (GBAC) considered mandatory for enterprise GCP environments?
**Answer:** GBAC decouples identity management from cloud permission management. Binding IAM roles to Google Groups instead of individual user accounts prevents IAM policy size limits (20 KB cap), avoids policy drift, simplifies onboarding/offboarding, and allows updating a single group membership to grant or revoke cloud access across hundreds of GCP projects instantly.

### Q2: What happens to a user's GCP access when they are removed from a Google Group in Cloud Identity?
**Answer:** When a user is removed from a Google Group in Cloud Identity (or via GCDS sync from Active Directory), Cloud IAM immediately stops recognizing that user as a member of the group. The user instantly loses all inherited IAM roles and permissions granted by that group across all GCP projects.

### Q3: How does using Google Groups prevent reaching the 20 KB IAM policy limit on GCP resources?
**Answer:** An IAM policy document stores principals as string entries in JSON. Listing 500 individual user email addresses (`user:alice@...`, `user:bob@...`) quickly exceeds the 20 KB policy size limit. Replacing 500 individual user entries with a single group entry (`group:engineering-team@company.com`) reduces policy size by 99% while serving the exact same access function.

---

## 15. Quick Decision Guide

| Requirement | Recommended Approach | Reason |
|---|---|---|
| Managing cloud access for 50 software developers across 20 projects | **Assign Predefined Roles to a Google Group (`gcp-devs@domain.com`)** | Single policy binding per project; user onboarding managed by adding members to the group. |
| Temporary break-glass administrative access for an on-call engineer | **JIT temporary addition to an Emergency Security Group** | Automatically revokes elevated access after on-call shift ends without touching project IAM policies. |
| Non-human microservice calling BigQuery | **Service Account (NOT a Google Group)** | Service accounts represent workload identities designed for automated API calls. |

### When should I use it?
- Mandatory practice for all human IAM access management in Google Cloud.

### When should I NOT use it?
- Do not use Google Groups for application-to-application service authentication—use Service Accounts instead.

---

## 16. Related Services

```text
                    [18. Groups]
                   /     |      \
          Cloud Identity IAM   Audit Logs
             (Groups)  Policies (Membership)
                |        |        |
             Okta/IdP   Roles   Admin Logs
```

- **Cloud Identity**: Creates and manages Google Workspace / Cloud Identity Groups.
- **Cloud IAM**: Binds IAM roles to `group:` principal identifiers.
- **Google Cloud Directory Sync (GCDS)**: Syncs Active Directory / LDAP groups to Cloud Identity.

---

## 17. Cheat Sheet

### Principal Format
- `group:group-name@yourdomain.com`

### Standard Group Naming Convention
- `gcp-[environment]-[job-function]@yourdomain.com`
- Example: `gcp-prod-network-admins@company.com`

### Useful Commands
```bash
# Add IAM role binding to a Google Group
gcloud projects add-iam-policy-binding PROJECT_ID \
    --member="group:gcp-devs@company.com" \
    --role="roles/viewer"

# View roles bound to a specific group
gcloud projects get-iam-policy PROJECT_ID \
    --flatten="bindings[].members" \
    --filter="bindings.members:group:gcp-devs@company.com"
```

---

## 18. Learning Connection

- **Previous Topic**: [17. Users](../17-users/README.md)
- **Next Topic**: [19. Service Accounts](../19-service-accounts/README.md)
