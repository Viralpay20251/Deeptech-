-- ============================================================
-- Migration: 002_create_connector_registry.sql
-- Description: Connector definitions, instances, credentials and health events.
--
-- ROLLBACK NOTES:
--   DROP TABLE IF EXISTS connector_health_events, connector_instances,
--                        connector_definitions CASCADE;
-- ============================================================

-- ─── Connector Definitions (static catalogue) ────────────────────────────────

CREATE TABLE connector_definitions (
    type                    TEXT PRIMARY KEY,
    version                 TEXT NOT NULL,
    display_name            TEXT NOT NULL,
    category                TEXT NOT NULL CHECK (category IN (
                                'search_web', 'analytics', 'social_media',
                                'messaging', 'publishing', 'paid_media',
                                'ai_model', 'storage', 'notifications'
                            )),
    official_api_docs_url   TEXT NOT NULL,
    capabilities            TEXT[] NOT NULL DEFAULT '{}',
    auth_method             TEXT NOT NULL CHECK (auth_method IN (
                                'oauth2', 'api_key', 'service_account', 'smtp', 'none'
                            )),
    required_scopes         TEXT[] NOT NULL DEFAULT '{}',
    rate_limit_notes        TEXT NOT NULL DEFAULT '',
    known_limitations       TEXT[] NOT NULL DEFAULT '{}',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE connector_definitions IS
    'Static catalogue of all connector types supported by the OS. '
    'A connector definition describes WHAT the connector can do and its API constraints. '
    'A connector instance (below) links a definition to a specific account/workspace.';

-- ─── Connector Instances (per-workspace / per-brand accounts) ────────────────

CREATE TABLE connector_instances (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brand_id                UUID REFERENCES brands(id) ON DELETE SET NULL,
    connector_type          TEXT NOT NULL REFERENCES connector_definitions(type),
    status                  TEXT NOT NULL DEFAULT 'not_configured'
                            CHECK (status IN (
                                'not_configured', 'awaiting_credentials', 'awaiting_oauth',
                                'awaiting_approval', 'connected', 'degraded',
                                'error', 'revoked', 'disabled'
                            )),
    -- IMPORTANT: Only a reference/key name is stored — never the raw secret value
    credential_reference    TEXT,   -- e.g. 'env:OPENAI_API_KEY' or 'secrets-manager:arn:...'
    granted_capabilities    TEXT[] NOT NULL DEFAULT '{}',
    last_health_check_at    TIMESTAMPTZ,
    health_check_message    TEXT,
    notes                   TEXT,   -- human-readable notes about this instance
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_connector_instances_workspace ON connector_instances(workspace_id);
CREATE INDEX idx_connector_instances_brand ON connector_instances(brand_id);
CREATE INDEX idx_connector_instances_type ON connector_instances(connector_type);
CREATE INDEX idx_connector_instances_status ON connector_instances(status);

COMMENT ON TABLE connector_instances IS
    'Live connector accounts. '
    'credential_reference points to an environment variable name or secrets-manager key — '
    'NEVER the raw secret value. Treat this table as sensitive.';

COMMENT ON COLUMN connector_instances.credential_reference IS
    'A reference string like "env:OPENAI_API_KEY" or "secrets:arn:aws:secretsmanager:...". '
    'The actual credential is resolved at runtime from the secure store. '
    'This column must NEVER contain a raw API key, token, password or secret value.';

-- ─── Connector Health Events ──────────────────────────────────────────────────

CREATE TABLE connector_health_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id        UUID NOT NULL REFERENCES connector_instances(id) ON DELETE CASCADE,
    workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    status              TEXT NOT NULL,
    message             TEXT,
    latency_ms          INTEGER,
    checked_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_connector_health_connector ON connector_health_events(connector_id, checked_at DESC);

COMMENT ON TABLE connector_health_events IS 'Historical health check results for connectors.';

-- ─── Trigger ─────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_connector_definitions_updated_at BEFORE UPDATE ON connector_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_connector_instances_updated_at BEFORE UPDATE ON connector_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
