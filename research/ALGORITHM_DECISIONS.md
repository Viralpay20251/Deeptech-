# Autonomous Growth OS — Algorithm Decisions & Evaluation Register

**Snapshot Date:** 13 October 2026  
**Auditor:** AI-Agent Systems Engineer & Data Science Architect  
**Specification Reference:** Master Build Prompt Section 26.2, Section 27, and Section 35  

---

## 1. Algorithm Family Decisions

### 1.1 Demand Opportunity Ranking & Prioritisation
- **Purpose:** Transparently rank discovered demand signals across CHATR, TalentXcel, and Nuty Tales so only high-value, policy-safe opportunities are acted upon.
- **Implemented Baseline (`Model v1.0.0`):**
  - Explainable 11-dimension weighted model: Demand evidence ($w=0.15$), Brand relevance ($w=0.15$), Intent strength ($w=0.10$), Content gap ($w=0.10$), Potential value ($w=0.10$), Freshness ($w=0.08$), Fulfilment capability ($w=0.08$), Effort ($w=-0.08$), Cost ($w=-0.06$), Uncertainty ($w=-0.05$), Policy risk ($w=-0.15$).
  - **Hard Blockers:** Policy risk $> 4.0/5.0$ or Brand relevance $< 5.0/10.0$ triggers immediate rejection regardless of volume.
- **Advanced Alternatives Evaluated:** Calibrated logistic regression, LightGBM ranker (LambdaMART), and Bayesian Value-of-Information (VoI).
- **Offline Evaluation Plan:** Test Precision@10 against a labelled set of 200 historical opportunities; measure Brier calibration score.
- **Online Evaluation Plan:** Track activation yield per accepted opportunity ($MAU / \text{Action}$).
- **Reason Selected:** Complete explainability; prevents "LLM hallucinated score" syndrome and guarantees regulatory safety.

---

### 1.2 Trend Detection & Anomaly Classification
- **Purpose:** Detect persistent demand shifts while ignoring noisy 1-day spikes or API ingestion outages.
- **Implemented Baseline:** Rolling 14-day Median and Median Absolute Deviation (MAD), controlling for day-of-week seasonality.
- **Advanced Alternatives Evaluated:** Cumulative Sum (CUSUM) and Pruned Exact Linear Time (PELT) change-point detection (`ruptures`).
- **Required Data:** Daily time-series of search query clicks, impressions, and referral visits ($\ge 30$ historical days).
- **Offline Evaluation Plan:** Synthetic injection of known step-changes and seasonal variance; measure alert precision and detection latency.
- **Online Evaluation Plan:** False-positive rate of operator anomaly alerts; tasks spawned per verified trend.
- **Reason Selected:** Rolling median/MAD is robust against extreme outliers without assuming Gaussian distributions.

---

### 1.3 Query, Topic & Intent Clustering
- **Purpose:** Group thousands of raw search queries and social questions into cohesive topic clusters mapped to user intent.
- **Implemented Baseline:** Lexical normalisation + TF-IDF vectorization with Agglomerative Hierarchical Clustering (cosine similarity threshold $0.75$).
- **Advanced Alternatives Evaluated:** HDBSCAN and BERTopic with multilingual sentence embeddings.
- **Required Data:** Raw query strings, source URLs, language tags.
- **Offline Evaluation Plan:** Silhouette score, human-evaluated cluster purity on 300 labelled queries.
- **Online Evaluation Plan:** Yield of clusters that translate into high-scoring, non-cannibalising content briefs.
- **Reason Selected:** Deterministic clustering prevents cluster drift and hallucinated topic labels.

---

### 1.4 Search Retrieval & Research Grounding
- **Purpose:** Retrieve relevant primary sources, guidelines, and internal assets to ground content generation.
- **Implemented Baseline:** Staged hybrid retrieval in PostgreSQL:
  1. Lexical retrieval via `tsvector` with BM25-like ranking (`ts_rank_cd`).
  2. Dense semantic retrieval via `pgvector` embeddings (`text-embedding-3-small` / local BGE).
  3. Reciprocal Rank Fusion (RRF) combining top-50 candidates ($k=60$).
- **Advanced Alternatives Evaluated:** Dedicated Elasticsearch/OpenSearch cluster, Vespa multi-stage ranking.
- **Offline Evaluation Plan:** NDCG@10 and Recall@20 on 100 domain-specific queries across AI, careers, and dry fruits.
- **Reason Selected:** RRF eliminates disparate score calibration issues and leverages the existing PostgreSQL store.

---

### 1.5 Duplicate & Cannibalisation Detection
- **Purpose:** Prevent scaled low-value content duplication and internal keyword cannibalisation across OS properties.
- **Implemented Baseline:**
  1. Exact duplicate: Cryptographic SHA-256 hash on normalised text.
  2. Near-duplicate: MinHash with 128 permutations and Locality-Sensitive Hashing (LSH) (`datasketch` pattern).
- **Advanced Alternatives Evaluated:** Cosine distance of sentence embeddings, SimHash.
- **Required Data:** Full asset markdown body, title, canonical URL.
- **Offline Evaluation Plan:** Precision/Recall on 100 near-duplicate test pairs (permutations of rephrased content).
- **Reason Selected:** MinHash/LSH guarantees sub-linear comparison time with proven theoretical Jaccard distance bounds.

---

### 1.6 Crawl Frontier & Freshness Prioritisation
- **Purpose:** Prioritise crawl inspection of public sitemaps and partner feeds without violating server resources.
- **Implemented Baseline:** Weighted priority queue:
  $$\text{Priority} = \text{Expected Value} \times \text{Freshness Need} \times \frac{1}{\text{Historical Error Rate}}$$
  Enforces per-host token bucket rate limiting (1 request / 2 seconds) and strict SSRF blocking.
- **Offline Evaluation Plan:** Verification of `robots.txt` compliance and SSRF loopback blocking on private IP ranges.
- **Online Evaluation Plan:** Useful records extracted per 1,000 HTTP requests; zero 429 rate limit blocks.

---

### 1.7 Content Quality Governor & Verification Rubric
- **Purpose:** Ensure no generated asset is published without passing 10 strict factual, architectural, and safety gates.
- **Implemented Baseline:** 10 deterministic gates in `QualityGovernor`:
  1. Demand Linkage ($\ge 1$ verified query/trend)
  2. Intent Clarity (Single primary intent)
  3. Substantive Depth ($\ge 300$ words, structured headings)
  4. Citation Integrity ($\ge 1$ valid external source citation)
  5. Transparent CTA (Disclosed outbound link)
  6. Technical Metadata (Valid title, description, schema)
  7. Semantic Structure (Valid markdown/HTML hierarchy)
  8. Uniqueness (Passes duplicate checks)
  9. Frequency Caps (Within daily brand limit)
  10. Brand Safety (Zero prohibited topics or unverified claims)
- **Offline Evaluation Plan:** Unit test suite covering synthetic passing and failing content assets.
- **Online Evaluation Plan:** Human reviewer acceptance rate in approval queue ($> 90\%$).

---

### 1.8 Channel & Creative Allocation
- **Purpose:** Direct distribution effort to the highest-converting channels without creating single-channel dependency.
- **Implemented Baseline:** Rule-based channel compatibility matrix with $\epsilon$-greedy randomised exploration ($80\%$ exploit, $20\%$ explore).
- **Advanced Alternatives Evaluated:** Contextual Bandits (LinUCB) and Thompson Sampling (`VowpalWabbit`).
- **Reason Selected:** Bandit models overfit and degrade when initial reward data is sparse; rule-based exploration establishes reliable baselines first.

---

### 1.9 Attribution & Uplift Modelling
- **Purpose:** Attribute real human visits and activations to specific campaigns and channels without confusing correlation with causation.
- **Implemented Baseline:**
  1. Descriptive Attribution: First-touch, last-touch, and linear UTM attribution recorded in `traffic_observations`.
  2. Bot Filtering: Flagging known bots, crawlers, and abnormal data-center IP addresses.
  3. Causal Verification: Geo-holdout and staggered rollout campaigns.
- **Advanced Alternatives Evaluated:** Difference-in-Differences (DiD), Synthetic Control, Uplift ML (`CausalML`, `EconML`).
- **Reason Selected:** Honest reporting: descriptive attribution is labeled as "associated with", not "caused by", until holdouts verify causal lift.

---

### 1.10 Retention & Cohort Survival Modelling
- **Purpose:** Measure whether acquired traffic produces meaningful, returning users for CHATR, TalentXcel, and Nuty Tales.
- **Implemented Baseline:** Rolling 30-day cohort tables measuring Day 1, Day 7, Day 14, and Day 30 retention.
- **Advanced Alternatives Evaluated:** Kaplan-Meier survival curves and Cox proportional hazards regression.
- **Reason Selected:** Cohort matrices provide direct, unmanipulated visibility into product stickiness.

---

### 1.11 Budget & Resource Allocation
- **Purpose:** Enforce strict financial boundaries on AI inference, search APIs, and potential paid channels.
- **Implemented Baseline:**
  - Per-task LLM budget cap: $\$0.50$
  - Daily global LLM spend cap: $\$10.00$
  - Outbound actions halted immediately upon budget threshold exhaustion.
- **Reason Selected:** Deterministic safety in code; model agents cannot unilaterally modify or bypass financial constraints.

---

### 1.12 Traffic Quality & Bot Classification
- **Purpose:** Guarantee zero fake traffic, bot clicks, or engagement pods are counted towards the 100k MAU target.
- **Implemented Baseline:** 4-tier traffic taxonomy:
  - `verified_bot`: Identified search engine crawlers (Googlebot, Bingbot) and synthetic test probes.
  - `likely_bot`: Data-center IP ranges (AWS, GCP, Hetzner), rapid click bursts ($< 2\text{s}$ session), or missing headers.
  - `likely_human`: Sessions with $\ge 10\text{s}$ duration, natural interaction events, and residential/mobile IP classification.
  - `unknown`: Unclassified sessions retained for operator review.
- **Reason Selected:** Preserves data integrity; ensures only `likely_human` sessions contribute to north-star scorecards.
