![GCP Hyperscaler Learning Hub](assets/gcp_learning_hub_banner.png)

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

## Curriculum Master Index

### 1. GCP Fundamentals
- **[01. Setup Free Account](01-gcp-fundamentals/01-setup-free-account/README.md)** - Setting up Google Cloud $300 free trial credit, Always Free tier guardrails, and billing safety.
- **[02. What is GCP](01-gcp-fundamentals/02-what-is-gcp/README.md)** - Overview of Google Cloud Platform, core cloud services, and global architecture.
- **[03. Why GCP is Used](01-gcp-fundamentals/03-why-gcp-is-used/README.md)** - Key differentiators, Google network backbone, data analytics strengths, and enterprise adoption.
- **[04. Cloud Computing Fundamentals](01-gcp-fundamentals/04-cloud-computing-fundamentals/README.md)** - Core concepts of IaaS, PaaS, SaaS, serverless, and cloud delivery models.
- **[05. Global Infrastructure](01-gcp-fundamentals/05-global-infrastructure/README.md)** - Google global network backbone, points of presence (PoP), and edge locations.
- **[06. Regions & Zones](01-gcp-fundamentals/06-regions-and-zones/README.md)** - Geographic region placement, multi-zone fault isolation, and latency considerations.
- **[07. Projects](01-gcp-fundamentals/07-projects/README.md)** - The core administrative and billing isolation unit for organizing GCP resources.
- **[08. Resource Hierarchy](01-gcp-fundamentals/08-resource-hierarchy/README.md)** - Organization, Folders, Projects, and Resources inheritance structure.
- **[09. Billing Accounts](01-gcp-fundamentals/09-billing-accounts/README.md)** - Managing cloud spend, payment profiles, credit structures, and invoice linkage.
- **[10. Cloud Console](01-gcp-fundamentals/10-cloud-console/README.md)** - Navigating the web UI interface for managing and monitoring GCP services.
- **[11. Cloud Shell](01-gcp-fundamentals/11-cloud-shell/README.md)** - In-browser command-line environment pre-configured with gcloud and dev tools.
- **[12. gcloud CLI](01-gcp-fundamentals/12-gcloud-cli/README.md)** - Command-line tool for controlling and automating GCP services.
- **[13. Google Cloud SDK](01-gcp-fundamentals/13-google-cloud-sdk/README.md)** - Installing, updating, and managing gcloud, gsutil, bq, and client libraries.
- **[14. Shared Responsibility Model](01-gcp-fundamentals/14-shared-responsibility-model/README.md)** - Division of security and operational duties between Google and the customer.
- **[15. Quotas & Limits](01-gcp-fundamentals/15-quotas-and-limits/README.md)** - Resource consumption ceilings, rate limits, and quota request procedures.

### 2. IAM & Identity
- **[16. IAM Fundamentals](02-iam-and-identity/16-iam-fundamentals/README.md)** - Core identity management, authentication, authorization, and least privilege principles.
- **[17. Users](02-iam-and-identity/17-users/README.md)** - Google Workspace and Cloud Identity user account governance.
- **[18. Groups](02-iam-and-identity/18-groups/README.md)** - Managing bulk permissions and access control using Google Groups.
- **[19. Service Accounts](02-iam-and-identity/19-service-accounts/README.md)** - Non-human identities for applications, workloads, and GCP service delegation.
- **[20. Basic Roles](02-iam-and-identity/20-basic-roles/README.md)** - Legacy primitive roles (Owner, Editor, Viewer) and why to avoid them in production.
- **[21. Predefined Roles](02-iam-and-identity/21-predefined-roles/README.md)** - Google-managed, fine-grained service-specific access roles.
- **[22. Custom Roles](02-iam-and-identity/22-custom-roles/README.md)** - Tailored permission sets created to enforce hyper-specific enterprise requirements.
- **[23. IAM Policies](02-iam-and-identity/23-iam-policies/README.md)** - Binding members, roles, and conditional rules to GCP resources.
- **[24. Organization Policies](02-iam-and-identity/24-organization-policies/README.md)** - Centralized governance guardrails and enterprise constraint rules across the hierarchy.
- **[25. Service Account Keys](02-iam-and-identity/25-service-account-keys/README.md)** - Long-lived JSON credentials, risks, rotators, and keyless alternatives.
- **[26. Workload Identity](02-iam-and-identity/26-workload-identity/README.md)** - Keyless authentication for external clouds (AWS/Azure) and Kubernetes workloads.

### 3. Networking / VPC
- **[27. VPC](03-networking-vpc/27-vpc/README.md)** - Virtual Private Cloud isolated virtual network infrastructure setup.
- **[28. Subnets](03-networking-vpc/28-subnets/README.md)** - Regional IP address ranges, custom mode vs auto mode subnetting.
- **[29. Routes](03-networking-vpc/29-routes/README.md)** - Network traffic routing rules, default internet gateways, and custom next-hops.
- **[30. Firewall Rules](03-networking-vpc/30-firewall-rules/README.md)** - Stateful ingress and egress filtering by IP, port, and network tags.
- **[31. Cloud DNS](03-networking-vpc/31-cloud-dns/README.md)** - High-performance, scalable managed DNS service for public and private zones.
- **[32. Cloud Router](03-networking-vpc/32-cloud-router/README.md)** - Dynamic BGP routing for VPN and Dedicated Interconnect connections.
- **[33. Cloud NAT](03-networking-vpc/33-cloud-nat/README.md)** - Managed Network Address Translation allowing outbound internet access for private VMs.
- **[34. Load Balancing](03-networking-vpc/34-load-balancing/README.md)** - Global and regional external/internal HTTP(S), TCP, and UDP load balancers.
- **[35. VPC Peering](03-networking-vpc/35-vpc-peering/README.md)** - Low-latency, private RFC1918 connectivity between independent VPC networks.
- **[36. Shared VPC](03-networking-vpc/36-shared-vpc/README.md)** - Centralized network management delegating subnets to application service projects.
- **[37. Private Service Connect](03-networking-vpc/37-private-service-connect/README.md)** - Private Endpoint connectivity to Google APIs and managed third-party services.

### 4. Compute / Virtual Machines
- **[38. Virtual Machines](04-compute-virtual-machines/38-virtual-machines/README.md)** - Compute Engine IaaS instances, configuration, and provisioning.
- **[39. Machine Types](04-compute-virtual-machines/39-machine-types/README.md)** - Selecting general-purpose, compute-optimized, memory-optimized, and GPU families.
- **[40. Persistent Disks](04-compute-virtual-machines/40-persistent-disks/README.md)** - Block storage options: Standard, Balanced, Performance SSD, and Extreme disks.
- **[41. Snapshots](04-compute-virtual-machines/41-snapshots/README.md)** - Point-in-time differential backups for disk recovery and instance duplication.
- **[42. Instance Templates](04-compute-virtual-machines/42-instance-templates/README.md)** - Reusable configuration blueprints for provisioning uniform VM instances.
- **[43. Managed Instance Groups](04-compute-virtual-machines/43-managed-instance-groups/README.md)** - Identical VM clusters providing high availability, auto-healing, and rolling updates.
- **[44. Autoscaling](04-compute-virtual-machines/44-autoscaling/README.md)** - Dynamically scaling VM group capacity based on CPU, load balancer utilization, or custom metrics.
- **[45. Load Balancers](04-compute-virtual-machines/45-load-balancers/README.md)** - Integrating Compute Engine instances with global external and internal load balancing tiers.

### 5. Storage & Databases
- **[46. Cloud Storage](05-storage-and-databases/46-cloud-storage/README.md)** - Unified object storage service for unstructured data and media assets.
- **[47. Buckets](05-storage-and-databases/47-buckets/README.md)** - Storage containers, naming rules, regional/multi-regional placement, and access control.
- **[48. Objects](05-storage-and-databases/48-objects/README.md)** - Uploading, downloading, metadata management, and immutable storage objects.
- **[49. Storage Classes](05-storage-and-databases/49-storage-classes/README.md)** - Standard, Nearline, Coldline, and Archive cost-tier trade-offs.
- **[50. Lifecycle Policies](05-storage-and-databases/50-lifecycle-policies/README.md)** - Automated rules for transitioning object storage classes or deleting aged data.
- **[51. Versioning](05-storage-and-databases/51-versioning/README.md)** - Object state history retention for accidental deletion protection.
- **[52. Encryption](05-storage-and-databases/52-encryption/README.md)** - Default Google-managed keys, CMEK (KMS), and CSEK encryption standards.
- **[53. Cloud SQL](05-storage-and-databases/53-cloud-sql/README.md)** - Managed relational database engine supporting PostgreSQL, MySQL, and SQL Server.
- **[54. Firestore](05-storage-and-databases/54-firestore/README.md)** - Scalable, serverless NoSQL document database with real-time sync capabilities.
- **[55. Bigtable](05-storage-and-databases/55-bigtable/README.md)** - Ultra-low latency, high-throughput NoSQL wide-column database for massive analytical workloads.
- **[56. Spanner](05-storage-and-databases/56-spanner/README.md)** - Global, strongly consistent relational database with enterprise horizontal scalability.
- **[57. Memorystore](05-storage-and-databases/57-memorystore/README.md)** - Fully managed in-memory Redis and Memcached service for high-speed caching.

### 6. Containers & Kubernetes
- **[58. Container Fundamentals](06-containers-and-kubernetes/58-container-fundamentals/README.md)** - Docker containerization basics, images, layering, and container runtimes.
- **[59. Artifact Registry](06-containers-and-kubernetes/59-artifact-registry/README.md)** - Enterprise repository for storing and managing container images and language packages.
- **[60. GKE Overview](06-containers-and-kubernetes/60-gke-overview/README.md)** - Managed Kubernetes Engine for deploying, scaling, and operating containerized apps.
- **[61. Cluster Architecture](06-containers-and-kubernetes/61-cluster-architecture/README.md)** - Kubernetes control plane, worker nodes, kubelet, and etcd operations.
- **[62. GKE Cluster Types](06-containers-and-kubernetes/62-gke-cluster-types/README.md)** - Zonal vs regional clusters and control plane redundancy models.
- **[63. Autopilot vs Standard](06-containers-and-kubernetes/63-autopilot-vs-standard/README.md)** - Hands-off serverless Kubernetes management vs full node control.
- **[64. Node Pools](06-containers-and-kubernetes/64-node-pools/README.md)** - Custom machine configurations, spot instances, and heterogeneous worker pools.
- **[65. Workloads](06-containers-and-kubernetes/65-workloads/README.md)** - Kubernetes Pods, Deployments, StatefulSets, DaemonSets, and Jobs.
- **[66. Services](06-containers-and-kubernetes/66-services/README.md)** - Internal ClusterIP, NodePort, and LoadBalancer networking abstractions.
- **[67. Ingress](06-containers-and-kubernetes/67-ingress/README.md)** - Managed GKE Ingress controllers routing HTTP(S) traffic to Kubernetes services.
- **[68. ConfigMaps](06-containers-and-kubernetes/68-configmaps/README.md)** - Decoupling non-sensitive environment configuration from container image code.
- **[69. Secrets](06-containers-and-kubernetes/69-secrets/README.md)** - Injecting sensitive credentials and keys into pods safely at runtime.
- **[70. GKE Networking](06-containers-and-kubernetes/70-gke-networking/README.md)** - VPC-native clusters, Pod IP ranges, Alias IPs, and Network Policies.
- **[71. GKE Storage](06-containers-and-kubernetes/71-gke-storage/README.md)** - Dynamic volume provisioning using PersistentVolumeClaims (PVC) and CSI drivers.
- **[72. GKE Security](06-containers-and-kubernetes/72-gke-security/README.md)** - Hardening clusters, RBAC integration, Pod Security Standards, and Shielded Nodes.
- **[73. Autoscaling](06-containers-and-kubernetes/73-autoscaling/README.md)** - Cluster Autoscaler, Horizontal Pod Autoscaler (HPA), and Vertical Pod Autoscaler (VPA).
- **[74. Multi-cluster GKE](06-containers-and-kubernetes/74-multi-cluster-gke/README.md)** - Managing multi-cluster fleets, Anthos/GKE Enterprise service mesh, and multi-cluster ingress.

### 7. Serverless & Event-Driven Architecture
- **[75. Cloud Run](07-serverless-event-driven/75-cloud-run/README.md)** - Fully managed serverless platform for executing stateless HTTP container workloads.
- **[76. Cloud Functions](07-serverless-event-driven/76-cloud-functions/README.md)** - Lightweight event-driven FaaS for running single-purpose code snippets.
- **[77. Cloud Scheduler](07-serverless-event-driven/77-cloud-scheduler/README.md)** - Fully managed enterprise cron job service for triggering periodic tasks.
- **[78. Pub/Sub Integration](07-serverless-event-driven/78-pubsub-integration/README.md)** - Asynchronous messaging middleware connecting serverless consumers and producers.
- **[79. Eventarc](07-serverless-event-driven/79-eventarc/README.md)** - Standardized event routing platform listening to GCP audit logs and Pub/Sub sources.
- **[80. API Gateway](07-serverless-event-driven/80-api-gateway/README.md)** - Securing, managing, and routing API traffic to Cloud Run, Functions, and App Engine.
- **[81. Event-Driven Architectures](07-serverless-event-driven/81-event-driven-architectures/README.md)** - Designing decoupled, reactive cloud applications using asynchronous events.

### 8. Infrastructure as Code
- **[82. Terraform on GCP](08-infrastructure-as-code/82-terraform-on-gcp/README.md)** - Automating Google Cloud resource provisioning declarative IaC code.
- **[83. Providers](08-infrastructure-as-code/83-providers/README.md)** - Configuring the official Google and Google-Beta Terraform providers.
- **[84. Variables](08-infrastructure-as-code/84-variables/README.md)** - Parameterizing Terraform configurations with input variables, outputs, and local values.
- **[85. Modules](08-infrastructure-as-code/85-modules/README.md)** - Reusable, composable Terraform infrastructure building blocks.
- **[86. State Management](08-infrastructure-as-code/86-state-management/README.md)** - Understanding state file lockings, drift detection, and state operations.
- **[87. Remote Backend](08-infrastructure-as-code/87-remote-backend/README.md)** - Storing Terraform state securely in Cloud Storage with state locking.

### 9. CI/CD
- **[88. CI/CD Concepts](09-cicd/88-cicd-concepts/README.md)** - Continuous integration and continuous delivery best practices on Google Cloud.
- **[89. Cloud Build](09-cicd/89-cloud-build/README.md)** - Serverless CI/CD platform executing automated builds, tests, and deployments.
- **[90. Artifact Registry Integration](09-cicd/90-artifact-registry-integration/README.md)** - Building container images and pushing them automatically from Cloud Build triggers.
- **[91. Deploy to Cloud Run](09-cicd/91-deploy-to-cloud-run/README.md)** - Automated release pipelines deploying container revisions to Cloud Run.
- **[92. Deploy to GKE](09-cicd/92-deploy-to-gke/README.md)** - Automated Kubernetes deployment pipelines using Cloud Deploy, Helm, or Kustomize.

### 10. Observability
- **[93. Cloud Monitoring](10-observability/93-cloud-monitoring/README.md)** - Enterprise monitoring platform tracking metrics, uptime, and system performance.
- **[94. Cloud Logging](10-observability/94-cloud-logging/README.md)** - Centralized real-time log ingestion, storage, filtering, and log router sinks.
- **[95. Metrics Explorer](10-observability/95-metrics-explorer/README.md)** - Querying, visualizing, and plotting custom and service system metrics.
- **[96. Dashboards](10-observability/96-dashboards/README.md)** - Building custom real-time visual monitoring dashboards for infrastructure and apps.
- **[97. Alerting Policies](10-observability/97-alerting-policies/README.md)** - Configuring automated incident alerts across Email, PagerDuty, and Webhooks.
- **[98. Uptime Checks](10-observability/98-uptime-checks/README.md)** - Synthetic HTTP, HTTPS, and TCP health probes monitoring public services.
- **[99. Cloud Trace](10-observability/99-cloud-trace/README.md)** - Distributed tracing service analyzing latency bottlenecks across microservices.
- **[100. Cloud Profiler](10-observability/100-cloud-profiler/README.md)** - Continuous CPU and memory profiling identifying application performance code hotspots.
- **[101. OpenTelemetry](10-observability/101-opentelemetry/README.md)** - Vendor-neutral telemetry data collection standards integrated with GCP Observability.

### 11. Security
- **[102. Secret Manager](11-security/102-secret-manager/README.md)** - Secure storage, versioning, and access control for API keys, passwords, and certificates.
- **[103. Cloud KMS](11-security/103-cloud-kms/README.md)** - Managed Key Management Service for customer-managed encryption keys (CMEK).
- **[104. Security Command Center](11-security/104-security-command-center/README.md)** - Enterprise security risk management, vulnerability scanning, and threat detection.
- **[105. Certificate Manager](11-security/105-certificate-manager/README.md)** - Provisioning and managing SSL/TLS certificates for Google Cloud Load Balancers.
- **[106. Cloud Armor](11-security/106-cloud-armor/README.md)** - Web Application Firewall (WAF) and DDoS protection protecting edge services.
- **[107. Identity-Aware Proxy (IAP)](11-security/107-identity-aware-proxy/README.md)** - Context-aware zero-trust access control for web applications and SSH/RDP.
- **[108. Binary Authorization](11-security/108-binary-authorization/README.md)** - Deploy-time security policy enforcing container signature verification before release.

### 12. Cost Management
- **[109. Billing Reports](12-cost-management/109-billing-reports/README.md)** - In-depth visualization of cloud expenditures grouped by project, SKU, and labels.
- **[110. Budgets & Alerts](12-cost-management/110-budgets-and-alerts/README.md)** - Setting up spend guardrails and threshold notification triggers.
- **[111. Cost Optimization Techniques](12-cost-management/111-cost-optimization-techniques/README.md)** - Committed Use Discounts (CUDs), Preemptible/Spot VMs, and lifecycle rules.
- **[112. Rightsizing Resources](12-cost-management/112-rightsizing-resources/README.md)** - Utilizing GCP Recommender recommendations to downsize idle or overprovisioned VMs.

### 13. Data & Analytics
- **[113. BigQuery](13-data-and-analytics/113-bigquery/README.md)** - Serverless enterprise data warehouse for petabyte-scale SQL analytics and machine learning.
- **[114. Pub/Sub](13-data-and-analytics/114-pubsub/README.md)** - High-throughput messaging service for real-time data streaming pipelines.
- **[115. Dataflow](13-data-and-analytics/115-dataflow/README.md)** - Unified stream and batch data processing pipeline service powered by Apache Beam.
- **[116. Dataproc](13-data-and-analytics/116-dataproc/README.md)** - Fully managed Apache Spark and Apache Hadoop cluster service.

### 14. Reliability Engineering
- **[117. SLI](14-reliability-engineering/117-sli/README.md)** - Service Level Indicators: Service metrics measuring real-time performance and availability.
- **[118. SLO](14-reliability-engineering/118-slo/README.md)** - Service Level Objectives: Targeted reliability performance goals agreed with stakeholders.
- **[119. SLA](14-reliability-engineering/119-sla/README.md)** - Service Level Agreements: Formal contractual commitments defining customer uptime expectations.
- **[120. Error Budgets](14-reliability-engineering/120-error-budgets/README.md)** - Acceptable service unreliability margin balancing release speed with stability.
- **[121. Incident Management](14-reliability-engineering/121-incident-management/README.md)** - Structured response workflows for triaging, mitigating, and resolving outages.
- **[122. Disaster Recovery](14-reliability-engineering/122-disaster-recovery/README.md)** - Cross-region failover strategies, RTO/RPO targets, and backup restoration plans.
- **[123. Chaos Engineering](14-reliability-engineering/123-chaos-engineering/README.md)** - Controlled fault injection experiments validating system resiliency under stress.

---

## Repository Standard Guidelines

Each topic module contains a dedicated `README.md` engineered to deliver:
- **Beginner clarity** with practical production-level depth.
- **Visual flowcharts and architecture diagrams** using standard Mermaid syntax and clean minimalist diagrams.
- **Actionable hands-on console and `gcloud` CLI workflows** with safety verification and cleanup.
- **Production security, FinOps budget guardrails, and enterprise hyperscaler context**.
- **Real Project Q&As** and quick decision matrix guides.
