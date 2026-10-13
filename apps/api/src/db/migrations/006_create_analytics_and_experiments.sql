-- ============================================================
-- Migration: 006_create_analytics_and_experiments.sql
-- Description: Traffic observations, metric definitions,
--              experiments, variants, and growth learning logs.
--
-- ROLLBACK NOTES:
--   DROP TABLE IF EXISTS decision_logs, experiment_variants,
--                        experiments, metric_definitions,
--                        traffic_observations CASCADE;
-- ============================================================

-- ─── Metric Definitions (Brand-specific event truth) ─────────────────────────

CREATE TABLE metric_definitions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brand_id                UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    metric_key              TEXT NOT NULL, -- e.g. 'monthly_active_user', 'activation', 'purchasing_customer'
    display_name            TEXT NOT NULL,
    definition_markdown     TEXT NOT NULL,
    qualifying_event_name   TEXT NOT NULL,
    calculation_version     TEXT NOT NULL DEFAULT '1.0.0',
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (brand_id, metric_key, calculation_version)
);

CREATE INDEX idx_metric_definitions_brand ON metric_definitions(brand_id);

COMMENT ON TABLE metric_definitions IS
    'Authoritative metric definitions. Distinguishes visitors, registrations, '
    'active users, returning users, and actual buyers (for Nuty Tales). Never confuse impressions with users.';

-- ─── Traffic Observations (Source-of-truth layer) ────────────────────────────

CREATE TABLE traffic_observations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brand_id                UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    import_job_id           UUID,
    source_connector_type   TEXT NOT NULL,
    observed_date           DATE NOT NULL,
    traffic_source          TEXT NOT NULL CHECK (traffic_source IN (
                                'organic_search', 'social', 'referral',
                                'email', 'paid', 'direct', 'unknown'
                            )),
    campaign_id             UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    utm_source              TEXT,
    utm_medium              TEXT,
    utm_campaign            TEXT,
    landing_page_path       TEXT,
    country_code            CHAR(2),
    sessions                INTEGER,
    engaged_sessions        INTEGER,
    session_quality         TEXT NOT NULL DEFAULT 'uncertain' CHECK (session_quality IN (
                                'likely_human', 'uncertain', 'likely_bot', 'known_crawler'
                            )),
    quality_confidence      NUMERIC(4,3) NOT NULL DEFAULT 0.5 CHECK (quality_confidence BETWEEN 0 AND 1),
    new_users               INTEGER,
    conversions             INTEGER,
    conversion_event        TEXT,
    raw_data_snapshot_ref   TEXT, -- reference to immutable storage snapshot
    ingested_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_freshness_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_demo_data            BOOLEAN NOT NULL DEFAULT FALSE,
    caveats                 TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_traffic_observations_workspace ON traffic_observations(workspace_id, observed_date DESC);
CREATE INDEX idx_traffic_observations_brand ON traffic_observations(brand_id, observed_date DESC);
CREATE INDEX idx_traffic_observations_demo ON traffic_observations(is_demo_data) WHERE is_demo_data = TRUE;
CREATE INDEX idx_traffic_observations_quality ON traffic_observations(session_quality);

COMMENT ON TABLE traffic_observations IS
    'Raw and normalised traffic data from authorised analytics connectors. '
    'Bot and crawler traffic is classified and separated from likely-human traffic.';

-- ─── Experiments ──────────────────────────────────────────────────────────────

CREATE TABLE experiments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brand_id                UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    hypothesis              TEXT NOT NULL,
    rationale               TEXT NOT NULL,
    channel                 TEXT NOT NULL,
    primary_metric          TEXT NOT NULL,
    guardrail_metrics       TEXT[] NOT NULL DEFAULT '{}',
    baseline_value          NUMERIC(12,4),
    expected_lift_pct       NUMERIC(6,2),
    status                  TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN (
                                'proposed', 'awaiting_approval', 'running',
                                'paused', 'completed', 'abandoned'
                            )),
    start_date              DATE,
    end_date                DATE,
    budget_cap_usd          NUMERIC(10,2),
    stopping_rules          TEXT NOT NULL DEFAULT '',
    confounders_noted       TEXT NOT NULL DEFAULT '',
    result_summary          TEXT,
    confidence_pct          NUMERIC(5,2),
    decision                TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_experiments_workspace ON experiments(workspace_id);
CREATE INDEX idx_experiments_brand ON experiments(brand_id);
CREATE INDEX idx_experiments_status ON experiments(status);

ALTER TABLE campaigns
    ADD CONSTRAINT fk_campaigns_experiment
    FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE SET NULL;

-- ─── Experiment Variants ──────────────────────────────────────────────────────

CREATE TABLE experiment_variants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id       UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    label               TEXT NOT NULL, -- e.g. 'control', 'variant_a'
    description         TEXT NOT NULL,
    allocation_pct      NUMERIC(5,2) NOT NULL CHECK (allocation_pct BETWEEN 0 AND 100),
    sample_count        INTEGER NOT NULL DEFAULT 0,
    outcome_count       INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_experiment_variants_exp ON experiment_variants(experiment_id);

-- ─── Decision Logs (Autonomous growth learning trail) ─────────────────────────

CREATE TABLE decision_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    agent_type          TEXT NOT NULL,
    decision_type       TEXT NOT NULL, -- e.g. 'opportunity_selected', 'channel_reallocated', 'experiment_concluded'
    summary             TEXT NOT NULL,
    evidence_basis      JSONB NOT NULL DEFAULT '{}'::JSONB,
    uncertainty_notes   TEXT NOT NULL DEFAULT '',
    action_taken        TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_decision_logs_brand ON decision_logs(brand_id, created_at DESC);
CREATE INDEX idx_decision_logs_workspace ON decision_logs(workspace_id, created_at DESC);

-- ─── Triggers ─────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_metric_definitions_updated_at BEFORE UPDATE ON metric_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_experiments_updated_at BEFORE UPDATE ON experiments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
