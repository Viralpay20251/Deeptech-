-- ============================================================================
-- PRODUCTION SYNC: 0005_pageview_multiplier_and_webpush.sql (Migration 0008)
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
    active_multiplier_tool TEXT DEFAULT 'Interactive Multiplier Tool',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed the exact 21 Active Canonical Production Domains (Excluding redirects, .vercel.app staging, and barred legacy hosts)
INSERT INTO public.domain_pageview_velocity 
(hostname, brand_cluster, daily_sessions, daily_pageviews, avg_session_depth, discover_impressions, active_push_subscribers, max_image_preview_large, active_multiplier_tool)
SELECT 
    hostname, 
    brand_cluster, 
    0, 0, 1.00, 0, 0, TRUE,
    CASE 
      WHEN hostname LIKE '%salary%' THEN 'In-Hand CTC & Tax Regime Comparator'
      WHEN hostname LIKE '%resume%' THEN 'Instant ATS Score & Keyword Gap Scanner'
      WHEN hostname LIKE '%jobs%' THEN 'Role-Skill-City Match Explorer'
      WHEN hostname LIKE '%college%' THEN 'Tier 1/2 College Placement Comparator'
      WHEN hostname LIKE '%career%' THEN 'Career Pathway & Promotion Roadmap Builder'
      WHEN hostname LIKE '%learn%' THEN 'Interactive Code & Tutorial Sandbox'
      WHEN hostname LIKE '%employer%' THEN 'Talent Pool Availability Estimator'
      WHEN hostname LIKE '%government%' THEN 'State & Central Scheme Benefit Checker'
      WHEN hostname LIKE '%passport%' THEN 'Cryptographic Skill Passport Verifier'
      WHEN hostname LIKE '%chatr.chat%' THEN 'Live Agent Intent Sandbox & Playground'
      WHEN hostname LIKE '%chatrchat%' THEN 'Enterprise AI Workforce ROI Calculator'
      WHEN hostname LIKE '%gifting%' THEN 'Bespoke Saffron Hamper & Packaging Builder'
      WHEN hostname LIKE '%wedding%' THEN 'Kashmiri Royal Wedding Favor Customizer'
      WHEN hostname LIKE '%craft%' THEN 'Artisan Papier-Mâché Customizer'
      WHEN hostname LIKE '%stay%' THEN 'Valley Itinerary & Heritage Orchard Stay Estimator'
      WHEN hostname LIKE '%travel%' THEN 'Cultural Excursion & Shikara Trail Planner'
      WHEN hostname LIKE '%nri%' THEN 'Global Diaspora Express Doorstep Courier Flow'
      WHEN hostname LIKE '%business%' THEN 'Wholesale Bulk Margin & FOB Price Configurator'
      ELSE 'Ecosystem Canonical Gateway'
    END
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

-- 6. Supabase Realtime Publication (Enables live streaming to dashboard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'domain_pageview_velocity'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.domain_pageview_velocity;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'discover_pulse_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.discover_pulse_reports;
  END IF;
END $$;

-- 7. Row Level Security (RLS) & Client Access Policies
ALTER TABLE public.domain_pageview_velocity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discover_pulse_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_funnel_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on domain_pageview_velocity" ON public.domain_pageview_velocity;
CREATE POLICY "Allow public read on domain_pageview_velocity"
ON public.domain_pageview_velocity FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow public read on discover_pulse_reports" ON public.discover_pulse_reports;
CREATE POLICY "Allow public read on discover_pulse_reports"
ON public.discover_pulse_reports FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Allow public insert on session_funnel_events" ON public.session_funnel_events;
CREATE POLICY "Allow public insert on session_funnel_events"
ON public.session_funnel_events FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public insert on push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Allow public insert on push_subscriptions"
ON public.push_subscriptions FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on velocity" ON public.domain_pageview_velocity;
CREATE POLICY "Service role full access on velocity"
ON public.domain_pageview_velocity FOR ALL
TO service_role
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on push_subs" ON public.push_subscriptions;
CREATE POLICY "Service role full access on push_subs"
ON public.push_subscriptions FOR ALL
TO service_role
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on pulse_reports" ON public.discover_pulse_reports;
CREATE POLICY "Service role full access on pulse_reports"
ON public.discover_pulse_reports FOR ALL
TO service_role
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on funnel_events" ON public.session_funnel_events;
CREATE POLICY "Service role full access on funnel_events"
ON public.session_funnel_events FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- 8. High-Throughput Performance Composite Indexes
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON public.push_subscriptions (brand_cluster, is_active);
CREATE INDEX IF NOT EXISTS idx_push_subs_hostname ON public.push_subscriptions (hostname, is_active);
CREATE INDEX IF NOT EXISTS idx_discover_pulse_pub ON public.discover_pulse_reports (hostname, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_lookup ON public.session_funnel_events (hostname, tool_type, step_number);
CREATE INDEX IF NOT EXISTS idx_funnel_events_session ON public.session_funnel_events (session_id);

-- 9. Daily Velocity Rollover Maintenance RPC
CREATE OR REPLACE FUNCTION public.reset_daily_domain_velocity()
RETURNS VOID AS $$
BEGIN
    UPDATE public.domain_pageview_velocity
    SET daily_sessions = 0,
        daily_pageviews = 0,
        avg_session_depth = 1.00,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.reset_daily_domain_velocity() TO authenticated, service_role;

