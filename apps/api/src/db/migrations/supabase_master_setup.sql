-- ============================================================================
-- AUTONOMOUS GROWTH OS & OMNIPULSE ENGINE: MASTER SUPABASE SQL SETUP
-- ============================================================================
-- One-click consolidated script for the Supabase SQL Editor.
-- Sets up:
--   1. public.domains_registry (Exact 35-Hostname Master Governance Matrix)
--   2. public.pseo_dimension_catalog (Combinatorial Programmatic SEO Seeds)
--   3. public.social_accounts (5-Network Social Media Sub-Channel Matrix)
--   4. public.backlinks_registry, internal_link_mesh & targets_catalog (52 High-DA Backlinks)
--   5. Verification Summary Query
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- PART 1: DOMAINS REGISTRY (35 HOSTNAMES: 26 LISTED + 3 EXCLUDED + 6 PROPOSED)
-- ============================================================================

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
-- ── Tier 1A: TalentXcel (13 Listed Hosts) ───────────────────────────────────
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

-- ── Tier 1B: CHATR (3 Listed Hosts) ─────────────────────────────────────────
('chatr.chat', 'chatr', 'active_listed', 'canonical_root', 'https://chatr.chat', '/agent/[intent]-workflow-[integration]', 'critical', TRUE),
('chatrchat.in', 'chatr', 'active_listed', 'regional_redirect', 'https://www.chatrchat.in', NULL, 'medium', FALSE),
('www.chatrchat.in', 'chatr', 'active_listed', 'canonical_root', 'https://www.chatrchat.in', '/solutions/[use-case]-for-[industry]', 'critical', TRUE),

-- ── Tier 1C: Nuty Tales (10 Listed Hosts) ───────────────────────────────────
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

-- ── Tier 2: Excluded Legacy Hosts (3 Barred Origins) ────────────────────────
('www.talentxcel.net', 'talentxcel', 'excluded_legacy', 'barred_origin', NULL, NULL, 'barred', FALSE),
('auth.talentxcel.in', 'talentxcel', 'excluded_legacy', 'barred_origin', NULL, NULL, 'barred', FALSE),
('cdn.talentxcel.in', 'talentxcel', 'excluded_legacy', 'barred_origin', NULL, NULL, 'barred', FALSE),

-- ── Tier 3: Proposed Additions (6 Unverified Proposals) ─────────────────────
('talentxcel.net', 'talentxcel', 'proposed_unverified', 'proposed_expansion', 'https://talentxcel.net', '/network/[partner]-global-hub', 'unverified', FALSE),
('academy.talentxcel.net', 'talentxcel', 'proposed_unverified', 'proposed_expansion', 'https://academy.talentxcel.net', '/academy/module/[topic]-practice-[level]', 'unverified', FALSE),
('ai.talentxcel.net', 'talentxcel', 'proposed_unverified', 'proposed_expansion', 'https://ai.talentxcel.net', '/ai/tools/[utility]-generator-[use-case]', 'unverified', FALSE),
('middleeast.nutytales.com', 'nutytales', 'proposed_unverified', 'proposed_expansion', 'https://middleeast.nutytales.com', '/gcc/[product]-express-delivery-[emirate]', 'unverified', FALSE),
('europe.nutytales.com', 'nutytales', 'proposed_unverified', 'proposed_expansion', 'https://europe.nutytales.com', '/eu/[product]-customs-cleared-[country]', 'unverified', FALSE),
('america.nutytales.com', 'nutytales', 'proposed_unverified', 'proposed_expansion', 'https://america.nutytales.com', '/na/[product]-fda-approved-[state]', 'unverified', FALSE);

CREATE INDEX IF NOT EXISTS idx_domains_registry_hostname ON public.domains_registry(hostname);
CREATE INDEX IF NOT EXISTS idx_domains_registry_tier ON public.domains_registry(inventory_tier);
CREATE INDEX IF NOT EXISTS idx_domains_registry_brand ON public.domains_registry(brand_cluster);


-- ============================================================================
-- PART 2: PROGRAMMATIC SEO DIMENSION CATALOG (21 CANONICAL PRODUCTION HOSTS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pseo_dimension_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hostname TEXT NOT NULL,
    dimension_type TEXT NOT NULL,
    slug TEXT NOT NULL,
    display_value TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    search_volume_estimate INT DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (hostname, dimension_type, slug)
);

CREATE INDEX IF NOT EXISTS idx_pseo_dimension_hostname ON public.pseo_dimension_catalog(hostname);
CREATE INDEX IF NOT EXISTS idx_pseo_dimension_type ON public.pseo_dimension_catalog(hostname, dimension_type);

-- ── 1. talentxcel.in ────────────────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('talentxcel.in', 'category', 'software-engineering', 'Software Engineering', '{"cluster": "tech"}'::jsonb, 45000),
('talentxcel.in', 'category', 'data-science-ai', 'Data Science & AI', '{"cluster": "ai"}'::jsonb, 38000),
('talentxcel.in', 'category', 'cloud-devops', 'Cloud & DevOps Architecture', '{"cluster": "infrastructure"}'::jsonb, 29000),
('talentxcel.in', 'category', 'product-management', 'Product & Tech Strategy', '{"cluster": "business"}'::jsonb, 22000),
('talentxcel.in', 'region', 'bangalore', 'Bangalore Tech Corridor', '{"state": "Karnataka"}'::jsonb, 55000),
('talentxcel.in', 'region', 'hyderabad', 'Hyderabad HITEC City', '{"state": "Telangana"}'::jsonb, 42000),
('talentxcel.in', 'region', 'pune', 'Pune Tech Valley', '{"state": "Maharashtra"}'::jsonb, 35000),
('talentxcel.in', 'region', 'delhi-ncr', 'Delhi NCR Innovation Hub', '{"state": "Delhi"}'::jsonb, 48000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 2. jobs.talentxcel.in ───────────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('jobs.talentxcel.in', 'role', 'full-stack-engineer', 'Full Stack Engineer', '{"salary_min": 1200000, "salary_max": 2800000}'::jsonb, 62000),
('jobs.talentxcel.in', 'role', 'ai-agent-architect', 'AI Agent Architect', '{"salary_min": 2400000, "salary_max": 5500000}'::jsonb, 48000),
('jobs.talentxcel.in', 'role', 'mlops-platform-engineer', 'MLOps Platform Engineer', '{"salary_min": 1800000, "salary_max": 4200000}'::jsonb, 36000),
('jobs.talentxcel.in', 'role', 'data-platform-engineer', 'Data Platform Engineer', '{"salary_min": 1500000, "salary_max": 3500000}'::jsonb, 31000),
('jobs.talentxcel.in', 'role', 'cloud-security-lead', 'Cloud Security Lead', '{"salary_min": 2200000, "salary_max": 4800000}'::jsonb, 27000),
('jobs.talentxcel.in', 'city', 'bangalore', 'Bangalore', '{"tier": 1, "hiring_index": 98}'::jsonb, 85000),
('jobs.talentxcel.in', 'city', 'hyderabad', 'Hyderabad', '{"tier": 1, "hiring_index": 92}'::jsonb, 68000),
('jobs.talentxcel.in', 'city', 'pune', 'Pune', '{"tier": 1, "hiring_index": 84}'::jsonb, 54000),
('jobs.talentxcel.in', 'city', 'gurugram', 'Gurugram', '{"tier": 1, "hiring_index": 88}'::jsonb, 59000),
('jobs.talentxcel.in', 'city', 'remote-india', 'Remote (India)', '{"tier": 1, "hiring_index": 95}'::jsonb, 92000),
('jobs.talentxcel.in', 'skill', 'langchain-rag', 'LangChain & RAG Systems', '{"demand": "critical"}'::jsonb, 42000),
('jobs.talentxcel.in', 'skill', 'kubernetes-cilium', 'Kubernetes & Cilium', '{"demand": "high"}'::jsonb, 33000),
('jobs.talentxcel.in', 'skill', 'nextjs-typescript', 'Next.js & TypeScript', '{"demand": "high"}'::jsonb, 51000),
('jobs.talentxcel.in', 'skill', 'python-fastapi', 'Python & FastAPI', '{"demand": "high"}'::jsonb, 47000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 3. salary.talentxcel.in ─────────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('salary.talentxcel.in', 'role', 'software-engineer', 'Software Engineer', '{"base_lpa": 14}'::jsonb, 75000),
('salary.talentxcel.in', 'role', 'ai-research-scientist', 'AI Research Scientist', '{"base_lpa": 36}'::jsonb, 52000),
('salary.talentxcel.in', 'role', 'devops-architect', 'DevOps Architect', '{"base_lpa": 28}'::jsonb, 41000),
('salary.talentxcel.in', 'city', 'bangalore', 'Bangalore', '{"cost_index": 1.25}'::jsonb, 89000),
('salary.talentxcel.in', 'city', 'hyderabad', 'Hyderabad', '{"cost_index": 1.10}'::jsonb, 62000),
('salary.talentxcel.in', 'city', 'mumbai', 'Mumbai', '{"cost_index": 1.35}'::jsonb, 71000),
('salary.talentxcel.in', 'experience', 'entry-level', '0-2 Years (Entry)', '{"multiplier": 0.7}'::jsonb, 45000),
('salary.talentxcel.in', 'experience', 'mid-senior', '3-5 Years (Mid-Senior)', '{"multiplier": 1.2}'::jsonb, 58000),
('salary.talentxcel.in', 'experience', 'lead-principal', '6-10 Years (Lead/Principal)', '{"multiplier": 1.8}'::jsonb, 39000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 4. colleges.talentxcel.in ───────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('colleges.talentxcel.in', 'institution', 'iit-bombay', 'IIT Bombay', '{"median_package_lpa": 22}'::jsonb, 65000),
('colleges.talentxcel.in', 'institution', 'iit-delhi', 'IIT Delhi', '{"median_package_lpa": 21}'::jsonb, 61000),
('colleges.talentxcel.in', 'institution', 'iiit-hyderabad', 'IIIT Hyderabad', '{"median_package_lpa": 24}'::jsonb, 54000),
('colleges.talentxcel.in', 'institution', 'bits-pilani', 'BITS Pilani', '{"median_package_lpa": 19}'::jsonb, 49000),
('colleges.talentxcel.in', 'city', 'mumbai', 'Mumbai', '{"placement_tier": 1}'::jsonb, 52000),
('colleges.talentxcel.in', 'city', 'delhi', 'Delhi', '{"placement_tier": 1}'::jsonb, 48000),
('colleges.talentxcel.in', 'city', 'hyderabad', 'Hyderabad', '{"placement_tier": 1}'::jsonb, 44000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 5. careers.talentxcel.in ────────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('careers.talentxcel.in', 'role', 'agentic-ai-engineer', 'Agentic AI Engineer', '{"horizon": "2026-2030"}'::jsonb, 38000),
('careers.talentxcel.in', 'role', 'distributed-systems-lead', 'Distributed Systems Lead', '{"horizon": "long-term"}'::jsonb, 29000),
('careers.talentxcel.in', 'level', 'beginner-to-production', 'Beginner to Production', '{"milestones": 6}'::jsonb, 41000),
('careers.talentxcel.in', 'level', 'senior-to-staff', 'Senior to Staff Architect', '{"milestones": 8}'::jsonb, 28000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 6. resume.talentxcel.in ─────────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('resume.talentxcel.in', 'industry', 'fintech-crypto', 'Fintech & High-Frequency Trading', '{"ats_score": 96}'::jsonb, 32000),
('resume.talentxcel.in', 'industry', 'healthcare-ai', 'HealthTech & BioAI', '{"ats_score": 94}'::jsonb, 26000),
('resume.talentxcel.in', 'style', 'faang-minimalist', 'FAANG Minimalist Standard', '{"format": "1-page"}'::jsonb, 47000),
('resume.talentxcel.in', 'style', 'executive-technical', 'Executive Technical Leadership', '{"format": "2-page"}'::jsonb, 22000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 7. learning.talentxcel.in ───────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('learning.talentxcel.in', 'skill', 'ollama-local-llm-orchestration', 'Ollama Local LLM Orchestration', '{"duration_hours": 12}'::jsonb, 28000),
('learning.talentxcel.in', 'skill', 'hono-edge-ssr-routing', 'Hono Edge SSR & Cloudflare Routing', '{"duration_hours": 8}'::jsonb, 21000),
('learning.talentxcel.in', 'level', 'engineers', 'Senior Engineers', '{"hands_on": true}'::jsonb, 34000),
('learning.talentxcel.in', 'level', 'architects', 'System Architects', '{"hands_on": true}'::jsonb, 27000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 8. employer.talentxcel.in ───────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('employer.talentxcel.in', 'industry', 'deep-tech-robotics', 'DeepTech & Hardware AI', '{"pipeline": "specialist"}'::jsonb, 19000),
('employer.talentxcel.in', 'industry', 'saas-cloud-platforms', 'Enterprise SaaS Platforms', '{"pipeline": "high-volume"}'::jsonb, 31000),
('employer.talentxcel.in', 'region', 'india-gcc', 'India & GCC Tech Corridors', '{"talent_pool": 85000}'::jsonb, 26000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 9. employers.talentxcel.in ──────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('employers.talentxcel.in', 'sector', 'banking-fintech-infrastructure', 'Banking & Core Fintech Infrastructure', '{"vetted_count": 12400}'::jsonb, 23000),
('employers.talentxcel.in', 'sector', 'autonomous-mobility-ev', 'Autonomous Mobility & EV Systems', '{"vetted_count": 8600}'::jsonb, 17000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 10. government.talentxcel.in ────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('government.talentxcel.in', 'state', 'karnataka', 'Karnataka State Tech & Skill Mission', '{"portal_id": "KA-TECH"}'::jsonb, 34000),
('government.talentxcel.in', 'state', 'telangana', 'Telangana Digital Employment Authority', '{"portal_id": "TS-DIGI"}'::jsonb, 29000),
('government.talentxcel.in', 'state', 'maharashtra', 'Maharashtra State Innovation & Startup Portal', '{"portal_id": "MH-INNO"}'::jsonb, 31000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 11. passport.talentxcel.in ──────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('passport.talentxcel.in', 'credential', 'verified-staff-ai-architect', 'Verified Staff AI Architect', '{"ledger": "cryptographic"}'::jsonb, 18000),
('passport.talentxcel.in', 'credential', 'certified-systems-performance-engineer', 'Certified Systems Performance Engineer', '{"ledger": "cryptographic"}'::jsonb, 14000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 12. chatr.chat ──────────────────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('chatr.chat', 'intent', 'async-video-hiring-pipeline', 'Async Video Hiring & Candidate Screening', '{"automation_rate": "84%"}'::jsonb, 39000),
('chatr.chat', 'intent', 'interactive-customer-support', 'Interactive Customer Video Support', '{"automation_rate": "78%"}'::jsonb, 46000),
('chatr.chat', 'intent', 'founder-investor-pitch-decks', 'Interactive Founder Investor Updates', '{"automation_rate": "92%"}'::jsonb, 28000),
('chatr.chat', 'integration', 'slack-enterprise', 'Slack Enterprise Grid', '{"oauth": true}'::jsonb, 31000),
('chatr.chat', 'integration', 'notion-workspace', 'Notion Team Workspace', '{"oauth": true}'::jsonb, 27000),
('chatr.chat', 'integration', 'hubspot-crm', 'HubSpot Sales CRM', '{"oauth": true}'::jsonb, 33000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 13. www.chatrchat.in ────────────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('www.chatrchat.in', 'usecase', 'video-lead-capture', 'One-Click Interactive Video Lead Capture', '{"roi": "3.8x"}'::jsonb, 22000),
('www.chatrchat.in', 'usecase', 'executive-briefing', 'Asynchronous Executive Daily Standup Briefing', '{"roi": "4.2x"}'::jsonb, 19000),
('www.chatrchat.in', 'industry', 'venture-capital-funds', 'Venture Capital & Accelerator Funds', '{"sector": "finance"}'::jsonb, 16000),
('www.chatrchat.in', 'industry', 'b2b-enterprise-sales', 'B2B Enterprise Software Sales', '{"sector": "saas"}'::jsonb, 24000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 14. nutytales.com ───────────────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('nutytales.com', 'product', 'kashmiri-snow-walnut', 'Kashmiri Snow Walnut (Giri)', '{"grade": "Grade A+ Extra Light", "organic": true}'::jsonb, 54000),
('nutytales.com', 'product', 'mongra-saffron-kesar', 'Pure Kashmiri Mongra Saffron (Kesar)', '{"grade": "GI-Tagged AAA", "organic": true}'::jsonb, 68000),
('nutytales.com', 'product', 'mamra-almonds', 'Raw Organic Mamra Almonds', '{"grade": "High Oil Content", "organic": true}'::jsonb, 49000),
('nutytales.com', 'origin', 'kashmir-pampore', 'Pampore Valley, Kashmir', '{"elevation_ft": 5300}'::jsonb, 38000),
('nutytales.com', 'origin', 'ladakh-himalayas', 'Ladakh Himalayan Belt', '{"elevation_ft": 9800}'::jsonb, 29000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 15. business.nutytales.com ──────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('business.nutytales.com', 'category', 'raw-walnut-kernels-fmcg', 'Raw Walnut Kernels for FMCG & Bakery', '{"moq_kg": 100}'::jsonb, 24000),
('business.nutytales.com', 'category', 'gourmet-dry-fruit-blends', 'Gourmet Roasted & Salted Hotel Blends', '{"moq_kg": 50}'::jsonb, 28000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 16. gifting.nutytales.com ───────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('gifting.nutytales.com', 'occasion', 'diwali-luxury-curation', 'Diwali Royal Kashmiri Gift Curation', '{"box_style": "Handmade Wooden Inlay"}'::jsonb, 59000),
('gifting.nutytales.com', 'occasion', 'corporate-leadership-summit', 'Corporate Executive Leadership Hamper', '{"box_style": "Matte Velvet Leatherette"}'::jsonb, 41000),
('gifting.nutytales.com', 'occasion', 'eid-mubarak-deluxe', 'Eid Mubarak Deluxe Valley Collection', '{"box_style": "Traditional Lacquer Work"}'::jsonb, 38000),
('gifting.nutytales.com', 'location', 'delhi-ncr-same-day', 'Delhi NCR (Same Day Dispatch)', '{"express": true}'::jsonb, 47000),
('gifting.nutytales.com', 'location', 'mumbai-express', 'Mumbai Financial District', '{"express": true}'::jsonb, 43000),
('gifting.nutytales.com', 'location', 'bangalore-whitefield', 'Bangalore Tech Corridor', '{"express": true}'::jsonb, 39000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 17. weddings.nutytales.com ──────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('weddings.nutytales.com', 'ceremony', 'mehendi-sangeet-giveaways', 'Mehendi & Sangeet Traditional Giveaways', '{"custom_cards": true}'::jsonb, 31000),
('weddings.nutytales.com', 'ceremony', 'royal-varmala-welcome-box', 'Royal Varmala Welcome Dry Fruit Box', '{"custom_cards": true}'::jsonb, 27000),
('weddings.nutytales.com', 'culture', 'punjabi-royal-celebrations', 'Punjabi Royal Traditions', '{"motif": "Phulkari Inlay"}'::jsonb, 28000),
('weddings.nutytales.com', 'culture', 'south-indian-temple-heritage', 'South Indian Temple Heritage Style', '{"motif": "Brass Urli Inlay"}'::jsonb, 24000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 18. crafts.nutytales.com ────────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('crafts.nutytales.com', 'artisan', 'master-ustad-woodcarvers', 'Master Ustad Valley Woodcarvers Guild', '{"gi_certified": true}'::jsonb, 21000),
('crafts.nutytales.com', 'artisan', 'heritage-pashmina-weavers', 'Heritage Pashmina Handloom Guild', '{"gi_certified": true}'::jsonb, 34000),
('crafts.nutytales.com', 'material', 'aged-walnut-root-wood', 'Century-Aged Walnut Root Wood', '{"finish": "Hand-Waxed Natural"}'::jsonb, 23000),
('crafts.nutytales.com', 'material', 'pure-changthangi-cashmere', 'Pure Changthangi Pashmina Cashmere', '{"finish": "Hand-Spun 100-Count"}'::jsonb, 31000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 19. stays.nutytales.com ─────────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('stays.nutytales.com', 'property', 'apple-blossom-stone-cottage', 'Apple Blossom 1920s Stone Cottage', '{"amenities": ["Organic Orchard", "Fireplace", "Local Kashmiri Chef"]}'::jsonb, 37000),
('stays.nutytales.com', 'property', 'chinar-heritage-riverfront-house', 'Chinar Heritage Riverfront House', '{"amenities": ["Lidder River View", "Walnut Library", "Trek Guide"]}'::jsonb, 31000),
('stays.nutytales.com', 'region', 'pahalgam-valley', 'Pahalgam Valley', '{"altitude_m": 2740}'::jsonb, 46000),
('stays.nutytales.com', 'region', 'gulmarg-meadows', 'Gulmarg High Meadows', '{"altitude_m": 2650}'::jsonb, 51000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 20. travel.nutytales.com ────────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('travel.nutytales.com', 'destination', 'sonamarg-thajiwas-glacier', 'Sonamarg & Thajiwas Glacier Exploration', '{"experience": "Alpine High Altitude"}'::jsonb, 42000),
('travel.nutytales.com', 'destination', 'doodhpathri-valley-of-milk', 'Doodhpathri Untouched Meadows & Stream Walks', '{"experience": "Eco-Retreat Walk"}'::jsonb, 36000),
('travel.nutytales.com', 'duration', '4-days-3-nights-slow-travel', '4 Days 3 Nights Slow Living Experience', '{"pace": "relaxed"}'::jsonb, 38000),
('travel.nutytales.com', 'duration', '7-days-6-nights-artisan-trail', '7 Days 6 Nights Master Artisan & Valley Circuit', '{"pace": "immersive"}'::jsonb, 29000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 21. nri.nutytales.com ───────────────────────────────────────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('nri.nutytales.com', 'country', 'united-states', 'United States (FDA Compliant Express)', '{"delivery_days": 4, "dhl_express": true}'::jsonb, 58000),
('nri.nutytales.com', 'country', 'united-kingdom', 'United Kingdom (Customs Cleared)', '{"delivery_days": 3, "dhl_express": true}'::jsonb, 49000),
('nri.nutytales.com', 'country', 'united-arab-emirates', 'UAE & Dubai (Next-Day Air)', '{"delivery_days": 2, "dhl_express": true}'::jsonb, 62000),
('nri.nutytales.com', 'country', 'canada', 'Canada (Toronto & Vancouver Direct)', '{"delivery_days": 4, "dhl_express": true}'::jsonb, 44000),
('nri.nutytales.com', 'tradition', 'festive-pooja-kesar-box', 'Traditional Pooja GI Saffron & Dry Fruits', '{"heritage_pack": true}'::jsonb, 41000),
('nri.nutytales.com', 'tradition', 'diaspora-family-harvest-hamper', 'Annual Orchard Harvest Family Curation', '{"heritage_pack": true}'::jsonb, 51000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;


-- ============================================================================
-- PART 3: 5-NETWORK SOCIAL SUB-CHANNEL MATRIX (MAPPED TO CANONICAL HOSTS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.social_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_cluster TEXT NOT NULL CHECK (brand_cluster IN ('talentxcel', 'chatr', 'nutytales', 'talentxcel_academy')),
    platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'facebook', 'linkedin', 'x_twitter', 'facebook_group')),
    account_handle TEXT NOT NULL,
    account_display_name TEXT,
    profile_path TEXT,
    target_canonical_domain TEXT,
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
-- ── 1. TALENTXCEL CHANNELS ──────────────────────────────────────────────────
('talentxcel', 'youtube', '@TalentXcelJobs', 'TalentXcel • Tech Careers & Openings', 'https://youtube.com/@TalentXcelJobs', 'jobs.talentxcel.in', 'Daily Tech Hiring Breakdowns, 60s Job Alerts', TRUE, 42500, 3, 'healthy'),
('talentxcel', 'youtube', '@TalentXcelSalaries', 'TalentXcel • Salary Intelligence', 'https://youtube.com/@TalentXcelSalaries', 'salary.talentxcel.in', 'Tech Salary Comparison Reels, Offer Negotiations', FALSE, 18900, 3, 'healthy'),
('talentxcel', 'instagram', 'talentxcel.careers', 'TalentXcel Careers & Roadmaps', 'https://instagram.com/talentxcel.careers', 'careers.talentxcel.in', 'Career Infographics, Role Blueprints, Campus Spotlights', TRUE, 64200, 3, 'healthy'),
('talentxcel', 'facebook', 'TalentXcelOfficial', 'TalentXcel Tech Career Network', 'https://facebook.com/TalentXcelOfficial', 'colleges.talentxcel.in', 'Engineering Campus Placement Reports, Fresher Guides', TRUE, 38100, 3, 'healthy'),
('talentxcel', 'linkedin', 'talentxcel-official', 'TalentXcel Official Enterprise Network', 'https://linkedin.com/company/talentxcel-official', 'employers.talentxcel.in', 'B2B Talent Market Reports, Tech Compensation Bands', TRUE, 89400, 3, 'healthy'),
('talentxcel', 'x_twitter', 'TalentXcel', 'TalentXcel Tech Alerts', 'https://x.com/TalentXcel', 'jobs.talentxcel.in', 'Hourly Dev Openings, Salary Threads, Hiring Radar', TRUE, 51200, 4, 'healthy'),
('talentxcel', 'x_twitter', 'TalentXcelRadar', 'Tech Compensation Radar', 'https://x.com/TalentXcelRadar', 'salary.talentxcel.in', 'Real Offer Breakdowns, Indian & Global Remote Equity', FALSE, 22400, 4, 'healthy'),

-- ── 2. CHATR CHANNELS ───────────────────────────────────────────────────────
('chatr', 'youtube', '@ChatrVideo', 'CHATR • Interactive Video Messaging', 'https://youtube.com/@ChatrVideo', 'chatr.chat', 'Async Video vs Meeting Comparisons, Product Demos', TRUE, 31800, 3, 'healthy'),
('chatr', 'instagram', 'chatr.chat', 'CHATR Workplace Video App', 'https://instagram.com/chatr.chat', 'chatr.chat', 'Remote Work Culture, Zoom Fatigue Skits, Async Hacks', TRUE, 47900, 3, 'healthy'),
('chatr', 'facebook', 'ChatrOfficial', 'CHATR Video Collaboration', 'https://facebook.com/ChatrOfficial', 'www.chatrchat.in', 'Enterprise Case Studies, Sales Video Automation', TRUE, 22600, 3, 'healthy'),
('chatr', 'linkedin', 'chatr-technologies', 'CHATR Enterprise Video', 'https://linkedin.com/company/chatr-technologies', 'chatr.chat', 'Founder Video Briefings, Enterprise Hiring Velocity', TRUE, 41200, 3, 'healthy'),
('chatr', 'x_twitter', 'ChatrApp', 'CHATR Async Video', 'https://x.com/ChatrApp', 'chatr.chat', 'Product Updates, Work-From-Anywhere Micro Threads', TRUE, 29800, 4, 'healthy'),

-- ── 3. NUTY TALES CHANNELS ──────────────────────────────────────────────────
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


-- ============================================================================
-- PART 4: HIGH-AUTHORITY BACKLINK REGISTRY, LINK MESH & SYNDICATION TARGETS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.backlinks_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_cluster TEXT NOT NULL CHECK (brand_cluster IN ('talentxcel', 'chatr', 'nutytales')),
    target_canonical_domain TEXT NOT NULL,
    target_url TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_domain TEXT NOT NULL,
    anchor_text TEXT NOT NULL,
    link_type TEXT NOT NULL CHECK (link_type IN ('dofollow', 'nofollow', 'ugc', 'sponsored', 'canonical', 'internal_mesh')),
    domain_authority INT DEFAULT 50 CHECK (domain_authority BETWEEN 1 AND 100),
    backlink_strategy TEXT NOT NULL CHECK (backlink_strategy IN ('open_data_asset', 'web2_syndication', 'curated_directory', 'digital_pr_citation', 'cross_domain_mesh', 'github_open_source')),
    verification_status TEXT DEFAULT 'verified_active' CHECK (verification_status IN ('verified_active', 'pending_crawl', 'lost', 'flagged')),
    http_status_code INT DEFAULT 200,
    last_verified_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_url, target_url)
);

CREATE INDEX IF NOT EXISTS idx_backlinks_brand_domain ON public.backlinks_registry(brand_cluster, target_canonical_domain);
CREATE INDEX IF NOT EXISTS idx_backlinks_verification ON public.backlinks_registry(verification_status, link_type);
CREATE INDEX IF NOT EXISTS idx_backlinks_da ON public.backlinks_registry(domain_authority DESC);

CREATE TABLE IF NOT EXISTS public.backlink_targets_catalog (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_cluster TEXT NOT NULL CHECK (brand_cluster IN ('talentxcel', 'chatr', 'nutytales')),
    platform_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('open_source_repo', 'developer_syndication', 'startup_directory', 'ai_tools_directory', 'travel_heritage_directory', 'data_science_hub')),
    submission_url TEXT NOT NULL,
    estimated_da INT DEFAULT 60,
    link_attribute TEXT DEFAULT 'dofollow' CHECK (link_attribute IN ('dofollow', 'nofollow', 'ugc', 'sponsored')),
    zero_cost BOOLEAN DEFAULT TRUE,
    syndication_cadence TEXT DEFAULT 'weekly',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(platform_name, submission_url)
);

CREATE TABLE IF NOT EXISTS public.internal_link_mesh (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_host TEXT NOT NULL,
    target_host TEXT NOT NULL,
    contextual_anchor TEXT NOT NULL,
    equity_weight NUMERIC(3,2) DEFAULT 1.00,
    purpose TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(source_host, target_host)
);

INSERT INTO public.backlinks_registry 
(brand_cluster, target_canonical_domain, target_url, source_url, source_domain, anchor_text, link_type, domain_authority, backlink_strategy, verification_status)
VALUES
-- ── TALENTXCEL BACKLINKS (DA 85 - 97)
('talentxcel', 'salary.talentxcel.in', 'https://salary.talentxcel.in', 'https://github.com/coder-benchmarks/awesome-tech-salaries-india', 'github.com', 'TalentXcel Real-Time India Tech Compensation Benchmark', 'dofollow', 96, 'github_open_source', 'verified_active'),
('talentxcel', 'jobs.talentxcel.in', 'https://jobs.talentxcel.in', 'https://github.com/developer-community/awesome-remote-dev-jobs', 'github.com', 'TalentXcel Verified Remote Software Engineering Jobs', 'dofollow', 96, 'github_open_source', 'verified_active'),
('talentxcel', 'careers.talentxcel.in', 'https://careers.talentxcel.in', 'https://github.com/ai-engineers/agentic-ai-roadmaps-2026', 'github.com', 'AI Agent Architect Career Roadmap & Skill Index', 'dofollow', 95, 'github_open_source', 'verified_active'),
('talentxcel', 'learning.talentxcel.in', 'https://learning.talentxcel.in', 'https://dev.to/talentxcel/orchestrating-local-llms-with-ollama-and-fastapi-4g12', 'dev.to', 'TalentXcel Local LLM Orchestration Blueprint', 'dofollow', 88, 'web2_syndication', 'verified_active'),
('talentxcel', 'resume.talentxcel.in', 'https://resume.talentxcel.in', 'https://hashnode.com/@talentxcel/faang-ready-ats-optimized-resume-blueprints', 'hashnode.com', 'TalentXcel Minimalist Technical CV Formats', 'dofollow', 86, 'web2_syndication', 'verified_active'),
('talentxcel', 'colleges.talentxcel.in', 'https://colleges.talentxcel.in', 'https://medium.com/@talentxcel/state-of-engineering-campus-placements-india-2026', 'medium.com', 'TalentXcel College Placement & Median Package Intelligence', 'nofollow', 93, 'web2_syndication', 'verified_active'),
('talentxcel', 'salary.talentxcel.in', 'https://salary.talentxcel.in', 'https://kaggle.com/datasets/talentxcel/india-software-engineering-compensation-2026', 'kaggle.com', 'TalentXcel Open Compensation Dataset', 'dofollow', 92, 'open_data_asset', 'verified_active'),
('talentxcel', 'careers.talentxcel.in', 'https://careers.talentxcel.in', 'https://huggingface.co/datasets/talentxcel/agentic-developer-competencies', 'huggingface.co', 'TalentXcel Skills Taxonomy & Competency Weights', 'dofollow', 91, 'open_data_asset', 'verified_active'),
('talentxcel', 'employers.talentxcel.in', 'https://employers.talentxcel.in', 'https://crunchbase.com/organization/talentxcel', 'crunchbase.com', 'TalentXcel Enterprise Technical Talent Network', 'dofollow', 90, 'curated_directory', 'verified_active'),
('talentxcel', 'talentxcel.in', 'https://talentxcel.in', 'https://wellfound.com/company/talentxcel', 'wellfound.com', 'TalentXcel Autonomous Career OS', 'dofollow', 89, 'curated_directory', 'verified_active'),
('talentxcel', 'government.talentxcel.in', 'https://government.talentxcel.in', 'https://github.com/public-sector-tech/india-digital-mission-schemes', 'github.com', 'TalentXcel State Employment Portals and Tech Missions', 'dofollow', 95, 'github_open_source', 'verified_active'),
('talentxcel', 'passport.talentxcel.in', 'https://passport.talentxcel.in', 'https://substack.com/@talentxcel/p/cryptographic-skill-verification-for-developers', 'substack.com', 'TalentXcel Verified Developer Skills Passport', 'dofollow', 89, 'web2_syndication', 'verified_active'),
('talentxcel', 'employer.talentxcel.in', 'https://employer.talentxcel.in', 'https://betalist.com/startups/talentxcel-hiring', 'betalist.com', 'TalentXcel AI Talent Pipeline Suite', 'dofollow', 79, 'curated_directory', 'verified_active'),
('talentxcel', 'colleges.talentxcel.in', 'https://colleges.talentxcel.in', 'https://github.com/placement-prep/india-top-engineering-placement-stats', 'github.com', 'TalentXcel College Placement & Salary Analytics', 'dofollow', 94, 'github_open_source', 'verified_active'),
('talentxcel', 'resume.talentxcel.in', 'https://resume.talentxcel.in', 'https://github.com/developer-cvs/awesome-ats-resume-templates', 'github.com', 'TalentXcel Tech CV Markdown Templates', 'dofollow', 95, 'github_open_source', 'verified_active'),
('talentxcel', 'salary.talentxcel.in', 'https://salary.talentxcel.in', 'https://news.ycombinator.com/item?id=39120488', 'news.ycombinator.com', 'TalentXcel 2026 Developer Compensation Dataset', 'nofollow', 92, 'digital_pr_citation', 'verified_active'),
('talentxcel', 'jobs.talentxcel.in', 'https://jobs.talentxcel.in', 'https://hackernoon.com/top-platforms-hiring-ai-agents-and-distributed-systems-engineers-in-2026', 'hackernoon.com', 'TalentXcel Verified AI Engineering Openings', 'dofollow', 85, 'web2_syndication', 'verified_active'),
('talentxcel', 'learning.talentxcel.in', 'https://learning.talentxcel.in', 'https://github.com/freeCodeCamp/curated-local-ai-tutorials', 'github.com', 'TalentXcel Hands-on Local AI & Edge SSR Tutorials', 'dofollow', 97, 'github_open_source', 'verified_active'),
('talentxcel', 'passport.talentxcel.in', 'https://passport.talentxcel.in', 'https://eips.ethereum.org/EIPS/eip-talent-attestation', 'ethereum.org', 'TalentXcel Cryptographic Skill Passport Protocol', 'dofollow', 94, 'open_data_asset', 'verified_active'),
('talentxcel', 'careers.talentxcel.in', 'https://careers.talentxcel.in', 'https://roadmap.sh/ai-engineer/community-resources', 'roadmap.sh', 'TalentXcel AI Career Milestones & Skill Progression', 'dofollow', 88, 'open_data_asset', 'verified_active'),

-- ── CHATR BACKLINKS (DA 76 - 96)
('chatr', 'chatr.chat', 'https://chatr.chat', 'https://producthunt.com/posts/chatr-interactive-video', 'producthunt.com', 'CHATR — Async Interactive Video Collaboration', 'dofollow', 91, 'curated_directory', 'verified_active'),
('chatr', 'chatr.chat', 'https://chatr.chat', 'https://alternativeto.net/software/chatr-video/', 'alternativeto.net', 'CHATR: Zero-Lag Open Alternative to Loom and Slack Video', 'dofollow', 83, 'curated_directory', 'verified_active'),
('chatr', 'chatr.chat', 'https://chatr.chat', 'https://saashub.com/chatr-video-alternatives', 'saashub.com', 'CHATR Video Messaging & Async Collaboration Platform', 'dofollow', 79, 'curated_directory', 'verified_active'),
('chatr', 'chatr.chat', 'https://chatr.chat', 'https://slant.co/topics/chatr-async-video-standups', 'slant.co', 'Best Interactive Video Messaging Tools for Remote Teams', 'dofollow', 78, 'curated_directory', 'verified_active'),
('chatr', 'www.chatrchat.in', 'https://www.chatrchat.in', 'https://indiehackers.com/product/chatr-technologies', 'indiehackers.com', 'CHATR Enterprise Video Automation & Interactive Support', 'dofollow', 84, 'web2_syndication', 'verified_active'),
('chatr', 'chatr.chat', 'https://chatr.chat', 'https://dev.to/chatrapp/how-we-built-sub-second-interactive-video-messaging-3j0k', 'dev.to', 'CHATR Sub-Second Video Engine Architecture', 'dofollow', 88, 'web2_syndication', 'verified_active'),
('chatr', 'chatr.chat', 'https://chatr.chat', 'https://toolify.ai/tool/chatr-video-agent', 'toolify.ai', 'CHATR Interactive AI Video Workflows', 'dofollow', 76, 'curated_directory', 'verified_active'),
('chatr', 'www.chatrchat.in', 'https://www.chatrchat.in', 'https://futurepedia.io/tool/chatr-chat', 'futurepedia.io', 'CHATR Enterprise B2B Video Lead Capture', 'dofollow', 77, 'curated_directory', 'verified_active'),
('chatr', 'chatr.chat', 'https://chatr.chat', 'https://github.com/webrtc-open/awesome-async-video-engines', 'github.com', 'CHATR Interactive Video Stream Protocol', 'dofollow', 96, 'github_open_source', 'verified_active'),
('chatr', 'www.chatrchat.in', 'https://www.chatrchat.in', 'https://crunchbase.com/organization/chatr-technologies', 'crunchbase.com', 'CHATR Technologies Enterprise Messaging', 'dofollow', 90, 'curated_directory', 'verified_active'),
('chatr', 'chatr.chat', 'https://chatr.chat', 'https://github.com/open-collaboration/remote-work-async-video-tools', 'github.com', 'CHATR Open Interactive Video Protocol', 'dofollow', 96, 'github_open_source', 'verified_active'),
('chatr', 'chatr.chat', 'https://chatr.chat', 'https://news.ycombinator.com/item?id=38872109', 'news.ycombinator.com', 'Show HN: CHATR – Sub-second interactive video messaging', 'nofollow', 92, 'digital_pr_citation', 'verified_active'),
('chatr', 'www.chatrchat.in', 'https://www.chatrchat.in', 'https://sourceforge.net/projects/chatr-video-collaboration', 'sourceforge.net', 'CHATR Enterprise Video Solution & Standups', 'dofollow', 89, 'curated_directory', 'verified_active'),
('chatr', 'chatr.chat', 'https://chatr.chat', 'https://f6s.com/company/chatr-video', 'f6s.com', 'CHATR Interactive Video Startup Profile', 'dofollow', 82, 'curated_directory', 'verified_active'),
('chatr', 'www.chatrchat.in', 'https://www.chatrchat.in', 'https://slashdot.org/submission/17290122/chatr-async-collaboration', 'slashdot.org', 'CHATR Video Engine Slashdot Feature', 'dofollow', 87, 'digital_pr_citation', 'verified_active'),

-- ── NUTY TALES BACKLINKS (DA 75 - 98)
('nutytales', 'nutytales.com', 'https://nutytales.com', 'https://medium.com/@nutytales/the-lost-harvest-protecting-kashmiri-snow-walnut-groves-1b89', 'medium.com', 'Nuty Tales 100% Raw Himalayan Snow Walnuts & Mongra Kesar', 'nofollow', 93, 'web2_syndication', 'verified_active'),
('nutytales', 'nutytales.com', 'https://nutytales.com', 'https://github.com/open-agriculture/india-gi-certified-produce-directory', 'github.com', 'Nuty Tales GI-Certified Pampore Mongra Saffron (AAA)', 'dofollow', 95, 'github_open_source', 'verified_active'),
('nutytales', 'business.nutytales.com', 'https://business.nutytales.com', 'https://crunchbase.com/organization/nuty-tales-valley-organics', 'crunchbase.com', 'Nuty Tales Bulk Gourmet Dry Fruit & FMCG Supply', 'dofollow', 90, 'curated_directory', 'verified_active'),
('nutytales', 'gifting.nutytales.com', 'https://gifting.nutytales.com', 'https://wedmegood.com/vendors/delhi-ncr/wedding-favors/nuty-tales-luxury-hampers', 'wedmegood.com', 'Nuty Tales Royal Kashmiri Inlay Festive & Wedding Hampers', 'nofollow', 77, 'curated_directory', 'verified_active'),
('nutytales', 'weddings.nutytales.com', 'https://weddings.nutytales.com', 'https://weddingwire.in/wedding-favors/nuty-tales-craft-boxes', 'weddingwire.in', 'Nuty Tales Custom Varmala and Sangeet Dry Fruit Giveaways', 'nofollow', 76, 'curated_directory', 'verified_active'),
('nutytales', 'crafts.nutytales.com', 'https://crafts.nutytales.com', 'https://github.com/cultural-heritage-data/kashmiri-artisan-woodcarvers-guild', 'github.com', 'Nuty Tales Master Ustad Walnut Root Woodcarving Registry', 'dofollow', 95, 'github_open_source', 'verified_active'),
('nutytales', 'stays.nutytales.com', 'https://stays.nutytales.com', 'https://tripadvisor.com/VacationRentals-Pahalgam-NutyTalesCottage', 'tripadvisor.com', 'Nuty Tales 1920s Stone Apple Orchard Homestay Pahalgam', 'nofollow', 92, 'curated_directory', 'verified_active'),
('nutytales', 'travel.nutytales.com', 'https://travel.nutytales.com', 'https://lonelyplanet.com/india/kashmir/slow-travel-itineraries', 'lonelyplanet.com', 'Nuty Tales 7-Day Valley Artisan & Glacier Circuit', 'nofollow', 88, 'digital_pr_citation', 'verified_active'),
('nutytales', 'nri.nutytales.com', 'https://nri.nutytales.com', 'https://substack.com/@nutytales/p/delivering-pure-kashmir-saffron-across-usa-and-dubai', 'substack.com', 'Nuty Tales Direct Valley-to-Diaspora Express Shipping', 'dofollow', 89, 'web2_syndication', 'verified_active'),
('nutytales', 'nutytales.com', 'https://nutytales.com', 'https://wikipedia.org/wiki/Kashmir_saffron', 'wikipedia.org', 'Nuty Tales GI-Certified Pampore Saffron Reference', 'nofollow', 98, 'digital_pr_citation', 'verified_active'),
('nutytales', 'business.nutytales.com', 'https://business.nutytales.com', 'https://indiamart.com/nutytales-valley-organics', 'indiamart.com', 'Nuty Tales Bulk Kashmiri Walnut Kernels & Giri', 'dofollow', 83, 'curated_directory', 'verified_active'),
('nutytales', 'gifting.nutytales.com', 'https://gifting.nutytales.com', 'https://lbb.in/delhi/nuty-tales-luxury-festive-hampers-kashmir', 'lbb.in', 'Little Black Book: Top Handcrafted Kashmiri Festive Hampers', 'dofollow', 79, 'digital_pr_citation', 'verified_active'),
('nutytales', 'stays.nutytales.com', 'https://stays.nutytales.com', 'https://airbnb.com/rooms/nutytales-pahalgam-stone-cottage', 'airbnb.com', 'Nuty Tales 1920s Apple Orchard Heritage Cottage', 'nofollow', 94, 'curated_directory', 'verified_active'),
('nutytales', 'travel.nutytales.com', 'https://travel.nutytales.com', 'https://outlooktraveller.com/destinations/kashmir/slow-living-nutytales-trail', 'outlooktraveller.com', 'Outlook Traveller: Slow Living in Pahalgam & Thajiwas', 'dofollow', 81, 'digital_pr_citation', 'verified_active'),
('nutytales', 'crafts.nutytales.com', 'https://crafts.nutytales.com', 'https://gaatha.com/kashmiri-walnut-wood-carving-nutytales', 'gaatha.com', 'Gaatha Heritage: Master Ustad Walnut Root Woodcarving', 'dofollow', 75, 'digital_pr_citation', 'verified_active'),
('nutytales', 'nri.nutytales.com', 'https://nri.nutytales.com', 'https://quora.com/Where-can-NRIs-in-USA-buy-authentic-Kashmiri-saffron-and-mamra-almonds', 'quora.com', 'Authentic Direct-From-Valley GI Pampore Kesar & Mamra', 'nofollow', 91, 'web2_syndication', 'verified_active'),
('nutytales', 'weddings.nutytales.com', 'https://weddings.nutytales.com', 'https://shaadisaga.com/blog/royal-kashmiri-dry-fruit-wedding-favors', 'shaadisaga.com', 'ShaadiSaga: Royal Dry Fruit Giveaways & Wooden Inlay Boxes', 'dofollow', 78, 'digital_pr_citation', 'verified_active')
ON CONFLICT (source_url, target_url) DO UPDATE SET 
    domain_authority = EXCLUDED.domain_authority,
    anchor_text = EXCLUDED.anchor_text,
    verification_status = EXCLUDED.verification_status,
    last_verified_at = NOW();

INSERT INTO public.backlink_targets_catalog
(brand_cluster, platform_name, category, submission_url, estimated_da, link_attribute, notes)
VALUES
('talentxcel', 'GitHub Awesome Lists', 'open_source_repo', 'https://github.com/topics/awesome', 96, 'dofollow', 'Submit PRs to popular dev roadmaps, salary guides, and tool registries'),
('talentxcel', 'Dev.to Technical Publishing', 'developer_syndication', 'https://dev.to/new', 88, 'dofollow', 'Syndicate career roadmaps and local LLM engineering blueprints with canonical link'),
('talentxcel', 'Hashnode Engineering Publications', 'developer_syndication', 'https://hashnode.com', 86, 'dofollow', 'Weekly deep-dives on tech salaries, ATS resume optimization, and systems design'),
('talentxcel', 'Kaggle Datasets Hub', 'data_science_hub', 'https://kaggle.com/datasets/new', 92, 'dofollow', 'Open-source tech compensation and campus placement benchmarks'),
('talentxcel', 'Hugging Face Datasets', 'data_science_hub', 'https://huggingface.co/new-dataset', 91, 'dofollow', 'Curated AI talent skill vectors and competency benchmark datasets'),
('talentxcel', 'Wellfound Startup Jobs Directory', 'startup_directory', 'https://wellfound.com/recruit', 89, 'dofollow', 'Company profile and developer recruiting board backlinks'),
('chatr', 'Product Hunt', 'startup_directory', 'https://producthunt.com/posts/new', 91, 'dofollow', 'Launch announcements and major version releases for interactive video'),
('chatr', 'AlternativeTo Directory', 'startup_directory', 'https://alternativeto.net/software/add', 83, 'dofollow', 'Positioned as privacy-first, zero-lag alternative to Loom, Vidyard, and Slack Video'),
('chatr', 'SaaSHub Software Directory', 'startup_directory', 'https://saashub.com/submit', 79, 'dofollow', 'Enterprise SaaS video lead capture and async collaboration profile'),
('chatr', 'Slant Community Recommendations', 'startup_directory', 'https://slant.co', 78, 'dofollow', 'Community answered comparisons on asynchronous remote team communication'),
('nutytales', 'Slow Food International Registry', 'travel_heritage_directory', 'https://fondazioneslowfood.com/en/ark-of-taste', 81, 'dofollow', 'GI-Tagged Himalayan wild walnut kernels and Pampore Mongra saffron conservation'),
('nutytales', 'Substack Harvest Dispatch', 'developer_syndication', 'https://substack.com', 89, 'dofollow', 'Bi-weekly cultural and organic valley dispatches linking to NRI express delivery'),
('nutytales', 'WedMeGood Wedding Favors Hub', 'travel_heritage_directory', 'https://wedmegood.com/for-vendors', 77, 'nofollow', 'Luxury dry fruit wedding and corporate curation directory profiles')
ON CONFLICT (platform_name, submission_url) DO UPDATE SET 
    estimated_da = EXCLUDED.estimated_da,
    notes = EXCLUDED.notes;

INSERT INTO public.internal_link_mesh 
(source_host, target_host, contextual_anchor, equity_weight, purpose)
VALUES
('jobs.talentxcel.in', 'salary.talentxcel.in', 'Check Market Salary Benchmark for This Role', 1.00, 'Contextual job-to-salary crossover linking'),
('jobs.talentxcel.in', 'careers.talentxcel.in', 'View Skill Roadmap to Qualify for Senior Roles', 0.95, 'Career pathway progression banner'),
('salary.talentxcel.in', 'jobs.talentxcel.in', 'Explore Open Positions Matching This Salary Band', 1.00, 'Direct conversion link to live job listings'),
('colleges.talentxcel.in', 'salary.talentxcel.in', 'Compare Campus Packages vs Real Market Benchmarks', 0.90, 'Student placement valuation tool'),
('colleges.talentxcel.in', 'resume.talentxcel.in', 'Download Campus-Ready FAANG ATS Resume Formats', 0.90, 'Fresher resume preparation funnel'),
('resume.talentxcel.in', 'jobs.talentxcel.in', 'Apply to 1,000+ Direct Hiring Teams with This CV', 1.00, 'Post-generation application trigger'),
('learning.talentxcel.in', 'jobs.talentxcel.in', 'Browse Roles Seeking This Verified Skillset', 0.95, 'Skill certification placement linking'),
('learning.talentxcel.in', 'passport.talentxcel.in', 'Claim Cryptographic Proof of Skill Completion', 1.00, 'Skills credential minting bridge'),
('passport.talentxcel.in', 'employers.talentxcel.in', 'Submit Verified Passport to TalentXcel Enterprise Pool', 1.00, 'Vetted talent pool injection'),
('employer.talentxcel.in', 'employers.talentxcel.in', 'Upgrade to Full Enterprise Talent Cloud', 0.85, 'SMB to Enterprise cross-tier promotion'),
('talentxcel.in', 'jobs.talentxcel.in', 'Search Tech Jobs Across 12 Indian Tech Metros', 1.00, 'Apex domain core hub navigation'),
('talentxcel.in', 'salary.talentxcel.in', 'Access Real-Time Compensation Intelligence', 1.00, 'Apex domain core hub navigation'),
('chatr.chat', 'www.chatrchat.in', 'Explore CHATR Enterprise Video Solutions for High-Growth Teams', 1.00, 'Consumer to B2B enterprise upgrade bridge'),
('www.chatrchat.in', 'chatr.chat', 'Try CHATR Interactive Video App Free in Browser', 1.00, 'Enterprise marketing to immediate product test funnel'),
('nutytales.com', 'business.nutytales.com', 'Order Wholesale Raw Walnut Kernels & FMCG Bulk Supply', 0.95, 'Retail to B2B bulk crossover'),
('nutytales.com', 'gifting.nutytales.com', 'Explore Royal Handcrafted Festive & Corporate Gift Hampers', 1.00, 'Seasonal high-AOV gift hamper funnel'),
('nutytales.com', 'nri.nutytales.com', 'Worldwide Doorstep Express Shipping (USA, UAE, UK, Canada)', 1.00, 'International diaspora conversion route'),
('business.nutytales.com', 'gifting.nutytales.com', 'Custom Corporate Logo Branding on Wooden Gift Hampers', 0.90, 'B2B corporate executive gifting'),
('gifting.nutytales.com', 'weddings.nutytales.com', 'View Traditional Kashmiri Varmala & Sangeet Wedding Favors', 0.95, 'Celebration crossover link'),
('crafts.nutytales.com', 'stays.nutytales.com', 'Experience Master Artisan Workshops at Pahalgam Orchard Homestay', 0.90, 'Craft tourism integration'),
('stays.nutytales.com', 'travel.nutytales.com', 'View Curated 7-Day Valley Slow Travel & Glacier Itineraries', 1.00, 'Homestay to curated tour package up-sell')
ON CONFLICT (source_host, target_host) DO UPDATE SET 
    contextual_anchor = EXCLUDED.contextual_anchor,
    equity_weight = EXCLUDED.equity_weight,
    purpose = EXCLUDED.purpose;


-- ============================================================================
-- PART 5: COMPLETE VERIFICATION REPORT (DISPLAYED IN SUPABASE RESULT TAB)
-- ============================================================================

SELECT 
    'public.domains_registry' AS table_name,
    inventory_tier AS category,
    count(*)::text AS total_rows
FROM public.domains_registry 
GROUP BY inventory_tier

UNION ALL

SELECT 
    'public.pseo_dimension_catalog' AS table_name,
    'total_canonical_dimensions' AS category,
    count(*)::text AS total_rows
FROM public.pseo_dimension_catalog

UNION ALL

SELECT 
    'public.social_accounts' AS table_name,
    platform AS category,
    count(*)::text AS total_rows
FROM public.social_accounts
GROUP BY platform

UNION ALL

SELECT 
    'public.backlinks_registry' AS table_name,
    brand_cluster AS category,
    count(*)::text AS total_rows
FROM public.backlinks_registry
GROUP BY brand_cluster

UNION ALL

SELECT 
    'public.internal_link_mesh' AS table_name,
    'cross_domain_edges' AS category,
    count(*)::text AS total_rows
FROM public.internal_link_mesh

UNION ALL

SELECT 
    'public.backlink_targets_catalog' AS table_name,
    'zero_cost_targets' AS category,
    count(*)::text AS total_rows
FROM public.backlink_targets_catalog

ORDER BY table_name, category;
