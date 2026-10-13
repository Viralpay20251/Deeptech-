-- ============================================================
-- Migration: 012_update_chatr_and_brand_domains.sql
-- Description: Update CHATR official domains to chatr.chat (primary)
--              and chatrchat.in (secondary); sanitize tracked links
--              and historical citations to eliminate 404s and placeholder domains.
-- ============================================================

-- 1. Update CHATR Brand Record
UPDATE brands
SET 
  base_url = 'https://chatr.chat',
  config = jsonb_set(
    jsonb_set(
      jsonb_set(
        config,
        '{secondary_domains}',
        '["https://chatrchat.in"]'::jsonb
      ),
      '{cta_urls}',
      '{"explore": "https://chatr.chat", "get_started": "https://chatr.chat", "tools": "https://chatr.chat/product", "features": "https://chatr.chat/features"}'::jsonb
    ),
    '{escalation_contact}',
    '"lead-growth@chatr.chat"'::jsonb
  ),
  updated_at = NOW()
WHERE slug = 'chatr';

-- 2. Update TalentXcel Brand Config
UPDATE brands
SET 
  base_url = 'https://talentxcel.in',
  config = jsonb_set(
    jsonb_set(
      config,
      '{cta_urls}',
      '{"find_jobs": "https://talentxcel.in/jobs", "career_tools": "https://talentxcel.in", "resume_review": "https://talentxcel.in"}'::jsonb
    ),
    '{escalation_contact}',
    '"operations@talentxcel.in"'::jsonb
  ),
  updated_at = NOW()
WHERE slug = 'talentxcel';

-- 3. Update Nuty Tales Brand Config
UPDATE brands
SET 
  base_url = 'https://nutytales.com',
  config = jsonb_set(
    config,
    '{cta_urls}',
    '{"shop_catalogue": "https://nutytales.com/shop", "gift_hampers": "https://nutytales.com/gifting", "corporate_enquiry": "https://nutytales.com"}'::jsonb
  ),
  updated_at = NOW()
WHERE slug = 'nuty-tales';

-- 4. Sanitize Existing Tracked Links (outbound redirects)
UPDATE tracked_links
SET target_url = 'https://chatr.chat'
WHERE target_url LIKE '%chatr.ai%';

UPDATE tracked_links
SET target_url = 'https://talentxcel.in'
WHERE target_url LIKE '%talentxcel.com%';

UPDATE tracked_links
SET target_url = 'https://nutytales.com/shop'
WHERE target_url LIKE '%nutytales.com/stories%' OR target_url LIKE '%nutytales.com/gastronomy-journal%';

-- 5. Sanitize Historical Content Assets Citations and Body
UPDATE content_assets
SET 
  citation_urls = array_replace(citation_urls, 'https://chatr.ai/product/interactive-video', 'https://chatr.chat'),
  body_markdown = REPLACE(body_markdown, 'https://chatr.ai', 'https://chatr.chat')
WHERE body_markdown LIKE '%chatr.ai%' OR 'https://chatr.ai/product/interactive-video' = ANY(citation_urls);

UPDATE content_assets
SET 
  citation_urls = array_replace(citation_urls, 'https://standards.org/reference', 'https://chatr.chat'),
  body_markdown = REPLACE(body_markdown, 'https://standards.org/reference', 'https://chatr.chat')
WHERE body_markdown LIKE '%standards.org%' OR 'https://standards.org/reference' = ANY(citation_urls);

UPDATE content_assets
SET 
  citation_urls = array_replace(
    array_replace(citation_urls, 'https://talentxcel.com/career-insights', 'https://talentxcel.in'),
    'https://talentxcel.in/career-insights',
    'https://talentxcel.in'
  ),
  body_markdown = REPLACE(body_markdown, 'https://talentxcel.com', 'https://talentxcel.in')
WHERE body_markdown LIKE '%talentxcel.com%' 
   OR 'https://talentxcel.com/career-insights' = ANY(citation_urls)
   OR 'https://talentxcel.in/career-insights' = ANY(citation_urls);

UPDATE content_assets
SET 
  citation_urls = array_replace(citation_urls, 'https://nutytales.com/gastronomy-journal', 'https://nutytales.com'),
  body_markdown = REPLACE(body_markdown, 'https://nutytales.com/gastronomy-journal', 'https://nutytales.com')
WHERE body_markdown LIKE '%gastronomy-journal%' OR 'https://nutytales.com/gastronomy-journal' = ANY(citation_urls);
