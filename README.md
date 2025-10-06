# 🧠 Jarvis — Personal AI Assistant on AWS Fargate
> A secure, self-hosted, auto-scaling AI assistant that connects to your personal data — emails, photos, files, and more

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant Web as Web App
  participant GW as API Gateway
  participant BFF as api-bff (ECS)
  participant Chat as chat-orchestrator (ECS)
  participant Agent as Bedrock Agent
  participant KB as Bedrock KB
  participant OS as OpenSearch
  participant TRem as tools-reminders (ECS)
  participant EVB as EventBridge
  participant DDB as DynamoDB

  U->>Web: "Summarize today's emails & remind me at 9am"
  Web->>GW: POST /chat (JWT)
  GW->>BFF: Route request
  BFF->>Chat: Stream chat turn
  Chat->>Agent: Submit user msg + context
  Agent->>KB: Retrieve relevant docs
  KB-->>Agent: Chunks + citations
  Agent->>OS: Hybrid search (vector+BM25)
  OS-->>Agent: Top-K chunks
  Agent-->>Chat: Draft summary + tool call (setReminder)
  Chat->>TRem: setReminder({ tomorrow 9:00, note })
  TRem->>EVB: Create schedule rule
  EVB->>DDB: Persist reminder item
  TRem-->>Chat: ok { ruleArn, reminderId }
  Chat-->>BFF: Final assistant message
  BFF-->>GW: Stream chunks
  GW-->>Web: Render response + "Reminder set"
```

![AWS](https://img.shields.io/badge/AWS-Fargate-orange)
![Language](https://img.shields.io/badge/TypeScript-CDK%20%7C%20Node.js-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🌍 Vision

Jarvis is your personal AI assistant — a **web-based, private, and continuously learning** agent that lives entirely inside AWS.

It can read your emails, photos, and documents (securely), answer questions, summarize information, and perform tasks — from setting reminders to drafting emails — all through chat. Over time, it learns your preferences and becomes smarter.

---

## ⚙️ Core Capabilities

| Function | Description | AWS Services |
|-----------|--------------|---------------|
| **Data Intake** | Pull in your emails, texts, files, and photos | SES, S3, SQS |
| **Data Understanding** | OCR, transcription, NLP, and vision analysis | Textract, Transcribe, Comprehend, Rekognition |
| **Knowledge Search (RAG)** | Retrieve and reason over your data | Bedrock Knowledge Base, OpenSearch Serverless |
| **Chat Assistant** | Conversational interface and task orchestrator | Bedrock Agent, ECS (chat-orchestrator), API Gateway |
| **Memory + Learning** | Stores and summarizes insights over time | Aurora pgvector, DynamoDB |
| **Action System** | Sends emails, creates reminders, automates tasks | SES, EventBridge, DynamoDB |
| **Security & Privacy** | End-to-end encryption and compliance | KMS, IAM, Macie, GuardDuty |

---

## 🧩 Architecture Overview

<details>
<summary><b>Click to expand architecture diagram</b></summary>

```mermaid
flowchart LR

  %% ==== Client & Edge ====
  user["User"]:::compute --> web["Web App (CloudFront + S3 + Cognito)"]:::compute
  web --> api["API Gateway (HTTP+WS)"]:::service
  api --> bff["ECS api-bff"]:::compute
  bff --> chat["ECS chat-orchestrator"]:::compute

  %% ==== Ingestion Pipeline ====
  subgraph Ingestion["Ingestion Pipeline"]
    web -. "Pre-signed PUT" .-> s3raw["S3 Raw"]:::storage
    sesIn["SES Inbound"]:::messaging --> s3raw
    s3raw --> sqsIngest["SQS Ingest Queue"]:::messaging
    sqsIngest --> sfn["Step Functions"]:::service
    sfn --> tex["Textract"]:::ai
    sfn --> rek["Rekognition"]:::ai
    sfn --> trs["Transcribe"]:::ai
    sfn --> cmp["Comprehend"]:::ai
    tex --> norm["Normalize + Chunk"]:::service
    rek --> norm
    trs --> norm
    cmp --> norm
    norm --> emb["Embed (Bedrock)"]:::ai
    emb --> os["OpenSearch"]:::storage
    norm --> s3cur["S3 Curated"]:::storage
    s3cur -. "KB sync" .-> kb["Bedrock KB"]:::ai
  end

  %% ==== Assistant Retrieval ====
  chat --> agent["Bedrock Agent"]:::ai
  agent --> kb
  agent --> os

  %% ==== Actions / Tools ====
  subgraph Tools["Action Tools"]
    agent --> tEmail["tools-email"]:::compute
    tEmail --> sesOut["SES Send"]:::messaging
    agent --> tTasks["tools-tasks"]:::compute
    tTasks --> ddb["DynamoDB"]:::db
    agent --> tRem["tools-reminders"]:::compute
    tRem --> evb["EventBridge"]:::messaging
    evb --> sns["SNS Notifications"]:::messaging
  end

  %% ==== Memory ====
  subgraph Memory["Long-term Memory"]
    reflect["memory-reflector"]:::compute --> aur["Aurora pgvector"]:::db
    reflect --> os
  end

  %% ==== Cross Links ====
  sfn -. "may invoke" .-> proc["processor-* workers"]:::compute
  bff --> os
  bff --> ddb
  bff --> evb

  class user,web,api,bff,chat,proc,reflect,tex,rek,trs,cmp,norm,emb,tEmail,tTasks,tRem,agent compute;
  class s3raw,s3cur,os,kb storage;
  class aur,ddb db;
  class sqsIngest,sesIn,sesOut,evb,sns messaging;
  class kb,agent,emb,tex,rek,trs,cmp ai;
```
</details>

| Service | Role | Scaling Type |
|----------|------|--------------|
| `api-bff` | WebSocket + REST broker | Always-on (target tracking) |
| `chat-orchestrator` | LLM Gateway → Bedrock Agent | Always-on |
| `search-service` | OpenSearch hybrid search | Always-on |
| `tools-email` | Draft & send emails | On-demand |
| `tools-tasks` | Manage to-do tasks | On-demand |
| `tools-reminders` | Create reminders | On-demand |
| `pipeline-router` | Routes S3 → Step Functions | Queue scaling |
| `processor-*` | Textract, Rekognition, Transcribe, Embed, Index | Queue scaling |
| `memory-reflector` | Nightly memory summarization | Scheduled |

---

## 🧠 Data Flow Diagrams

### Level 0 — Context

```mermaid
flowchart LR
  user["User (Browser/Mobile)"]
  subgraph AWS["Your AWS Account"]
    ui["Web App (CloudFront + S3 + Cognito)"]
    api["API Gateway (HTTP/WS)"]
    agent["Bedrock Agent"]
    kb["Bedrock Knowledge Base"]
    os[("OpenSearch Serverless")]
    s3raw[("S3 Raw")]
    s3cur[("S3 Curated")]
    ddb[("DynamoDB Tasks/Drafts/Sessions")]
    aur[("Aurora pgvector")]
    ses["SES Inbound/Outbound"]
  end

  user <--> ui
  ui <--> api
  api <--> agent
  agent <--> kb
  agent <--> os
  ui -->|"Uploads"| s3raw
  ses -->|"Inbound mail"| s3raw
  s3raw -->|"Processed to"| s3cur
  s3cur -->|"Indexed"| os
  agent -->|"Create tasks/reminders"| ddb
  agent -->|"Send mail"| ses
  agent -->|"Long-term memory"| aur
```

### Level 1 — Ingestion

```mermaid
flowchart LR
  subgraph Intake
    ses["SES Inbound"] --> s3raw[("S3 Raw")]
    ui["Web App Upload"] --> s3raw
  end

  s3raw -->|"S3 Event"| sqs[("SQS Ingest Queue")]
  sqs --> router["ECS Fargate: pipeline-router"]
  router --> sfn[["Step Functions: ProcessObject"]]

  sfn -->|"PDF/Scans"| tex["Textract"]
  sfn -->|"Images"| rek["Rekognition"]
  sfn -->|"Audio/Video"| trs["Transcribe"]
  sfn -->|"PII Detection"| cmp["Comprehend"]

  tex --> norm["Normalize + Chunk"]
  rek --> norm
  trs --> norm
  cmp --> norm

  norm --> emb["Bedrock Embeddings"]
  emb --> os[("OpenSearch Vector+BM25")]
  norm --> s3cur[("S3 Curated")]
  s3cur -."optional sync".-> kb["Bedrock Knowledge Base"]
```

### Level 1 — Chat & Actions

```mermaid
flowchart LR
  user["User"] --> ui["Web App (WS)"]
  ui --> api["API Gateway"]
  api --> bff["ECS: api-bff"]
  bff --> chat["ECS: chat-orchestrator"]
  chat --> agent["Bedrock Agent"]
  agent -->|"Retrieve"| kb["Bedrock KB"]
  agent -->|"Hybrid Search"| os[("OpenSearch")]
  agent --> email["ECS: tools-email"] --> ses["SES Send"]
  agent --> tasks["ECS: tools-tasks"] --> ddb[("DynamoDB")]
  agent --> remind["ECS: tools-reminders"] --> evb["EventBridge"] --> sns["SNS/Email/Push"]
```

---

## 🧩 UML Diagrams

### Component Diagram

```mermaid
graph TB
  subgraph Client
    Web["Next.js Web App"]
    User["User"]
  end
  User --> Web

  subgraph Edge
    CF["CloudFront"]
    APIGW["API Gateway HTTP/WS"]
  end
  Web --> CF --> APIGW

  subgraph Compute["ECS Fargate Services"]
    BFF["api-bff"]
    CHAT["chat-orchestrator"]
    SEARCH["search-service"]
    TEMAIL["tools-email"]
    TTASKS["tools-tasks"]
    TREM["tools-reminders"]
    ROU["pipeline-router"]
    PTEX["processor-textract"]
    PREK["processor-rekognition"]
    PTRA["processor-transcribe"]
    PNORM["processor-normalize"]
    PEMB["processor-embed"]
    PINX["processor-indexer"]
    MEM["memory-reflector"]
  end

  subgraph Data
    S3R[("S3 Raw")]
    S3C[("S3 Curated")]
    OS[("OpenSearch Serverless")]
    DDB[("DynamoDB")]
    AUR[("Aurora pgvector")]
  end

  subgraph AI
    KB["Bedrock Knowledge Base"]
    Agent["Bedrock Agent"]
    BR["Bedrock Models"]
  end

  subgraph Integrations
    SES["SES Inbound/Outbound"]
    SFN["Step Functions"]
    SQS["SQS"]
    EVB["EventBridge"]
    SNS["SNS"]
  end

  APIGW --> BFF --> CHAT --> Agent
  Agent --> KB --> S3C
  Agent --> OS
  Agent --> TEMAIL --> SES
  Agent --> TTASKS --> DDB
  Agent --> TREM --> EVB --> SNS

  SES --> S3R --> SQS --> ROU --> SFN
  SFN --> PTEX --> PNORM
  SFN --> PREK --> PNORM
  SFN --> PTRA --> PNORM
  PNORM --> PEMB --> OS
  PNORM --> PINX --> OS
  PNORM --> S3C
  MEM --> AUR
  CHAT --> BR
  PEMB --> BR
```

### Sequence — “Summarize emails + reminder”

```mermaid
sequenceDiagram
  autonumber
  User->>Web: "Summarize my latest emails"
  Web->>API: POST /chat
  API->>ECS1: Handle request
  ECS1->>ECS2: Send chat message
  ECS2->>BR: Query Bedrock Agent
  BR->>OS: Hybrid retrieval
  BR-->>ECS2: Summary + tool call (setReminder)
  ECS2->>Tools: Trigger reminder
  Tools->>EventBridge: Schedule task
  Tools-->>ECS2: Confirmation
  ECS2-->>API: Stream final response
  API-->>Web: Render in chat
```

### Deployment Diagram

```mermaid
graph TB
  subgraph UserDevice
    Browser["Browser"]
  end

  subgraph AWS_Edge["AWS Edge"]
    CF["CloudFront"]
    APIGW["API Gateway HTTP/WS"]
  end

  Browser --> CF --> APIGW

  subgraph VPC["Private VPC (3 AZs)"]
    subgraph PublicSubnets
      NLB["Internal NLB (VPC Link target)"]
    end
    subgraph PrivateSubnets
      ECS1["ECS Fargate: api-bff"]
      ECS2["ECS Fargate: chat-orchestrator"]
      ECS3["ECS Fargate: search-service"]
      ECS4["ECS Fargate: tools-*"]
      ECS5["ECS Fargate: processors-*"]
      OTEL["OTEL Collector"]
    end
    VPCE1[("VPC Endpoint: S3")]
    VPCE2[("VPC Endpoint: OpenSearch")]
    VPCE3[("VPC Endpoint: Bedrock")]
    VPCE4[("VPC Endpoint: Secrets/KMS")]
  end

  APIGW -."VPC Link".-> NLB
  NLB --> ECS1 & ECS2 & ECS3 & ECS4

  S3R[("S3 Raw")]
  S3C[("S3 Curated")]
  OS[("OpenSearch Serverless")]
  DDB[("DynamoDB")]
  SES["Amazon SES"]
  SFN["Step Functions"]
  SQS["SQS"]
  EVB["EventBridge"]
  Agent["Bedrock Agent"]
  KB["Bedrock KB"]

  ECS5 --> SQS
  ECS5 --> SFN
  ECS4 --> EVB
  ECS4 --> DDB
  ECS4 --> SES
  ECS2 --> Agent
  Agent --> KB
  ECS3 --> OS
  ECS5 --> S3R
  ECS5 --> S3C
  ECS5 --> OS
```

### Data Models (Core Classes)

```mermaid
classDiagram
  class Document {
    +string id
    +string tenantId
    +string source
    +string s3Uri
    +string title
    +string mimeType
    +Date createdAt
    +Map metadata
    +bool hasPII()
  }
  class Chunk {
    +string id
    +string documentId
    +int index
    +string section
    +int pageNo
    +string text
    +float[] vector
    +int tokens
  }
  class Task {
    +string id
    +string tenantId
    +string title
    +string status
    +Date dueAt
    +Map sourceRef
  }
  class Reminder {
    +string id
    +string tenantId
    +string message
    +Date triggerAt
    +string ruleArn
    +string status
  }
  Document "1" -- "many" Chunk : contains
```

---

## 📁 Repository Structure

```
jarvis-assistant/
├─ README.md
├─ .env.example
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
├─ docker-compose.dev.yml
├─ .gitignore
│
├─ apps/
│  ├─ web/                          # Next.js (App Router) UI, Cognito auth
│  │  ├─ app/                       # routes: /chat, /search, /uploads, /settings
│  │  ├─ components/                # MessageStream, ResultCard, DraftModal, PiiBadge
│  │  ├─ lib/                       # cognito client, api fetchers, websocket client
│  │  ├─ public/
│  │  ├─ next.config.js
│  │  ├─ Dockerfile
│  │  └─ .env.local.example
│  │
│  └─ docs/                         # Architecture & runbooks
│     └─ architecture/*.md
│
├─ services/
│  ├─ api-bff/                      # Gateway → NLB → ECS (REST + WS broker)
│  │  ├─ src/
│  │  │  ├─ index.ts
│  │  │  ├─ routes/                 # /chat, /search, /actions/*
│  │  │  ├─ ws/                     # websocket upgrade handling
│  │  │  ├─ middleware/             # auth (Cognito JWT), rate limit, logging
│  │  │  └─ adapters/               # Bedrock Agent proxy, tool dispatch
│  │  ├─ Dockerfile
│  │  └─ .env.example
│  │
│  ├─ chat-orchestrator/            # Bedrock Agent gateway; streams tokens
│  │  ├─ src/
│  │  ├─ Dockerfile
│  │  └─ .env.example
│  │
│  ├─ search-service/               # Hybrid retrieval: OpenSearch (vector+BM25)
│  │  ├─ src/
│  │  │  ├─ handlers/search.ts
│  │  │  ├─ scoring/hybrid.ts
│  │  │  └─ mappings/               # OS index templates
│  │  ├─ Dockerfile
│  │  └─ .env.example
│  │
│  ├─ tools-email/                  # Draft + Send via SES
│  ├─ tools-tasks/                  # Create/list tasks (DynamoDB)
│  ├─ tools-reminders/              # Reminders (EventBridge → SNS)
│  ├─ ingest-ses-consumer/          # SES inbound S3 events → SQS
│  ├─ pipeline-router/              # SQS worker: detect type → Step Functions
│  ├─ processor-textract/           # Textract jobs for PDFs/scans
│  ├─ processor-rekognition/        # Labels, OCR-in-image
│  ├─ processor-transcribe/         # A/V transcription
│  ├─ processor-normalize/          # Canonical doc JSON + chunking
│  ├─ processor-embed/              # Bedrock embeddings (Titan/Cohere)
│  ├─ processor-indexer/            # Upsert to OpenSearch
│  ├─ memory-reflector/             # Nightly summarization + memory vectors
│  ├─ notifications/                # Server → client events (WS/SNS)
│  └─ otel-collector/               # OpenTelemetry collector
│
├─ infra/                           # AWS CDK (TypeScript) — Fargate-first
│  ├─ bin/
│  │  └─ cdk.ts
│  ├─ stacks/
│  │  ├─ network.ts                 # VPC, subnets, NAT, VPC endpoints
│  │  ├─ ecr.ts                     # ECR repos for each service
│  │  ├─ ecs-cluster.ts             # ECS Cluster, capacity providers
│  │  ├─ load-balancers.ts          # Internal NLB/ALB, target groups
│  │  ├─ api-gateway.ts             # HTTP API + VPC Link → NLB
│  │  ├─ identity.ts                # Cognito UserPool/Clients
│  │  ├─ storage.ts                 # S3 (raw/curated), KMS keys
│  │  ├─ search.ts                  # OpenSearch Serverless
│  │  ├─ data.ts                    # DynamoDB, optional Aurora pgvector
│  │  ├─ messaging.ts               # SQS queues, SNS topics
│  │  ├─ pipeline.ts                # Step Functions state machines
│  │  ├─ ses.ts                     # SES inbound rule set → S3
│  │  ├─ services.ts                # ECS TaskDefs, Services, AutoScaling
│  │  ├─ observability.ts           # CloudWatch dashboards/alarms, X-Ray
│  │  └─ security.ts                # IAM roles, WAF, GuardDuty, Macie
│  ├─ config/
│  │  ├─ dev.json
│  │  ├─ stg.json
│  │  └─ prod.json
│  └─ cdk.json
│
├─ packages/
│  ├─ clients/                      # Thin AWS SDK wrappers
│  ├─ prompts/                      # System + tool prompts (versioned)
│  ├─ shared-types/                 # Zod/TS types: Document, Chunk, Tool IO
│  ├─ security/                     # KMS helpers, PII maskers
│  └─ telemetry/                    # Logger, metrics, OpenTelemetry config
│
├─ openapi/
│  ├─ api.yaml                      # /chat, /search, /actions/* contract
│  └─ examples/*.json
│
├─ stepfunctions/
│  └─ process_object.asl.json
│
├─ scripts/
│  ├─ config.services.json          # Shared service definitions
│  ├─ Setup-AwsProfile.ps1
│  ├─ Create-Ecr-Repos.ps1
│  ├─ Build-Push-All.ps1
│  ├─ Deploy-Cdk.ps1
│  ├─ Update-Ecs-Services.ps1
│  ├─ Scale-Workers.ps1
│  ├─ Rollback-Service.ps1
│  ├─ Seed-Fixtures.ps1
│  └─ Smoke-Test.ps1
│
├─ .github/
│  └─ workflows/
│     ├─ ci.yml                     # lint/typecheck/test
│     ├─ build-and-push.yml         # build images → ECR (matrix)
│     └─ deploy-cdk.yml             # CDK synth/deploy via GitHub OIDC
│
└─ test/
   ├─ unit/                         # services/* unit tests
   ├─ contract/                     # OpenAPI contract tests
   ├─ integration/                  # local compose → hit endpoints
   └─ e2e/                          # provision ephemeral env → run flows
```

**Key Decisions:**
- **Everything backend = containers**: Each microservice is a small Node/TS service with single responsibility and its own ECS Task Definition
- **Ingress pattern**: API Gateway (HTTP) → VPC Link → Internal NLB → ECS Services (private subnets)
- **Auto-scaling**: Target Tracking (CPU/MEM), Step Scaling (SQS queue depth), RPS scaling via ALB/NLB metrics
- **Long tasks = on-demand workers**: Pipeline services scale with SQS depth and terminate when idle
- **Observability**: Central OTEL collector sends traces/metrics/logs to CloudWatch/X-Ray

---

## 🧰 DevOps + Scaling

| Layer | Tech | Notes |
|-------|------|-------|
| IaC | AWS CDK (TypeScript) | Define all infra declaratively |
| CI/CD | GitHub Actions + CodePipeline | Build Docker + Deploy ECS/CDK |
| Monitoring | CloudWatch + X-Ray + OTEL | Metrics & traces |
| Scaling | TargetTracking + StepScaling | Based on CPU, Memory, or SQS depth |
| Secrets | AWS Secrets Manager | Encrypted env vars |
| Network | Private VPC + Endpoints | No public access |

### ECS Fargate Scaling Patterns

| Type | Examples | Runtime | Scaling |
|------|----------|---------|---------|
| Always-on Service | api-bff, chat-orchestrator, search-service | 24/7 tasks in ECS Service | Target-tracking (CPU/Mem/RPS) |
| Event-driven Worker | pipeline-router, processor-* | Fargate tasks launched by SQS depth | Step scaling (queue depth) |
| Scheduled Batch | memory-reflector | Triggered by EventBridge cron | 1 task on schedule |
| On-demand Tool | tools-email, tools-tasks | Invoked by chat agent or API call | 1–2 tasks per request burst |

---

## 🔐 Security

- KMS encryption for all storage layers  
- IAM least privilege roles per ECS task  
- Macie & GuardDuty for ongoing compliance  
- CloudTrail for audit logging  
- API Gateway WAF for DDoS & abuse protection  
- User-facing “Delete My Data” and “Export My Data” options

---

## ⚡ PowerShell Deployment Workflow

### Prerequisites
- AWS CLI v2 (`aws --version`)
- Docker Desktop (with BuildKit)
- PowerShell 7+ (`pwsh`)
- Node.js 20+ (for app builds)
- AWS CDK (`npm i -g aws-cdk@latest`)
- IAM user/role with permissions for: ECR, ECS, CloudWatch, S3, IAM, OpenSearch, SES, StepFunctions, EventBridge

### Typical End-to-End Workflow

```powershell
# 0) One-time profile setup
pwsh scripts/Setup-AwsProfile.ps1 -ProfileName siqstack-dev -Region us-east-1

# 1) Create ECR repos (idempotent)
pwsh scripts/Create-Ecr-Repos.ps1 -Profile siqstack-dev

# 2) Build + push all images with current Git SHA
pwsh scripts/Build-Push-All.ps1 -Profile siqstack-dev

# 3) Deploy/refresh infrastructure
pwsh scripts/Deploy-Cdk.ps1 -Profile siqstack-dev

# 4) Point ECS services at the new image tag
pwsh scripts/Update-Ecs-Services.ps1 -Profile siqstack-dev -Tag sha-abc123

# 5) Optional: seed test data and watch pipeline
pwsh scripts/Seed-Fixtures.ps1 -Profile siqstack-dev

# 6) Smoke test endpoints
pwsh scripts/Smoke-Test.ps1 -BaseUrl https://api.yourdomain.com -Jwt $token
```

### Service Configuration: `scripts/config.services.json`

Define your microservices once; all scripts read this:

```json
{
  "Project": "jarvis",
  "Env": "dev",
  "Region": "us-east-1",
  "AccountId": "123456789012",
  "ClusterName": "jarvis-dev-cluster",
  "Services": [
    { "name": "api-bff", "path": "services/api-bff", "port": 8080 },
    { "name": "chat-orchestrator", "path": "services/chat-orchestrator", "port": 8081 },
    { "name": "search-service", "path": "services/search-service", "port": 8082 },
    { "name": "tools-email", "path": "services/tools-email", "port": 8083 },
    { "name": "tools-tasks", "path": "services/tools-tasks", "port": 8084 },
    { "name": "tools-reminders", "path": "services/tools-reminders", "port": 8085 },
    { "name": "pipeline-router", "path": "services/pipeline-router", "port": 8087 },
    { "name": "processor-textract", "path": "services/processor-textract", "port": 8088 },
    { "name": "processor-rekognition", "path": "services/processor-rekognition", "port": 8089 },
    { "name": "processor-transcribe", "path": "services/processor-transcribe", "port": 8090 },
    { "name": "processor-normalize", "path": "services/processor-normalize", "port": 8091 },
    { "name": "processor-embed", "path": "services/processor-embed", "port": 8092 },
    { "name": "processor-indexer", "path": "services/processor-indexer", "port": 8093 },
    { "name": "memory-reflector", "path": "services/memory-reflector", "port": 8094 }
  ]
}
```

### Available Scripts

| Script | Purpose |
|--------|---------|
| `Setup-AwsProfile.ps1` | Configure AWS CLI profile with region/output |
| `Create-Ecr-Repos.ps1` | Ensure ECR repositories exist for all services |
| `Build-Push-All.ps1` | Build Docker images & push to ECR (parallel) |
| `Deploy-Cdk.ps1` | Deploy AWS infrastructure via CDK stacks |
| `Update-Ecs-Services.ps1` | Update ECS services with new image tags |
| `Scale-Workers.ps1` | Manually adjust worker task counts (pre-scale) |
| `Rollback-Service.ps1` | Roll back a service to previous task definition |
| `Seed-Fixtures.ps1` | Upload test documents to S3 for pipeline testing |
| `Smoke-Test.ps1` | Quick health/endpoint validation |

### Example: `Build-Push-All.ps1`

```powershell
param(
  [string]$Profile = "siqstack-dev",
  [string]$ConfigPath = "scripts/config.services.json",
  [string]$Tag = ""
)

$cfg = Get-Content $ConfigPath | ConvertFrom-Json
$account = $cfg.AccountId
$region = $cfg.Region
$project = $cfg.Project
$env = $cfg.Env

if ([string]::IsNullOrWhiteSpace($Tag)) {
  $sha = git rev-parse --short HEAD
  $Tag = "sha-$sha"
}

Write-Host "ECR login..." -ForegroundColor Cyan
aws ecr get-login-password --region $region --profile $Profile | `
  docker login --username AWS --password-stdin "$account.dkr.ecr.$region.amazonaws.com"

foreach ($svc in $cfg.Services) {
  $repoName = "$($project)/$($svc.name)-$env"
  $imageUri = "$account.dkr.ecr.$region.amazonaws.com/$repoName:$Tag"
  Push-Location $svc.path
  Write-Host "Building $($svc.name) -> $imageUri" -ForegroundColor Yellow
  docker build -t $imageUri . || throw "Build failed for $($svc.name)"
  docker push $imageUri || throw "Push failed for $($svc.name)"
  Pop-Location
}

Write-Host "All images built & pushed with tag: $Tag" -ForegroundColor Green
```

### Example: CDK ECS Service with SQS Scaling

```typescript
const queue = new sqs.Queue(this, 'PipelineQueue', { 
  visibilityTimeout: cdk.Duration.minutes(5) 
});

const taskDef = new ecs.FargateTaskDefinition(this, 'RouterTask', { 
  cpu: 512, 
  memoryLimitMiB: 1024 
});

taskDef.addContainer('app', {
  image: ecs.ContainerImage.fromEcrRepository(repo, 'latest'),
  logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'router' }),
  environment: { QUEUE_URL: queue.queueUrl }
});

const svc = new ecs.FargateService(this, 'RouterService', {
  cluster, 
  taskDefinition: taskDef, 
  desiredCount: 1
});

queue.grantConsumeMessages(taskDef.taskRole);

const scaling = svc.autoScaleTaskCount({ 
  minCapacity: 1, 
  maxCapacity: 50 
});

scaling.scaleOnMetric('QueueDepth', {
  metric: queue.metricApproximateNumberOfMessagesVisible(),
  scalingSteps: [
    { upper: 10, change: 0 },
    { lower: 11, upper: 100, change: +2 },
    { lower: 101, change: +5 },
  ]
});
```

---

## 🧠 Roadmap

- ✅ Text-based assistant MVP  
- 🔄 Voice + multimodal (audio & image) support  
- 📆 Calendar and productivity integrations  
- 🧩 Personalized Bedrock fine-tuning  
- 🪄 Smart Home / IoT commands  

---

## 🧾 License
MIT © 2025 [SIQstack](https://siqstack.com)

---

*Generated on 2025-10-06 — AWS-native design by Franco Presta*
