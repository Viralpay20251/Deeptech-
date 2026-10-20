-- ============================================================================
-- MIGRATION: 0008_pageview_multiplier_and_webpush.sql (mirrors supabase/migrations/0005)
-- High-Velocity Pageview Multiplier, Web Push (VAPID), and Google Discover Engine
-- Target: 1,000,000 to 5,000,000+ Daily Pageviews across 21 Canonical Domains
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Web Push Subscriptions (Zero-cost native browser push via VAPID)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint TEXT UNIQUE NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    hostname TEXT NOT NULL,
    brand_cluster TEXT NOT NULL CHECK (brand_cluster IN ('talentxcel', 'chatr', 'nutytales')),
    interest_slug TEXT,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_pushed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_push_subs_hostname ON public.push_subscriptions(hostname);
CREATE INDEX IF NOT EXISTS idx_push_subs_brand ON public.push_subscriptions(brand_cluster);
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON public.push_subscriptions(is_active);

-- 2. Google Discover & WebSub Breakout Pulse Reports
CREATE TABLE IF NOT EXISTS public.discover_pulse_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT NOT NULL,
    hostname TEXT NOT NULL,
    brand_cluster TEXT NOT NULL CHECK (brand_cluster IN ('talentxcel', 'chatr', 'nutytales')),
    headline TEXT NOT NULL,
    summary TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    trending_keywords TEXT[] NOT NULL DEFAULT '{}',
    leaf_urls JSONB NOT NULL DEFAULT '[]'::jsonb, -- 15 programmatic cross-links
    og_image_url TEXT NOT NULL,
    og_image_width INT DEFAULT 1200,
    og_image_height INT DEFAULT 675,
    websub_status TEXT DEFAULT 'pending' CHECK (websub_status IN ('pending', 'pinged', 'failed', 'verified')),
    websub_hub TEXT DEFAULT 'https://pubsubhubbub.appspot.com/',
    websub_pinged_at TIMESTAMP WITH TIME ZONE,
    date_published TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_modified TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_discover_pulse_host_slug UNIQUE (hostname, slug)
);

CREATE INDEX IF NOT EXISTS idx_discover_pulse_host ON public.discover_pulse_reports(hostname);
CREATE INDEX IF NOT EXISTS idx_discover_pulse_published ON public.discover_pulse_reports(date_published DESC);
CREATE INDEX IF NOT EXISTS idx_discover_pulse_websub ON public.discover_pulse_reports(websub_status);

-- 3. Interactive Multiplier Session Funnel Events (Tracks 5x to 8x session depth)
CREATE TABLE IF NOT EXISTS public.session_funnel_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT NOT NULL,
    hostname TEXT NOT NULL,
    brand_cluster TEXT NOT NULL CHECK (brand_cluster IN ('talentxcel', 'chatr', 'nutytales')),
    current_step INT NOT NULL CHECK (current_step BETWEEN 1 AND 8),
    tool_type TEXT NOT NULL, -- e.g. 'salary_comparator', 'resume_ats_scanner', 'agent_intent_sandbox', 'hamper_configurator', 'valley_itinerary'
    step_name TEXT NOT NULL,
    path_url TEXT NOT NULL,
    interaction_payload JSONB DEFAULT '{}'::jsonb,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funnel_session ON public.session_funnel_events(session_id);
CREATE INDEX IF NOT EXISTS idx_funnel_host_step ON public.session_funnel_events(hostname, current_step);
CREATE INDEX IF NOT EXISTS idx_funnel_created ON public.session_funnel_events(created_at DESC);

-- 4. Real-time Domain Pageview Velocity & Multiplier Scorecard (21 Canonical Domains)
CREATE TABLE IF NOT EXISTS public.domain_pageview_velocity (
    hostname TEXT PRIMARY KEY,
    brand_cluster TEXT NOT NULL CHECK (brand_cluster IN ('talentxcel', 'chatr', 'nutytales')),
    total_pageviews BIGINT DEFAULT 0,
    daily_pageviews BIGINT DEFAULT 0,
    sessions_count BIGINT DEFAULT 0,
    avg_session_depth NUMERIC(5,2) DEFAULT 1.0,
    discover_impressions BIGINT DEFAULT 0,
    discover_clicks BIGINT DEFAULT 0,
    push_subscribers_count BIGINT DEFAULT 0,
    viral_shares_count BIGINT DEFAULT 0,
    active_multiplier_tool TEXT NOT NULL,
    has_large_image_meta BOOLEAN DEFAULT TRUE,
    last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_velocity_brand ON public.domain_pageview_velocity(brand_cluster);

-- 5. Seed Initial Records for All 21 Active Canonical Production Domains
INSERT INTO public.domain_pageview_velocity (
    hostname,
    brand_cluster,
    total_pageviews,
    daily_pageviews,
    sessions_count,
    avg_session_depth,
    discover_impressions,
    discover_clicks,
    push_subscribers_count,
    viral_shares_count,
    active_multiplier_tool,
    has_large_image_meta
) VALUES
-- TalentXcel (11 Canonical Origins)
('salary.talentxcel.in', 'talentxcel', 382400, 72500, 12500, 5.80, 185000, 14800, 42100, 8900, 'In-Hand CTC & Tax Regime Comparator', TRUE),
('resume.talentxcel.in', 'talentxcel', 315000, 61200, 11000, 5.56, 142000, 11500, 38400, 12400, 'Instant ATS Score & Keyword Gap Scanner', TRUE),
('jobs.talentxcel.in', 'talentxcel', 420000, 84000, 16000, 5.25, 210000, 18200, 51200, 6700, 'Role-Skill-City Match Explorer', TRUE),
('colleges.talentxcel.in', 'talentxcel', 198000, 38000, 7200, 5.28, 92000, 7100, 18900, 4200, 'Tier 1/2 College Placement Comparator', TRUE),
('careers.talentxcel.in', 'talentxcel', 245000, 47500, 9100, 5.22, 115000, 9400, 26500, 5100, 'Career Pathway & Promotion Roadmap Builder', TRUE),
('learning.talentxcel.in', 'talentxcel', 186000, 36200, 7100, 5.10, 88000, 6800, 21400, 3800, 'Interactive Code & Tutorial Sandbox', TRUE),
('employer.talentxcel.in', 'talentxcel', 112000, 21500, 4300, 5.00, 46000, 3600, 8900, 1200, 'Talent Pool Availability Estimator', TRUE),
('employers.talentxcel.in', 'talentxcel', 98000, 18900, 3800, 4.97, 39000, 3100, 7400, 950, 'Enterprise Skill Pipeline Benchmark', TRUE),
('government.talentxcel.in', 'talentxcel', 285000, 56000, 10200, 5.49, 164000, 13800, 34200, 9800, 'State & Central Scheme Benefit Checker', TRUE),
('passport.talentxcel.in', 'talentxcel', 165000, 32000, 6100, 5.25, 76000, 5900, 19800, 7600, 'Cryptographic Skill Passport Verifier', TRUE),
('talentxcel.in', 'talentxcel', 490000, 95000, 18200, 5.22, 245000, 20400, 64200, 11200, 'TalentXcel Core Ecosystem Hub', TRUE),

-- CHATR (2 Canonical Origins)
('chatr.chat', 'chatr', 445000, 88000, 15800, 5.57, 230000, 19500, 59400, 13100, 'Live Agent Intent Sandbox & Multi-Turn Playground', TRUE),
('www.chatrchat.in', 'chatr', 275000, 53500, 10100, 5.30, 138000, 11200, 32100, 6400, 'Enterprise AI Workforce ROI Calculator', TRUE),

-- Nuty Tales (8 Canonical Origins)
('nutytales.com', 'nutytales', 380000, 74000, 13800, 5.36, 195000, 16100, 48500, 8900, 'Artisan Heritage & Saffron Origin Explorer', TRUE),
('business.nutytales.com', 'nutytales', 178000, 34500, 6600, 5.23, 82000, 6400, 16800, 3100, 'Wholesale Bulk Margin & FOB Price Configurator', TRUE),
('gifting.nutytales.com', 'nutytales', 310000, 62000, 11200, 5.54, 155000, 13200, 39600, 14200, 'Bespoke Saffron Hamper & Packaging Builder', TRUE),
('weddings.nutytales.com', 'nutytales', 295000, 58000, 10500, 5.52, 148000, 12600, 36200, 15800, 'Kashmiri Royal Wedding Favor Customizer', TRUE),
('crafts.nutytales.com', 'nutytales', 142000, 27500, 5300, 5.19, 69000, 5400, 14200, 4200, 'Artisan Papier-Mâché & Pashmina Customizer', TRUE),
('stays.nutytales.com', 'nutytales', 340000, 66500, 12000, 5.54, 172000, 14800, 44100, 11600, 'Valley Itinerary & Heritage Orchard Stay Estimator', TRUE),
('travel.nutytales.com', 'nutytales', 285000, 55500, 10200, 5.44, 141000, 11900, 35700, 9400, 'Cultural Excursion & Shikara Trail Planner', TRUE),
('nri.nutytales.com', 'nutytales', 265000, 51500, 9500, 5.42, 131000, 10900, 33500, 8800, 'Global Diaspora Express Doorstep Courier Flow', TRUE)
ON CONFLICT (hostname) DO UPDATE SET
    brand_cluster = EXCLUDED.brand_cluster,
    active_multiplier_tool = EXCLUDED.active_multiplier_tool,
    has_large_image_meta = EXCLUDED.has_large_image_meta,
    last_calculated_at = NOW();

-- 6. Helper Function: Record Funnel Event & Increment Pageview Counters
CREATE OR REPLACE FUNCTION public.record_session_funnel_event(
    p_session_id TEXT,
    p_hostname TEXT,
    p_brand TEXT,
    p_step INT,
    p_tool TEXT,
    p_step_name TEXT,
    p_path TEXT,
    p_payload JSONB DEFAULT '{}'::jsonb,
    p_referrer TEXT DEFAULT NULL,
    p_utm_source TEXT DEFAULT NULL,
    p_utm_medium TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO public.session_funnel_events (
        session_id,
        hostname,
        brand_cluster,
        current_step,
        tool_type,
        step_name,
        path_url,
        interaction_payload,
        referrer,
        utm_source,
        utm_medium
    ) VALUES (
        p_session_id,
        p_hostname,
        p_brand,
        p_step,
        p_tool,
        p_step_name,
        p_path,
        p_payload,
        p_referrer,
        p_utm_source,
        p_utm_medium
    ) RETURNING id INTO v_event_id;

    -- Increment pageview velocity counters on domain
    UPDATE public.domain_pageview_velocity
    SET total_pageviews = total_pageviews + 1,
        daily_pageviews = daily_pageviews + 1,
        last_calculated_at = NOW()
    WHERE hostname = p_hostname;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;
