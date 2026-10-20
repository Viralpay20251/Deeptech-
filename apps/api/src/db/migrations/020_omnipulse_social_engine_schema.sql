-- ============================================================
-- Migration: 020_omnipulse_social_engine_schema.sql
-- Description: Social media autonomous distribution engine schema,
--              multi-account pool, content queue, trend signals,
--              and daily distribution telemetry.
-- ============================================================

-- ─── 1. social_accounts ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_cluster TEXT NOT NULL CHECK (brand_cluster IN ('talentxcel', 'chatr', 'nutytales', 'talentxcel_academy')),
    platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'facebook', 'linkedin', 'x_twitter', 'facebook_group')),
    account_handle TEXT NOT NULL,
    account_display_name TEXT,
    profile_path TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    cookie_file_path TEXT,
    login_email TEXT,
    follower_count INT DEFAULT 0,
    daily_post_limit INT DEFAULT 3,
    weekly_post_count INT DEFAULT 0,
    last_posted_at TIMESTAMPTZ,
    last_health_check_at TIMESTAMPTZ,
    health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'shadowbanned', 'restricted', 'logged_out', 'unknown')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(platform, account_handle)
);

CREATE INDEX IF NOT EXISTS idx_social_acc_brand_plat ON social_accounts(brand_cluster, platform);
CREATE INDEX IF NOT EXISTS idx_social_acc_health ON social_accounts(health_status, active);

COMMENT ON TABLE social_accounts IS 'Multi-channel account pool for stealth browser automation (Patchright) across YouTube, Instagram, Facebook, LinkedIn, and X.';

-- ─── 2. content_queue ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_cluster TEXT NOT NULL,
    platform TEXT NOT NULL,
    social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('short_video', 'reel', 'post', 'story', 'thread', 'article')),
    script_text TEXT,
    hook_line TEXT,
    media_file_path TEXT,
    thumbnail_path TEXT,
    caption TEXT,
    first_comment_text TEXT,
    first_comment_status TEXT DEFAULT 'pending' CHECK (first_comment_status IN ('pending', 'posted', 'failed', 'skipped')),
    source_pseo_url TEXT,
    source_trend_query TEXT,
    scheduled_for TIMESTAMPTZ,
    posted_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'media_ready', 'scheduled', 'posted', 'failed', 'cancelled')),
    post_url TEXT,
    views_count BIGINT DEFAULT 0,
    likes_count INT DEFAULT 0,
    shares_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    view_velocity NUMERIC(8,2),
    virality_score NUMERIC(5,3) DEFAULT 0,
    retry_count INT DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_queue_sched ON content_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_content_queue_brand_plat ON content_queue(brand_cluster, platform, status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_content_queue_velocity ON content_queue(view_velocity DESC) WHERE status = 'posted';

COMMENT ON TABLE content_queue IS 'Unified multi-platform publishing queue orchestrating autonomous rendering, stealth posting, and engagement telemetry.';

-- ─── Auto-update content_queue.updated_at Trigger ─────────────────────────
CREATE OR REPLACE FUNCTION update_content_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_content_queue_updated_at ON content_queue;
CREATE TRIGGER trg_content_queue_updated_at
BEFORE UPDATE ON content_queue
FOR EACH ROW
EXECUTE FUNCTION update_content_queue_updated_at();

-- ─── 3. trend_signals ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trend_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_cluster TEXT NOT NULL,
    query TEXT NOT NULL,
    normalized_query TEXT NOT NULL,
    platform_discovered TEXT,
    search_volume_estimate INT DEFAULT 0,
    competition_score NUMERIC(4,3) DEFAULT 0.5,
    opportunity_score NUMERIC(4,3) DEFAULT 0.5,
    related_pseo_hostname TEXT,
    related_dimension_type TEXT,
    ollama_angle TEXT,
    content_formats_suggested TEXT[] DEFAULT '{}',
    scripts_generated INT DEFAULT 0,
    content_created INT DEFAULT 0,
    discovered_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS idx_trend_signals_brand_opp ON trend_signals(brand_cluster, opportunity_score DESC, expires_at);
CREATE INDEX IF NOT EXISTS idx_trend_signals_query ON trend_signals(normalized_query);

COMMENT ON TABLE trend_signals IS 'Discovered viral search and social trend signals synthesized by SearXNG and local Ollama inference.';

-- ─── 4. distribution_metrics ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS distribution_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_cluster TEXT NOT NULL,
    platform TEXT NOT NULL,
    date DATE NOT NULL,
    posts_attempted INT DEFAULT 0,
    posts_succeeded INT DEFAULT 0,
    posts_failed INT DEFAULT 0,
    total_views BIGINT DEFAULT 0,
    total_reach BIGINT DEFAULT 0,
    total_engagements INT DEFAULT 0,
    top_performing_post_url TEXT,
    top_performing_views BIGINT DEFAULT 0,
    avg_view_velocity NUMERIC(8,2) DEFAULT 0,
    accounts_healthy INT DEFAULT 0,
    accounts_shadowbanned INT DEFAULT 0,
    quota_violations INT DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(brand_cluster, platform, date)
);

CREATE INDEX IF NOT EXISTS idx_dist_metrics_brand_date ON distribution_metrics(brand_cluster, date DESC);

COMMENT ON TABLE distribution_metrics IS 'Daily aggregated distribution and engagement telemetry per brand cluster and social network.';

-- ─── 5. Seed social_accounts (4 brand clusters x 5 platforms = 20 rows) ───
INSERT INTO social_accounts (
    brand_cluster, platform, account_handle, account_display_name, profile_path, is_primary, cookie_file_path, daily_post_limit, health_status, active
) VALUES
-- TalentXcel (Primary Talent & Tech Brand)
('talentxcel', 'youtube', '@talentxcel_official', 'TalentXcel Tech Careers & Code', 'https://youtube.com/@talentxcel_official', TRUE, '/profiles/talentxcel_youtube.json', 3, 'healthy', TRUE),
('talentxcel', 'instagram', '@talentxcel_jobs', 'TalentXcel | Jobs & Salary Index', 'https://instagram.com/talentxcel_jobs', TRUE, '/profiles/talentxcel_instagram.json', 3, 'healthy', TRUE),
('talentxcel', 'facebook', '@talentxcel.careers', 'TalentXcel Official Careers Hub', 'https://facebook.com/talentxcel.careers', TRUE, '/profiles/talentxcel_facebook.json', 3, 'healthy', TRUE),
('talentxcel', 'linkedin', '@talentxcel', 'TalentXcel Network', 'https://linkedin.com/company/talentxcel', TRUE, '/profiles/talentxcel_linkedin.json', 3, 'healthy', TRUE),
('talentxcel', 'x_twitter', '@talentxcel_jobs', 'TalentXcel Tech Jobs & Insights', 'https://x.com/talentxcel_jobs', TRUE, '/profiles/talentxcel_x.json', 3, 'healthy', TRUE),

-- CHATR (Conversational AI Platform)
('chatr', 'youtube', '@chatr_ai', 'CHATR AI | Omnichannel Automation', 'https://youtube.com/@chatr_ai', TRUE, '/profiles/chatr_youtube.json', 3, 'healthy', TRUE),
('chatr', 'instagram', '@chatr_chat', 'CHATR Conversational AI', 'https://instagram.com/chatr_chat', TRUE, '/profiles/chatr_instagram.json', 3, 'healthy', TRUE),
('chatr', 'facebook', '@chatrchat', 'CHATR Customer Intelligence', 'https://facebook.com/chatrchat', TRUE, '/profiles/chatr_facebook.json', 3, 'healthy', TRUE),
('chatr', 'linkedin', '@chatr-ai', 'CHATR Conversational Solutions', 'https://linkedin.com/company/chatr-ai', TRUE, '/profiles/chatr_linkedin.json', 3, 'healthy', TRUE),
('chatr', 'x_twitter', '@chatr_chat', 'CHATR Autonomous Agents', 'https://x.com/chatr_chat', TRUE, '/profiles/chatr_x.json', 3, 'healthy', TRUE),

-- Nuty Tales (Himalayan Gourmet & Crafts E-Commerce)
('nutytales', 'youtube', '@nutytales_organics', 'Nuty Tales | Himalayan Heritage Harvest', 'https://youtube.com/@nutytales_organics', TRUE, '/profiles/nutytales_youtube.json', 3, 'healthy', TRUE),
('nutytales', 'instagram', '@nutytales_india', 'Nuty Tales Pure Kashmir Gourmet', 'https://instagram.com/nutytales_india', TRUE, '/profiles/nutytales_instagram.json', 3, 'healthy', TRUE),
('nutytales', 'facebook', '@nutytales.valley', 'Nuty Tales Organic Valley Foods', 'https://facebook.com/nutytales.valley', TRUE, '/profiles/nutytales_facebook.json', 3, 'healthy', TRUE),
('nutytales', 'linkedin', '@nutytales', 'Nuty Tales Himalayan Luxury & B2B', 'https://linkedin.com/company/nutytales', TRUE, '/profiles/nutytales_linkedin.json', 3, 'healthy', TRUE),
('nutytales', 'x_twitter', '@nutytales_india', 'Nuty Tales Gourmet & Gifting', 'https://x.com/nutytales_india', TRUE, '/profiles/nutytales_x.json', 3, 'healthy', TRUE),

-- TalentXcel Academy (Tech Learning & Fellowship)
('talentxcel_academy', 'youtube', '@talentxcel_academy', 'TalentXcel Tech Academy & Masterclasses', 'https://youtube.com/@talentxcel_academy', TRUE, '/profiles/academy_youtube.json', 3, 'healthy', TRUE),
('talentxcel_academy', 'instagram', '@talentxcel_academy', 'TalentXcel Academy | Code & System Design', 'https://instagram.com/talentxcel_academy', TRUE, '/profiles/academy_instagram.json', 3, 'healthy', TRUE),
('talentxcel_academy', 'facebook', '@talentxcel.academy', 'TalentXcel Academy Learning Community', 'https://facebook.com/talentxcel.academy', TRUE, '/profiles/academy_facebook.json', 3, 'healthy', TRUE),
('talentxcel_academy', 'linkedin', '@talentxcel-academy', 'TalentXcel Tech Academy', 'https://linkedin.com/school/talentxcel-academy', TRUE, '/profiles/academy_linkedin.json', 3, 'healthy', TRUE),
('talentxcel_academy', 'x_twitter', '@talentxcel_acad', 'TalentXcel Academy Tips & Code', 'https://x.com/talentxcel_acad', TRUE, '/profiles/academy_x.json', 3, 'healthy', TRUE)

ON CONFLICT (platform, account_handle) DO UPDATE SET
    account_display_name = EXCLUDED.account_display_name,
    profile_path = EXCLUDED.profile_path,
    is_primary = EXCLUDED.is_primary,
    cookie_file_path = EXCLUDED.cookie_file_path,
    daily_post_limit = EXCLUDED.daily_post_limit,
    health_status = EXCLUDED.health_status,
    active = EXCLUDED.active;
