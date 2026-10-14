-- Migration 018: Durable PostgreSQL Job Queue
-- Replaces in-memory QUEUE_DRIVER=memory with a durable, restart-safe job queue.
-- Supports: queued → claimed → running → succeeded | failed | dead_lettered
-- Features: idempotency keys, lease heartbeats, retry limits, dead-letter table,
--           per-job audit trail, and backpressure metrics.

BEGIN;

-- ─── Core job queue table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_queue (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key  TEXT UNIQUE,                   -- Prevents duplicate job creation

  -- Job classification
  job_type         TEXT NOT NULL,                  -- e.g. 'crawl', 'connector_sync', 'domain_health_check'
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id         UUID REFERENCES brands(id) ON DELETE SET NULL,

  -- Payload (sanitized — no raw secrets)
  payload          JSONB NOT NULL DEFAULT '{}',

  -- Scheduling
  scheduled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  priority         INTEGER NOT NULL DEFAULT 50,    -- 0=lowest, 100=highest

  -- Status lifecycle: queued → running → succeeded | failed | dead_lettered
  status           TEXT NOT NULL DEFAULT 'queued'
                     CHECK (status IN ('queued','running','succeeded','partial','failed','retrying','cancelled','dead_lettered')),

  -- Worker lease (FOR UPDATE SKIP LOCKED pattern)
  worker_id        TEXT,                            -- Identifies claiming worker instance
  lease_expires_at TIMESTAMPTZ,                    -- Worker must renew before this expires
  heartbeat_at     TIMESTAMPTZ,                    -- Last worker heartbeat

  -- Retry tracking
  attempts         INTEGER NOT NULL DEFAULT 0,
  max_attempts     INTEGER NOT NULL DEFAULT 3,
  next_attempt_at  TIMESTAMPTZ,

  -- Result / error
  result_summary   JSONB,                          -- rows_fetched, rows_upserted, etc.
  last_error       TEXT,
  last_error_at    TIMESTAMPTZ,

  -- Timestamps
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Dead-letter table for permanently failed jobs ────────────────────────────
CREATE TABLE IF NOT EXISTS job_queue_dead_letter (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_job_id  UUID NOT NULL,
  job_type         TEXT NOT NULL,
  workspace_id     UUID NOT NULL,
  brand_id         UUID,
  payload          JSONB NOT NULL,
  failure_reason   TEXT,
  attempts         INTEGER NOT NULL,
  dead_lettered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved         BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at      TIMESTAMPTZ,
  resolved_by      TEXT
);

-- ─── Worker heartbeat registry ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_id        TEXT PRIMARY KEY,
  worker_type      TEXT NOT NULL,                  -- 'vercel_cron', 'dedicated_worker', 'local_dev'
  deployment_id    TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_job_id   UUID REFERENCES job_queue(id) ON DELETE SET NULL,
  jobs_completed   INTEGER NOT NULL DEFAULT 0,
  jobs_failed      INTEGER NOT NULL DEFAULT 0,
  is_alive         BOOLEAN NOT NULL DEFAULT TRUE   -- updated by upsert; stale after 10 min
);

-- ─── Indexes for efficient queue operations ───────────────────────────────────

-- Claim next queued job (FOR UPDATE SKIP LOCKED)
CREATE INDEX IF NOT EXISTS idx_job_queue_claim
  ON job_queue (priority DESC, scheduled_at ASC)
  WHERE status IN ('queued', 'retrying');

-- Recover abandoned leases
CREATE INDEX IF NOT EXISTS idx_job_queue_lease_expiry
  ON job_queue (lease_expires_at)
  WHERE status = 'running';

-- Workspace-scoped listing
CREATE INDEX IF NOT EXISTS idx_job_queue_workspace
  ON job_queue (workspace_id, status, created_at DESC);

-- Job type filtering
CREATE INDEX IF NOT EXISTS idx_job_queue_type_status
  ON job_queue (job_type, status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_job_queue_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_queue_updated_at ON job_queue;
CREATE TRIGGER job_queue_updated_at
  BEFORE UPDATE ON job_queue
  FOR EACH ROW EXECUTE FUNCTION update_job_queue_updated_at();

-- ─── Queue metrics view ───────────────────────────────────────────────────────
CREATE OR REPLACE VIEW queue_metrics AS
SELECT
  job_type,
  status,
  COUNT(*) AS count,
  MIN(created_at) AS oldest_job_at,
  MAX(heartbeat_at) AS latest_heartbeat,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))::NUMERIC(10,2) AS avg_duration_secs
FROM job_queue
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY job_type, status;

-- ─── Helper: claim next queued job atomically ─────────────────────────────────
CREATE OR REPLACE FUNCTION claim_next_job(
  p_worker_id   TEXT,
  p_job_type    TEXT DEFAULT NULL,
  p_lease_secs  INTEGER DEFAULT 300
)
RETURNS job_queue LANGUAGE plpgsql AS $$
DECLARE
  v_job job_queue;
BEGIN
  SELECT * INTO v_job
  FROM job_queue
  WHERE status IN ('queued', 'retrying')
    AND scheduled_at <= (NOW() + INTERVAL '10 seconds')
    AND (p_job_type IS NULL OR job_type = p_job_type)
  ORDER BY priority DESC, scheduled_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE job_queue
  SET
    status           = 'running',
    worker_id        = p_worker_id,
    lease_expires_at = NOW() + (p_lease_secs || ' seconds')::INTERVAL,
    heartbeat_at     = NOW(),
    started_at       = COALESCE(started_at, NOW()),
    attempts         = attempts + 1,
    updated_at       = NOW()
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

-- ─── Helper: renew lease heartbeat ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION renew_job_lease(
  p_job_id      UUID,
  p_worker_id   TEXT,
  p_lease_secs  INTEGER DEFAULT 300
)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE job_queue
  SET
    lease_expires_at = NOW() + (p_lease_secs || ' seconds')::INTERVAL,
    heartbeat_at     = NOW(),
    updated_at       = NOW()
  WHERE id = p_job_id
    AND worker_id = p_worker_id
    AND status = 'running';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

-- ─── Helper: complete job ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION complete_job(
  p_job_id         UUID,
  p_worker_id      TEXT,
  p_result_summary JSONB DEFAULT NULL,
  p_status         TEXT DEFAULT 'succeeded'
)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE job_queue
  SET
    status           = p_status,
    result_summary   = p_result_summary,
    completed_at     = NOW(),
    lease_expires_at = NULL,
    worker_id        = NULL,
    updated_at       = NOW()
  WHERE id = p_job_id
    AND worker_id = p_worker_id
    AND status = 'running';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;

-- ─── Helper: fail job with retry or dead-letter ───────────────────────────────
CREATE OR REPLACE FUNCTION fail_job(
  p_job_id       UUID,
  p_worker_id    TEXT,
  p_error        TEXT,
  p_retry_delay  INTEGER DEFAULT 300  -- seconds before next retry
)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_job        job_queue;
  v_new_status TEXT;
BEGIN
  SELECT * INTO v_job FROM job_queue WHERE id = p_job_id AND worker_id = p_worker_id AND status = 'running';
  IF NOT FOUND THEN RETURN 'not_found'; END IF;

  IF v_job.attempts >= v_job.max_attempts THEN
    v_new_status := 'dead_lettered';
    INSERT INTO job_queue_dead_letter (original_job_id, job_type, workspace_id, brand_id, payload, failure_reason, attempts)
    VALUES (v_job.id, v_job.job_type, v_job.workspace_id, v_job.brand_id, v_job.payload, p_error, v_job.attempts);
  ELSE
    v_new_status := 'retrying';
  END IF;

  UPDATE job_queue
  SET
    status           = v_new_status,
    last_error       = p_error,
    last_error_at    = NOW(),
    next_attempt_at  = CASE WHEN v_new_status = 'retrying'
                          THEN NOW() + (p_retry_delay || ' seconds')::INTERVAL
                          ELSE NULL END,
    scheduled_at     = CASE WHEN v_new_status = 'retrying'
                          THEN NOW() + (p_retry_delay || ' seconds')::INTERVAL
                          ELSE scheduled_at END,
    lease_expires_at = NULL,
    worker_id        = NULL,
    completed_at     = CASE WHEN v_new_status = 'dead_lettered' THEN NOW() ELSE NULL END,
    updated_at       = NOW()
  WHERE id = p_job_id;

  RETURN v_new_status;
END;
$$;

-- ─── Helper: recover abandoned jobs (run periodically by worker) ──────────────
CREATE OR REPLACE FUNCTION recover_abandoned_jobs()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Jobs whose lease expired but are still 'running'
  UPDATE job_queue
  SET
    status           = CASE WHEN attempts >= max_attempts THEN 'dead_lettered' ELSE 'retrying' END,
    last_error       = 'Lease expired: worker did not complete or heartbeat before lease_expires_at',
    last_error_at    = NOW(),
    scheduled_at     = NOW() + INTERVAL '60 seconds',
    lease_expires_at = NULL,
    worker_id        = NULL,
    updated_at       = NOW()
  WHERE status = 'running'
    AND lease_expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Dead-letter any recovered jobs that exceeded max_attempts
  INSERT INTO job_queue_dead_letter (original_job_id, job_type, workspace_id, brand_id, payload, failure_reason, attempts)
  SELECT id, job_type, workspace_id, brand_id, payload, last_error, attempts
  FROM job_queue
  WHERE status = 'dead_lettered'
    AND completed_at IS NULL;

  UPDATE job_queue SET completed_at = NOW(), updated_at = NOW()
  WHERE status = 'dead_lettered' AND completed_at IS NULL;

  RETURN v_count;
END;
$$;

COMMIT;

