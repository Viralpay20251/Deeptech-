# Autonomous Growth OS — Research Log

**Snapshot Date:** 13 October 2026  
**Auditor:** Principal Software Architect & AI Systems Engineer  
**Purpose:** Technical investigation into candidate open-source software, algorithmic models, API feasibility, and commercial licensing compatibility for the Autonomous Growth OS.  

---

## 1. Research Questions Investigated

1. **Orchestration Runtime:** Can a stateful graph (LangGraph / Microsoft Agent Framework) or durable execution runtime (Temporal / Prefect) guarantee failure recovery and human-in-the-loop approvals without overwhelming operational overhead?
2. **Search & Crawling:** What is the legal, technical, and performance tradeoff between Python-based crawlers (Scrapy), TypeScript engines (Crawlee), and AI-tailored extractors (Crawl4AI)?
3. **Database & Retrieval Strategy:** Does early workload justify a dedicated vector database (Qdrant) or search cluster (OpenSearch/Vespa), or is PostgreSQL FTS + `pgvector` sufficient?
4. **Algorithmic Baselines:** What transparent, deterministic baselines should precede machine learning for opportunity ranking, trend change detection, topic clustering, and near-duplicate detection?
5. **Channel Feasibility:** What are the actual official API terms, quotas, and app review gates for LinkedIn, YouTube, Meta, TikTok, and Reddit?
6. **Commercial Licensing Due Diligence:** Which open-source projects pose hidden copyleft or non-commercial traps (AGPL-3.0, Elastic License, BSL, Fair-Code) that would block commercializing the OS as a proprietary SaaS?

---

## 2. Key Verified Facts vs Repository Claims

| Item | Repository Claim / Marketing Headline | Verified Technical / Legal Fact |
| :--- | :--- | :--- |
| **OpenSEO** | "Open-source SEO tool suite" | Repository code is MIT, but keyword & backlink data relies on a paid external DataForSEO API account. Code is not free data. |
| **CrawlSEO** | "Self-hosted GSC, crawler & MCP tool" | MIT licensed, but tightly coupled to GSC only. The Growth OS requires multi-channel demand discovery. |
| **Postiz** | "Open-source social media scheduling" | Root repository is licensed under **AGPL-3.0**. Embedding into a hosted commercial SaaS without copyleft review is a major legal risk. |
| **n8n** | "Open source workflow automation" | Licensed under the Sustainable Use License / Fair-Code, **not OSI open source**. Prohibits commercial hosted resale without paid commercial license. |
| **Arize Phoenix** | "AI observability & tracing" | Licensed under **Elastic License 2.0**. Commercial redistribution or embedding requires legal clearance. |
| **Remotion** | "Programmatic React video generation" | Custom commercial license with company revenue/size restrictions. Not free for commercial SaaS resale. |
| **TikTok Content Posting** | "Direct video posting API" | Unaudited developer apps are restricted to private video visibility only. Public posting requires formal audit approval. |
| **Reddit Data API** | "Public developer data API" | Terms updated July 2026 strictly require commercial agreements for automated commercial listening or training. |
| **Google Search** | "SEO ranking automation" | Scaled-content abuse policy explicitly treats high volumes of unoriginal pages generated for rank manipulation as search abuse. |

---

## 3. Core Findings & Architecture Decisions Summary

### 3.1 Orchestration Decision
- **Finding:** A modular TypeScript DAG Orchestrator with database persistence and idempotency keys satisfies Phase 1–3 requirements with zero external server dependencies.
- **Durable Engine Benchmark:** For multi-day workflows, Temporal (MIT server) provides the strongest replay and timer semantics. LangGraph and Microsoft Agent Framework provide powerful state-graph abstractions, but should be isolated behind our internal `WorkflowOrchestrator` contract.

### 3.2 Storage & Search Decision
- **Finding:** PostgreSQL with `tsvector` full-text search and `pgvector` provides dense semantic recall and lexical precision in a single operational unit.
- **Decision:** Do not introduce Qdrant, Meilisearch, or OpenSearch until document volume exceeds $500,000$ items or latency benchmarks degrade below $150\text{ms}$.

### 3.3 Scoring & Quality Verification
- **Finding:** LLMs must never be the sole authority for opportunity selection or publishing approval ("LLM-as-judge" bias).
- **Decision:** Implemented an explainable 11-dimension scoring model (`v1.0.0`) with hard rejection gates (Policy Risk $> 4.0$ or Brand Relevance $< 5.0$), coupled with 10 deterministic Quality Governor gates.

---

## 4. Open Questions & Pending Research Items

1. **LinkedIn Partner API Review Timeline:** What is the average enterprise app review lead time for LinkedIn Community Management API for company page posting?
2. **Meta Graph API Business Verification:** Required documentation for Meta App Review to enable `instagram_content_publish` for organic brand publishing.
3. **GA4 Data API Real-time Latency:** Standard GA4 reporting latency is 24–48 hours; verify whether BigQuery streaming export is necessary for intraday traffic anomalies.
