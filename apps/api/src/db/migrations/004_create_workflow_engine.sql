-- ============================================================
-- Migration: 004_create_workflow_engine.sql
-- Description: Agent workflow runs, tasks, task attempts, approvals.
--
-- ROLLBACK NOTES:
--   DROP TABLE IF EXISTS approval_events, tool_invocations, task_attempts,
--                        tasks, workflow_runs, workflow_definitions,
--                        agent_definitions CASCADE;
-- ============================================================

-- ─── Agent Definitions ────────────────────────────────────────────────────────

CREATE TABLE agent_definitions (
    agent_type          TEXT PRIMARY KEY,
    display_name        TEXT NOT NULL,
    description         TEXT NOT NULL,
    prompt_version      TEXT NOT NULL DEFAULT '0.1.0',
    permitted_tools     TEXT[] NOT NULL DEFAULT '{}',
    max_autonomy_level  SMALLINT NOT NULL DEFAULT 2
                        CHECK (max_autonomy_level BETWEEN 0 AND 4),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agent_definitions IS
    'Versioned definitions of each agent type. '
    'prompt_version must change whenever the agent prompt or tool set changes '
    'so behaviour differences can be traced.';

-- ─── Workflow Definitions ─────────────────────────────────────────────────────

CREATE TABLE workflow_definitions (
    id                  TEXT PRIMARY KEY,   -- e.g. 'demand_to_opportunity_v1'
    display_name        TEXT NOT NULL,
    description         TEXT NOT NULL,
    version             TEXT NOT NULL,
    definition_json     JSONB NOT NULL,     -- DAG definition
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE workflow_definitions IS 'Versioned workflow DAG definitions.';

-- ─── Workflow Runs ────────────────────────────────────────────────────────────

CREATE TABLE workflow_runs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brand_id                UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    workflow_definition_id  TEXT NOT NULL REFERENCES workflow_definitions(id),
    idempotency_key         TEXT NOT NULL UNIQUE,   -- prevents duplicate runs
    status                  TEXT NOT NULL DEFAULT 'queued'
                            CHECK (status IN (
                                'queued', 'running', 'awaiting_approval', 'paused',
                                'completed', 'failed', 'cancelled', 'timed_out'
                            )),
    autonomy_level          SMALLINT NOT NULL DEFAULT 1
                            CHECK (autonomy_level BETWEEN 0 AND 4),
    input                   JSONB NOT NULL DEFAULT '{}'::JSONB,
    output                  JSONB,
    error                   TEXT,
    model_cost_usd          NUMERIC(10,6) NOT NULL DEFAULT 0,
    api_call_count          INTEGER NOT NULL DEFAULT 0,
    started_at              TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_runs_workspace ON workflow_runs(workspace_id, created_at DESC);
CREATE INDEX idx_workflow_runs_brand ON workflow_runs(brand_id);
CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX idx_workflow_runs_idempotency ON workflow_runs(idempotency_key);

COMMENT ON TABLE workflow_runs IS
    'A workflow run is a single execution of a workflow definition. '
    'idempotency_key ensures that duplicate trigger events do not create duplicate runs.';

-- ─── Tasks ────────────────────────────────────────────────────────────────────

CREATE TABLE tasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_run_id     UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    agent_type          TEXT NOT NULL REFERENCES agent_definitions(agent_type),
    status              TEXT NOT NULL DEFAULT 'queued'
                        CHECK (status IN (
                            'queued', 'running', 'awaiting_approval', 'paused',
                            'completed', 'failed', 'cancelled', 'timed_out'
                        )),
    idempotency_key     TEXT NOT NULL UNIQUE,
    input               JSONB NOT NULL DEFAULT '{}'::JSONB,
    output              JSONB,
    error               TEXT,
    retry_count         SMALLINT NOT NULL DEFAULT 0,
    max_retries         SMALLINT NOT NULL DEFAULT 3,
    next_retry_at       TIMESTAMPTZ,
    model_cost_usd      NUMERIC(10,6) NOT NULL DEFAULT 0,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_workflow_run ON tasks(workflow_run_id);
CREATE INDEX idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_retry ON tasks(next_retry_at) WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- ─── Task Attempts (history of retries) ──────────────────────────────────────

CREATE TABLE task_attempts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    attempt_number  SMALLINT NOT NULL,
    status          TEXT NOT NULL,
    error           TEXT,
    model_cost_usd  NUMERIC(10,6) NOT NULL DEFAULT 0,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    UNIQUE (task_id, attempt_number)
);

CREATE INDEX idx_task_attempts_task ON task_attempts(task_id);

-- ─── Tool Invocations ─────────────────────────────────────────────────────────

CREATE TABLE tool_invocations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    tool_name       TEXT NOT NULL,
    -- input/output are logged without secrets (redaction is the caller's responsibility)
    input_summary   TEXT NOT NULL,      -- human-readable summary, not raw input
    output_summary  TEXT,
    success         BOOLEAN NOT NULL,
    error           TEXT,
    latency_ms      INTEGER,
    invoked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tool_invocations_task ON tool_invocations(task_id);
CREATE INDEX idx_tool_invocations_tool ON tool_invocations(tool_name);

COMMENT ON COLUMN tool_invocations.input_summary IS
    'Human-readable summary of the tool call. '
    'Do NOT log raw inputs if they may contain credentials or personal data.';

-- ─── Approval Events ──────────────────────────────────────────────────────────

CREATE TABLE approval_events (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    resource_type           TEXT NOT NULL,  -- e.g. 'content_asset', 'publishing_job'
    resource_id             UUID NOT NULL,
    requested_by_agent      TEXT NOT NULL,
    reviewed_by_user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    status                  TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_at              TIMESTAMPTZ,
    expires_at              TIMESTAMPTZ   -- null = no expiry
);

CREATE INDEX idx_approval_events_workspace ON approval_events(workspace_id);
CREATE INDEX idx_approval_events_resource ON approval_events(resource_type, resource_id);
CREATE INDEX idx_approval_events_status ON approval_events(status) WHERE status = 'pending';

COMMENT ON TABLE approval_events IS
    'Human approval gate for all publishing and privileged actions. '
    'A valid, non-expired approved row here is required before any external publish action.';

-- ─── Budget / Cost Tracking ───────────────────────────────────────────────────

CREATE TABLE model_cost_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brand_id        UUID REFERENCES brands(id) ON DELETE SET NULL,
    task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
    provider        TEXT NOT NULL,
    model           TEXT NOT NULL,
    prompt_tokens   INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd        NUMERIC(10,6) NOT NULL DEFAULT 0,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_model_cost_workspace ON model_cost_records(workspace_id, recorded_at DESC);
CREATE INDEX idx_model_cost_brand ON model_cost_records(brand_id);

-- ─── Triggers ─────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_agent_definitions_updated_at BEFORE UPDATE ON agent_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_workflow_runs_updated_at BEFORE UPDATE ON workflow_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
