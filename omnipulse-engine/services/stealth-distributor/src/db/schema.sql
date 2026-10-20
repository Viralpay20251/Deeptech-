-- ============================================================
-- Schema: OmniPulse Engine Stealth Distributor
-- Tables: content_queue, social_accounts, distribution_metrics
-- ============================================================

-- 1. Social Accounts Registry
CREATE TABLE IF NOT EXISTS social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'facebook', 'linkedin', 'twitter')),
    brand_cluster TEXT NOT NULL DEFAULT 'chatr',
    account_handle TEXT NOT NULL,
    profile_path TEXT NOT NULL DEFAULT '',
    cookie_file_path TEXT NOT NULL,
    health_status TEXT NOT NULL DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'shadowbanned', 'rate_limited', 'dead', 'cooling_down')),
    daily_post_limit INTEGER NOT NULL DEFAULT 3,
    last_posted_at TIMESTAMPTZ,
    posts_today INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_platform_handle UNIQUE (platform, account_handle)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_platform_health ON social_accounts(platform, health_status);
CREATE INDEX IF NOT EXISTS idx_social_accounts_brand ON social_accounts(brand_cluster);

-- 2. Content Distribution Queue
CREATE TABLE IF NOT EXISTS content_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_cluster TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'facebook', 'linkedin', 'twitter')),
    social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
    content_type TEXT NOT NULL DEFAULT 'short_video',
    script_text TEXT NOT NULL DEFAULT '',
    hook_line TEXT NOT NULL DEFAULT '',
    media_file_path TEXT NOT NULL,
    thumbnail_path TEXT NOT NULL DEFAULT '',
    caption TEXT NOT NULL DEFAULT '',
    first_comment_text TEXT NOT NULL DEFAULT '',
    source_pseo_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'media_ready' CHECK (status IN ('draft', 'pending', 'media_ready', 'processing', 'published', 'failed')),
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_url TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_queue_status_sched ON content_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_content_queue_platform_brand ON content_queue(platform, brand_cluster);

-- 3. Distribution Metrics & Performance
CREATE TABLE IF NOT EXISTS distribution_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID NOT NULL,
    platform TEXT NOT NULL,
    social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
    brand_cluster TEXT NOT NULL,
    post_url TEXT,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    views_count INTEGER NOT NULL DEFAULT 0,
    likes_count INTEGER NOT NULL DEFAULT 0,
    comments_count INTEGER NOT NULL DEFAULT 0,
    shares_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_content_platform UNIQUE (content_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_distribution_metrics_platform_brand ON distribution_metrics(platform, brand_cluster);
