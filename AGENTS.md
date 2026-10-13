# Autonomous Growth OS — Specialist Agent Contracts

## 1. Multi-Agent Orchestration Architecture

The Autonomous Growth OS operates through **18 typed specialist agents**. Each agent operates under:
- **Least-Privilege Tool Access:** Agents can only invoke tools explicitly granted in `agent_definitions.permitted_tools`.
- **Structured Schema Contracts:** Structured JSON inputs and outputs validated via Zod schemas.
- **Autonomy Ladder:** Explicit policy levels (Level 0: Observe to Level 4: Expanded Autonomy). Initial deployment runs strictly at Levels 0–2.

---

## 2. The 18 Specialist Agents

| Agent Type | Display Name | Core Mandate | Permitted Tools | Max Autonomy |
| :--- | :--- | :--- | :--- | :--- |
| `market_scout` | Market Scout | Detects emerging search queries, public trends, and content gaps. | `web_search`, `sitemap_inspector`, `rss_feed_reader` | 1 |
| `search_intelligence` | Search Intelligence Agent | Audits crawl technicals, canonicals, robots directives, and query deltas. | `gsc_reader`, `bing_wmt_reader`, `robots_auditor` | 1 |
| `social_listening` | Social Listening Agent | Gathers public conversations and community questions from authorised connectors. | `social_query_reader`, `community_topic_indexer` | 1 |
| `source_researcher` | Source Researcher | Gathers, verifies, and archives primary sources with freshness tracking. | `url_fetcher_sanitised`, `citation_validator` | 1 |
| `audience_classifier` | Audience/Intent Classifier | Maps queries to buyer personas, intent categories, and brand relevance. | `intent_matrix_evaluator`, `persona_matcher` | 1 |
| `opportunity_scorer` | Opportunity Scorer | Calculates explainable 11-dimension scores with model version & rationale. | `scoring_model_v1`, `score_history_comparer` | 1 |
| `experience_planner` | Experience Planner | Architectures calculators, topic hubs, guides, and comparison experiences. | `experience_blueprint_generator`, `ux_spec_builder` | 1 |
| `content_builder` | Content/Media Builder | Drafts differentiated, source-grounded content in the brand's approved voice. | `llm_content_generator`, `claim_extractor` | 1 |
| `localisation` | Localisation Agent | Adapts terminology, cultural conventions, and currency without mistranslation. | `locale_dictionary_lookup`, `cultural_checker` | 1 |
| `fact_quality_auditor` | Fact/Quality Auditor | Runs 10 Quality Gates; audits citations, uniqueness, depth, and safety. | `uniqueness_checker`, `claim_verification_engine` | 1 |
| `distribution_planner` | Distribution Planner | Selects optimal channels, generates UTMs, and checks channel frequency limits. | `channel_readiness_checker`, `utm_generator` | 1 |
| `publisher` | Publisher Agent | Executes approved distribution actions strictly after approval event check. | `os_property_deployer`, `connector_publisher_guarded`| 2 |
| `partnership_research` | Partnership Research Agent | Identifies creators, publishers, and co-marketing opportunities. | `partner_profile_evaluator`, `outreach_draft_builder`| 1 |
| `traffic_analyst` | Traffic Analyst | Normalises analytics records, filters bot/crawler traffic, and models lift. | `bot_traffic_classifier`, `cohort_calculator` | 1 |
| `experiment` | Experiment Agent | Formulates hypotheses, stopping rules, sample sizes, and guardrails. | `experiment_designer`, `power_calculator` | 1 |
| `growth_strategist` | Growth Strategist | Allocates acquisition budget across channels based on incremental outcome lift. | `portfolio_allocator`, `proof_gate_evaluator` | 1 |
| `policy_safety` | Policy/Safety Agent | Enforces anti-spam rules, platform terms, claims safety, and change controls. | `safety_boundary_validator`, `compliance_auditor` | 1 |
| `reliability_cost` | Reliability/Cost Agent | Monitors latencies, token spend, connector quotas, and error rates. | `cost_ledger_auditor`, `quota_guard` | 1 |

---

## 3. Autonomy Ladder

- **Level 0 — Observe:** Signal collection and technical monitoring only. Zero external side effects.
- **Level 1 — Recommend:** Prepares scored opportunities, asset briefs, and proposed campaigns. (Default mode)
- **Level 2 — Approved Execution:** Executes distribution actions strictly following an operator's human approval event.
- **Level 3 — Bounded Autonomy:** Executes pre-approved low-risk tasks inside strict hourly budget caps and emergency stop monitors. (Disabled in Phase 1)
- **Level 4 — Expanded Autonomy:** Unlocked only after written owner sign-off and multi-month proof gate demonstration.
