-- Migration 016: Metadata Governance, Grounding Validation & Intelligence Graph Outcomes
-- Enforces tenant isolation, operator audit trail, and outcome measurement

-- 1. Metadata Proposals Enhancements
ALTER TABLE metadata_proposals
  ADD COLUMN IF NOT EXISTS grounding_status TEXT DEFAULT 'pending'
    CHECK (grounding_status IN ('pending', 'grounded', 'warning', 'violation')),
  ADD COLUMN IF NOT EXISTS grounding_report JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS decided_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;

-- Backfill default workspace for any existing proposals without workspace_id
UPDATE metadata_proposals
SET workspace_id = '00000000-0000-0000-0000-000000000001'
WHERE workspace_id IS NULL;

-- 2. Metadata Outcome Measurements Table
CREATE TABLE IF NOT EXISTS metadata_outcome_measurements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id       UUID REFERENCES metadata_proposals(id) ON DELETE CASCADE,
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brand_id          UUID REFERENCES brands(id) ON DELETE SET NULL,
  url               TEXT NOT NULL,
  baseline_metrics  JSONB NOT NULL DEFAULT '{}',
  current_metrics   JSONB NOT NULL DEFAULT '{}',
  metrics_delta     JSONB NOT NULL DEFAULT '{}',
  measured_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_outcomes_workspace ON metadata_outcome_measurements(workspace_id);
CREATE INDEX IF NOT EXISTS idx_meta_outcomes_proposal ON metadata_outcome_measurements(proposal_id);
CREATE INDEX IF NOT EXISTS idx_meta_outcomes_brand ON metadata_outcome_measurements(brand_id);
CREATE INDEX IF NOT EXISTS idx_meta_outcomes_url ON metadata_outcome_measurements(url);
