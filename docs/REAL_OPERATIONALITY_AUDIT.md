# Autonomous Growth OS — Real Operationality Audit

**Audit Date:** 2026-10-14  
**Audit Baseline Commit:** `b5484d9` (with Phase 0 & Phase 1 remediation committed)  
**Database:** Supabase PostgreSQL (`aws-0-ap-south-1.pooler.supabase.com:5432`)  
**Operating Mode:** Strict Truthfulness (`OPERATING_MODE=live` in production, zero silent simulator fallbacks)

---

## Operational State Classification Taxonomy

Every capability in the Growth OS is classified under exactly one truthful state:

- **`LIVE_VERIFIED`**: A genuine network request to an authoritative external endpoint or upstream provider succeeded, returned real data, and was persisted/reconciled.
- **`LIVE_CONFIGURED_UNVERIFIED`**: Credentials or configuration exist in the environment, but a fresh capability test has not been executed or verified in this session.
- **`AWAITING_CREDENTIALS`**: Implementation is operational in code, but real production OAuth tokens, API keys, or access grants are absent.
- **`UNSUPPORTED`**: Catalog entry or prototype definition only; no working production execution adapter is present.
- **`DEGRADED` / `FAILED`**: The last execution failed, upstream returned an error, or observed data is stale (>24h without refresh).
- **`SIMULATION`**: Permitted strictly in isolated test suites or an explicitly labeled demo mode with `is_simulated: true`. Never returns synthetic success in production.

---

## 1. Core Platform & Infrastructure

| Subsystem | Function / Endpoint | Evidence Source | Operational State | Last Verified | Limitations & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Database Pool** | `apps/api/src/lib/db.ts` | Supabase Postgres query | `LIVE_VERIFIED` | 2026-10-14 14:44 UTC | 29 registered domains, schema migrations up to 018. SSL enabled. |
| **Migrations** | `apps/api/src/db/migrate.ts` | `schema_migrations` table | `LIVE_VERIFIED` | 2026-10-14 14:44 UTC | 19 migrations applied: `001` through `018_durable_job_queue.sql`. |
| **Durable Queue** | `apps/api/src/services/job-queue-service.ts` | `job_queue` & `claim_next_job()` | `LIVE_VERIFIED` | 2026-10-14 14:44 UTC | Backed by PostgreSQL `FOR UPDATE SKIP LOCKED`. Dead-letter table & heartbeat leases active. |
| **Worker Cron** | `vercel.json` (`*/5 * * * *`) | Cron trigger endpoint | `LIVE_CONFIGURED_UNVERIFIED` | 2026-10-14 14:45 UTC | Scheduled every 5 min. Protected by `CRON_SECRET` with timing-safe comparison. |
| **Auth & RBAC** | `apps/api/src/middleware/auth.ts` | JWT / users table | `LIVE_VERIFIED` | 2026-10-14 14:48 UTC | Workspace tenant isolation and operator role verification. Anonymous mutations rejected. |
| **SSRF Safety** | `apps/api/src/lib/safety.ts` | `assertSafeOutboundUrlAsync` | `LIVE_VERIFIED` | 2026-10-14 13:30 UTC | Tested against private IPs, AWS metadata (`169.254.169.254`), non-standard ports, user:pass creds. |

---

## 2. Multi-Domain Registry & Health Probes (26 Hosts + 3 Excluded)

| Domain Scope | Component / Route | Evidence Source | Operational State | Last Verified | Limitations & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TalentXcel (13 Hosts)** | `POST /api/v1/domains/check-health` | Live DNS lookup (`getaddrinfo`) & TLS probe | `LIVE_VERIFIED` | 2026-10-14 13:58 UTC | 13/13 authoritative hosts resolve and respond. `employer` and `employers` strictly distinct. |
| **CHATR (3 Hosts)** | `DomainRegistryService.checkDomainHealth` | Live HTTP probe & app shell detection | `LIVE_VERIFIED` | 2026-10-14 13:58 UTC | `chatr.chat`, `chatrchat.in`, `www.chatrchat.in` pass DNS/TLS/HTTP. Correctly diagnosed as JS app shells. |
| **Nuty Tales (10 Hosts)** | `DomainRegistryService.checkDomainHealth` | Live DNS, TLS & HTTP probe | `LIVE_VERIFIED` | 2026-10-14 13:58 UTC | 10/10 authoritative hosts resolve. Content inspection bounded. |
| **Legacy Excluded (3 Hosts)** | `DomainRegistryService.updateDomain` | Policy boundary guard | `LIVE_VERIFIED` | 2026-10-14 13:58 UTC | `www.talentxcel.net`, `auth.talentxcel.in`, `cdn.talentxcel.in` barred from crawling and index submission. |
| **Health Summary** | `GET /api/v1/domains/summary` | `registered_domains.health_matrix` | `LIVE_VERIFIED` | 2026-10-14 14:46 UTC | Discloses `source: 'persisted_history'`, `is_live_probe: false`, latest/oldest check timestamps and freshness status. |

---

## 3. Model Gateway & AI Capabilities

| Provider / Model | Implementation | Evidence Source | Operational State | Last Verified | Limitations & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **OpenAI (`gpt-4o-mini`)** | `apps/api/src/services/model-gateway.ts` | Upstream OpenAI API | `AWAITING_CREDENTIALS` | — | Code implemented. Requires `OPENAI_API_KEY`. Fails closed with typed `ModelProviderError`. |
| **Anthropic (`claude-3-haiku`)** | `apps/api/src/services/model-gateway.ts` | Upstream Anthropic API | `AWAITING_CREDENTIALS` | — | Code implemented. Requires `ANTHROPIC_API_KEY`. Fails closed with typed `ModelProviderError`. |
| **Google AI (`gemini-1.5-flash`)** | `apps/api/src/services/model-gateway.ts` | Upstream Google Generative AI | `AWAITING_CREDENTIALS` | — | Code implemented. Requires `GOOGLE_AI_API_KEY`. Fails closed with typed `ModelProviderError`. |
| **Ollama (`llama3.2`)** | `apps/api/src/services/model-gateway.ts` | `http://localhost:11434/api/chat` | `DEGRADED` | 2026-10-14 14:35 UTC | Not reachable in cloud runtime. Throws `PROVIDER_UNAVAILABLE` rather than falling back to simulator. |
| **Deterministic Simulator** | `ModelGateway.callDeterministicSimulator` | In-memory rule engine | `SIMULATION` | 2026-10-14 14:35 UTC | Strictly restricted to `NODE_ENV=test`. Hard-blocked in production. |

---

## 4. Platform Connectors & Integrations

| Connector Type | Capability | Evidence Source | Operational State | Last Verified | Limitations & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`sitemap_rss_inspector`** | Sitemap & RSS discovery | `SitemapRssConnector.fetchSitemap` | `LIVE_VERIFIED` | 2026-10-13 21:00 UTC | Public endpoint crawling. SSRF checked. No credentials needed. |
| **`indexnow`** | URL submission to Bing/Yandex | `IndexNowConnector.submitUrls` | `LIVE_CONFIGURED_UNVERIFIED` | — | Key registered. Submissions reported as "submitted", never falsely as "indexed". |
| **`pagespeed_crux`** | PageSpeed Insights audit | `PageSpeedCruxConnector.runAudit` | `LIVE_VERIFIED` | 2026-10-13 21:00 UTC | Public Google PageSpeed API. Throws error on failure, zero false-success fallback. |
| **`crossref_openalex`** | Academic query search | `CrossrefOpenalexConnector.searchPapers` | `LIVE_VERIFIED` | 2026-10-13 21:00 UTC | Public API. Real DOI and metadata persisted. |
| **`wikipedia_wikidata`** | Knowledge graph entities | `WikipediaConnector.getEntitySummary` | `LIVE_VERIFIED` | 2026-10-13 21:00 UTC | Public MediaWiki API. Real entity extraction. |
| **`google_search_console`** | Search Analytics & Property list | Google OAuth & Search Console API | `AWAITING_CREDENTIALS` | — | Requires OAuth grant. Token verification probe checks `tokeninfo` endpoint before marking connected. |
| **`google_analytics_4`** | GA4 Data API reports | Google OAuth & Analytics Data API | `AWAITING_CREDENTIALS` | — | Requires OAuth grant. Zero placeholder session or user counts permitted. |
| **`linkedin` / `linkedin_pages`** | Profile & Company distribution | LinkedIn REST API (`userinfo`) | `AWAITING_CREDENTIALS` | — | Real probe implemented. Rejects placeholder tokens with 400. |
| **`meta` / `meta_pages`** | Graph API page publishing | Meta Graph API (`/me`) | `AWAITING_CREDENTIALS` | — | Real probe implemented. Rejects placeholder tokens with 400. |
| **Catalog-only Connectors** | Other 12 connector definitions | `connector_definitions` table | `UNSUPPORTED` | — | Sync attempts return typed `UNSUPPORTED_CONNECTOR` error. Zero increment of `rowsFetched`. |

---

## 5. Web Crawler & SEO Auditing Engine

| Component | Function / Route | Evidence Source | Operational State | Last Verified | Limitations & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Crawl Job Creation** | `POST /api/v1/crawler/jobs` | `crawl_jobs` DB table | `LIVE_VERIFIED` | 2026-10-14 14:45 UTC | Bounded max_pages (max 200). Scope and profile validated. |
| **Standalone Crawler Worker**| `CrawlerWorker.processNextJob` | `apps/api/src/workers/crawler-worker.ts` | `LIVE_VERIFIED` | 2026-10-14 14:45 UTC | Claims pending jobs atomically with `SKIP LOCKED`. Updates heartbeat. |
| **URL Fetch & HTML Parser** | `CrawlEngineService.crawlSingleUrl` | `node-html-parser` + Axios | `LIVE_VERIFIED` | 2026-10-13 20:30 UTC | SSRF checked on every hop. Extracts metadata, OG, Twitter, schema. |
| **Robots.txt Parser** | `robots-parser` | robots.txt HTTP retrieval | `LIVE_VERIFIED` | 2026-10-13 20:30 UTC | Published User-Agent: `AutonomousGrowthOS-DiscoveryBot/2.0`. |
| **Technical SEO Rules** | `SeoAuditService.auditUrl` | `apps/api/src/services/seo-audit-service.ts` | `LIVE_VERIFIED` | 2026-10-13 20:30 UTC | Deterministic diagnostic rules. No synthetic score inflation. |

---

## 6. Meta Tags & Schema Studio V3

| Capability | Function / Route | Evidence Source | Operational State | Last Verified | Limitations & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Inspect URL** | `POST /api/v1/meta-studio/inspect` | Real-time HTTP GET + DOM extraction | `LIVE_VERIFIED` | 2026-10-13 21:30 UTC | Extracts observed tags, H1, word count, canonical, schema facts. |
| **Image Verification** | `POST /api/v1/meta-studio/image-check` | SSRF-safe HEAD/GET probe | `LIVE_VERIFIED` | 2026-10-13 21:30 UTC | Confirms HTTP 200, MIME type `image/*`, byte length. |
| **Schema Grounding** | `MetaStudioService.validateSchemaGrounding` | Rule-based DOM fact matcher | `LIVE_VERIFIED` | 2026-10-13 21:30 UTC | Flags commercial/price fabrication and ungrounded schema claims. |
| **Proposal Decisions** | `POST /api/v1/meta-studio/proposals/:id/decide` | `metadata_proposals` table | `LIVE_VERIFIED` | 2026-10-14 14:46 UTC | Scoped by workspace. Requires genuine operator role. Audit logged. |
| **Simulated Previews** | Frontend preview render | `apps/web/src/components/MetaStudioView.tsx` | `SIMULATION` | 2026-10-13 21:30 UTC | Explicitly labeled as local simulated previews. |

---

## 7. Evidence & Claims Verification

| Capability | Function / Route | Evidence Source | Operational State | Last Verified | Limitations & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Claim Auditor** | `POST /api/v1/evidence/audit-claim` | `apps/api/src/services/evidence-service.ts` | `LIVE_VERIFIED` | 2026-10-13 22:00 UTC | Rejects placeholder domains (`example.com`, `standards.org`). Checks citations. |
| **Evidence Ledger** | `GET /api/v1/evidence` | `evidence_records` table | `LIVE_VERIFIED` | 2026-10-13 22:00 UTC | Persists verified citations, claims, and audit timestamps. |

---

## 8. Summary of Non-Live Features & Required Next Actions

1. **Model API Keys**: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_AI_API_KEY` must be provisioned in environment secrets before generative completions can execute. (Fails closed with typed error until configured).
2. **Search Console & GA4 OAuth**: Requires operator to perform OAuth authorization via `/api/v1/auth/google/authorize` with real Google Cloud client credentials.
3. **Product MAU Telemetry**: Event streams from CHATR, TalentXcel, and Nuty Tales are not yet connected. MAU metrics remain honest: `unverified / not connected`. Zero synthetic numbers are displayed.
