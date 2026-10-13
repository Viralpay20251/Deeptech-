-- ============================================================
-- Migration: 007_create_tracked_links.sql
-- Description: Independent Outbound Tracking Router & Click Intelligence.
--              Enables measuring legitimate, bot-filtered outbound traffic
--              with zero code modifications on CHATR, TalentXcel, or Nuty Tales.
-- ============================================================

CREATE TABLE tracked_links (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    campaign_id         UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    short_code          TEXT NOT NULL UNIQUE,
    target_url          TEXT NOT NULL,
    title               TEXT NOT NULL DEFAULT '',
    utm_source          TEXT,
    utm_medium          TEXT,
    utm_campaign        TEXT,
    utm_term            TEXT,
    utm_content         TEXT,
    clicks_total        INTEGER NOT NULL DEFAULT 0,
    clicks_human        INTEGER NOT NULL DEFAULT 0,
    clicks_bot          INTEGER NOT NULL DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tracked_links_short_code ON tracked_links(short_code);
CREATE INDEX idx_tracked_links_brand ON tracked_links(brand_id);
CREATE INDEX idx_tracked_links_workspace ON tracked_links(workspace_id);

COMMENT ON TABLE tracked_links IS
    'Tracked outbound marketing links with UTM parameters. Resolves transparently via /r/:short_code.';

CREATE TABLE tracked_link_clicks (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracked_link_id         UUID NOT NULL REFERENCES tracked_links(id) ON DELETE CASCADE,
    brand_id                UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    ip_hash                 TEXT NOT NULL,
    user_agent              TEXT NOT NULL DEFAULT '',
    referer                 TEXT NOT NULL DEFAULT '',
    traffic_classification  TEXT NOT NULL DEFAULT 'unknown' CHECK (traffic_classification IN (
                                'verified_bot', 'likely_bot', 'likely_human', 'unknown'
                            )),
    confidence              NUMERIC(4,3) NOT NULL DEFAULT 0.50 CHECK (confidence BETWEEN 0 AND 1),
    is_eligible_for_mau     BOOLEAN NOT NULL DEFAULT FALSE,
    clicked_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tracked_link_clicks_link ON tracked_link_clicks(tracked_link_id, clicked_at DESC);
CREATE INDEX idx_tracked_link_clicks_brand ON tracked_link_clicks(brand_id, clicked_at DESC);
CREATE INDEX idx_tracked_link_clicks_mau ON tracked_link_clicks(is_eligible_for_mau) WHERE is_eligible_for_mau = TRUE;

COMMENT ON TABLE tracked_link_clicks IS
    'Individual click telemetry with bot classification and privacy-preserving IP hashing.';

CREATE TRIGGER trg_tracked_links_updated_at BEFORE UPDATE ON tracked_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
