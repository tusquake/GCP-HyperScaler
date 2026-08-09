# Topic 107: Identity-Aware Proxy (IAP)

---

## 1. What Is It?

**Google Cloud Identity-Aware Proxy (IAP)** is a Zero-Trust access control service on Google Cloud Platform that intercepts incoming HTTP(S) requests and TCP connections, enforcing central user identity and context-aware device policies before granting access to web applications, administrative interfaces, and internal VMs without requiring a traditional Virtual Private Network (VPN).

Identity-Aware Proxy delivers four core Zero-Trust capabilities:
1. **Zero-Trust Identity Authentication**: Verifies user identity via Google Workspace, Cloud Identity, or external Identity Providers (OIDC/SAML) at the cloud perimeter instead of relying on network perimeter firewalls.
2. **Context-Aware Access Control**: Integrates with **BeyondCorp Enterprise** Access Context Manager to evaluate request context (user identity, device security posture, IP location, date/time) before granting access.
3. **TCP Tunneling for SSH/RDP**: Securely tunnels administrative SSH and RDP traffic to internal Compute Engine VMs that lack public IP addresses, eliminating bastion hosts and open SSH ports on the public internet.
4. **JWT Header Claims & App Security**: Transmits cryptographically signed JSON Web Tokens (JWT) containing verified user identity attributes (`x-goog-authenticated-user-email`) to backend applications.

### Real-World Analogy
Think of Identity-Aware Proxy like an elite corporate security desk at a headquarters entrance vs. a physical office key:
- **Traditional Network VPN**: Giving an employee a master key to the building's front door. Once inside the lobby (Connected to VPN), the employee can wander into every unlocked room, office, and server closet in the entire building.
- **Identity-Aware Proxy (Zero-Trust)**: Every room has an electronic security guard (IAP Guard). Before entering a specific office, the guard checks the employee's ID badge (Identity), verifies that their security clearance is active, confirms they are carrying a corporate-issued laptop (Device Context), and logs the entry (Cloud Audit Logs). The employee gets access *only* to that specific room, leaving the rest of the building completely isolated.

---

## 2. Where Does It Fit?

IAP sits at the Google Cloud edge network, interposing identity verification between external users and internal web or TCP endpoints.

```mermaid
flowchart TD
    subgraph RemoteUsers["Remote Workforce & Admins"]
        WebUser["Web Browser User"]
        SSHAdmin["SRE Administrator (gcloud ssh)"]
    end

    subgraph IAPPerimeterLayer["Google Cloud Perimeter Security"]
        HTTPSLB["Global External HTTP(S) Load Balancer"]
        IAPEngine["Identity-Aware Proxy (IAP) Service"]
        AccessContext["Access Context Manager (Context-Aware Policies)"]
    end

    subgraph InternalVPCNetwork["Private GCP VPC Network"]
        InternalWebApp["Internal Web App (App Engine / Cloud Run / GKE)"]
        PrivateVM["Private Compute Engine VM (No Public IP)"]
    end

    WebUser -- HTTPS Request --> HTTPSLB --> IAPEngine
    SSHAdmin -- gcloud compute ssh --tunnel-through-iap --> IAPEngine
    IAPEngine <--> AccessContext
    IAPEngine -- Validate IAM & Context --> InternalWebApp
    IAPEngine -- Forward TCP Stream (Port 22) --> PrivateVM
```

---

## 3. Core Concepts

| Concept | Description | Production Best Practice |
|---|---|---|
| **IAP Web App Access** | Secures HTTP(S) web applications behind Load Balancers or App Engine. | Grant `roles/iap.httpsResourceAccessor` to specific Google Groups, not `allAuthenticatedUsers`. |
| **IAP TCP Tunneling** | Routes SSH (port 22) and RDP (port 3389) traffic securely through IAP to private VMs. | Remove all public IP addresses from Compute Engine VMs and use IAP TCP tunneling. |
| **Signed Header (`x-goog-iap-jwt-assertion`)** | JWT header injected by IAP containing cryptographically signed user identity data. | Validate the JWT signature in backend applications to prevent header spoofing. |
| **Access Context Manager** | Engine defining context rules (device encryption, corporate OS, geo-location). | Enforce corporate device posture checks for sensitive administrative tools. |
| **IAP Web IAM Binding** | Policy binding mapping users/groups to the `IAP-secured Web App User` role. | Manage access via Google Workspace or Cloud Identity groups. |

---

## 4. How It Works

HTTP web access and TCP tunneling workflows follow deterministic security checks:

```text
1. User navigates to `https://internal-tool.company.com`
                               ↓
2. IAP intercepts request -> Redirects to Google Identity Login Page (OAuth2)
                               ↓
3. User authenticates -> IAP checks IAM bindings & Access Context Manager policies
                               ↓
4. Policy Passed -> IAP injects `x-goog-authenticated-user-email` & Signed JWT -> Forwards request
                               ↓
5. Policy Failed -> Displays "Access Denied HTTP 403" -> Event logged to Cloud Audit Logs
```

1. **SSH TCP Tunneling Protocol**: `gcloud compute ssh --tunnel-through-iap` wraps SSH packets inside HTTPS websockets transmitted to IAP endpoint `iap.googleapis.com`, which unwraps packets and forwards them to VM port 22.
2. **Zero Ingress Firewall Rules**: Internal VMs require only ONE ingress firewall rule: allow TCP port 22/3389 traffic originating from Google's IAP proxy IP range (`35.235.240.0/20`).

---

## 5. Production Scenario

### Zero-Trust Internal Web Tooling and Bastionless SSH Access

```text
Requirement: Secure an internal GKE administrative portal and eliminate public SSH exposure for 500 Compute Engine VMs without deploying or maintaining VPN servers.
    ↓
Architecture: Global HTTP(S) Load Balancer + IAP + Private VMs + GKE Workloads.
    ↓
Step 1: Remove all public IP addresses from Compute Engine VMs.
Step 2: Create VPC Firewall Rule allowing IAP proxy IP range:
    gcloud compute firewall-rules create allow-ingress-from-iap \
      --network=default \
      --allow=tcp:22 \
      --source-ranges=35.235.240.0/20
    ↓
Step 3: Enable IAP on Load Balancer Backend Service for Internal Web Portal:
    gcloud compute backend-services update internal-portal-backend \
      --iap=enabled,oauth2-client-id=ID,oauth2-client-secret=SECRET \
      --global
    ↓
Step 4: Grant SRE team IAM access:
    gcloud compute backend-services add-iam-policy-binding internal-portal-backend \
      --member="group:sre-team@company.com" \
      --role="roles/iap.httpsResourceAccessor" \
      --global
    ↓
Result: Zero-Trust web access protected by Google MFA, and SSH access achieved via `gcloud compute ssh vm-name --tunnel-through-iap` without public IPs or VPNs.
```

*Why Selected*: Illustrates standard enterprise Zero-Trust implementation replacing traditional VPNs and bastion hosts.

---

## 6. Hands-On Lab

### Prerequisites
- Active GCP Project with Compute Engine and IAP APIs enabled.
- Cloud Shell or local machine with `gcloud` CLI installed.

### CLI Method

```bash
# 1. Environment configuration
export PROJECT_ID=$(gcloud config get-value project)
export ZONE="us-central1-a"
export VM_NAME="private-iap-vm"

# 2. Enable IAP and Compute Engine APIs
gcloud services enable iap.googleapis.com compute.googleapis.com

# 3. Create a private Compute Engine VM (NO public IP)
gcloud compute instances create ${VM_NAME} \
  --zone=${ZONE} \
  --machine-type=e2-micro \
  --no-address \
  --metadata=startup-script="#!/bin/bash
sudo apt-get update && sudo apt-get install -y nginx"

# 4. Create Firewall Rule allowing IAP SSH ingress
gcloud compute firewall-rules create allow-ssh-from-iap \
  --network=default \
  --allow=tcp:22 \
  --source-ranges=35.235.240.0/20 \
  --description="Allow IAP TCP Tunneling for SSH"

# 5. SSH securely into the private VM using IAP TCP Tunneling
gcloud compute ssh ${VM_NAME} --zone=${ZONE} --tunnel-through-iap --command="hostname -I"
```

### Verification
Execute the `gcloud compute ssh --tunnel-through-iap` command above and verify it successfully connects and outputs the internal private IP address of the VM.

### Cleanup

```bash
gcloud compute instances delete ${VM_NAME} --zone=${ZONE} --quiet
gcloud compute firewall-rules delete allow-ssh-from-iap --quiet
```

---

## 7. Security

### Zero-Trust IAM & Application Security Controls
- **Validate JWT Assertions**: Backend web applications MUST validate the signature of the `x-goog-iap-jwt-assertion` HTTP header using Google's public keys (`https://www.gstatic.com/iap/verify/public_key`) to prevent attackers from bypassing IAP via direct internal IP access.
- **Disable Public SSH Ports**: Ensure firewall rules block `0.0.0.0/0` on port 22/3389, allowing ingress strictly from `35.235.240.0/20`.

```text
BAD PRACTICE:
Leaving SSH port 22 open to `0.0.0.0/0` on public VM instances or relying solely on internal network IP checks for app security.

PRODUCTION PRACTICE:
Remove all VM public IPs, enforce IAP TCP Tunneling (`35.235.240.0/20`), enable IAP on web services, and validate signed JWT headers in app code.
```

---

## 8. Scaling & High Availability

IAP proxy architecture and throughput scaling:

```text
Remote Workforce (Thousands of Concurrent Web & SSH Sessions)
                       ↓
Google Cloud Global Edge Infrastructure (Distributed IAP Enforcement Proxies)
                       ↓
Auto-Scales Horizontally Across Google Points of Presence Worldwide
                       ↓
Terminates OAuth TLS -> Forwards Clean Authenticated Traffic into VPC
```

- **No Single Point of Failure**: IAP runs as a distributed serverless Google edge proxy, eliminating bandwidth bottlenecks and single-point-of-failure risks associated with traditional enterprise VPN concentrator hardware.

---

## 9. Cost

### Identity-Aware Proxy Pricing Model

| Component | Standard IAP Feature | BeyondCorp Enterprise Tier |
|---|---|---|
| **IAP Web App Access & TCP Tunneling** | 100% FREE | Included free in standard GCP IAM |
| **Context-Aware Device Posture Rules** | Requires BeyondCorp Enterprise | Enterprise user monthly subscription fee |

---

## 10. Monitoring & Troubleshooting

### Operational Telemetry & Audit Logs
- **Cloud Audit Logs**: Filter `cloudaudit.googleapis.com` for `methodName="google.cloud.iap.v1.IdentityAwareProxyAdminService"` to audit IAM policy changes.
- **HTTP Error Codes**: HTTP 403 indicates valid Google authentication but missing `roles/iap.httpsResourceAccessor` IAM permission.

### Troubleshooting Matrix

| Symptom | Cause | Resolution |
|---|---|---|
| `gcloud compute ssh --tunnel-through-iap` hangs or times out | Firewall rule missing for `35.235.240.0/20` on TCP port 22 | Create ingress firewall rule allowing `35.235.240.0/20` on port 22. |
| HTTP 403 Forbidden on IAP-secured web app | User account lacks `IAP-secured Web App User` role | Add IAM binding: `roles/iap.httpsResourceAccessor` to target user or group. |
| Web app displays invalid user identity | App reading unverified plain text headers instead of signed JWT | Update app code to decode and verify `x-goog-iap-jwt-assertion`. |

---

## 11. Common Mistakes

```text
Mistake: Leaving public IP addresses attached to Compute Engine VMs when using IAP TCP Tunneling.
Why: Forgetting to set `--no-address` during instance creation.
Impact: Exposes the VM to direct internet port scanning and brute-force attacks, defeating the purpose of IAP.
Correct Approach: Create VMs with `--no-address` and route administrative access exclusively through IAP TCP Tunneling.

Mistake: Granting `roles/iap.httpsResourceAccessor` to `allAuthenticatedUsers`.
Why: Attempting to allow any Google account to log in.
Impact: Allows any personal `@gmail.com` account in the world to access internal corporate applications.
Correct Approach: Restrict IAP IAM roles strictly to specific Google Workspace corporate domain groups (e.g., `group:devs@company.com`).
```

---

## 12. Production Best Practices

- [ ] Remove public IP addresses from all internal Compute Engine VMs.
- [ ] Create a firewall rule allowing TCP 22/3389 strictly from **`35.235.240.0/20`**.
- [ ] Enable IAP on Load Balancer Backend Services for internal web tools.
- [ ] Restrict `roles/iap.httpsResourceAccessor` to specific **Google Workspace Groups**.
- [ ] Validate the **`x-goog-iap-jwt-assertion`** cryptographic signature in backend app code.
- [ ] Enforce **Multi-Factor Authentication (MFA)** on Cloud Identity user accounts.

---

## 13. Hyperscaler / Enterprise Perspective

```text
Personal / Learning
  Public IP VMs → Password SSH → Direct Port Exposure
        ↓
Small Production
  Private VMs → IAP TCP Tunneling → Basic IAM Web Access
        ↓
Enterprise Environment
  BeyondCorp Enterprise Integration → Context-Aware Device Posture Policies → JWT Signature Verification
        ↓
Hyperscaler Environment
  100% Zero-Trust Architecture → Legacy VPN Sunset → Continuous Device Health Evaluation & Automated Certificate Mutual Auth
```

Enterprise hyperscalers adopt **BeyondCorp Enterprise**, completely decommissioning legacy VPN infrastructure and enforcing context-aware rules that continuously evaluate disk encryption, OS patch level, and corporate domain join state before granting access to critical cloud resources.

---

## 14. Real Project Questions

### Q1: How does Identity-Aware Proxy allow SREs to SSH into a Compute Engine VM that has no public IP address?
**Answer:** IAP uses **TCP Tunneling**. The `gcloud compute ssh --tunnel-through-iap` command encapsulates SSH packets inside HTTPS websockets transmitted to Google's public IAP endpoint (`iap.googleapis.com`). IAP authenticates the user's IAM credentials and forwards the raw SSH stream privately across the Google network to the VM's internal IP address via port 22.

### Q2: Why is validating the `x-goog-iap-jwt-assertion` HTTP header necessary in backend microservice code?
**Answer:** The signed JWT header contains cryptographically verified user identity details (email, user ID) issued by Google. If a bad actor manages to bypass the load balancer and connect directly to the internal application IP, unverified plain-text headers (like `X-Forwarded-For`) can be spoofed. Validating the JWT cryptographic signature against Google's public keys guarantees the identity claim is authentic.

### Q3: What IP address range must be whitelisted in GCP VPC firewall rules to enable IAP TCP Tunneling?
**Answer:** **`35.235.240.0/20`**. This dedicated CIDR block contains all Google IAP proxy servers that forward TCP tunnel traffic (SSH/RDP) to internal Compute Engine instances.

---

## 15. Quick Decision Guide

| Access Requirement | Recommended Solution | Benefit |
|---|---|---|
| Admin SSH Access to Private VMs | IAP TCP Tunneling (`35.235.240.0/20`) | No public IPs or bastion hosts required. |
| Protecting Internal Corporate Web Tools | IAP Web App Access | Enforces Google Identity & MFA at cloud edge. |
| Device Security Posture Enforcement | BeyondCorp Enterprise Context-Aware Access | Restricts access to managed corporate laptops only. |

### When to Use Identity-Aware Proxy
- Mandatory for Zero-Trust remote access, bastionless SSH/RDP administration, and securing internal web tools on GCP.

### When NOT to Use Identity-Aware Proxy
- Completely open, public un-authenticated e-commerce websites (use Cloud Armor WAF instead).

---

## 16. Related Services

```text
               [107. Identity-Aware Proxy]
              /            |            \
    Cloud Identity    Global Load Balancer Access Context Manager
    (User MFA Auth)   (Web Ingress Proxy)  (Device Posture)
          |                |                     |
    Authenticates     Terminates OAuth2    Enforces Context
    User Credentials  & Injects JWT        Access Rules
```

- **Cloud Identity**: User identity and MFA authentication provider for IAP.
- **Global Load Balancer**: Ingress proxy terminating TLS and applying IAP rules.
- **Access Context Manager**: Rule engine defining context-aware device posture policies.

---

## 17. Cheat Sheet

### Common gcloud IAP Commands

```bash
# SSH into a private VM using IAP TCP Tunneling
gcloud compute ssh VM_NAME --zone=us-central1-a --tunnel-through-iap

# Tunnel RDP port 3389 to local port 3389 for Windows VMs
gcloud compute start-iap-tunnel VM_NAME 3389 --zone=us-central1-a --local-host-port=localhost:3389

# Create Firewall Rule allowing IAP ingress
gcloud compute firewall-rules create allow-iap-ssh --allow=tcp:22 --source-ranges=35.235.240.0/20

# Add IAP Web App User role to a backend service
gcloud compute backend-services add-iam-policy-binding BACKEND_SERVICE --member="group:devs@company.com" --role="roles/iap.httpsResourceAccessor" --global
```

---

## 18. Learning Connection

- **Previous Topic**: [106. Cloud Armor](../106-cloud-armor/README.md)
- **Next Topic**: [108. Binary Authorization](../108-binary-authorization/README.md)
