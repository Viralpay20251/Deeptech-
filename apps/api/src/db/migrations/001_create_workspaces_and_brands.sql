-- ============================================================
-- Migration: 001_create_workspaces_and_brands.sql
-- Description: Core workspace, brand, user and role tables.
--
-- ROLLBACK NOTES:
--   DROP TABLE IF EXISTS memberships, brands, workspaces, users CASCADE;
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Workspaces / Tenants ─────────────────────────────────────────────────────

CREATE TABLE workspaces (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug              TEXT NOT NULL UNIQUE,
    display_name      TEXT NOT NULL,
    is_internal       BOOLEAN NOT NULL DEFAULT FALSE,
    is_commercial     BOOLEAN NOT NULL DEFAULT FALSE,   -- stays FALSE until proof gates pass
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE workspaces IS
    'Tenant/workspace table. Only one internal workspace exists during the proof phase. '
    'Commercial workspace creation is gated behind FEATURE_SAAS_ONBOARDING.';

COMMENT ON COLUMN workspaces.is_commercial IS
    'Set to TRUE only after the owner explicitly approves commercialisation. '
    'Keeping this FALSE prevents external customer onboarding.';

-- ─── Users ───────────────────────────────────────────────────────────────────

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email           TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    password_hash   TEXT NOT NULL,           -- bcrypt hash; raw password never stored
    role            TEXT NOT NULL DEFAULT 'read_only'
                    CHECK (role IN (
                        'workspace_admin',
                        'operator',
                        'reviewer',
                        'publisher',
                        'read_only'
                    )),
    mfa_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, email)            -- email unique within workspace
);

CREATE INDEX idx_users_workspace ON users(workspace_id);
CREATE INDEX idx_users_email ON users(email);

COMMENT ON TABLE users IS 'OS operators and reviewers — no end-user/customer data stored here.';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hash only. Never store plaintext password.';

-- ─── Brands / Projects ───────────────────────────────────────────────────────

CREATE TABLE brands (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id                UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    slug                        TEXT NOT NULL,
    display_name                TEXT NOT NULL,
    base_url                    TEXT NOT NULL,
    is_protected_production     BOOLEAN NOT NULL DEFAULT TRUE,
    config                      JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, slug)
);

CREATE INDEX idx_brands_workspace ON brands(workspace_id);
CREATE INDEX idx_brands_slug ON brands(slug);

COMMENT ON TABLE brands IS
    'Brand registry for CHATR, TalentXcel and Nuty Tales (and future customer brands). '
    'is_protected_production=TRUE means no write operations may target this brand''s production systems.';

COMMENT ON COLUMN brands.is_protected_production IS
    'When TRUE, any action that would write to, deploy to, or modify the production '
    'system of this brand MUST be blocked by the safety layer.';

-- ─── Audit Log (always-on) ────────────────────────────────────────────────────

CREATE TABLE audit_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    actor_type      TEXT NOT NULL CHECK (actor_type IN ('user', 'agent', 'system')),
    actor_id        TEXT NOT NULL,
    action          TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    resource_id     TEXT,
    metadata        JSONB NOT NULL DEFAULT '{}'::JSONB,
    ip_address      TEXT,           -- stored only when needed for security review
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_workspace ON audit_events(workspace_id, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_events(resource_type, resource_id);
CREATE INDEX idx_audit_actor ON audit_events(actor_type, actor_id);

COMMENT ON TABLE audit_events IS
    'Immutable audit log. Records authentication, permission changes, approvals, '
    'publishing events and privileged actions. Never delete rows from this table.';

-- ─── Kill Switches ────────────────────────────────────────────────────────────

CREATE TABLE kill_switch_events (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    scope                   TEXT NOT NULL CHECK (scope IN ('global', 'workspace', 'brand', 'channel', 'campaign')),
    scope_id                TEXT,           -- brand_id | channel_id | campaign_id
    activated_by_user_id    UUID NOT NULL REFERENCES users(id),
    reason                  TEXT NOT NULL,
    activated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deactivated_at          TIMESTAMPTZ
);

CREATE INDEX idx_kill_switch_workspace ON kill_switch_events(workspace_id);
CREATE INDEX idx_kill_switch_scope ON kill_switch_events(scope, scope_id) WHERE deactivated_at IS NULL;

COMMENT ON TABLE kill_switch_events IS
    'Emergency stop records. A NULL deactivated_at means the switch is currently active.';

-- ─── Trigger: updated_at auto-update ────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_workspaces_updated_at BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_brands_updated_at BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
