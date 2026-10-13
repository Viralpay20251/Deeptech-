-- ============================================================
-- Migration: 005_create_content_and_campaigns.sql
-- Description: Content assets, quality checks, claims, citations,
--              campaigns, outbound links, and publication records.
--
-- ROLLBACK NOTES:
--   DROP TABLE IF EXISTS publication_records, outbound_links,
--                        campaign_assets, campaigns,
--                        claims, content_assets CASCADE;
-- ============================================================

-- ─── Content Assets ───────────────────────────────────────────────────────────

CREATE TABLE content_assets (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brand_id                UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    opportunity_id          UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    asset_type              TEXT NOT NULL CHECK (asset_type IN (
                                'search_landing_page', 'topic_hub', 'article', 'faq_page',
                                'interactive_tool', 'buying_guide', 'career_guide',
                                'gift_guide', 'social_post', 'video_script',
                                'newsletter', 'partner_pitch', 'outreach_draft'
                            )),
    lifecycle_status        TEXT NOT NULL DEFAULT 'draft'
                            CHECK (lifecycle_status IN (
                                'discovered', 'researching', 'draft', 'quality_review',
                                'approval_required', 'approved', 'scheduled', 'published',
                                'monitoring', 'refresh_needed', 'consolidation_candidate',
                                'retired', 'blocked'
                            )),
    title                   TEXT NOT NULL,
    body_markdown           TEXT NOT NULL DEFAULT '',
    audience_description    TEXT NOT NULL DEFAULT '',
    intent_type             TEXT NOT NULL CHECK (intent_type IN (
                                'informational', 'navigational', 'transactional',
                                'commercial_investigation', 'career_job_search', 'community'
                            )),
    locale                  TEXT NOT NULL DEFAULT 'en',
    country_code            CHAR(2),
    version                 INTEGER NOT NULL DEFAULT 1,
    authoring_agent         TEXT NOT NULL,
    source_evidence_ids     UUID[] NOT NULL DEFAULT '{}',
    citation_urls           TEXT[] NOT NULL DEFAULT '{}',
    quality_check_results   JSONB NOT NULL DEFAULT '[]'::JSONB,
    approval_event_id       UUID REFERENCES approval_events(id) ON DELETE SET NULL,
    published_url           TEXT,
    canonical_url           TEXT,
    campaign_id             UUID, -- FK added below after campaigns table
    is_demo_data            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_assets_workspace ON content_assets(workspace_id);
CREATE INDEX idx_content_assets_brand ON content_assets(brand_id);
CREATE INDEX idx_content_assets_status ON content_assets(lifecycle_status);
CREATE INDEX idx_content_assets_demo ON content_assets(is_demo_data) WHERE is_demo_data = TRUE;

COMMENT ON TABLE content_assets IS
    'Content and experience repository. All assets must pass quality checks and '
    'human approval before publication. Default publishing destination is OS-owned properties.';

-- ─── Claims and Citations ─────────────────────────────────────────────────────

CREATE TABLE claims (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id                UUID NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
    workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    claim_text              TEXT NOT NULL,
    claim_type              TEXT NOT NULL CHECK (claim_type IN (
                                'statistical', 'factual', 'product_capability',
                                'comparative', 'testimonial', 'pricing'
                            )),
    source_citation_url     TEXT NOT NULL,
    source_citation_title   TEXT NOT NULL DEFAULT '',
    is_verified             BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by_agent       TEXT,
    verification_notes      TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claims_asset ON claims(asset_id);

COMMENT ON TABLE claims IS
    'Individual verifiable claims made in content assets. '
    'Fabricated claims (stats, salaries, jobs, health benefits, fake reviews) are strictly forbidden.';

-- ─── Campaigns ────────────────────────────────────────────────────────────────

CREATE TABLE campaigns (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brand_id                UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    objective               TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN (
                                'draft', 'awaiting_approval', 'active', 'paused',
                                'completed', 'cancelled'
                            )),
    channels                TEXT[] NOT NULL DEFAULT '{}',
    target_locale           TEXT NOT NULL DEFAULT 'en',
    target_country          CHAR(2),
    utm_source              TEXT NOT NULL,
    utm_medium              TEXT NOT NULL,
    utm_campaign            TEXT NOT NULL,
    start_date              DATE,
    end_date                DATE,
    budget_cap_usd          NUMERIC(10,2),
    autonomy_level          SMALLINT NOT NULL DEFAULT 1 CHECK (autonomy_level BETWEEN 0 AND 4),
    approval_event_id       UUID REFERENCES approval_events(id) ON DELETE SET NULL,
    experiment_id           UUID, -- FK added in 006 migration
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_workspace ON campaigns(workspace_id);
CREATE INDEX idx_campaigns_brand ON campaigns(brand_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);

ALTER TABLE content_assets
    ADD CONSTRAINT fk_content_assets_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;

-- ─── Outbound Links (Transparent measurement) ─────────────────────────────────

CREATE TABLE outbound_links (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brand_id                UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    campaign_id             UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    short_code              TEXT NOT NULL UNIQUE,
    destination_url         TEXT NOT NULL,  -- verified destination on target brand
    utm_source              TEXT NOT NULL,
    utm_medium              TEXT NOT NULL,
    utm_campaign            TEXT NOT NULL,
    utm_content             TEXT,
    utm_term                TEXT,
    click_count             INTEGER NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outbound_links_code ON outbound_links(short_code);
CREATE INDEX idx_outbound_links_brand ON outbound_links(brand_id);

COMMENT ON TABLE outbound_links IS
    'Transparent redirect tracking. Destination must be clearly disclosed; no deceptive cloaking.';

-- ─── Publication Records ──────────────────────────────────────────────────────

CREATE TABLE publication_records (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brand_id                UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    asset_id                UUID NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
    campaign_id             UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    connector_instance_id   UUID REFERENCES connector_instances(id) ON DELETE SET NULL,
    channel                 TEXT NOT NULL,
    destination_type        TEXT NOT NULL CHECK (destination_type IN (
                                'os_owned_property', 'authorised_brand_property',
                                'authorised_social_account', 'partner_export', 'manual_draft'
                            )),
    external_post_id        TEXT,
    published_url           TEXT NOT NULL,
    approval_event_id       UUID NOT NULL REFERENCES approval_events(id),
    status                  TEXT NOT NULL CHECK (status IN ('published', 'failed', 'retracted', 'scheduled')),
    response_payload        JSONB NOT NULL DEFAULT '{}'::JSONB,
    published_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_publication_records_asset ON publication_records(asset_id);
CREATE INDEX idx_publication_records_brand ON publication_records(brand_id);
CREATE INDEX idx_publication_records_workspace ON publication_records(workspace_id);

COMMENT ON TABLE publication_records IS
    'Immutable audit log of all publishing actions. Requires valid approval_event_id.';

-- ─── Triggers ─────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_content_assets_updated_at BEFORE UPDATE ON content_assets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
