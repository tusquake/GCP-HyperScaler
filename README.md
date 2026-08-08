# GCP Hyperscaler Learning Roadmap

Welcome to the **GCP Hyperscaler Learning Curriculum**. This repository contains a structured, end-to-end learning path designed to take engineers from fundamental concepts to enterprise hyperscaler production readiness on Google Cloud Platform (GCP).

---

## Learning Progression

```text
GCP Fundamentals
        ↓
IAM & Identity
        ↓
Networking / VPC
        ↓
Compute / Virtual Machines
        ↓
Storage & Databases
        ↓
Containers & Kubernetes (GKE)
        ↓
Serverless & Event-Driven Architecture
        ↓
Infrastructure as Code (Terraform)
        ↓
CI/CD Pipelines
        ↓
Observability & Telemetry
        ↓
Enterprise Security & Governance
        ↓
Cost Management & FinOps
        ↓
Data & Analytics
        ↓
Reliability Engineering (SRE)
```

---

## Curriculum Table of Contents

### 1. GCP Fundamentals
- [01. Setup Free Account](file:///e:/GCP%20Hyperscaler/01-gcp-fundamentals/01-setup-free-account/README.md)
- 02. What is GCP
- 03. Why GCP is Used
- 04. Cloud Computing Fundamentals
- 05. Global Infrastructure
- 06. Regions & Zones
- 07. Projects
- 08. Resource Hierarchy
- 09. Billing Accounts
- 10. Cloud Console
- 11. Cloud Shell
- 12. gcloud CLI
- 13. Google Cloud SDK
- 14. Shared Responsibility Model
- 15. Quotas & Limits

### 2. IAM & Identity
- 16. IAM Fundamentals
- 17. Users
- 18. Groups
- 19. Service Accounts
- 20. Basic Roles
- 21. Predefined Roles
- 22. Custom Roles
- 23. IAM Policies
- 24. Organization Policies
- 25. Service Account Keys
- 26. Workload Identity

### 3. Networking / VPC
- 27. VPC
- 28. Subnets
- 29. Routes
- 30. Firewall Rules
- 31. Cloud DNS
- 32. Cloud Router
- 33. Cloud NAT
- 34. Load Balancing
- 35. VPC Peering
- 36. Shared VPC
- 37. Private Service Connect

### 4. Compute / Virtual Machines
- 38. Virtual Machines
- 39. Machine Types
- 40. Persistent Disks
- 41. Snapshots
- 42. Instance Templates
- 43. Managed Instance Groups
- 44. Autoscaling
- 45. Load Balancers

### 5. Storage & Databases
- 46. Cloud Storage
- 47. Buckets
- 48. Objects
- 49. Storage Classes
- 50. Lifecycle Policies
- 51. Versioning
- 52. Encryption
- 53. Cloud SQL
- 54. Firestore
- 55. Bigtable
- 56. Spanner
- 57. Memorystore

### 6. Containers & Kubernetes
- 58. Container Fundamentals
- 59. Artifact Registry
- 60. GKE Overview
- 61. Cluster Architecture
- 62. GKE Cluster Types
- 63. Autopilot vs Standard
- 64. Node Pools
- 65. Workloads
- 66. Services
- 67. Ingress
- 68. ConfigMaps
- 69. Secrets
- 70. GKE Networking
- 71. GKE Storage
- 72. GKE Security
- 73. Autoscaling
- 74. Multi-cluster GKE

### 7. Serverless & Event-Driven Architecture
- 75. Cloud Run
- 76. Cloud Functions
- 77. Cloud Scheduler
- 78. Pub/Sub Integration
- 79. Eventarc
- 80. API Gateway
- 81. Event-Driven Architectures

### 8. Infrastructure as Code
- 82. Terraform on GCP
- 83. Providers
- 84. Variables
- 85. Modules
- 86. State Management
- 87. Remote Backend

### 9. CI/CD
- 88. CI/CD Concepts
- 89. Cloud Build
- 90. Artifact Registry Integration
- 91. Deploy to Cloud Run
- 92. Deploy to GKE

### 10. Observability
- 93. Cloud Monitoring
- 94. Cloud Logging
- 95. Metrics Explorer
- 96. Dashboards
- 97. Alerting Policies
- 98. Uptime Checks
- 99. Cloud Trace
- 100. Cloud Profiler
- 101. OpenTelemetry

### 11. Security
- 102. Secret Manager
- 103. Cloud KMS
- 104. Security Command Center
- 105. Certificate Manager
- 106. Cloud Armor
- 107. Identity-Aware Proxy (IAP)
- 108. Binary Authorization

### 12. Cost Management
- 109. Billing Reports
- 110. Budgets & Alerts
- 111. Cost Optimization Techniques
- 112. Rightsizing Resources

### 13. Data & Analytics
- 113. BigQuery
- 114. Pub/Sub
- 115. Dataflow
- 116. Dataproc

### 14. Reliability Engineering
- 117. SLI
- 118. SLO
- 119. SLA
- 120. Error Budgets
- 121. Incident Management
- 122. Disaster Recovery
- 123. Chaos Engineering

---

## Repository Standard Guidelines

Each topic module contains a dedicated `README.md` engineered to deliver:
- **Beginner clarity** with practical production-level depth.
- **Visual flowcharts and architecture diagrams** using standard Mermaid syntax.
- **Actionable hands-on console and `gcloud` CLI workflows** with safety verification and cleanup.
- **Production security, FinOps budget guardrails, and enterprise hyperscaler context**.
- **Tech Lead interview Q&As** and quick decision matrix guides.
