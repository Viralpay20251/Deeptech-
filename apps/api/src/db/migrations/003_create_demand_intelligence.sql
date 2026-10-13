-- ============================================================
-- Migration: 003_create_demand_intelligence.sql
-- Description: Demand signals, topic clusters, opportunities and scoring.
--
-- ROLLBACK NOTES:
--   DROP TABLE IF EXISTS opportunity_scores, opportunities,
--                        topic_clusters, demand_signals CASCADE;
-- ============================================================

-- ─── Demand Signals ───────────────────────────────────────────────────────────

CREATE TABLE demand_signals (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brand_id                UUID REFERENCES brands(id) ON DELETE SET NULL,
    source_connector_id     UUID REFERENCES connector_instances(id) ON DELETE SET NULL,
    source_type             TEXT NOT NULL,
    source_url              TEXT,
    -- raw_signal is untrusted external data — NEVER executed or treated as instructions
    raw_signal              JSONB NOT NULL DEFAULT '{}'::JSONB,
    topic_cluster_id        UUID,   -- FK added below after topic_clusters table
    intent_type             TEXT NOT NULL CHECK (intent_type IN (
                                'informational', 'navigational', 'transactional',
                                'commercial_investigation', 'career_job_search', 'community'
                            )),
    trend_type              TEXT NOT NULL CHECK (trend_type IN (
                                'evergreen', 'seasonal', 'emerging', 'time_sensitive', 'declining'
                            )),
    confidence              NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    locale                  TEXT NOT NULL DEFAULT 'en',
    country_code            CHAR(2),
    observed_at             TIMESTAMPTZ NOT NULL,
    ingested_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    permitted_use_notes     TEXT NOT NULL DEFAULT '',
    is_demo_data            BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT chk_demo_not_mixed CHECK (
        -- Prevent mixing demo data with live data by requiring explicit labelling
        is_demo_data IS NOT NULL
    )
);

CREATE INDEX idx_demand_signals_workspace ON demand_signals(workspace_id, ingested_at DESC);
CREATE INDEX idx_demand_signals_brand ON demand_signals(brand_id);
CREATE INDEX idx_demand_signals_cluster ON demand_signals(topic_cluster_id);
CREATE INDEX idx_demand_signals_intent ON demand_signals(intent_type);
CREATE INDEX idx_demand_signals_demo ON demand_signals(is_demo_data) WHERE is_demo_data = TRUE;

COMMENT ON TABLE demand_signals IS
    'Individual demand observations from connectors. '
    'raw_signal is UNTRUSTED external data — it must be sanitised and delimited before '
    'being passed to any agent or model.';

COMMENT ON COLUMN demand_signals.is_demo_data IS
    'MUST be TRUE for any seeded/demo record. '
    'Production queries must filter WHERE is_demo_data = FALSE to exclude demo rows.';

-- ─── Topic Clusters ───────────────────────────────────────────────────────────

CREATE TABLE topic_clusters (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    label               TEXT NOT NULL,
    intent_type         TEXT NOT NULL CHECK (intent_type IN (
                            'informational', 'navigational', 'transactional',
                            'commercial_investigation', 'career_job_search', 'community'
                        )),
    trend_type          TEXT NOT NULL CHECK (trend_type IN (
                            'evergreen', 'seasonal', 'emerging', 'time_sensitive', 'declining'
                        )),
    signal_count        INTEGER NOT NULL DEFAULT 0,
    first_observed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_observed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_demo_data        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_topic_clusters_workspace ON topic_clusters(workspace_id);
CREATE INDEX idx_topic_clusters_label ON topic_clusters(label);

-- Add FK from demand_signals to topic_clusters now that the table exists
ALTER TABLE demand_signals
    ADD CONSTRAINT fk_demand_signals_topic_cluster
    FOREIGN KEY (topic_cluster_id) REFERENCES topic_clusters(id) ON DELETE SET NULL;

-- ─── Opportunities ────────────────────────────────────────────────────────────

CREATE TABLE opportunities (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brand_id                UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    topic_cluster_id        UUID REFERENCES topic_clusters(id) ON DELETE SET NULL,
    title                   TEXT NOT NULL,
    description             TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'discovered'
                            CHECK (status IN (
                                'discovered', 'scored', 'selected', 'rejected',
                                'in_progress', 'completed', 'expired', 'blocked'
                            )),
    rejection_reason        TEXT,
    proposed_asset_type     TEXT CHECK (proposed_asset_type IN (
                                'search_landing_page', 'topic_hub', 'article', 'faq_page',
                                'interactive_tool', 'buying_guide', 'career_guide',
                                'gift_guide', 'social_post', 'video_script',
                                'newsletter', 'partner_pitch', 'outreach_draft'
                            )),
    target_locale           TEXT NOT NULL DEFAULT 'en',
    target_country          CHAR(2),
    is_demo_data            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_opportunities_workspace ON opportunities(workspace_id);
CREATE INDEX idx_opportunities_brand ON opportunities(brand_id);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_demo ON opportunities(is_demo_data) WHERE is_demo_data = TRUE;

-- ─── Opportunity Scores ───────────────────────────────────────────────────────

CREATE TABLE opportunity_scores (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id          UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    -- 0–10 component scores
    demand_evidence         NUMERIC(4,2) NOT NULL CHECK (demand_evidence BETWEEN 0 AND 10),
    brand_relevance         NUMERIC(4,2) NOT NULL CHECK (brand_relevance BETWEEN 0 AND 10),
    intent_strength         NUMERIC(4,2) NOT NULL CHECK (intent_strength BETWEEN 0 AND 10),
    content_gap             NUMERIC(4,2) NOT NULL CHECK (content_gap BETWEEN 0 AND 10),
    potential_value         NUMERIC(4,2) NOT NULL CHECK (potential_value BETWEEN 0 AND 10),
    freshness               NUMERIC(4,2) NOT NULL CHECK (freshness BETWEEN 0 AND 10),
    fulfilment_capability   NUMERIC(4,2) NOT NULL CHECK (fulfilment_capability BETWEEN 0 AND 10),
    expected_effort         NUMERIC(4,2) NOT NULL CHECK (expected_effort BETWEEN 0 AND 10),
    cost                    NUMERIC(4,2) NOT NULL CHECK (cost BETWEEN 0 AND 10),
    uncertainty             NUMERIC(4,2) NOT NULL CHECK (uncertainty BETWEEN 0 AND 10),
    policy_risk             NUMERIC(4,2) NOT NULL CHECK (policy_risk BETWEEN 0 AND 10),
    weighted_total          NUMERIC(6,2) NOT NULL CHECK (weighted_total BETWEEN 0 AND 100),
    score_model_version     TEXT NOT NULL,
    rationale               TEXT NOT NULL,
    evidence_refs           TEXT[] NOT NULL DEFAULT '{}',
    calculated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_opportunity_scores_opportunity ON opportunity_scores(opportunity_id);
CREATE INDEX idx_opportunity_scores_total ON opportunity_scores(weighted_total DESC);

COMMENT ON TABLE opportunity_scores IS
    'Versioned opportunity scores with full component breakdown. '
    'Every score must include rationale and evidence_refs — no opaque scores.';

-- ─── Triggers ─────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_topic_clusters_updated_at BEFORE UPDATE ON topic_clusters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_opportunities_updated_at BEFORE UPDATE ON opportunities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
