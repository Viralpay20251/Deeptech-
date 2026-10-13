/**
 * Unit Test: Independent Public Publishing Surface & Safety Verification
 */

import { describe, it, expect } from 'vitest';
import { PublishingService } from '../../apps/api/src/services/publishing-service.js';
import { SafetyViolationError } from '../../apps/api/src/lib/safety.js';

describe('PublishingService: Domain Safety & Approval Gates', () => {
  it('strictly rejects unapproved assets', async () => {
    await expect(
      PublishingService.publishPage({
        workspaceId: '00000000-0000-0000-0000-000000000001',
        brandId: '00000000-0000-0000-0001-000000000001',
        approvalEventId: '', // Missing approval event
        slug: 'test-unapproved-slug',
        title: 'Unapproved Article',
        metaDescription: 'Description',
        htmlContent: '<p>Content</p>',
      })
    ).rejects.toThrow(SafetyViolationError);
  });

  it('generates compliant robots.txt with sitemap reference', () => {
    const robots = PublishingService.generateRobotsTxt();
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /p/');
    expect(robots).toContain('Allow: /sitemap.xml');
    expect(robots).toContain('Disallow: /api/');
    expect(robots).toContain('Sitemap:');
    expect(robots).not.toContain('.internal');
  });

  it('renders semantic HTML with JSON-LD schema, canonical url and CTA button', () => {
    const dummyPage = {
      id: '00000000-0000-0000-0000-000000000001',
      workspace_id: '00000000-0000-0000-0000-000000000001',
      brand_id: '00000000-0000-0000-0001-000000000001',
      asset_id: '00000000-0000-0000-0000-000000000001',
      approval_event_id: '00000000-0000-0000-0000-000000000001',
      slug: 'video-commerce-guide',
      title: 'Guide to Video Commerce',
      meta_description: 'An authoritative technical guide',
      canonical_url: 'https://deeptech-taupe.vercel.app/p/video-commerce-guide',
      schema_type: 'Article',
      html_content: '<p>Body paragraph</p>',
      cta_tracked_code: 'chatr-v1',
      cta_label: 'Explore CHATR',
      page_views: 42,
      is_indexed: true,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const html = PublishingService.renderHtmlDocument(dummyPage);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Guide to Video Commerce');
    expect(html).toContain('An authoritative technical guide');
    expect(html).toContain('https://deeptech-taupe.vercel.app/p/video-commerce-guide');
    expect(html).toContain('"@type":"Article"');
    expect(html).toContain('/r/chatr-v1');
    expect(html).toContain('Explore CHATR');
  });
});
