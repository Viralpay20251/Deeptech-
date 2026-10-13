-- Migration 015: Meta Studio V3 Schema Enhancements
-- Adds workspace_id and observed_payload to metadata_proposals for tenant isolation and audit trail

ALTER TABLE metadata_proposals
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS observed_payload JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS diff_summary JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_metadata_proposals_workspace ON metadata_proposals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_metadata_proposals_status ON metadata_proposals(status);
