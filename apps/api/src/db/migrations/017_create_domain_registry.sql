-- ============================================================
-- Migration: 017_create_domain_registry.sql
-- Description: Centralized domain registry, scope model, and multi-domain
--              health matrix for all 26 authoritative hostnames across
--              TalentXcel, CHATR, and Nuty Tales.
-- ============================================================

CREATE TABLE IF NOT EXISTS registered_domains (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id                UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    brand_id                    UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    hostname                    TEXT NOT NULL UNIQUE,
    scheme_preference           TEXT NOT NULL DEFAULT 'https' CHECK (scheme_preference IN ('https', 'http')),
    host_role                   TEXT NOT NULL CHECK (host_role IN ('primary', 'www_alias', 'product_subdomain', 'deployment_host', 'search_console_property', 'unknown', 'excluded')),
    intended_canonical_host     TEXT,
    canonical_policy_source     TEXT,
    expected_redirect_target    TEXT,
    expects_redirect            BOOLEAN NOT NULL DEFAULT FALSE,
    verification_state          TEXT NOT NULL DEFAULT 'owner_supplied' CHECK (verification_state IN ('owner_supplied', 'observed', 'verified', 'excluded', 'needs_review')),
    indexing_intent             TEXT NOT NULL DEFAULT 'indexable' CHECK (indexing_intent IN ('indexable', 'noindex_expected', 'unknown', 'deployment_only')),
    allowed_for_crawling        BOOLEAN NOT NULL DEFAULT TRUE,
    allowed_for_content_analysis BOOLEAN NOT NULL DEFAULT TRUE,
    allowed_for_index_submission BOOLEAN NOT NULL DEFAULT FALSE,
    search_console_property_uri TEXT,
    ga4_property_id             TEXT,
    dns_status                  TEXT NOT NULL DEFAULT 'not_tested' CHECK (dns_status IN ('passed', 'failed', 'not_tested', 'inconclusive')),
    tls_status                  TEXT NOT NULL DEFAULT 'not_tested' CHECK (tls_status IN ('passed', 'failed', 'not_tested', 'inconclusive')),
    http_status                 INT,
    robots_policy_status        TEXT NOT NULL DEFAULT 'not_tested' CHECK (robots_policy_status IN ('passed', 'failed', 'not_tested', 'inconclusive', 'missing')),
    sitemap_status              TEXT NOT NULL DEFAULT 'not_tested' CHECK (sitemap_status IN ('passed', 'failed', 'not_tested', 'inconclusive', 'missing')),
    canonical_tag               TEXT,
    robots_directives           TEXT,
    schema_types                JSONB NOT NULL DEFAULT '[]'::JSONB,
    is_app_shell                BOOLEAN,
    duplicate_of_hostname       TEXT,
    last_checked_at             TIMESTAMPTZ,
    last_successful_check_at    TIMESTAMPTZ,
    last_crawl_at               TIMESTAMPTZ,
    last_error                  TEXT,
    health_matrix               JSONB NOT NULL DEFAULT '{}'::JSONB,
    notes                       TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reg_domains_brand ON registered_domains(brand_id);
CREATE INDEX IF NOT EXISTS idx_reg_domains_workspace ON registered_domains(workspace_id);
CREATE INDEX IF NOT EXISTS idx_reg_domains_role ON registered_domains(host_role);
CREATE INDEX IF NOT EXISTS idx_reg_domains_state ON registered_domains(verification_state);

COMMENT ON TABLE registered_domains IS
    'Centralized domain registry supporting domain-aware intelligence, bounded crawling, technical SEO, and metadata governance across TalentXcel, CHATR, and Nuty Tales.';

-- ─── SEED INITIAL INVENTORY: ALL 26 AUTHORITATIVE HOSTNAMES ──────────────────

-- TalentXcel (Brand ID: 00000000-0000-0000-0001-000000000002)
-- 13 Listed Hostnames
INSERT INTO registered_domains (
    workspace_id, brand_id, hostname, host_role, intended_canonical_host, canonical_policy_source, expected_redirect_target, expects_redirect, verification_state, indexing_intent, allowed_for_crawling, allowed_for_content_analysis, allowed_for_index_submission, search_console_property_uri, notes
) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002', 'talentxcel.in', 'primary', 'talentxcel.in', 'brand_config', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'sc-domain:talentxcel.in', 'Primary authoritative domain for TalentXcel'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002', 'www.talentxcel.in', 'www_alias', 'talentxcel.in', 'brand_config', 'https://talentxcel.in', TRUE, 'owner_supplied', 'indexable', TRUE, TRUE, FALSE, NULL, 'WWW alias expected to 301 redirect to apex'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002', 'colleges.talentxcel.in', 'product_subdomain', 'colleges.talentxcel.in', 'subdomain_policy', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'https://colleges.talentxcel.in/', 'TalentXcel College partnerships and campus placement portal'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002', 'careers.talentxcel.in', 'product_subdomain', 'careers.talentxcel.in', 'subdomain_policy', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'https://careers.talentxcel.in/', 'TalentXcel Career development and pathways portal'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002', 'salary.talentxcel.in', 'product_subdomain', 'salary.talentxcel.in', 'subdomain_policy', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'https://salary.talentxcel.in/', 'TalentXcel Tech salary benchmarks and compensation index'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002', 'resume.talentxcel.in', 'product_subdomain', 'resume.talentxcel.in', 'subdomain_policy', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'https://resume.talentxcel.in/', 'TalentXcel AI resume builder and CV review tool'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002', 'jobs.talentxcel.in', 'product_subdomain', 'jobs.talentxcel.in', 'subdomain_policy', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'https://jobs.talentxcel.in/', 'TalentXcel Job listings and tech opportunities portal'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002', 'employer.talentxcel.in', 'product_subdomain', 'employer.talentxcel.in', 'subdomain_policy', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, NULL, 'TalentXcel Employer hiring portal (singular)'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002', 'employers.talentxcel.in', 'search_console_property', 'employers.talentxcel.in', 'gsc_property', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'https://employers.talentxcel.in/', 'TalentXcel Employers property in GSC (plural; distinct origin from employer.talentxcel.in)'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002', 'government.talentxcel.in', 'product_subdomain', 'government.talentxcel.in', 'subdomain_policy', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'https://government.talentxcel.in/', 'TalentXcel Public sector and government career initiatives'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002', 'learning.talentxcel.in', 'product_subdomain', 'learning.talentxcel.in', 'subdomain_policy', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'https://learning.talentxcel.in/', 'TalentXcel Technical upskilling and certification portal'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002', 'passport.talentxcel.in', 'product_subdomain', 'passport.talentxcel.in', 'subdomain_policy', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'https://passport.talentxcel.in/', 'TalentXcel Verified skill passport credentialing portal'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002', 'career-pathways-ai-builder.vercel.app', 'deployment_host', 'talentxcel.in', 'deployment_config', 'https://talentxcel.in', FALSE, 'owner_supplied', 'deployment_only', TRUE, FALSE, FALSE, NULL, 'Vercel deployment host; non-canonical application preview')
ON CONFLICT (hostname) DO UPDATE SET
    host_role = EXCLUDED.host_role,
    intended_canonical_host = EXCLUDED.intended_canonical_host,
    canonical_policy_source = EXCLUDED.canonical_policy_source,
    expected_redirect_target = EXCLUDED.expected_redirect_target,
    search_console_property_uri = EXCLUDED.search_console_property_uri,
    notes = EXCLUDED.notes;

-- Explicitly Excluded Legacy References for TalentXcel (Must NOT be crawled as active targets)
INSERT INTO registered_domains (
    workspace_id, brand_id, hostname, host_role, verification_state, indexing_intent, allowed_for_crawling, allowed_for_content_analysis, allowed_for_index_submission, notes
) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002', 'www.talentxcel.net', 'excluded', 'excluded', 'noindex_expected', FALSE, FALSE, FALSE, 'Explicitly excluded legacy reference by owner. Barred from active crawl.'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002', 'auth.talentxcel.in', 'excluded', 'excluded', 'noindex_expected', FALSE, FALSE, FALSE, 'Explicitly excluded authentication origin by owner. Barred from active crawl.'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000002', 'cdn.talentxcel.in', 'excluded', 'excluded', 'noindex_expected', FALSE, FALSE, FALSE, 'Explicitly excluded CDN asset origin by owner. Barred from active crawl.')
ON CONFLICT (hostname) DO UPDATE SET
    host_role = 'excluded',
    verification_state = 'excluded',
    allowed_for_crawling = FALSE;

-- CHATR (Brand ID: 00000000-0000-0000-0001-000000000001)
-- 3 Listed Hostnames
INSERT INTO registered_domains (
    workspace_id, brand_id, hostname, host_role, intended_canonical_host, canonical_policy_source, expected_redirect_target, expects_redirect, verification_state, indexing_intent, allowed_for_crawling, allowed_for_content_analysis, allowed_for_index_submission, notes
) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001', 'chatr.chat', 'primary', 'chatr.chat', 'brand_config', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'Primary modern product and branding domain for CHATR'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001', 'chatrchat.in', 'product_subdomain', 'www.chatrchat.in', 'owner_policy', 'https://www.chatrchat.in', TRUE, 'owner_supplied', 'indexable', TRUE, TRUE, FALSE, 'Secondary regional domain; redirects to www.chatrchat.in in owner config'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000001', 'www.chatrchat.in', 'www_alias', 'www.chatrchat.in', 'owner_policy', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'Historical canonical host configured by owner. Preserved without cross-domain auto-consolidation.')
ON CONFLICT (hostname) DO UPDATE SET
    host_role = EXCLUDED.host_role,
    intended_canonical_host = EXCLUDED.intended_canonical_host,
    canonical_policy_source = EXCLUDED.canonical_policy_source,
    expected_redirect_target = EXCLUDED.expected_redirect_target,
    notes = EXCLUDED.notes;

-- Nuty Tales (Brand ID: 00000000-0000-0000-0001-000000000003)
-- 10 Listed Hostnames
INSERT INTO registered_domains (
    workspace_id, brand_id, hostname, host_role, intended_canonical_host, canonical_policy_source, expected_redirect_target, expects_redirect, verification_state, indexing_intent, allowed_for_crawling, allowed_for_content_analysis, allowed_for_index_submission, notes
) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000003', 'nutytales.com', 'primary', 'nutytales.com', 'brand_config', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'Primary e-commerce marketplace and flagship brand domain'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000003', 'www.nutytales.com', 'www_alias', 'nutytales.com', 'brand_config', 'https://nutytales.com', TRUE, 'owner_supplied', 'indexable', TRUE, TRUE, FALSE, 'WWW alias expected to 301 redirect to apex nutytales.com'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000003', 'business.nutytales.com', 'product_subdomain', 'business.nutytales.com', 'vertical_policy', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'B2B supply, bulk procurement, and corporate snacking vertical'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000003', 'gifting.nutytales.com', 'product_subdomain', 'gifting.nutytales.com', 'vertical_policy', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'Curated festive & corporate luxury gift hampers vertical'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000003', 'weddings.nutytales.com', 'product_subdomain', 'weddings.nutytales.com', 'vertical_policy', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'Wedding favors, bridal hampers, and custom celebrations vertical'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000003', 'crafts.nutytales.com', 'product_subdomain', 'crafts.nutytales.com', 'vertical_policy', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'Handmade artisan crafts, walnut wood carvings & heritage goods'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000003', 'stays.nutytales.com', 'product_subdomain', 'stays.nutytales.com', 'vertical_policy', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'Eco-friendly orchard stays & heritage hospitality experiences'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000003', 'travel.nutytales.com', 'product_subdomain', 'travel.nutytales.com', 'vertical_policy', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'Curated valley travel tours, trail packs & experiential journeys'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000003', 'nri.nutytales.com', 'product_subdomain', 'nri.nutytales.com', 'vertical_policy', NULL, FALSE, 'owner_supplied', 'indexable', TRUE, TRUE, TRUE, 'Worldwide cross-border shipping & international diaspora orders'),
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0001-000000000003', 'nutytales.vercel.app', 'deployment_host', 'nutytales.com', 'deployment_config', 'https://nutytales.com', FALSE, 'owner_supplied', 'deployment_only', TRUE, FALSE, FALSE, 'Vercel staging and production deployment host; non-canonical')
ON CONFLICT (hostname) DO UPDATE SET
    host_role = EXCLUDED.host_role,
    intended_canonical_host = EXCLUDED.intended_canonical_host,
    canonical_policy_source = EXCLUDED.canonical_policy_source,
    expected_redirect_target = EXCLUDED.expected_redirect_target,
    notes = EXCLUDED.notes;
