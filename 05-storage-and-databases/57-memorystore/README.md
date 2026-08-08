# Topic 57: Memorystore

---

## 1. What Is It?

**Google Cloud Memorystore** is a fully managed, in-memory data store service designed to deliver sub-millisecond data access for caching, session management, real-time gaming leaderboards, and pub/sub messaging.

Memorystore provides fully managed instances for two open-source in-memory engines:
1. **Memorystore for Redis (and Redis Cluster)**: Supports complex data structures (hashes, lists, sets, sorted sets), pub/sub messaging, geospatial indexes, and High Availability (HA) failover.
2. **Memorystore for Memcached**: Designed for simple key-value caching to scale web application page caching horizontally across multi-node clusters.

Memorystore automates provisioning, replication, failover, patch updates, and monitoring, protecting applications from database overload by offloading frequent read operations to high-speed RAM.

### Real-World Analogy
Think of Memorystore like a high-speed express counter set up in front of a main library archive (Cloud SQL or Bigtable). Instead of forcing every student (Application Request) to wait 5 minutes while a librarian walks to the basement archive to fetch a textbook (Disk Query), the express counter keeps copies of the 50 most popular textbooks sitting directly on top of the front desk (In-Memory RAM). 95% of students get their textbook in 1 second, leaving the basement archive free of long lines.

---

## 2. Where Does It Fit?

Memorystore sits between application compute tiers (Compute VMs, GKE, Cloud Run) and persistent database storage (Cloud SQL, Spanner, Bigtable), serving as an in-memory caching layer.

```mermaid
flowchart TD
    subgraph ComputeTier["Application Compute Tier"]
        CloudRun["Cloud Run Services"]
        GKEPod["GKE Microservices"]
        ComputeVM["Compute Engine VMs"]
    end

    subgraph MemorystoreLayer["Google Cloud Memorystore (Private VPC)"]
        subgraph RedisHAInstance["Memorystore for Redis (Standard HA Tier)"]
            PrimaryRedis["Primary Redis Node (Zone A - 10.100.0.10)"]
            ReplicaRedis["Replica Redis Node (Zone B - Synchronous Replication)"]
        end
    end

    subgraph PersistentDatabase["Persistent Transactional Database"]
        CloudSQLDB["Cloud SQL / Spanner Database (PostgreSQL / MySQL)"]
    end

    ComputeTier -- 1. Query Cache (Sub-millisecond Read) --> PrimaryRedis
    PrimaryRedis <== Automatic Failover & Sync ==> ReplicaRedis
    ComputeTier -. 2. Cache Miss -> Query Database .-> CloudSQLDB
    CloudSQLDB -. 3. Populate Cache .-> PrimaryRedis
```

---

## 3. Core Concepts

| Memorystore Concept | Redis Standard Tier | Redis Basic Tier | Memcached |
|---|---|---|---|
| **High Availability (HA)** | **Yes** (Primary in Zone A + Replica in Zone B). | **No** (Single node in 1 zone). | **No** (Stateless multi-node cluster). |
| **Failover SLA** | Automatic failover (~30 seconds) - **99.9% SLA**. | No failover (Node failure = cache wipe). | N/A (Node failure = partial cache miss). |
| **Data Persistence** | Supports RDB snapshots and AOF persistence. | Ephemeral (Lost on restart). | Strictly Ephemeral (RAM only). |
| **Max Capacity** | Up to 300 GB (Instance) / 2.5 TB (Cluster). | Up to 300 GB. | Up to 5 TB per cluster. |
| **Primary Use Case** | Session stores, sub-ms caching, leaderboards, pub/sub. | Dev/Test sandboxes. | Distributed HTML/page fragment caching. |

---

## 4. How It Works

Cache Lookaside pattern and Automatic HA Failover operate deterministically:

```text
Application receives HTTP Request -> Queries Memorystore for Redis key "user:101"
              ↓
Cache Hit -> Memorystore returns cached JSON payload in 0.5 milliseconds!
              ↓
Cache Miss -> App queries Cloud SQL DB -> Fetches row in 15 milliseconds
              ↓
App writes row payload back to Memorystore (`SET user:101 "{...}" EX 3600`)
              ↓
(Primary Node Outage): Primary Zone A fails -> Memorystore automatically promotes Zone B Replica to Primary in ~30s!
```

1. **Private Service Access**: Memorystore instances are provisioned with RFC1918 Private IP addresses directly inside your VPC network.
2. **Transit Encryption**: Supports in-transit TLS encryption and Redis AUTH password protection for secure client connections.

---

## 5. Production Scenario

### High-Availability Session Store & DB Cache for E-Commerce

```text
Requirement: Protect a Cloud SQL PostgreSQL database from crashing during Black Friday traffic spikes while storing 1,000,000 active user shopping cart sessions in memory.
    ↓
Architecture: Memorystore for Redis **Standard Tier (HA)** in `us-central1`.
    ↓
Instance Specification:
  - Tier: **Standard (HA)** (Primary: `us-central1-a`, Replica: `us-central1-b`).
  - Capacity: `10 GB` RAM.
  - Redis Version: `REDIS_7_0`.
  - Network: Private IP via VPC `custom-prod-vpc`.
  - Security: TLS Encryption Enabled + Redis AUTH Password enforced.
  - Eviction Policy: `allkeys-lru` (Least Recently Used eviction when RAM fills).
    ↓
Result: 95% of read queries served in <1ms by Memorystore; Cloud SQL database CPU stays below 30%.
    ↓
Monitoring: Cloud Monitoring tracking `redis/stats/cache_hit_ratio` (Target: >90%).
```

*Why Selected*: Standard Tier HA Redis provides automatic cross-zone failover for shopping cart sessions, while LRU eviction guarantees the cache never crashes when RAM capacity limits are reached.

---

## 6. Hands-On Lab

### Prerequisites
- Active GCP Project with Custom VPC and Private Services Access created (from Topic 27).
- Cloud Shell or `gcloud` CLI.
- IAM permissions: `roles/redis.admin`.

### Console Method
1. Log into [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **Databases** → **Memorystore** → **Redis**.
3. Click **CREATE INSTANCE** at top.
4. Set Instance ID: `redis-cache-prod`, Tier: **Standard (High Availability)**.
5. Capacity: `5 GB`.
6. Region: `us-central1` → Primary Zone: `us-central1-a`, Secondary Zone: `us-central1-b`.
7. Network: Select VPC `custom-prod-vpc`.
8. Security: Check **Enable In-Transit Encryption (TLS)**.
9. Click **CREATE** (Wait 3–5 minutes for instance provisioning).

### CLI Method
Create and inspect a Memorystore for Redis HA instance using `gcloud`:

```bash
# Set project and network variables
PROJECT_ID="your-gcp-project-id"
VPC_NAME="custom-prod-vpc"
INSTANCE_ID="redis-cache-prod"

# 1. Create a Standard Tier (HA) Redis Instance with Private IP
gcloud redis instances create $INSTANCE_ID \
    --size=5 \
    --region=us-central1 \
    --zone=us-central1-a \
    --alternative-zone=us-central1-b \
    --tier=STANDARD \
    --network=projects/$PROJECT_ID/global/networks/$VPC_NAME \
    --connect-mode=PRIVATE_SERVICE_ACCESS \
    --redis-version=redis_7_0 \
    --enable-auth

# 2. Retrieve Redis Instance Private IP and AUTH Password
gcloud redis instances describe $INSTANCE_ID --region=us-central1 --format="json(host, port, authString)"
```

### Verification
SSH into a private VM inside the VPC and test Redis connectivity using `redis-cli`:

```bash
# Execute redis-cli from a VM inside the VPC
gcloud compute ssh test-vm --zone=us-central1-a \
    --command="redis-cli -h 10.100.0.10 -p 6379 -a YOUR_AUTH_STRING SET testkey 'Hello Memorystore' && redis-cli -h 10.100.0.10 -p 6379 -a YOUR_AUTH_STRING GET testkey"
```
*Expected Result*: Returns `OK` followed by `"Hello Memorystore"`.

### Cleanup
Delete Memorystore instance:

```bash
gcloud redis instances delete $INSTANCE_ID --region=us-central1 --quiet
```

---

## 7. Security

### In-Memory Connection Security
- **Private IP Isolation**: Deploy Memorystore instances using Private IP via Private Services Access. Disable public access.
- **Enforce Redis AUTH**: Enable Redis AUTH passwords to require password authentication for every client connection.
- **TLS In-Transit Encryption**: Enable TLS encryption to protect sensitive session tokens or PII transmitted between compute instances and Memorystore.

```text
BAD PRACTICE:
Deploying Memorystore for Redis Basic Tier in production without Redis AUTH or TLS encryption.
Risk: Zero failover SLA (Primary failure wipes cache); raw unencrypted session tokens exposed on internal network.

PRODUCTION PRACTICE:
Use Standard Tier (HA) with automatic dual-zone failover. Enable Redis AUTH and TLS in-transit encryption.
```

---

## 8. Scaling & High Availability

Standard Tier vs. Redis Cluster Scaling:

```text
Memorystore Redis Basic Tier (Single Zone - No SLA - Ephemeral)
   ↓ (Production HA Upgrade)
Memorystore Redis Standard Tier (Dual Zone Primary + Replica - 99.9% SLA - Up to 300 GB)
   ↓ (Massive Scale-Out Upgrade)
Memorystore for Redis Cluster (Sharded cluster architecture - Up to 2.5 TB RAM - Millions of QPS)
```

- **Max Memory Eviction Policies**: Always set a maxmemory eviction policy (e.g., `allkeys-lru` or `volatile-lru`). If memory fills up without an eviction policy, Redis rejects new write commands with `OOM command not allowed` errors.

---

## 9. Cost

### Pricing Structure of Memorystore
- **Capacity Billing**: Billed per GB of provisioned RAM capacity per hour (e.g., ~$0.049/GB/hour for Standard Tier in US regions).
- **Tier Price Ratio**: Standard Tier (HA) costs approximately 2x Basic Tier because GCP provisions a dedicated replica node in a second availability zone.
- **Network Egress**: Data transferred over Private IP within the same zone is $0/GB; cross-zone egress incurs standard cross-zone rates.

---

## 10. Monitoring & Troubleshooting

### Memorystore Observability Tools
- **Cloud Monitoring Redis Metrics**: Track `redis/stats/cache_hit_ratio`, `redis/server/uptime`, and `redis/memory/usage_ratio`.
- **Alert Policies**: Set alerts when `cache_hit_ratio` drops below 80% or `memory/usage_ratio` exceeds 85%.

### Troubleshooting Matrix

| Symptom | Possible Cause | What to Check | Fix |
|---|---|---|---|
| Writes failing with `OOM command not allowed` | Redis RAM full and `maxmemory-policy` set to `noeviction` | Console Redis Instance Configuration | Change `maxmemory-policy` to `allkeys-lru` or scale up instance RAM size. |
| Cache Hit Ratio low (<50%) | Short TTL on keys or undersized cache memory | Cloud Monitoring `cache_hit_ratio` | Increase key Time-To-Live (TTL) or increase Memorystore RAM capacity. |
| High latency on Redis commands | Executing slow blocking commands (e.g., `KEYS *` or `FLUSHALL`) | App source code for Redis commands | Replace `KEYS *` with non-blocking `SCAN` commands in application code. |

---

## 11. Common Mistakes

```text
Mistake: Executing the blocking `KEYS *` command in production code against Memorystore for Redis.
Why: Attempting to list all active keys in the cache.
Impact: Redis is single-threaded; `KEYS *` blocks all incoming client requests for seconds/minutes, causing application-wide timeouts.
Correct approach: Use the non-blocking `SCAN` command for scanning keys in production.

Mistake: Leaving `maxmemory-policy` set to default `noeviction` on a caching instance.
Why: Forgetting to configure an eviction policy during instance creation.
Impact: When RAM capacity hits 100%, Redis rejects all subsequent write operations with OOM errors.
Correct approach: Set `maxmemory-policy` to `allkeys-lru` (Least Recently Used) for caching workloads.
```

---

## 12. Production Best Practices

- [ ] Select **Standard Tier (HA)** for production Redis instances (provides 99.9% SLA).
- [ ] Configure `maxmemory-policy` to **`allkeys-lru`** for caching workloads.
- [ ] Enable **Redis AUTH** and **TLS In-Transit Encryption**.
- [ ] Monitor **Cache Hit Ratio** (`cache_hit_ratio`); target >85% for effective caching.
- [ ] Ban blocking commands (`KEYS *`, `FLUSHALL`) in production code; use `SCAN`.
- [ ] Automate all Memorystore instances, network peering, and security configs via Terraform.

---

## 13. Hyperscaler / Enterprise Perspective

```text
Personal / Learning
  Basic Tier Redis → No AUTH → No TLS → Single zone setup
        ↓
Small Production
  Standard Tier HA Redis → Redis AUTH enabled → Basic LRU Eviction
        ↓
Enterprise Environment
  Standard Tier HA + In-Transit TLS → Private Service Access → Automated Cache Hit Ratio Alerts
        ↓
Hyperscaler Environment
  Memorystore for Redis Clusters (Terabyte Scale) → Automated Terraform Modules → Microservice Cache Abstraction Layers
```

In a hyperscaler environment, Memorystore serves as the high-speed caching tier for microservice architectures. Enterprise platform teams deploy **Memorystore for Redis Clusters** providing terabytes of in-memory RAM across multi-zone shards, absorbing millions of queries per second to protect underlying databases from traffic overload.

---

## 14. Real Project Questions

### Q1: What is the primary operational difference between Memorystore Redis Basic Tier and Standard Tier?
**Answer:** **Basic Tier** provisions a single standalone Redis node in 1 zone with zero high-availability SLA; if the zone or node fails, the cache is lost. **Standard Tier (HA)** provisions a Primary node in Zone A and a Replica node in Zone B with automatic failover in ~30 seconds, delivering a 99.9% availability SLA.

### Q2: Why should developers never execute the `KEYS *` command on a production Redis instance?
**Answer:** Redis is a single-threaded engine. Executing `KEYS *` forces Redis to scan every single key stored in memory sequentially, blocking the single thread and preventing all other client read/write operations from executing until the scan finishes, causing widespread application timeouts.

### Q3: What is the Cache-Side (Lookaside) pattern, and how does it prevent database overload?
**Answer:** In the Cache-Side pattern, application code queries Memorystore first. On a **Cache Hit**, data is returned in <1ms without touching the database. On a **Cache Miss**, the app queries the database, writes the result back to Memorystore with a Time-To-Live (TTL), and returns the response. This offloads 90%+ of read queries from persistent databases.

---

## 15. Quick Decision Guide

| Requirement | Recommended Approach | Reason |
|---|---|---|
| High-speed sub-millisecond session store for a production e-commerce web app | **Memorystore for Redis (Standard HA Tier)** | 99.9% HA SLA, automatic cross-zone failover, supports complex Redis data structures. |
| Simple horizontal HTML page fragment caching for a legacy web cluster | **Memorystore for Memcached** | Multi-node horizontal key-value caching optimized for simple web page caching. |
| Massive multi-terabyte in-memory datastore processing 1,000,000 QPS | **Memorystore for Redis Cluster** | Sharded cluster architecture scaling up to 2.5 TB RAM and millions of operations/sec. |

### When should I use it?
- Essential in-memory service for caching, session stores, real-time leaderboards, and pub/sub messaging in GCP.

### When should I NOT use it?
- Do not use Memorystore as a primary persistent database for critical transactional data without persistent disk backups.

---

## 16. Related Services

```text
               [57. Memorystore]
              /        |        \
        Compute VMs   Cloud SQL  Cloud Run
         / GKE Pods   Database   Microservices
            |            |            |
        Sub-ms Read   Offloaded    Stateless
         Caching      Read Ops      Session
```

- **Compute Engine / GKE**: Microservice compute tiers consuming Memorystore caches.
- **Cloud SQL / Spanner**: Transactional databases protected by Memorystore read caching.
- **Cloud Run**: Serverless container environments connecting to Memorystore via Serverless VPC Access.

---

## 17. Cheat Sheet

### Tier & Engine Summary
- **Redis Basic Tier**: Single node, 0 SLA (Dev/Test).
- **Redis Standard Tier**: Dual-zone HA, 99.9% SLA (Production).
- **Redis Cluster**: Sharded cluster, up to 2.5 TB RAM.
- **Memcached**: Simple distributed key-value caching.

### Useful Commands
```bash
# Create a Standard Tier (HA) Redis instance
gcloud redis instances create INSTANCE_NAME \
    --size=5 --region=us-central1 --tier=STANDARD \
    --zone=us-central1-a --alternative-zone=us-central1-b \
    --network=VPC_NAME --connect-mode=PRIVATE_SERVICE_ACCESS --enable-auth

# Describe instance and get host IP
gcloud redis instances describe INSTANCE_NAME --region=us-central1

# Delete a Redis instance
gcloud redis instances delete INSTANCE_NAME --region=us-central1
```

---

## 18. Learning Connection

- **Previous Topic**: [56. Spanner](../56-spanner/README.md)
- **Next Topic**: [58. Container Fundamentals](../../06-containers-and-kubernetes/58-container-fundamentals/README.md)
