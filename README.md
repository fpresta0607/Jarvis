# 🧠 Jarvis — Personal AI Assistant on AWS Fargate
> A secure, self-hosted, auto-scaling AI assistant that connects to your personal data — emails, photos, files, and more — entirely within your AWS account.

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
  user["User (Browser)"] --> ui["Web App (CloudFront + S3 + Cognito)"]
  ui --> api["API Gateway (HTTP + WS)"]
  api --> ecs_api["ECS: api-bff"]
  ecs_api --> ecs_chat["ECS: chat-orchestrator"]

  %% ==== Ingestion Pipeline ====
  subgraph Ingestion_Pipeline
    ui -. "Pre-signed PUT" .-> s3_raw["S3 Raw Bucket"]
    ses_in["SES Inbound"] --> s3_raw
    s3_raw --> sqs_ing["SQS Ingest Queue"]
    sqs_ing --> sfn["Step Functions: ProcessObject"]

    sfn --> tex["Textract (PDF/Scans)"]
    sfn --> rek["Rekognition (Images)"]
    sfn --> trs["Transcribe (Audio/Video)"]
    sfn --> cmp["Comprehend (Entities/PII)"]

    tex --> norm["Normalize + Chunk"]
    rek --> norm
    trs --> norm
    cmp --> norm

    norm --> emb["Embed (Bedrock)"]
    emb --> os[("OpenSearch (Vector+BM25)")]
    norm --> s3_cur["S3 Curated Bucket"]
    s3_cur -. "KB sync" .-> kb["Bedrock Knowledge Base"]
  end

  %% ==== Assistant Retrieval ====
  ecs_chat --> agent["Bedrock Agent"]
  agent --> kb
  agent --> os

  %% ==== Actions / Tools ====
  subgraph Actions
    agent --> t_email["ECS: tools-email"]
    t_email --> ses_out["SES Send"]

    agent --> t_tasks["ECS: tools-tasks"]
    t_tasks --> ddb["DynamoDB (Tasks/Drafts/Sessions)"]

    agent --> t_rem["ECS: tools-reminders"]
    t_rem --> evb["EventBridge (Schedules)"]
    evb --> sns["SNS / Notifications"]
  end

  %% ==== Long-term Memory ====
  subgraph Memory
    nightly["ECS: memory-reflector (Nightly)"] --> aur["Aurora pgvector (User Memory)"]
    nightly --> os
  end

  %% ==== Cross-links ====
  sfn -. "may invoke" .-> ecs_proc["ECS: processor-* (optional workers)"]
  ecs_api --> os
  ecs_api --> ddb
  ecs_api --> evb

```
</details>

---

## 🧱 ECS Fargate Services

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
  user[User] --> web[Web App]
  web --> api[API Gateway]
  api --> ecs[ECS Cluster]
  ecs --> s3[(S3)]
  ecs --> os[(OpenSearch)]
  ecs --> kb[Bedrock KB]
  ecs --> aur[(Aurora pgvector)]
  ecs --> ddb[(DynamoDB)]
```

### Level 1 — Ingestion

```mermaid
flowchart LR
  ses[SES Inbound] --> s3raw[(S3 Raw)]
  s3raw --> sqs[(SQS Ingest Queue)]
  sqs --> router[ECS: pipeline-router]
  router --> sfn[[Step Functions]]
  sfn --> tex[Textract]
  sfn --> rek[Rekognition]
  sfn --> trs[Transcribe]
  sfn --> norm[Normalize + Chunk]
  norm --> emb[Bedrock Embeddings]
  emb --> os[(OpenSearch)]
  norm --> s3cur[(S3 Curated)]
```

### Level 1 — Chat & Actions

```mermaid
flowchart LR
  user --> web --> api --> bff[ECS: api-bff]
  bff --> chat[ECS: chat-orchestrator]
  chat --> agent[Bedrock Agent]
  agent --> kb[Bedrock KB]
  agent --> os
  agent --> email[ECS: tools-email]
  agent --> tasks[ECS: tools-tasks]
  agent --> rem[ECS: tools-reminders]
```

---

## 🧩 UML Diagrams

### Component Diagram

```mermaid
graph TB
  subgraph Client
    Web[Next.js Web App]
  end
  subgraph AWS
    CF[CloudFront]
    APIGW[API Gateway]
    ECS1[api-bff]
    ECS2[chat-orchestrator]
    ECS3[search-service]
    Tools[tools-*]
    Proc[processors-*]
    Mem[memory-reflector]
    OS[(OpenSearch)]
    S3[(S3)]
    DDB[(DynamoDB)]
    AUR[(Aurora pgvector)]
    BR[Bedrock Agent + KB]
  end
  Web --> CF --> APIGW --> ECS1 --> ECS2 --> BR
  ECS2 --> OS
  ECS2 --> Tools
  ECS2 --> DDB
  ECS2 --> AUR
  Proc --> S3
  Proc --> OS
  Mem --> AUR
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
  Browser --> CF["CloudFront"]
  CF --> APIGW["API Gateway"]
  APIGW --> NLB["Internal NLB"]
  NLB --> ECS["ECS Cluster (Private Subnets)"]
  ECS --> S3["(S3)"]
  ECS --> OS["(OpenSearch)"]
  ECS --> DDB["(DynamoDB)"]
  ECS --> AUR["(Aurora pgvector)"]
  ECS --> BR["Bedrock Agent"]
```

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

```powershell
pwsh scripts/Setup-AwsProfile.ps1
pwsh scripts/Create-Ecr-Repos.ps1
pwsh scripts/Build-Push-All.ps1 -Tag sha-xxxx
pwsh scripts/Deploy-Cdk.ps1
pwsh scripts/Update-Ecs-Services.ps1 -Tag sha-xxxx
```

Scripts included:
- `Setup-AwsProfile.ps1`
- `Create-Ecr-Repos.ps1`
- `Build-Push-All.ps1`
- `Deploy-Cdk.ps1`
- `Update-Ecs-Services.ps1`
- `Scale-Workers.ps1`
- `Rollback-Service.ps1`
- `Seed-Fixtures.ps1`

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
