-- Migration 014: Expand connector definitions catalogue across Waves 1, 2, and 3
-- Implements P4 Specification for integration capability registry.

INSERT INTO connector_definitions (
    type, version, display_name, category, official_api_docs_url,
    capabilities, auth_method, required_scopes, rate_limit_notes, known_limitations
) VALUES
-- ─── Wave 1: Search, Performance & Indexation Diagnostics ───────────────────
(
    'indexnow',
    'v1.0',
    'IndexNow Protocol',
    'search_web',
    'https://www.indexnow.org/documentation',
    ARRAY['publish_post'],
    'api_key',
    ARRAY[]::text[],
    'Up to 10,000 URLs per key per day submitted in batches',
    ARRAY['Supported by Bing, Yandex, Seznam; Google uses Indexing API instead']
),
(
    'pagespeed_crux',
    'v5',
    'Google PageSpeed Insights & CrUX',
    'analytics',
    'https://developers.google.com/speed/docs/insights/v5/get-started',
    ARRAY['read_analytics', 'read_insights'],
    'api_key',
    ARRAY[]::text[],
    '25,000 queries per day without billing; 240 QPM',
    ARRAY['CrUX data requires sufficient 28-day real-user traffic volume for origin data']
),
(
    'w3c_nu_checker',
    'v1',
    'W3C Nu HTML/CSS Checker',
    'search_web',
    'https://validator.w3.org/nu/about.html',
    ARRAY['read_insights'],
    'none',
    ARRAY[]::text[],
    'Fair-use rate limits on public instance; recommend local container for bulk validation',
    ARRAY['Checks HTML5 conformance only; not a ranking factor by itself']
),
(
    'brave_search',
    'v1',
    'Brave Search API',
    'search_web',
    'https://brave.com/search/api/',
    ARRAY['read_public', 'read_insights'],
    'api_key',
    ARRAY[]::text[],
    'Tiered quotas; Free tier 2,000 queries/month, 1 QPS',
    ARRAY['Independent web index with distinct rank ordering from Google/Bing']
),

-- ─── Wave 2: Open Web Intelligence & Academic / Public Research ─────────────
(
    'common_crawl',
    'v1',
    'Common Crawl Index & CDX',
    'search_web',
    'https://commoncrawl.org/the-data/get-started/',
    ARRAY['read_public', 'read_insights'],
    'none',
    ARRAY[]::text[],
    'Free public datasets hosted on AWS Open Data; rate limits apply to CDX server',
    ARRAY['Crawl archives are historical (monthly snapshots); not live real-time index']
),
(
    'internet_archive_wayback',
    'v1',
    'Internet Archive Wayback CDX API',
    'search_web',
    'https://archive.org/help/wayback_api.php',
    ARRAY['read_public', 'read_insights'],
    'none',
    ARRAY[]::text[],
    'Standard polite rate limits (1 req/sec); strict backoff on 429/503',
    ARRAY['Historical web snapshots; subject to exclusion directives']
),
(
    'crossref_openalex',
    'v1',
    'Crossref & OpenAlex Scholarly API',
    'search_web',
    'https://api.crossref.org/swagger-ui/index.html',
    ARRAY['read_public', 'read_insights'],
    'none',
    ARRAY[]::text[],
    'Polite pool requires mailto header in User-Agent; OpenAlex up to 10 req/sec',
    ARRAY['Peer-reviewed academic research only; metadata coverage varies by publisher']
),
(
    'wikipedia_wikidata',
    'v1',
    'Wikipedia & Wikidata API',
    'search_web',
    'https://www.mediawiki.org/wiki/API:Main_page',
    ARRAY['read_public', 'read_insights'],
    'none',
    ARRAY[]::text[],
    '200 req/sec maximum with descriptive User-Agent',
    ARRAY['Neutral point of view and non-promotional content policies apply strictly']
),
(
    'github_developer',
    'v3',
    'GitHub REST & GraphQL API',
    'search_web',
    'https://docs.github.com/en/rest',
    ARRAY['read_public', 'read_insights'],
    'api_key',
    ARRAY[]::text[],
    '5,000 requests per hour with Personal Access Token (PAT)',
    ARRAY['Code and repository intelligence only']
),

-- ─── Wave 3: Social & Community Channels ────────────────────────────────────
(
    'youtube_data',
    'v3',
    'YouTube Data API v3',
    'social_media',
    'https://developers.google.com/youtube/v3',
    ARRAY['read_analytics', 'read_insights'],
    'oauth2',
    ARRAY['https://www.googleapis.com/auth/youtube.readonly'],
    '10,000 units per day default quota',
    ARRAY['Video upload requires audit approval; read operations consume 1-100 units each']
),
(
    'x_twitter',
    'v2',
    'X (Twitter) API v2',
    'social_media',
    'https://developer.x.com/en/docs/x-api',
    ARRAY['publish_post', 'read_insights'],
    'oauth2',
    ARRAY['tweet.read', 'tweet.write', 'users.read'],
    'Free tier allows 1,500 posts/month; Basic tier ($100/mo) allows 3,000 posts/mo',
    ARRAY['Tiered API pricing; free tier does not support search endpoints']
),
(
    'reddit_data',
    'v1',
    'Reddit Data API',
    'social_media',
    'https://www.reddit.com/dev/api/',
    ARRAY['read_insights', 'publish_post'],
    'oauth2',
    ARRAY['identity', 'read', 'submit'],
    '60-100 requests per minute with OAuth',
    ARRAY['Strict non-commercial licensing and anti-spam moderation rules on subreddits']
)
ON CONFLICT (type) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    category = EXCLUDED.category,
    capabilities = EXCLUDED.capabilities,
    auth_method = EXCLUDED.auth_method,
    rate_limit_notes = EXCLUDED.rate_limit_notes,
    known_limitations = EXCLUDED.known_limitations,
    updated_at = NOW();

-- Ensure all new connector instances exist for the internal workspace
INSERT INTO connector_instances (workspace_id, connector_type, status, granted_capabilities, notes)
SELECT
    '00000000-0000-0000-0000-000000000001'::uuid,
    cd.type,
    CASE WHEN cd.auth_method = 'none' THEN 'connected' ELSE 'awaiting_credentials' END,
    cd.capabilities,
    CASE WHEN cd.auth_method = 'none' THEN 'Operational out of the box (public open access)' ELSE 'Awaiting API key or OAuth authorization' END
FROM connector_definitions cd
WHERE cd.type IN (
    'indexnow', 'pagespeed_crux', 'w3c_nu_checker', 'brave_search',
    'common_crawl', 'internet_archive_wayback', 'crossref_openalex',
    'wikipedia_wikidata', 'github_developer', 'youtube_data', 'x_twitter', 'reddit_data'
)
ON CONFLICT DO NOTHING;
