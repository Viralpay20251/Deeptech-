-- Migration 013: P8 — Crawl Engine, SEO Workbench, Metadata Studio, Evidence Store
-- Implements all new DB entities required by P8 of the specification.
-- All tables are additive; migration is safe to run on an existing schema.

-- ─── Crawl Jobs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crawl_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id      UUID REFERENCES brands(id) ON DELETE SET NULL,
  label         TEXT NOT NULL,
  seed_urls     JSONB NOT NULL DEFAULT '[]',
  profile       TEXT NOT NULL DEFAULT 'discovery'
                  CHECK (profile IN ('sitemap','rss','robots','internal_links','discovery','seo_audit','metadata')),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','paused','completed','failed','cancelled')),
  max_pages     INT  NOT NULL DEFAULT 500,
  pages_crawled INT  NOT NULL DEFAULT 0,
  error         TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Crawl Job URLs (per-URL result rows) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS crawl_job_urls (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_job_id   UUID NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  url            TEXT NOT NULL,
  depth          INT  NOT NULL DEFAULT 0,
  status_code    INT,
  redirected_to  TEXT,
  content_type   TEXT,
  crawled_at     TIMESTAMPTZ,
  error          TEXT,
  robots_allowed BOOLEAN,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_crawl_job_urls ON crawl_job_urls(crawl_job_id, url);

-- ─── Page Snapshots ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS page_snapshots (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_job_id UUID NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  url          TEXT NOT NULL,
  status_code  INT,
  html_hash    TEXT,
  title        TEXT,
  h1           TEXT,
  meta_desc    TEXT,
  canonical    TEXT,
  robots_tag   TEXT,
  word_count   INT,
  internal_links INT NOT NULL DEFAULT 0,
  external_links INT NOT NULL DEFAULT 0,
  images_count   INT NOT NULL DEFAULT 0,
  images_missing_alt INT NOT NULL DEFAULT 0,
  schema_types   JSONB NOT NULL DEFAULT '[]',
  open_graph     JSONB NOT NULL DEFAULT '{}',
  twitter_card   JSONB NOT NULL DEFAULT '{}',
  raw_headers    JSONB NOT NULL DEFAULT '{}',
  snapshot_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_page_snapshots ON page_snapshots(crawl_job_id, url);

-- ─── Page Metadata Extractions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS page_metadata_extractions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_snapshot_id UUID NOT NULL REFERENCES page_snapshots(id) ON DELETE CASCADE,
  brand_id         UUID REFERENCES brands(id) ON DELETE SET NULL,
  field_name       TEXT NOT NULL,
  current_value    TEXT,
  proposed_value   TEXT,
  status           TEXT NOT NULL DEFAULT 'detected'
                     CHECK (status IN ('detected','proposed','approved','rejected','published')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SEO Findings ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_findings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_job_id   UUID NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
  page_snapshot_id UUID REFERENCES page_snapshots(id) ON DELETE CASCADE,
  brand_id       UUID REFERENCES brands(id) ON DELETE SET NULL,
  issue_code     TEXT NOT NULL,
  severity       TEXT NOT NULL DEFAULT 'warning'
                   CHECK (severity IN ('critical','error','warning','info')),
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  evidence       JSONB NOT NULL DEFAULT '{}',
  recommendation TEXT,
  status         TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','acknowledged','resolved','wont_fix')),
  url            TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_seo_findings_job ON seo_findings(crawl_job_id);
CREATE INDEX IF NOT EXISTS idx_seo_findings_brand ON seo_findings(brand_id);

-- ─── Metadata Proposals ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metadata_proposals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     UUID REFERENCES brands(id) ON DELETE SET NULL,
  url          TEXT NOT NULL,
  proposal_type TEXT NOT NULL DEFAULT 'meta_tags'
                  CHECK (proposal_type IN ('meta_tags','json_ld','open_graph','twitter_card')),
  payload      JSONB NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','pending_review','approved','rejected','published')),
  approved_by  UUID,
  approved_at  TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Source Evidence ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS source_evidence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  title           TEXT,
  authors         JSONB NOT NULL DEFAULT '[]',
  published_date  DATE,
  publisher       TEXT,
  doi             TEXT,
  evidence_type   TEXT NOT NULL DEFAULT 'web_page'
                    CHECK (evidence_type IN ('web_page','academic_paper','government_data','api_response','official_docs','news_article','dataset')),
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  content_hash    TEXT,
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  verification_notes TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_source_evidence_url ON source_evidence(workspace_id, url);

-- ─── Evidence Claim Links ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evidence_claim_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id     UUID NOT NULL REFERENCES source_evidence(id) ON DELETE CASCADE,
  resource_type   TEXT NOT NULL,
  resource_id     UUID NOT NULL,
  claim_text      TEXT NOT NULL,
  claim_type      TEXT NOT NULL DEFAULT 'factual'
                    CHECK (claim_type IN ('factual','statistical','comparative','causal','definitional')),
  passes_check    BOOLEAN NOT NULL DEFAULT FALSE,
  check_notes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ecl_resource ON evidence_claim_links(resource_type, resource_id);

-- ─── Connector Health Checks ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connector_health_checks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_instance_id UUID REFERENCES connector_instances(id) ON DELETE SET NULL,
  connector_type        TEXT NOT NULL,
  workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  checked_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  config_ok             BOOLEAN NOT NULL DEFAULT FALSE,
  auth_ok               BOOLEAN NOT NULL DEFAULT FALSE,
  capability_ok         BOOLEAN NOT NULL DEFAULT FALSE,
  data_freshness_ok     BOOLEAN NOT NULL DEFAULT FALSE,
  latency_ms            INT,
  status                TEXT NOT NULL DEFAULT 'unknown'
                          CHECK (status IN ('connected','awaiting_credentials','awaiting_oauth','degraded','error','unknown')),
  message               TEXT,
  raw_response          JSONB
);
CREATE INDEX IF NOT EXISTS idx_chc_connector ON connector_health_checks(connector_instance_id);
CREATE INDEX IF NOT EXISTS idx_chc_workspace ON connector_health_checks(workspace_id, connector_type, checked_at DESC);

-- ─── Connector Sync Runs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connector_sync_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_instance_id UUID REFERENCES connector_instances(id) ON DELETE SET NULL,
  connector_type        TEXT NOT NULL,
  workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id              UUID REFERENCES brands(id) ON DELETE SET NULL,
  started_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  status                TEXT NOT NULL DEFAULT 'running'
                          CHECK (status IN ('running','completed','failed','partial')),
  rows_fetched          INT NOT NULL DEFAULT 0,
  rows_upserted         INT NOT NULL DEFAULT 0,
  error                 TEXT,
  sync_metadata         JSONB NOT NULL DEFAULT '{}'
);

-- ─── Connector Usage Events ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connector_usage_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_type TEXT NOT NULL,
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type     TEXT NOT NULL,
  api_endpoint   TEXT,
  request_count  INT NOT NULL DEFAULT 1,
  quota_unit     TEXT,
  quota_consumed INT,
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cue_connector ON connector_usage_events(workspace_id, connector_type, occurred_at DESC);

-- ─── Timestamps trigger helper ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_crawl_jobs_updated_at
    BEFORE UPDATE ON crawl_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_seo_findings_updated_at
    BEFORE UPDATE ON seo_findings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  CREATE TRIGGER trg_metadata_proposals_updated_at
    BEFORE UPDATE ON metadata_proposals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;
