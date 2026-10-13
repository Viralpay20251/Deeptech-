/**
 * Autonomous Growth OS — Development Seed Script
 *
 * Populates:
 * 1. The single Internal Validation Workspace (is_internal=true, is_commercial=false)
 * 2. Default operators/reviewers with bcrypt-hashed credentials
 * 3. The 3 Proving Ground Brands: CHATR, TalentXcel, Nuty Tales
 *    (All marked is_protected_production=true with distinct configurations)
 * 4. 18 Agent Definitions with versioned contracts and tool scopes
 * 5. Connector Definitions Catalogue
 * 6. Connector Instances (with truthful initial status: awaiting_credentials / connected)
 * 7. Authoritative Metric Definitions for all 3 brands
 *
 * SAFETY: Every row inserted adheres strictly to tenant boundaries.
 * No production data or customer credentials exist in this script.
 */

import bcrypt from 'bcryptjs';
import { query, transaction } from '../../lib/db.js';
import { logger } from '../../lib/logger.js';

export const INTERNAL_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';
export const CHATR_BRAND_ID = '00000000-0000-0000-0001-000000000001';
export const TALENTXCEL_BRAND_ID = '00000000-0000-0000-0001-000000000002';
export const NUTYTALES_BRAND_ID = '00000000-0000-0000-0001-000000000003';

export async function runSeed(): Promise<void> {
  logger.info('Starting Autonomous Growth OS database seeding...');

  await transaction(async (client) => {
    // 1. Internal Workspace
    await client.query(
      `INSERT INTO workspaces (id, slug, display_name, is_internal, is_commercial)
       VALUES ($1, 'internal-proving-ground', 'Autonomous Growth OS — Internal Proving Ground', TRUE, FALSE)
       ON CONFLICT (id) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         is_internal = TRUE,
         is_commercial = FALSE`,
      [INTERNAL_WORKSPACE_ID]
    );

    // 2. Default Operator User
    const passwordHash = await bcrypt.hash('GrowthOS_Admin_2026!Secure', 10);
    await client.query(
      `INSERT INTO users (workspace_id, email, display_name, password_hash, role, mfa_enabled)
       VALUES ($1, 'operator@growth-os.internal', 'Lead Growth Operator', $2, 'workspace_admin', FALSE)
       ON CONFLICT (workspace_id, email) DO UPDATE SET
         role = 'workspace_admin',
         updated_at = NOW()`,
      [INTERNAL_WORKSPACE_ID, passwordHash]
    );

    // 3. Brand Registries (CHATR, TalentXcel, Nuty Tales)
    // CHATR
    const chatrConfig = {
      voice_guidelines: 'Clear, modern, tech-forward, authentic, user-empowering. Focus on practical utility of AI and seamless communication.',
      approved_claim_categories: ['ai_productivity', 'messaging_speed', 'workflow_automation', 'privacy_first_architecture'],
      prohibited_topics: ['unverified_agi_claims', 'fabricated_benchmarks', 'unauthorised_competitor_disparagement', 'unsupported_pricing_discounts'],
      allowed_countries: ['US', 'GB', 'IN', 'CA', 'AU', 'DE', 'SG'],
      allowed_channels: ['organic_search', 'linkedin', 'x_twitter', 'youtube', 'reddit', 'developer_communities'],
      cta_urls: {
        explore: 'https://chatr.ai/explore',
        get_started: 'https://chatr.ai/signup',
        tools: 'https://chatr.ai/tools'
      },
      active_user_event_definition: 'Completed at least one meaningful AI interaction or initiated an active messaging workflow in a rolling 30-day window.',
      max_posts_per_day_per_channel: { linkedin: 2, x_twitter: 4, youtube: 1, reddit: 1 },
      requires_human_approval_before_publish: true,
      legal_review_required_categories: ['data_privacy_guarantees', 'enterprise_sla_claims'],
      escalation_contact: 'lead-growth@chatr.ai'
    };

    await client.query(
      `INSERT INTO brands (id, workspace_id, slug, display_name, base_url, is_protected_production, config)
       VALUES ($1, $2, 'chatr', 'CHATR', 'https://chatr.ai', TRUE, $3)
       ON CONFLICT (id) DO UPDATE SET
         config = EXCLUDED.config,
         is_protected_production = TRUE,
         updated_at = NOW()`,
      [CHATR_BRAND_ID, INTERNAL_WORKSPACE_ID, JSON.stringify(chatrConfig)]
    );

    // TalentXcel
    const talentxcelConfig = {
      voice_guidelines: 'Professional, empowering, pragmatic, actionable, career-focused. Respectful of job seekers and recruitment teams.',
      approved_claim_categories: ['career_guidance', 'resume_optimization', 'interview_preparation', 'job_market_insights'],
      prohibited_topics: ['fabricated_job_listings', 'invented_salary_averages', 'guaranteed_employment_claims', 'discriminatory_targeting'],
      allowed_countries: ['US', 'GB', 'IN', 'CA', 'AE', 'SG'],
      allowed_channels: ['organic_search', 'linkedin', 'youtube', 'career_newsletters', 'reddit_career_hubs'],
      cta_urls: {
        find_jobs: 'https://talentxcel.in/jobs',
        career_tools: 'https://talentxcel.in/tools',
        resume_review: 'https://talentxcel.in/resume-builder'
      },
      active_user_event_definition: 'Performed a verified career action: applied to an active role, completed CV analysis, or engaged with verified talent tools in 30 days.',
      max_posts_per_day_per_channel: { linkedin: 3, youtube: 1, career_newsletters: 1 },
      requires_human_approval_before_publish: true,
      legal_review_required_categories: ['employment_law_guidance', 'recruitment_compliance'],
      escalation_contact: 'operations@talentxcel.in'
    };

    await client.query(
      `INSERT INTO brands (id, workspace_id, slug, display_name, base_url, is_protected_production, config)
       VALUES ($1, $2, 'talentxcel', 'TalentXcel', 'https://talentxcel.in', TRUE, $3)
       ON CONFLICT (id) DO UPDATE SET
         base_url = EXCLUDED.base_url,
         config = EXCLUDED.config,
         is_protected_production = TRUE,
         updated_at = NOW()`,
      [TALENTXCEL_BRAND_ID, INTERNAL_WORKSPACE_ID, JSON.stringify(talentxcelConfig)]
    );

    // Nuty Tales
    const nutytalesConfig = {
      voice_guidelines: 'Warm, artisanal, gastronomic, wholesome, transparent on provenance and quality. Gourmet gifting and nutrient richness.',
      approved_claim_categories: ['origin_traceability', 'grade_specifications', 'culinary_pairings', 'corporate_gifting_services'],
      prohibited_topics: ['medicinal_cure_claims', 'fake_urgency_timers', 'invented_customer_reviews', 'fabricated_certifications'],
      allowed_countries: ['IN', 'AE', 'GB', 'US', 'SG'],
      allowed_channels: ['organic_search', 'instagram', 'meta', 'pinterest', 'corporate_gifting_outreach'],
      cta_urls: {
        shop_catalogue: 'https://nutytales.com/shop',
        gift_hampers: 'https://nutytales.com/gifting',
        corporate_enquiry: 'https://nutytales.com/corporate'
      },
      active_user_event_definition: 'Catalog or recipe engagement. Actual purchasing customers are strictly reported via verified completed transactions.',
      max_posts_per_day_per_channel: { instagram: 2, meta: 2, pinterest: 3 },
      requires_human_approval_before_publish: true,
      legal_review_required_categories: ['food_safety_regulations', 'export_customs_disclosures'],
      escalation_contact: 'gifting@nutytales.com'
    };

    await client.query(
      `INSERT INTO brands (id, workspace_id, slug, display_name, base_url, is_protected_production, config)
       VALUES ($1, $2, 'nuty-tales', 'Nuty Tales', 'https://nutytales.com', TRUE, $3)
       ON CONFLICT (id) DO UPDATE SET
         config = EXCLUDED.config,
         is_protected_production = TRUE,
         updated_at = NOW()`,
      [NUTYTALES_BRAND_ID, INTERNAL_WORKSPACE_ID, JSON.stringify(nutytalesConfig)]
    );

    // 4. 18 Specialist Agent Definitions
    const agents = [
      {
        type: 'market_scout',
        name: 'Market Scout',
        desc: 'Detects audience demand, emerging topics, search trends, and underserved needs.',
        tools: ['web_search', 'sitemap_inspector', 'rss_feed_reader', 'trend_analyser'],
        max_autonomy: 1
      },
      {
        type: 'search_intelligence',
        name: 'Search Intelligence Agent',
        desc: 'Analyses search queries, landing page performance, crawl observations, and SERP gaps.',
        tools: ['gsc_reader', 'bing_wmt_reader', 'robots_canonical_auditor', 'keyword_gap_evaluator'],
        max_autonomy: 1
      },
      {
        type: 'social_listening',
        name: 'Social Listening Agent',
        desc: 'Collects authorised and public social signals, discussions, and community questions.',
        tools: ['social_query_reader', 'community_topic_indexer'],
        max_autonomy: 1
      },
      {
        type: 'source_researcher',
        name: 'Source Researcher',
        desc: 'Retrieves, verifies, and cites source material with freshness tracking and full provenance.',
        tools: ['url_fetcher_sanitised', 'citation_validator', 'fact_archive_reader'],
        max_autonomy: 1
      },
      {
        type: 'audience_classifier',
        name: 'Audience/Intent Classifier',
        desc: 'Maps demand signals to target audience personas, intent types, funnel stages, and brand relevance.',
        tools: ['intent_matrix_evaluator', 'persona_matcher'],
        max_autonomy: 1
      },
      {
        type: 'opportunity_scorer',
        name: 'Opportunity Scorer',
        desc: 'Scores opportunities across 11 transparent dimensions with explainable model rationales.',
        tools: ['scoring_model_v1', 'score_history_comparer'],
        max_autonomy: 1
      },
      {
        type: 'experience_planner',
        name: 'Experience Planner',
        desc: 'Architects useful assets, calculators, guides, topic hubs, and interactive experiences.',
        tools: ['experience_blueprint_generator', 'ux_spec_builder'],
        max_autonomy: 1
      },
      {
        type: 'content_builder',
        name: 'Content/Media Builder',
        desc: 'Drafts helpful, differentiated, source-grounded content tailored to channel and brand voice.',
        tools: ['llm_content_generator', 'markdown_formatter', 'claim_extractor'],
        max_autonomy: 1
      },
      {
        type: 'localisation',
        name: 'Localisation Agent',
        desc: 'Adapts terminology, cultural idioms, units, and currency for target locales without mistranslation.',
        tools: ['locale_dictionary_lookup', 'cultural_nuance_checker'],
        max_autonomy: 1
      },
      {
        type: 'fact_quality_auditor',
        name: 'Fact/Quality Auditor',
        desc: 'Checks factual claims against citations, audits uniqueness, utility, readability, and policy risks.',
        tools: ['uniqueness_checker', 'claim_verification_engine', 'policy_rule_evaluator'],
        max_autonomy: 1
      },
      {
        type: 'distribution_planner',
        name: 'Distribution Planner',
        desc: 'Selects compliant distribution channels, configures UTM parameters, and plans posting windows.',
        tools: ['channel_readiness_checker', 'utm_generator', 'frequency_cap_evaluator'],
        max_autonomy: 1
      },
      {
        type: 'publisher',
        name: 'Publisher Agent',
        desc: 'Executes verified publishing actions strictly after approval event validation.',
        tools: ['os_property_deployer', 'connector_publisher_guarded'],
        max_autonomy: 2
      },
      {
        type: 'partnership_research',
        name: 'Partnership Research Agent',
        desc: 'Finds aligned creators, publications, and co-marketing opportunities with mutual value.',
        tools: ['partner_profile_evaluator', 'outreach_draft_builder'],
        max_autonomy: 1
      },
      {
        type: 'traffic_analyst',
        name: 'Traffic Analyst',
        desc: 'Normalises analytics records, separates verified humans from bots, and computes attribution.',
        tools: ['bot_traffic_classifier', 'attribution_model_evaluator', 'cohort_calculator'],
        max_autonomy: 1
      },
      {
        type: 'experiment',
        name: 'Experiment Agent',
        desc: 'Designs acquisition experiments with hypotheses, sample sizes, stop rules, and guardrails.',
        tools: ['experiment_designer', 'statistical_power_calculator'],
        max_autonomy: 1
      },
      {
        type: 'growth_strategist',
        name: 'Growth Strategist',
        desc: 'Allocates resources based on observed outcome lift, marginal costs, and business proof gates.',
        tools: ['growth_portfolio_allocator', 'proof_gate_evaluator'],
        max_autonomy: 1
      },
      {
        type: 'policy_safety',
        name: 'Policy/Safety Agent',
        desc: 'Enforces privacy, anti-spam, platform policies, claim safety, and change boundaries.',
        tools: ['safety_boundary_validator', 'compliance_checklist_auditor'],
        max_autonomy: 1
      },
      {
        type: 'reliability_cost',
        name: 'Reliability/Cost Agent',
        desc: 'Monitors API latencies, model token budgets, connector quotas, and system health.',
        tools: ['cost_ledger_auditor', 'health_event_monitor', 'quota_guard'],
        max_autonomy: 1
      }
    ];

    for (const agent of agents) {
      await client.query(
        `INSERT INTO agent_definitions (agent_type, display_name, description, prompt_version, permitted_tools, max_autonomy_level)
         VALUES ($1, $2, $3, '1.0.0', $4, $5)
         ON CONFLICT (agent_type) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           description = EXCLUDED.description,
           permitted_tools = EXCLUDED.permitted_tools,
           max_autonomy_level = EXCLUDED.max_autonomy_level,
           updated_at = NOW()`,
        [agent.type, agent.name, agent.desc, agent.tools, agent.max_autonomy]
      );
    }

    // Workflow Definitions Catalogue
    await client.query(
      `INSERT INTO workflow_definitions (id, display_name, description, version, definition_json)
       VALUES (
         'demand_discovery_vertical_slice',
         'Demand Discovery Vertical Slice',
         'End-to-end flow: Ingest Signal -> Cluster -> Score -> Synthesise -> QA Audit -> Approval Queue',
         '1.0.0',
         '{"steps": ["ingest_signal", "score_opportunity", "build_content", "audit_quality", "queue_approval"]}'::jsonb
       )
       ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name`
    );

    // 5. Connector Definitions Catalogue
    const connectorDefs = [
      {
        type: 'sitemap_rss_inspector',
        version: '1.0.0',
        name: 'Public Web & Sitemap Inspector',
        category: 'search_web',
        docs: 'https://www.sitemaps.org/protocol.html',
        caps: ['read_public'],
        auth: 'none',
        scopes: [],
        rate_notes: '1 request per second default; respects robots.txt',
        limitations: ['Public pages only; no login-gated content']
      },
      {
        type: 'google_search_console',
        version: 'v3',
        name: 'Google Search Console API',
        category: 'search_web',
        docs: 'https://developers.google.com/webmaster-tools/v1/searchanalytics/query',
        caps: ['read_analytics', 'read_insights'],
        auth: 'oauth2',
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
        rate_notes: '1,200 QPM per project; URL Inspection API 2,000 QPD',
        limitations: ['16-month data window; anonymised queries omitted by Google']
      },
      {
        type: 'bing_webmaster',
        version: 'v2',
        name: 'Bing Webmaster Tools API',
        category: 'search_web',
        docs: 'https://learn.microsoft.com/en-us/bingwebmaster/getting-started',
        caps: ['read_analytics', 'read_insights'],
        auth: 'api_key',
        scopes: [],
        rate_notes: 'Standard Bing API quotas apply',
        limitations: ['Bing search share volume only']
      },
      {
        type: 'google_analytics_4',
        version: 'v1beta',
        name: 'Google Analytics 4 Data API',
        category: 'analytics',
        docs: 'https://developers.google.com/analytics/devguides/reporting/data/v1',
        caps: ['read_analytics', 'read_insights'],
        auth: 'oauth2',
        scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
        rate_notes: 'Standard Google Analytics Data API token limits per property',
        limitations: ['Data delay of 24-48 hours for standard reporting']
      },
      {
        type: 'linkedin',
        version: 'v2',
        name: 'LinkedIn Marketing & Pages API',
        category: 'social_media',
        docs: 'https://learn.microsoft.com/en-us/linkedin/marketing/',
        caps: ['publish_post', 'schedule_post', 'read_insights'],
        auth: 'oauth2',
        scopes: ['w_member_social', 'r_liteprofile', 'w_organization_social'],
        rate_notes: 'Strict daily rate limits per member / organization',
        limitations: ['Personal profile publishing requires specific user grants; company page needs admin']
      },
      {
        type: 'openai',
        version: 'v1',
        name: 'OpenAI API (Model Gateway)',
        category: 'ai_model',
        docs: 'https://platform.openai.com/docs',
        caps: ['run_inference', 'generate_embedding'],
        auth: 'api_key',
        scopes: [],
        rate_notes: 'Tier-based RPM/TPM limits',
        limitations: ['Cost bounded by MODEL_BUDGET_PER_TASK_USD']
      },
      {
        type: 'anthropic',
        version: 'v1',
        name: 'Anthropic Claude API (Model Gateway)',
        category: 'ai_model',
        docs: 'https://docs.anthropic.com',
        caps: ['run_inference'],
        auth: 'api_key',
        scopes: [],
        rate_notes: 'Tier-based RPM/TPM limits',
        limitations: ['Cost bounded by MODEL_BUDGET_PER_TASK_USD']
      }
    ];

    for (const c of connectorDefs) {
      await client.query(
        `INSERT INTO connector_definitions (type, version, display_name, category, official_api_docs_url, capabilities, auth_method, required_scopes, rate_limit_notes, known_limitations)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (type) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           capabilities = EXCLUDED.capabilities,
           rate_limit_notes = EXCLUDED.rate_limit_notes,
           known_limitations = EXCLUDED.known_limitations,
           updated_at = NOW()`,
        [c.type, c.version, c.name, c.category, c.docs, c.caps, c.auth, c.scopes, c.rate_notes, c.limitations]
      );
    }

    // 6. Connector Instances (Honest initial statuses)
    // The Sitemap & Web Inspector is ready out-of-the-box
    await client.query(
      `INSERT INTO connector_instances (workspace_id, connector_type, status, granted_capabilities, notes)
       VALUES ($1, 'sitemap_rss_inspector', 'connected', ARRAY['read_public'], 'Active public web crawler with robots.txt parser and rate limiter')
       ON CONFLICT DO NOTHING`,
      [INTERNAL_WORKSPACE_ID]
    );

    // GSC connector awaiting OAuth credentials
    await client.query(
      `INSERT INTO connector_instances (workspace_id, connector_type, status, granted_capabilities, notes)
       VALUES ($1, 'google_search_console', 'awaiting_credentials', ARRAY['read_analytics', 'read_insights'], 'Connector implemented. Pending OAuth client ID & secret in environment')
       ON CONFLICT DO NOTHING`,
      [INTERNAL_WORKSPACE_ID]
    );

    // 7. Authoritative Metric Definitions for the 3 Brands
    const metrics = [
      {
        brandId: CHATR_BRAND_ID,
        key: 'monthly_active_user',
        name: 'CHATR Monthly Active User (MAU)',
        def: 'A unique user who executed at least one qualifying AI workflow or sent/received messages in a verified session within a rolling 30-day window.',
        event: 'chatr.user.meaningful_interaction'
      },
      {
        brandId: TALENTXCEL_BRAND_ID,
        key: 'monthly_active_user',
        name: 'TalentXcel Monthly Active User (MAU)',
        def: 'A unique user who performed a verified career action: job application, tailored resume export, or verified career advisory tool interaction.',
        event: 'talentxcel.career.verified_action'
      },
      {
        brandId: NUTYTALES_BRAND_ID,
        key: 'monthly_active_audience',
        name: 'Nuty Tales Monthly Active Audience',
        def: 'Engaged visitor with catalogue or recipe hub exploration across >= 2 product views or saved gift collections.',
        event: 'nutytales.catalogue.engaged_view'
      },
      {
        brandId: NUTYTALES_BRAND_ID,
        key: 'monthly_purchasing_customer',
        name: 'Nuty Tales Monthly Purchasing Customer',
        def: 'Distinct customer with a completed, paid, non-refunded purchase order in the 30-day window. Kept strictly separate from visitors.',
        event: 'nutytales.order.paid_completed'
      }
    ];

    for (const m of metrics) {
      await client.query(
        `INSERT INTO metric_definitions (workspace_id, brand_id, metric_key, display_name, definition_markdown, qualifying_event_name)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (brand_id, metric_key, calculation_version) DO NOTHING`,
        [INTERNAL_WORKSPACE_ID, m.brandId, m.key, m.name, m.def, m.event]
      );
    }
  });

  logger.info('Database seeding completed successfully. 3 brands registered with strict safety boundaries.');
}

// Allow direct CLI execution: node --loader tsx dev-seed.ts
if (process.argv[1]?.endsWith('dev-seed.ts')) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, 'Seed execution failed');
      process.exit(1);
    });
}
