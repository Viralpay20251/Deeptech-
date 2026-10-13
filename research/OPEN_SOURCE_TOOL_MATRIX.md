# Autonomous Growth OS — Open-Source Tool Due-Diligence Matrix

**Snapshot Date:** 13 October 2026  
**Auditor:** Principal Software Architect  
**Specification Reference:** Master Build Prompt Section 26.2, Section 34, and Section 36  

---

## 1. Candidate Evaluation Matrix

| Category | Candidate Repository | Licence & SPDX | Release / Activity | Operational Dependencies | Commercial SaaS Risk | Decision | Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Agent Runtime** | [LangGraph](https://github.com/langchain-ai/langgraph) | MIT (`MIT`) | Active (v0.2+) | Python / Node.js, SQLite/PostgreSQL | **Low** (Permissive core) | **Adopt / Shortlist** | Durable state graphs, human-in-the-loop checkpoints. |
| **Agent Runtime** | [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) | MIT (`MIT`) | Active (2026 releases) | Python / .NET runtime | **Low** | **Compare (Runner-up)** | Successor to AutoGen; compare with LangGraph under identical test slice. |
| **Agent Runtime** | [AutoGen](https://github.com/microsoft/autogen) | Creative / Mixed | Stated Maintenance Mode | Python | **High** (Deprecation risk) | **Reject** | Deprecated by Microsoft in favor of Microsoft Agent Framework. |
| **Agent Tooling** | [Pydantic AI](https://github.com/pydantic/pydantic-ai) | MIT (`MIT`) | Active | Python, Pydantic v2 | **Low** | **Adopt (Patterns)** | Typed outputs, structured schema validation for specialist agents. |
| **Agent Tooling** | [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) | MIT (`MIT`) | Active | Python, OpenAI API | **Medium** (Provider lock-in) | **Isolate** | Use for provider-specific flows behind internal Model Gateway. |
| **Agent Tooling** | [Google ADK](https://github.com/google/adk-python) | Apache-2.0 (`Apache-2.0`) | Active | Python, Google AI Studio | **Low** | **Isolate** | Clean evaluation harness; isolate behind Model Gateway. |
| **Workflow Engine** | [Temporal](https://github.com/temporalio/temporal) | MIT Server (`MIT`) | Highly Active | Temporal Server, PostgreSQL/Cassandra | **Low** (Clean separation) | **Adopt for Scale** | Industry gold standard for deterministic workflow replay, timers, and crash recovery. |
| **Workflow Engine** | [Prefect](https://github.com/PrefectHQ/prefect) | Apache-2.0 (`Apache-2.0`) | Active | Python, SQLite/PostgreSQL | **Low** | **Compare (Runner-up)** | Strong for Python-centric data engineering pipelines. |
| **Workflow Engine** | [Activepieces](https://github.com/activepieces/activepieces) | MIT Core / Commercial EE | Active | Node.js, PostgreSQL, Redis | **Medium** (Dual-licensed) | **Adapt Patterns Only** | Audit subtrees; do not import enterprise folders. |
| **Workflow Engine** | [n8n](https://github.com/n8n-io/n8n) | Fair-Code / Sustainable Use | Active | Node.js, PostgreSQL | **CRITICAL HIGH** (Non-OSI) | **Reject for Embedding** | Prohibits commercial hosted SaaS resale. Internal reference only. |
| **Web Crawling** | [Crawlee](https://github.com/apify/crawlee) | Apache-2.0 (`Apache-2.0`) | Highly Active | Node.js, Playwright / Cheerio | **Low** | **Adopt (TS Stack)** | Native TypeScript crawling, robots.txt, session pools, SSRF hooks. |
| **Web Crawling** | [Scrapy](https://github.com/scrapy/scrapy) | BSD-3-Clause (`BSD-3-Clause`) | Mature & Active | Python, Twisted / Asyncio | **Low** | **Compare (Python)** | Industry standard for structured batch crawling. |
| **AI Extraction** | [Crawl4AI](https://github.com/unclecode/crawl4ai) | Apache-2.0 (`Apache-2.0`) | Beta / Active | Python, Playwright, LLM | **Medium** (Beta stability) | **Spike / Benchmark** | Benchmarked for LLM markdown extraction; test error recovery. |
| **SEO Tools** | [OpenSEO](https://github.com/every-app/open-seo) | MIT (`MIT`) | Moderate | Python, DataForSEO API account | **Medium** (Data costs) | **Adapt Patterns Only** | Workflows are valuable reference; requires paid external API keys. |
| **SEO Tools** | [CrawlSEO](https://github.com/crawlseo/crawlseo) | MIT (`MIT`) | Active | Node.js / Python | **Low** | **Inspect Reference** | GSC ingestion patterns; maintain multi-channel scope. |
| **Rank Tracking** | [SerpBear](https://github.com/towfiqi/serpbear) | GPL-3.0 (`GPL-3.0`) | Moderate | Node.js, Scraping proxies | **CRITICAL HIGH** (GPL + Scrape) | **Reject** | Copyleft license; scraping SERPs violates search engine terms. |
| **Vector Storage** | [pgvector](https://github.com/pgvector/pgvector) | PostgreSQL (`PostgreSQL`) | Highly Active | PostgreSQL 15+ extension | **Zero** | **Adopt** | Eliminates extra infrastructure; provides HNSW and IVFFlat in existing DB. |
| **Vector Storage** | [Qdrant](https://github.com/qdrant/qdrant) | Apache-2.0 (`Apache-2.0`) | Highly Active | Rust binary, standalone service | **Low** | **Defer** | Evaluate only when vector count exceeds $1\text{M}$ embeddings. |
| **Search Engine** | [Meilisearch](https://github.com/meilisearch/meilisearch) | MIT Community / BSL EE | Active | Standalone binary | **Medium** (Edition split) | **Defer** | Retain PostgreSQL FTS until dedicated search latency requires it. |
| **Search Engine** | [SearXNG](https://github.com/searxng/searxng) | AGPL-3.0 (`AGPL-3.0`) | Active | Python, Redis | **CRITICAL HIGH** (Network copyleft)| **Reject for Commercial** | AGPL-3.0 creates severe network copyleft obligations. |
| **Deduplication** | [datasketch](https://github.com/ekzhu/datasketch) | MIT (`MIT`) | Stable | Python / NumPy | **Low** | **Adopt (Patterns)** | MinHash and LSH indexing for near-duplicate and cannibalisation detection. |
| **Change Detection**| [ruptures](https://github.com/deepcharles/ruptures) | BSD-2-Clause (`BSD-2-Clause`) | Stable | Python / NumPy | **Low** | **Adopt** | Offline PELT and binary segmentation for historical trend breaks. |
| **Online Learning**| [Vowpal Wabbit](https://github.com/VowpalWabbit/vowpal_wabbit) | BSD-3-Clause (`BSD-3-Clause`) | Mature | C++ / Python bindings | **Low** | **Defer (Phase 6)** | Contextual bandits (LinUCB) after sufficient traffic rewards exist. |
| **Causal ML** | [CausalML](https://github.com/uber/causalml) | Apache-2.0 (`Apache-2.0`) | Active | Python, scikit-learn | **Low** | **Defer (Phase 6)** | Uplift modeling requires verified baseline and holdout data. |
| **Analytics** | [Umami](https://github.com/umami-software/umami) | MIT (`MIT`) | Active | Node.js, PostgreSQL | **Low** | **Inspect Reference** | Privacy-first analytics patterns for OS-owned content hub. |
| **Analytics** | [PostHog](https://github.com/PostHog/posthog) | MIT Core / Proprietary EE | Active | Python, ClickHouse, Kafka | **Medium** (Ops weight) | **Inspect Reference** | High operational overhead; adopt event schema patterns. |
| **Experimentation**| [GrowthBook](https://github.com/growthbook/growthbook) | MIT Core / Commercial EE | Active | Node.js, MongoDB/PostgreSQL | **Low (Core only)** | **Adopt (Core)** | Statistical engine, A/B test assignment, and guardrail tracking. |
| **AI Tracing** | [Langfuse](https://github.com/langfuse/langfuse) | MIT Core / Commercial EE | Active | Node.js, PostgreSQL | **Low** | **Shortlist** | Observability, token cost ledger, prompt versioning. |
| **AI Observability**| [Arize Phoenix](https://github.com/Arize-ai/phoenix) | Elastic License 2.0 | Active | Python runtime | **CRITICAL HIGH** (Custom license)| **Reject for Embedding** | Non-OSI license restricts commercial SaaS embedding. |
| **Prompt Testing** | [Promptfoo](https://github.com/promptfoo/promptfoo) | MIT (`MIT`) | Highly Active | Node.js CLI / library | **Low** | **Adopt in CI/CD** | Regression testing, prompt injection fuzzing, rubric evaluation. |
| **Social Sched.** | [Postiz](https://github.com/gitroomhq/postiz-app) | AGPL-3.0 (`AGPL-3.0`) | Active | Node.js, PostgreSQL, Redis | **CRITICAL HIGH** (AGPL) | **Reject for Embedding** | Strong features, but AGPL-3.0 imposes network copyleft on SaaS. |
| **Video Creation** | [Remotion](https://github.com/remotion-dev/remotion) | Custom Commercial | Active | Node.js, Chromium, React | **HIGH** (Commercial terms) | **Reject for SaaS Core** | Strict company revenue limits; requires paid enterprise license. |
| **Media Transform**| [FFmpeg](https://github.com/FFmpeg/FFmpeg) | LGPL / GPL (Build flags) | Mature | Native binary | **Medium** (Patent/build flags)| **Adopt (LGPL build)** | Transcoding, thumbnail extraction, and clipping using LGPL flags only. |
| **Agent Team OS** | [AdClaw](https://github.com/Citedy/adclaw) | Apache-2.0 (`Apache-2.0`) | Active (v0.8+) | Python, Docker, React, Redis | **Low** (Permissive) | **Adopt Patterns** | Multi-agent personas (SOUL.md), 122 marketing skills, LLM fallback chain. Isolate Citedy cloud credit hooks. |
| **SEO/AEO Agent** | [Citeworthy SEO Agent](https://github.com/citeworthyio/seo-agent) | MIT (`MIT`) | Active | Cloudflare Workers, D1, KV | **Zero** (Permissive) | **Adopt Core Patterns** | Fail-open KV metadata overrides, deterministic (path, rule) issue lifecycle, GSC integration, 2026 AEO/GEO deliverability audit. |
| **Agentic SEO** | [Agentic SEO Agent](https://github.com/DafinEdison/agentic-seo-agent) | AGPL-3.0 (`AGPL-3.0`) | Active | Node.js, GSC API, LLMs | **CRITICAL HIGH** (AGPL) | **Research Reference Only** | Multi-round tool loop, GSC query trend diagnosis, Anti-Words anti-slop dictionary. Clean-room TypeScript reimplementation. |
| **Social Auto Agent**| [Social Agent AI](https://github.com/YusufSizmaz/social-agent-ai) | MIT (`MIT`) | Active | Node.js, PostgreSQL, Gemini | **Zero** (Permissive) | **Adopt Core Patterns** | Multi-platform publishing (X, IG, YT, TikTok), SKIP LOCKED Postgres worker queue, platform character/media bounds validation. |
| **Social Video Agent**| [AI Social Agent (Nuraveda)](https://github.com/Nuraveda-Labs/ai-social-agent) | MIT (`MIT`) | Active | Python, Alembic, Celery | **Low** (Permissive) | **Inspect Reference** | Multi-brand signal discovery, video generation hooks, ORM sentiment monitoring with human approval gates. |
| **Social Management**| [Postmill AI](https://github.com/postmill-ai/postmill-app) | AGPL-3.0 (`AGPL-3.0`) | Active | Next.js, NestJS, Inngest | **CRITICAL HIGH** (AGPL) | **Barred from Direct Use** | 45+ channel schemas; AGPL-3.0 prevents commercial SaaS embedding. Study connector API schemas only. |
| **Growth Playbooks**| [Growth Marketing OS](https://github.com/growthack88/growth-marketing-os) | MIT (`MIT`) | Active | Markdown / Prompts / MCP | **Zero** (Permissive) | **Adopt Knowledge Assets**| Comprehensive growth prompt library, Claude skills, and experimental playbooks for agent context injection. |

---

## 2. Procurement & Adoption Principles

1. **Permissive Core First:** Core proprietary business logic must only link against permissively licensed dependencies (`MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `PostgreSQL`).
2. **Copyleft Isolation Policy:** Any tool licensed under `GPL-3.0` or `AGPL-3.0` (such as Postiz, SerpBear, SearXNG) must **never be embedded, imported, or statically linked** into the commercial codebase.
3. **Source-Available Caution:** Systems with fair-code, Elastic 2.0, or Polyform licenses (n8n, Phoenix, AutoGPT platform) are barred from commercial customer distribution unless formal legal counsel sign-off is granted.
4. **Minimal Operational Complexity:** Do not deploy independent clusters (Kafka, ClickHouse, Vespa) during initial proving milestones. PostgreSQL + pooler handles transactional and analytical needs up to 100k MAU validation.
