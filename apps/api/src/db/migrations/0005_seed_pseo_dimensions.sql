-- ============================================================================
-- MIGRATION: 0005_seed_pseo_dimensions.sql
-- Seed Combinatorial Dimensions for the 21 Active Canonical Production Hosts
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

-- ── 1. talentxcel.in (Apex Canonical Hub) ──────────────────────────────────
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

-- ── 2. jobs.talentxcel.in (/job/[role]-in-[city]-with-[skill]) ─────────────
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

-- ── 3. salary.talentxcel.in (/salary/[role]-in-[city]-[experience]) ────────
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

-- ── 4. colleges.talentxcel.in (/college/[institution]-placement-[city]) ────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('colleges.talentxcel.in', 'institution', 'iit-bombay', 'IIT Bombay', '{"median_package_lpa": 22}'::jsonb, 65000),
('colleges.talentxcel.in', 'institution', 'iit-delhi', 'IIT Delhi', '{"median_package_lpa": 21}'::jsonb, 61000),
('colleges.talentxcel.in', 'institution', 'iiit-hyderabad', 'IIIT Hyderabad', '{"median_package_lpa": 24}'::jsonb, 54000),
('colleges.talentxcel.in', 'institution', 'bits-pilani', 'BITS Pilani', '{"median_package_lpa": 19}'::jsonb, 49000),
('colleges.talentxcel.in', 'city', 'mumbai', 'Mumbai', '{"placement_tier": 1}'::jsonb, 52000),
('colleges.talentxcel.in', 'city', 'delhi', 'Delhi', '{"placement_tier": 1}'::jsonb, 48000),
('colleges.talentxcel.in', 'city', 'hyderabad', 'Hyderabad', '{"placement_tier": 1}'::jsonb, 44000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 5. careers.talentxcel.in (/career-path/[role]-roadmap-[level]) ──────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('careers.talentxcel.in', 'role', 'agentic-ai-engineer', 'Agentic AI Engineer', '{"horizon": "2026-2030"}'::jsonb, 38000),
('careers.talentxcel.in', 'role', 'distributed-systems-lead', 'Distributed Systems Lead', '{"horizon": "long-term"}'::jsonb, 29000),
('careers.talentxcel.in', 'level', 'beginner-to-production', 'Beginner to Production', '{"milestones": 6}'::jsonb, 41000),
('careers.talentxcel.in', 'level', 'senior-to-staff', 'Senior to Staff Architect', '{"milestones": 8}'::jsonb, 28000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 6. resume.talentxcel.in (/templates/[industry]-cv-format-[style]) ───────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('resume.talentxcel.in', 'industry', 'fintech-crypto', 'Fintech & High-Frequency Trading', '{"ats_score": 96}'::jsonb, 32000),
('resume.talentxcel.in', 'industry', 'healthcare-ai', 'HealthTech & BioAI', '{"ats_score": 94}'::jsonb, 26000),
('resume.talentxcel.in', 'style', 'faang-minimalist', 'FAANG Minimalist Standard', '{"format": "1-page"}'::jsonb, 47000),
('resume.talentxcel.in', 'style', 'executive-technical', 'Executive Technical Leadership', '{"format": "2-page"}'::jsonb, 22000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 7. learning.talentxcel.in (/learn/[skill]-tutorial-for-[level]) ─────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('learning.talentxcel.in', 'skill', 'ollama-local-llm-orchestration', 'Ollama Local LLM Orchestration', '{"duration_hours": 12}'::jsonb, 28000),
('learning.talentxcel.in', 'skill', 'hono-edge-ssr-routing', 'Hono Edge SSR & Cloudflare Routing', '{"duration_hours": 8}'::jsonb, 21000),
('learning.talentxcel.in', 'level', 'engineers', 'Senior Engineers', '{"hands_on": true}'::jsonb, 34000),
('learning.talentxcel.in', 'level', 'architects', 'System Architects', '{"hands_on": true}'::jsonb, 27000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 8. employer.talentxcel.in (/hiring/[industry]-solutions-[region]) ──────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('employer.talentxcel.in', 'industry', 'deep-tech-robotics', 'DeepTech & Hardware AI', '{"pipeline": "specialist"}'::jsonb, 19000),
('employer.talentxcel.in', 'industry', 'saas-cloud-platforms', 'Enterprise SaaS Platforms', '{"pipeline": "high-volume"}'::jsonb, 31000),
('employer.talentxcel.in', 'region', 'india-gcc', 'India & GCC Tech Corridors', '{"talent_pool": 85000}'::jsonb, 26000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 9. employers.talentxcel.in (/enterprise/[sector]-talent-pool) ───────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('employers.talentxcel.in', 'sector', 'banking-fintech-infrastructure', 'Banking & Core Fintech Infrastructure', '{"vetted_count": 12400}'::jsonb, 23000),
('employers.talentxcel.in', 'sector', 'autonomous-mobility-ev', 'Autonomous Mobility & EV Systems', '{"vetted_count": 8600}'::jsonb, 17000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 10. government.talentxcel.in (/schemes/[state]-employment-portal) ──────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('government.talentxcel.in', 'state', 'karnataka', 'Karnataka State Tech & Skill Mission', '{"portal_id": "KA-TECH"}'::jsonb, 34000),
('government.talentxcel.in', 'state', 'telangana', 'Telangana Digital Employment Authority', '{"portal_id": "TS-DIGI"}'::jsonb, 29000),
('government.talentxcel.in', 'state', 'maharashtra', 'Maharashtra State Innovation & Startup Portal', '{"portal_id": "MH-INNO"}'::jsonb, 31000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 11. passport.talentxcel.in (/passport/[credential]-verification-[id]) ──
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('passport.talentxcel.in', 'credential', 'verified-staff-ai-architect', 'Verified Staff AI Architect', '{"ledger": "cryptographic"}'::jsonb, 18000),
('passport.talentxcel.in', 'credential', 'certified-systems-performance-engineer', 'Certified Systems Performance Engineer', '{"ledger": "cryptographic"}'::jsonb, 14000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 12. chatr.chat (/agent/[intent]-workflow-[integration]) ────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('chatr.chat', 'intent', 'async-video-hiring-pipeline', 'Async Video Hiring & Candidate Screening', '{"automation_rate": "84%"}'::jsonb, 39000),
('chatr.chat', 'intent', 'interactive-customer-support', 'Interactive Customer Video Support', '{"automation_rate": "78%"}'::jsonb, 46000),
('chatr.chat', 'intent', 'founder-investor-pitch-decks', 'Interactive Founder Investor Updates', '{"automation_rate": "92%"}'::jsonb, 28000),
('chatr.chat', 'integration', 'slack-enterprise', 'Slack Enterprise Grid', '{"oauth": true}'::jsonb, 31000),
('chatr.chat', 'integration', 'notion-workspace', 'Notion Team Workspace', '{"oauth": true}'::jsonb, 27000),
('chatr.chat', 'integration', 'hubspot-crm', 'HubSpot Sales CRM', '{"oauth": true}'::jsonb, 33000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 13. www.chatrchat.in (/solutions/[use-case]-for-[industry]) ─────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('www.chatrchat.in', 'usecase', 'video-lead-capture', 'One-Click Interactive Video Lead Capture', '{"roi": "3.8x"}'::jsonb, 22000),
('www.chatrchat.in', 'usecase', 'executive-briefing', 'Asynchronous Executive Daily Standup Briefing', '{"roi": "4.2x"}'::jsonb, 19000),
('www.chatrchat.in', 'industry', 'venture-capital-funds', 'Venture Capital & Accelerator Funds', '{"sector": "finance"}'::jsonb, 16000),
('www.chatrchat.in', 'industry', 'b2b-enterprise-sales', 'B2B Enterprise Software Sales', '{"sector": "saas"}'::jsonb, 24000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 14. nutytales.com (/store/[product]-organic-[origin]) ──────────────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('nutytales.com', 'product', 'kashmiri-snow-walnut', 'Kashmiri Snow Walnut (Giri)', '{"grade": "Grade A+ Extra Light", "organic": true}'::jsonb, 54000),
('nutytales.com', 'product', 'mongra-saffron-kesar', 'Pure Kashmiri Mongra Saffron (Kesar)', '{"grade": "GI-Tagged AAA", "organic": true}'::jsonb, 68000),
('nutytales.com', 'product', 'mamra-almonds', 'Raw Organic Mamra Almonds', '{"grade": "High Oil Content", "organic": true}'::jsonb, 49000),
('nutytales.com', 'origin', 'kashmir-pampore', 'Pampore Valley, Kashmir', '{"elevation_ft": 5300}'::jsonb, 38000),
('nutytales.com', 'origin', 'ladakh-himalayas', 'Ladakh Himalayan Belt', '{"elevation_ft": 9800}'::jsonb, 29000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 15. business.nutytales.com (/bulk/[category]-wholesale-supply) ─────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('business.nutytales.com', 'category', 'raw-walnut-kernels-fmcg', 'Raw Walnut Kernels for FMCG & Bakery', '{"moq_kg": 100}'::jsonb, 24000),
('business.nutytales.com', 'category', 'gourmet-dry-fruit-blends', 'Gourmet Roasted & Salted Hotel Blends', '{"moq_kg": 50}'::jsonb, 28000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 16. gifting.nutytales.com (/gift/[occasion]-hamper-delivery-[location]) 
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('gifting.nutytales.com', 'occasion', 'diwali-luxury-curation', 'Diwali Royal Kashmiri Gift Curation', '{"box_style": "Handmade Wooden Inlay"}'::jsonb, 59000),
('gifting.nutytales.com', 'occasion', 'corporate-leadership-summit', 'Corporate Executive Leadership Hamper', '{"box_style": "Matte Velvet Leatherette"}'::jsonb, 41000),
('gifting.nutytales.com', 'occasion', 'eid-mubarak-deluxe', 'Eid Mubarak Deluxe Valley Collection', '{"box_style": "Traditional Lacquer Work"}'::jsonb, 38000),
('gifting.nutytales.com', 'location', 'delhi-ncr-same-day', 'Delhi NCR (Same Day Dispatch)', '{"express": true}'::jsonb, 47000),
('gifting.nutytales.com', 'location', 'mumbai-express', 'Mumbai Financial District', '{"express": true}'::jsonb, 43000),
('gifting.nutytales.com', 'location', 'bangalore-whitefield', 'Bangalore Tech Corridor', '{"express": true}'::jsonb, 39000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 17. weddings.nutytales.com (/wedding/[ceremony]-favor-packing-[culture]) 
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('weddings.nutytales.com', 'ceremony', 'mehendi-sangeet-giveaways', 'Mehendi & Sangeet Traditional Giveaways', '{"custom_cards": true}'::jsonb, 31000),
('weddings.nutytales.com', 'ceremony', 'royal-varmala-welcome-box', 'Royal Varmala Welcome Dry Fruit Box', '{"custom_cards": true}'::jsonb, 27000),
('weddings.nutytales.com', 'culture', 'punjabi-royal-celebrations', 'Punjabi Royal Traditions', '{"motif": "Phulkari Inlay"}'::jsonb, 28000),
('weddings.nutytales.com', 'culture', 'south-indian-temple-heritage', 'South Indian Temple Heritage Style', '{"motif": "Brass Urli Inlay"}'::jsonb, 24000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 18. crafts.nutytales.com (/craft/[artisan]-handmade-[material]) ────────
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('crafts.nutytales.com', 'artisan', 'master-ustad-woodcarvers', 'Master Ustad Valley Woodcarvers Guild', '{"gi_certified": true}'::jsonb, 21000),
('crafts.nutytales.com', 'artisan', 'heritage-pashmina-weavers', 'Heritage Pashmina Handloom Guild', '{"gi_certified": true}'::jsonb, 34000),
('crafts.nutytales.com', 'material', 'aged-walnut-root-wood', 'Century-Aged Walnut Root Wood', '{"finish": "Hand-Waxed Natural"}'::jsonb, 23000),
('crafts.nutytales.com', 'material', 'pure-changthangi-cashmere', 'Pure Changthangi Pashmina Cashmere', '{"finish": "Hand-Spun 100-Count"}'::jsonb, 31000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 19. stays.nutytales.com (/stay/[property]-heritage-homestay-[region]) ──
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('stays.nutytales.com', 'property', 'apple-blossom-stone-cottage', 'Apple Blossom 1920s Stone Cottage', '{"amenities": ["Organic Orchard", "Fireplace", "Local Kashmiri Chef"]}'::jsonb, 37000),
('stays.nutytales.com', 'property', 'chinar-heritage-riverfront-house', 'Chinar Heritage Riverfront House', '{"amenities": ["Lidder River View", "Walnut Library", "Trek Guide"]}'::jsonb, 31000),
('stays.nutytales.com', 'region', 'pahalgam-valley', 'Pahalgam Valley', '{"altitude_m": 2740}'::jsonb, 46000),
('stays.nutytales.com', 'region', 'gulmarg-meadows', 'Gulmarg High Meadows', '{"altitude_m": 2650}'::jsonb, 51000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 20. travel.nutytales.com (/tour/[destination]-cultural-itinerary-[duration]) 
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('travel.nutytales.com', 'destination', 'sonamarg-thajiwas-glacier', 'Sonamarg & Thajiwas Glacier Exploration', '{"experience": "Alpine High Altitude"}'::jsonb, 42000),
('travel.nutytales.com', 'destination', 'doodhpathri-valley-of-milk', 'Doodhpathri Untouched Meadows & Stream Walks', '{"experience": "Eco-Retreat Walk"}'::jsonb, 36000),
('travel.nutytales.com', 'duration', '4-days-3-nights-slow-travel', '4 Days 3 Nights Slow Living Experience', '{"pace": "relaxed"}'::jsonb, 38000),
('travel.nutytales.com', 'duration', '7-days-6-nights-artisan-trail', '7 Days 6 Nights Master Artisan & Valley Circuit', '{"pace": "immersive"}'::jsonb, 29000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;

-- ── 21. nri.nutytales.com (/diaspora/[country]-home-delivery-[tradition]) ───
INSERT INTO public.pseo_dimension_catalog (hostname, dimension_type, slug, display_value, metadata, search_volume_estimate) VALUES
('nri.nutytales.com', 'country', 'united-states', 'United States (FDA Compliant Express)', '{"delivery_days": 4, "dhl_express": true}'::jsonb, 58000),
('nri.nutytales.com', 'country', 'united-kingdom', 'United Kingdom (Customs Cleared)', '{"delivery_days": 3, "dhl_express": true}'::jsonb, 49000),
('nri.nutytales.com', 'country', 'united-arab-emirates', 'UAE & Dubai (Next-Day Air)', '{"delivery_days": 2, "dhl_express": true}'::jsonb, 62000),
('nri.nutytales.com', 'country', 'canada', 'Canada (Toronto & Vancouver Direct)', '{"delivery_days": 4, "dhl_express": true}'::jsonb, 44000),
('nri.nutytales.com', 'tradition', 'festive-pooja-kesar-box', 'Traditional Pooja GI Saffron & Dry Fruits', '{"heritage_pack": true}'::jsonb, 41000),
('nri.nutytales.com', 'tradition', 'diaspora-family-harvest-hamper', 'Annual Orchard Harvest Family Curation', '{"heritage_pack": true}'::jsonb, 51000)
ON CONFLICT (hostname, dimension_type, slug) DO UPDATE SET display_value = EXCLUDED.display_value;
