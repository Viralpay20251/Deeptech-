-- ============================================================
-- Migration: 009_register_meta_and_channel_connectors.sql
-- Description: Register Meta (Instagram/Facebook Pages) connector definition
--              and ensure default connector definitions and instances exist.
-- ============================================================

INSERT INTO connector_definitions (
    type, version, display_name, category, official_api_docs_url,
    capabilities, auth_method, required_scopes, rate_limit_notes, known_limitations
)
VALUES (
    'meta',
    'v19.0',
    'Meta (Instagram / Facebook)',
    'social_media',
    'https://developers.facebook.com/docs/graph-api',
    ARRAY['publish_post', 'read_insights'],
    'oauth2',
    ARRAY['pages_manage_posts', 'instagram_basic', 'pages_read_engagement'],
    'Standard Graph API rate limits (200 calls/hr/user)',
    ARRAY['Requires business verification for production usage']
)
ON CONFLICT (type) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    capabilities = EXCLUDED.capabilities,
    rate_limit_notes = EXCLUDED.rate_limit_notes;

-- Ensure all standard connector instances exist for the internal workspace
INSERT INTO connector_instances (workspace_id, connector_type, status, granted_capabilities, notes)
SELECT
    '00000000-0000-0000-0000-000000000001'::uuid,
    cd.type,
    CASE WHEN cd.auth_method = 'none' THEN 'connected' ELSE 'awaiting_credentials' END,
    cd.capabilities,
    CASE WHEN cd.auth_method = 'none' THEN 'Active out of the box' ELSE 'Awaiting direct login or OAuth connection' END
FROM connector_definitions cd
WHERE cd.type IN ('sitemap_rss_inspector', 'google_search_console', 'google_analytics_4', 'linkedin', 'meta', 'openai')
  AND NOT EXISTS (
      SELECT 1 FROM connector_instances ci
      WHERE ci.workspace_id = '00000000-0000-0000-0000-000000000001'::uuid
        AND ci.connector_type = cd.type
  );
