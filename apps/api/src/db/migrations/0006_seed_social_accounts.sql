-- ============================================================================
-- MIGRATION: 0006_seed_social_accounts.sql
-- 5-Network Social Sub-Channel Matrix Mapped to 21 Canonical Production Hosts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.social_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_cluster TEXT NOT NULL CHECK (brand_cluster IN ('talentxcel', 'chatr', 'nutytales', 'talentxcel_academy')),
    platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'facebook', 'linkedin', 'x_twitter', 'facebook_group')),
    account_handle TEXT NOT NULL,
    account_display_name TEXT,
    profile_path TEXT,
    target_canonical_domain TEXT NOT NULL,
    content_focus TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    cookie_file_path TEXT,
    login_email TEXT,
    follower_count INT DEFAULT 0,
    daily_post_limit INT DEFAULT 3,
    weekly_post_count INT DEFAULT 0,
    last_posted_at TIMESTAMPTZ,
    last_health_check_at TIMESTAMPTZ,
    health_status TEXT DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'shadowbanned', 'restricted', 'logged_out', 'unknown')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(platform, account_handle)
);

ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS target_canonical_domain TEXT;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS content_focus TEXT;

CREATE INDEX IF NOT EXISTS idx_social_accounts_brand_platform ON public.social_accounts(brand_cluster, platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_health ON public.social_accounts(health_status, active);

INSERT INTO public.social_accounts 
(brand_cluster, platform, account_handle, account_display_name, profile_path, target_canonical_domain, content_focus, is_primary, follower_count, daily_post_limit, health_status)
VALUES
-- ── 1. TALENTXCEL CHANNELS (Driving to jobs, salary, colleges, resume, learning)
('talentxcel', 'youtube', '@TalentXcelJobs', 'TalentXcel • Tech Careers & Openings', 'https://youtube.com/@TalentXcelJobs', 'jobs.talentxcel.in', 'Daily Tech Hiring Breakdowns, 60s Job Alerts', TRUE, 42500, 3, 'healthy'),
('talentxcel', 'youtube', '@TalentXcelSalaries', 'TalentXcel • Salary Intelligence', 'https://youtube.com/@TalentXcelSalaries', 'salary.talentxcel.in', 'Tech Salary Comparison Reels, Offer Negotiations', FALSE, 18900, 3, 'healthy'),
('talentxcel', 'instagram', 'talentxcel.careers', 'TalentXcel Careers & Roadmaps', 'https://instagram.com/talentxcel.careers', 'careers.talentxcel.in', 'Career Infographics, Role Blueprints, Campus Spotlights', TRUE, 64200, 3, 'healthy'),
('talentxcel', 'facebook', 'TalentXcelOfficial', 'TalentXcel Tech Career Network', 'https://facebook.com/TalentXcelOfficial', 'colleges.talentxcel.in', 'Engineering Campus Placement Reports, Fresher Guides', TRUE, 38100, 3, 'healthy'),
('talentxcel', 'linkedin', 'talentxcel-official', 'TalentXcel Official Enterprise Network', 'https://linkedin.com/company/talentxcel-official', 'employers.talentxcel.in', 'B2B Talent Market Reports, Tech Compensation Bands', TRUE, 89400, 3, 'healthy'),
('talentxcel', 'x_twitter', 'TalentXcel', 'TalentXcel Tech Alerts', 'https://x.com/TalentXcel', 'jobs.talentxcel.in', 'Hourly Dev Openings, Salary Threads, Hiring Radar', TRUE, 51200, 4, 'healthy'),
('talentxcel', 'x_twitter', 'TalentXcelRadar', 'Tech Compensation Radar', 'https://x.com/TalentXcelRadar', 'salary.talentxcel.in', 'Real Offer Breakdowns, Indian & Global Remote Equity', FALSE, 22400, 4, 'healthy'),

-- ── 2. CHATR CHANNELS (Driving to chatr.chat & www.chatrchat.in) ────────────
('chatr', 'youtube', '@ChatrVideo', 'CHATR • Interactive Video Messaging', 'https://youtube.com/@ChatrVideo', 'chatr.chat', 'Async Video vs Meeting Comparisons, Product Demos', TRUE, 31800, 3, 'healthy'),
('chatr', 'instagram', 'chatr.chat', 'CHATR Workplace Video App', 'https://instagram.com/chatr.chat', 'chatr.chat', 'Remote Work Culture, Zoom Fatigue Skits, Async Hacks', TRUE, 47900, 3, 'healthy'),
('chatr', 'facebook', 'ChatrOfficial', 'CHATR Video Collaboration', 'https://facebook.com/ChatrOfficial', 'www.chatrchat.in', 'Enterprise Case Studies, Sales Video Automation', TRUE, 22600, 3, 'healthy'),
('chatr', 'linkedin', 'chatr-technologies', 'CHATR Enterprise Video', 'https://linkedin.com/company/chatr-technologies', 'chatr.chat', 'Founder Video Briefings, Enterprise Hiring Velocity', TRUE, 41200, 3, 'healthy'),
('chatr', 'x_twitter', 'ChatrApp', 'CHATR Async Video', 'https://x.com/ChatrApp', 'chatr.chat', 'Product Updates, Work-From-Anywhere Micro Threads', TRUE, 29800, 4, 'healthy'),

-- ── 3. NUTY TALES CHANNELS (Driving to nutytales, gifting, weddings, crafts, stays, travel, nri)
('nutytales', 'youtube', '@NutyTalesValley', 'Nuty Tales • Valley Harvest & Heritage', 'https://youtube.com/@NutyTalesValley', 'nutytales.com', 'Himalayan Orchard Harvesting, Raw Nut Cracking ASMR', TRUE, 58400, 3, 'healthy'),
('nutytales', 'instagram', 'nutytales', 'Nuty Tales Pure Himalayan Goods', 'https://instagram.com/nutytales', 'nutytales.com', 'Aesthetic Kashmiri Heritage, Kesar & Walnut Recipes', TRUE, 92100, 3, 'healthy'),
('nutytales', 'instagram', 'nutytales.gifting', 'Nuty Tales Luxury Hampers', 'https://instagram.com/nutytales.gifting', 'gifting.nutytales.com', 'Diwali & Wedding Curation Previews, Velvet Boxes', FALSE, 34500, 3, 'healthy'),
('nutytales', 'facebook', 'NutyTalesGourmet', 'Nuty Tales Gourmet Himalayan Foods', 'https://facebook.com/NutyTalesGourmet', 'business.nutytales.com', 'B2B Wholesale Snacking, Festive Corporate Gifting', TRUE, 44100, 3, 'healthy'),
('nutytales', 'linkedin', 'nutytales-organics', 'Nuty Tales B2B & Agri-Supply', 'https://linkedin.com/company/nutytales-organics', 'business.nutytales.com', 'FMCG Bulk Kernel Supply, Corporate Executive Gifting', TRUE, 18700, 3, 'healthy'),
('nutytales', 'x_twitter', 'NutyTales', 'Nuty Tales Organic Valley', 'https://x.com/NutyTales', 'nri.nutytales.com', 'Harvest Updates, International Shipping Announcements', TRUE, 26300, 4, 'healthy'),
('nutytales', 'youtube', '@NutyTalesStays', 'Kashmir Orchard Stays & Trails', 'https://youtube.com/@NutyTalesStays', 'stays.nutytales.com', 'Pahalgam Stone Cottage Walkthroughs, Alpine Treks', FALSE, 21900, 3, 'healthy')
ON CONFLICT (platform, account_handle) DO UPDATE SET 
    target_canonical_domain = EXCLUDED.target_canonical_domain,
    content_focus = EXCLUDED.content_focus,
    follower_count = EXCLUDED.follower_count;
