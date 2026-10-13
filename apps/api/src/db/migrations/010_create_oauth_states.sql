-- ============================================================
-- Migration: 010_create_oauth_states.sql
-- Description: Cryptographically secure, single-use OAuth state nonces
--              with strict workspace binding and CSRF replay prevention.
-- ============================================================

CREATE TABLE IF NOT EXISTS oauth_states (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nonce           TEXT NOT NULL UNIQUE,
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    redirect_uri    TEXT NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_nonce ON oauth_states(nonce);
CREATE INDEX IF NOT EXISTS idx_oauth_states_workspace ON oauth_states(workspace_id);

COMMENT ON TABLE oauth_states IS
    'Single-use, cryptographically unpredictable OAuth state tokens bound to an initiating workspace session to prevent CSRF and cross-workspace token substitution.';
