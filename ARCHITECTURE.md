# Autonomous Growth OS — Architecture Specification

## 1. System Topology

The Autonomous Growth OS is built as a modular system designed for resilience, observability, and strict change control:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   OPERATOR CONTROL ROOM (React 18)                     │
│  - Brand Scorecards (100k Target)    - Human Approval Queue (10 Gates) │
│  - Scored Demand Opportunities        - Emergency Kill Switch Controls  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ REST / JSON (Zod Validated)
┌──────────────────────────────────▼─────────────────────────────────────┐
│                    API CONTROL PLANE (Node/Express)                    │
│  - Tenant & Brand Router             - Workflow Orchestrator API       │
│  - Safety & SSRF Guard Middleware     - Cost Ledger & Audit Service     │
└─────────────────┬──────────────────────────────────────────┬───────────┘
                  │                                          │
┌─────────────────▼──────────────────┐   ┌───────────────────▼───────────┐
│     ORCHESTRATOR & AGENT WORKERS   │   │     CONNECTOR GATEWAY         │
│  - Durable DAG Engine              │   │  - Sitemap & RSS Inspector    │
│  - Idempotency & Deduplication     │   │  - GSC & Bing Connectors      │
│  - 18 Specialist Agent Contracts   │   │  - GA4 Analytics Connector    │
│  - Model Gateway (Cost-Capped)     │   │  - Social Adapters (LinkedIn) │
└─────────────────┬──────────────────┘   └───────────────────┬───────────┘
                  │                                          │
┌─────────────────▼──────────────────────────────────────────▼───────────┐
│                       POSTGRESQL RELATIONAL STORE                      │
│  - schema_migrations               - workspaces & brands               │
│  - demand_signals & topic_clusters - opportunities & versioned scores  │
│  - content_assets (10 QA results)  - approval_events & audit_events    │
│  - kill_switch_events              - traffic_observations (bot-flagged)│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Service Boundaries

### 2.1 Control Plane API
- **Responsibilities:** Manages workspace context, brand profiles, approval queue, kill switches, and observability feeds.
- **Constraints:** Every non-public request requires workspace context. Cross-tenant leakage is prevented at query level.

### 2.2 Agent Orchestration Engine
- **Responsibilities:** Translates high-level acquisition objectives into typed DAG tasks. Manages idempotency keys, retries with exponential backoff, and state persistence.
- **Durable Recovery:** Tasks that fail due to transient errors retry up to `max_retries` with bounded jittered backoff. Permanent errors transition to `failed` and log an audit incident.

### 2.3 Opportunity Scoring Engine
- **Formula Version:** `1.0.0`
- **Dimensions (11):** Demand evidence, Brand relevance, Intent strength, Content gap, Potential value, Freshness, Fulfilment capability, Expected effort, Cost, Uncertainty, and Policy risk.
- **Selection Threshold:** Weighted total $\ge 65.0$.
- **Hard Rejection Gates:** Policy risk $> 4.0$ or Brand relevance $< 5.0$.

### 2.4 Quality Governor
- **10 Verification Gates:** Demonstrable demand, distinct intent, substance/depth, citation integrity, transparent CTA, technical metadata, semantic layout, uniqueness, frequency caps, and brand safety.
- **Enforcement:** Assets failing any gate are held in `draft` with explicit remediation reasons; assets passing all 10 gates enter `approval_required`.

### 2.5 Connector Gateway
- **Contract:** Typed adapters declaring explicit capabilities (`read_public`, `read_analytics`, `publish_post`, etc.).
- **Truthful Status Reporting:** Instances with missing credentials report as `awaiting_credentials` and never fabricate data.
- **SSRF Filtering:** Outbound calls to cloud metadata IPs (`169.254.169.254`, `metadata.google`) or private RFC1918 subnets are blocked synchronously.

---

## 3. Data Flow & Transaction Boundaries

1. **Signal Discovery:** Connector ingests raw public metadata $\rightarrow$ SSRF verified $\rightarrow$ sanitised and stored in `demand_signals` (`is_demo_data = FALSE`).
2. **Topic Clustering & Scoring:** Market Scout & Scorer evaluate signal $\rightarrow$ compute 11-dimension score $\rightarrow$ store in `opportunity_scores`.
3. **Experience Synthesis:** Content Builder synthesises differentiated asset using Model Gateway (bounded by `$0.50` task budget).
4. **Quality Audit:** Quality Governor runs 10 gates $\rightarrow$ attaches results to `content_assets`.
5. **Approval Queue:** Workflow pauses at `awaiting_approval` and inserts row into `approval_events`.
6. **Human Gate:** Operator inspects asset and signs off $\rightarrow$ only then is asset eligible for distribution planning.
