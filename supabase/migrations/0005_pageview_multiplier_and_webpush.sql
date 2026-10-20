-- ============================================================================
-- PRODUCTION SYNC: 0005_pageview_multiplier_and_webpush.sql
-- Provisions Web Push, Discover Pulse, Funnel Beacons & 21-Domain Velocity
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Native W3C Web Push Subscriptions (RFC 8292 VAPID)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hostname TEXT NOT NULL REFERENCES public.domains_registry(hostname) ON DELETE CASCADE,
    brand_cluster TEXT NOT NULL CHECK (brand_cluster IN ('talentxcel', 'chatr', 'nutytales')),
    endpoint TEXT UNIQUE NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    interest_slug TEXT DEFAULT 'general',
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_notified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Google Discover Breakout Pulse Reports
CREATE TABLE IF NOT EXISTS public.discover_pulse_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hostname TEXT NOT NULL REFERENCES public.domains_registry(hostname) ON DELETE CASCADE,
    brand_cluster TEXT NOT NULL,
    slug TEXT NOT NULL,
    headline TEXT NOT NULL,
    og_image_1200x675_url TEXT NOT NULL,
    cross_linked_leaves JSONB NOT NULL DEFAULT '[]'::jsonb,
    websub_ping_status INT DEFAULT 204,
    discover_impressions BIGINT DEFAULT 0,
    discover_clicks BIGINT DEFAULT 0,
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(hostname, slug)
);

-- 3. Session Depth Multiplier Funnel Events (Steps 1..6)
CREATE TABLE IF NOT EXISTS public.session_funnel_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT NOT NULL,
    hostname TEXT NOT NULL,
    tool_type TEXT NOT NULL, -- 'ctc_calculator', 'ats_scanner', 'chatr_sandbox', 'hamper_configurator'
    step_number INT NOT NULL CHECK (step_number BETWEEN 1 AND 10),
    source_channel TEXT DEFAULT 'organic',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Real-Time 21-Canonical Domain Pageview Velocity
CREATE TABLE IF NOT EXISTS public.domain_pageview_velocity (
    hostname TEXT PRIMARY KEY REFERENCES public.domains_registry(hostname) ON DELETE CASCADE,
    brand_cluster TEXT NOT NULL,
    daily_sessions BIGINT DEFAULT 0,
    daily_pageviews BIGINT DEFAULT 0,
    avg_session_depth NUMERIC(4,2) DEFAULT 1.00,
    discover_impressions BIGINT DEFAULT 0,
    active_push_subscribers BIGINT DEFAULT 0,
    max_image_preview_large BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed the exact 21 Active Canonical Production Domains (Excluding redirects, .vercel.app staging, and barred legacy hosts)
INSERT INTO public.domain_pageview_velocity 
(hostname, brand_cluster, daily_sessions, daily_pageviews, avg_session_depth, discover_impressions, active_push_subscribers, max_image_preview_large)
SELECT 
    hostname, 
    brand_cluster, 
    0, 0, 1.00, 0, 0, TRUE
FROM public.domains_registry
WHERE inventory_tier = 'active_listed'
  AND host_role IN ('canonical_root', 'subdomain_pseo')
  AND is_crawl_allowed = TRUE
ON CONFLICT (hostname) DO NOTHING;

-- 5. Zero-Overhead RPC Beacon Function for Step Multipliers
CREATE OR REPLACE FUNCTION public.record_session_funnel_event(
    p_session_id TEXT,
    p_hostname TEXT,
    p_tool_type TEXT,
    p_step_number INT,
    p_source_channel TEXT DEFAULT 'organic'
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.session_funnel_events (session_id, hostname, tool_type, step_number, source_channel)
    VALUES (p_session_id, p_hostname, p_tool_type, p_step_number, p_source_channel);

    UPDATE public.domain_pageview_velocity
    SET 
        daily_pageviews = daily_pageviews + 1,
        daily_sessions = CASE WHEN p_step_number = 1 THEN daily_sessions + 1 ELSE daily_sessions END,
        avg_session_depth = LEAST(6.50, ROUND((daily_pageviews + 1)::numeric / GREATEST(1, CASE WHEN p_step_number = 1 THEN daily_sessions + 1 ELSE daily_sessions END), 2)),
        updated_at = NOW()
    WHERE hostname = p_hostname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
