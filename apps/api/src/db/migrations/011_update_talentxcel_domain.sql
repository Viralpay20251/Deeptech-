-- ============================================================
-- Migration: 011_update_talentxcel_domain.sql
-- Description: Update TalentXcel official domain to https://talentxcel.in
-- ============================================================

UPDATE brands
SET base_url = 'https://talentxcel.in',
    updated_at = NOW()
WHERE slug = 'talentxcel';

UPDATE brands
SET config = jsonb_set(
    config,
    '{target_conversion_paths,find_jobs}',
    '"https://talentxcel.in/jobs"'
)
WHERE slug = 'talentxcel' AND config ? 'target_conversion_paths';
