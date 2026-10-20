-- ============================================================================
-- MIGRATION: 0004_sync_exact_35_master_inventory.sql
-- Aligns Supabase with Commit 530e23d (26 Listed + 3 Excluded + 6 Proposed = 35)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS public.domains_registry CASCADE;

CREATE TABLE public.domains_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hostname TEXT UNIQUE NOT NULL,
    brand_cluster TEXT NOT NULL CHECK (brand_cluster IN ('talentxcel', 'chatr', 'nutytales')),
    inventory_tier TEXT NOT NULL CHECK (inventory_tier IN ('active_listed', 'excluded_legacy', 'proposed_unverified')),
    host_role TEXT NOT NULL, -- 'canonical_root', 'subdomain_pseo', 'www_redirect', 'regional_redirect', 'deployment_only', 'barred_origin', 'proposed_expansion'
    canonical_target TEXT,   -- Populated if host_role requires 301 redirect or canonical pointer
    url_pattern_formula TEXT,
    crawl_tier TEXT NOT NULL CHECK (crawl_tier IN ('critical', 'high', 'medium', 'noindex_staging', 'barred', 'unverified')),
    is_crawl_allowed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.domains_registry 
(hostname, brand_cluster, inventory_tier, host_role, canonical_target, url_pattern_formula, crawl_tier, is_crawl_allowed) 
VALUES
-- ============================================================================
-- TIER 1A: TALENTXCEL — 13 LISTED (.in & Deployment Hosts)
-- ============================================================================
('talentxcel.in', 'talentxcel', 'active_listed', 'canonical_root', 'https://talentxcel.in', '/hub/[category]/[region]', 'high', TRUE),
('www.talentxcel.in', 'talentxcel', 'active_listed', 'www_redirect', 'https://talentxcel.in', NULL, 'medium', FALSE),
('colleges.talentxcel.in', 'talentxcel', 'active_listed', 'subdomain_pseo', 'https://colleges.talentxcel.in', '/college/[institution]-placement-[city]', 'medium', TRUE),
('careers.talentxcel.in', 'talentxcel', 'active_listed', 'subdomain_pseo', 'https://careers.talentxcel.in', '/career-path/[role]-roadmap-[level]', 'high', TRUE),
('salary.talentxcel.in', 'talentxcel', 'active_listed', 'subdomain_pseo', 'https://salary.talentxcel.in', '/salary/[role]-in-[city]-[experience]', 'critical', TRUE),
('resume.talentxcel.in', 'talentxcel', 'active_listed', 'subdomain_pseo', 'https://resume.talentxcel.in', '/templates/[industry]-cv-format-[style]', 'high', TRUE),
('jobs.talentxcel.in', 'talentxcel', 'active_listed', 'subdomain_pseo', 'https://jobs.talentxcel.in', '/job/[role]-in-[city]-with-[skill]', 'critical', TRUE),
('employer.talentxcel.in', 'talentxcel', 'active_listed', 'subdomain_pseo', 'https://employer.talentxcel.in', '/hiring/[industry]-solutions-[region]', 'medium', TRUE),
('employers.talentxcel.in', 'talentxcel', 'active_listed', 'subdomain_pseo', 'https://employers.talentxcel.in', '/enterprise/[sector]-talent-pool', 'medium', TRUE),
('government.talentxcel.in', 'talentxcel', 'active_listed', 'subdomain_pseo', 'https://government.talentxcel.in', '/schemes/[state]-employment-portal', 'medium', TRUE),
('learning.talentxcel.in', 'talentxcel', 'active_listed', 'subdomain_pseo', 'https://learning.talentxcel.in', '/learn/[skill]-tutorial-for-[level]', 'high', TRUE),
('passport.talentxcel.in', 'talentxcel', 'active_listed', 'subdomain_pseo', 'https://passport.talentxcel.in', '/passport/[credential]-verification-[id]', 'high', TRUE),
('career-pathways-ai-builder.vercel.app', 'talentxcel', 'active_listed', 'deployment_only', 'https://careers.talentxcel.in', NULL, 'noindex_staging', FALSE),

-- ============================================================================
-- TIER 1B: CHATR — 3 LISTED HOSTS
-- ============================================================================
('chatr.chat', 'chatr', 'active_listed', 'canonical_root', 'https://chatr.chat', '/agent/[intent]-workflow-[integration]', 'critical', TRUE),
('chatrchat.in', 'chatr', 'active_listed', 'regional_redirect', 'https://www.chatrchat.in', NULL, 'medium', FALSE),
('www.chatrchat.in', 'chatr', 'active_listed', 'canonical_root', 'https://www.chatrchat.in', '/solutions/[use-case]-for-[industry]', 'critical', TRUE),

-- ============================================================================
-- TIER 1C: NUTY TALES — 10 LISTED HOSTS
-- ============================================================================
('nutytales.com', 'nutytales', 'active_listed', 'canonical_root', 'https://nutytales.com', '/store/[product]-organic-[origin]', 'high', TRUE),
('www.nutytales.com', 'nutytales', 'active_listed', 'www_redirect', 'https://nutytales.com', NULL, 'medium', FALSE),
('business.nutytales.com', 'nutytales', 'active_listed', 'subdomain_pseo', 'https://business.nutytales.com', '/bulk/[category]-wholesale-supply', 'medium', TRUE),
('gifting.nutytales.com', 'nutytales', 'active_listed', 'subdomain_pseo', 'https://gifting.nutytales.com', '/gift/[occasion]-hamper-delivery-[location]', 'high', TRUE),
('weddings.nutytales.com', 'nutytales', 'active_listed', 'subdomain_pseo', 'https://weddings.nutytales.com', '/wedding/[ceremony]-favor-packing-[culture]', 'high', TRUE),
('crafts.nutytales.com', 'nutytales', 'active_listed', 'subdomain_pseo', 'https://crafts.nutytales.com', '/craft/[artisan]-handmade-[material]', 'medium', TRUE),
('stays.nutytales.com', 'nutytales', 'active_listed', 'subdomain_pseo', 'https://stays.nutytales.com', '/stay/[property]-heritage-homestay-[region]', 'critical', TRUE),
('travel.nutytales.com', 'nutytales', 'active_listed', 'subdomain_pseo', 'https://travel.nutytales.com', '/tour/[destination]-cultural-itinerary-[duration]', 'high', TRUE),
('nri.nutytales.com', 'nutytales', 'active_listed', 'subdomain_pseo', 'https://nri.nutytales.com', '/diaspora/[country]-home-delivery-[tradition]', 'critical', TRUE),
('nutytales.vercel.app', 'nutytales', 'active_listed', 'deployment_only', 'https://nutytales.com', NULL, 'noindex_staging', FALSE),

-- ============================================================================
-- TIER 2: EXCLUDED LEGACY HOSTS — 3 HOSTS (BARRED FROM CRAWLING & INDEXING)
-- ============================================================================
('www.talentxcel.net', 'talentxcel', 'excluded_legacy', 'barred_origin', NULL, NULL, 'barred', FALSE),
('auth.talentxcel.in', 'talentxcel', 'excluded_legacy', 'barred_origin', NULL, NULL, 'barred', FALSE),
('cdn.talentxcel.in', 'talentxcel', 'excluded_legacy', 'barred_origin', NULL, NULL, 'barred', FALSE),

-- ============================================================================
-- TIER 3: PROPOSED ADDITIONS — 6 HOSTS (UNVERIFIED ROADMAP PROPOSALS)
-- ============================================================================
('talentxcel.net', 'talentxcel', 'proposed_unverified', 'proposed_expansion', 'https://talentxcel.net', '/network/[partner]-global-hub', 'unverified', FALSE),
('academy.talentxcel.net', 'talentxcel', 'proposed_unverified', 'proposed_expansion', 'https://academy.talentxcel.net', '/academy/module/[topic]-practice-[level]', 'unverified', FALSE),
('ai.talentxcel.net', 'talentxcel', 'proposed_unverified', 'proposed_expansion', 'https://ai.talentxcel.net', '/ai/tools/[utility]-generator-[use-case]', 'unverified', FALSE),
('middleeast.nutytales.com', 'nutytales', 'proposed_unverified', 'proposed_expansion', 'https://middleeast.nutytales.com', '/gcc/[product]-express-delivery-[emirate]', 'unverified', FALSE),
('europe.nutytales.com', 'nutytales', 'proposed_unverified', 'proposed_expansion', 'https://europe.nutytales.com', '/eu/[product]-customs-cleared-[country]', 'unverified', FALSE),
('america.nutytales.com', 'nutytales', 'proposed_unverified', 'proposed_expansion', 'https://america.nutytales.com', '/na/[product]-fda-approved-[state]', 'unverified', FALSE);

-- Indexes for fast filtering by tier, brand, and hostname
CREATE INDEX IF NOT EXISTS idx_domains_registry_hostname ON public.domains_registry(hostname);
CREATE INDEX IF NOT EXISTS idx_domains_registry_tier ON public.domains_registry(inventory_tier);
CREATE INDEX IF NOT EXISTS idx_domains_registry_brand ON public.domains_registry(brand_cluster);
