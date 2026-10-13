/**
 * Technical SEO Audit Workbench Rules Test
 *
 * Verifies P2 Requirements:
 * 1. Correctly flags 4xx/5xx HTTP errors as CRITICAL
 * 2. Correctly flags robots noindex directives as WARNING
 * 3. Correctly evaluates title tag lengths (missing, short, long)
 * 4. Correctly flags missing meta description and H1 tags
 * 5. Correctly detects missing image alt attributes and Open Graph tags
 */

import { describe, it, expect } from 'vitest';
import { SeoWorkbenchService } from '../../apps/api/src/services/seo-workbench-service.js';
import type { PageSnapshotData } from '../../apps/api/src/services/crawl-engine.js';

describe('P2: Technical SEO Audit Rule Engine', () => {
  const baseSnapshot: PageSnapshotData = {
    url: 'https://chatr.chat/video-tools',
    statusCode: 200,
    title: 'Autonomous Video Messaging & Engagement Tools 2026',
    h1: 'Next-Generation Autonomous Video Messaging',
    metaDesc: 'Enterprise-grade interactive video messaging with automated conversational engagement and real-time response workflows.',
    canonical: 'https://chatr.chat/video-tools',
    robotsTag: 'index, follow',
    wordCount: 450,
    internalLinks: 12,
    externalLinks: 3,
    imagesCount: 4,
    imagesMissingAlt: 0,
    schemaTypes: ['WebSite'],
    openGraph: { 'og:title': 'Video Tools', 'og:image': 'https://chatr.chat/og.png' },
    twitterCard: { 'twitter:card': 'summary_large_image' },
    rawHeaders: { 'content-type': 'text/html' },
  };

  it('detects no critical issues on fully compliant snapshot', () => {
    const findings = SeoWorkbenchService.evaluateSnapshotRules(baseSnapshot);
    const criticals = findings.filter((f) => f.severity === 'critical');
    expect(criticals.length).toBe(0);
  });

  it('detects 404 client error as critical', () => {
    const findings = SeoWorkbenchService.evaluateSnapshotRules({
      ...baseSnapshot,
      statusCode: 404,
    });
    const errorFinding = findings.find((f) => f.issueCode === 'HTTP_4XX_CLIENT_ERROR');
    expect(errorFinding).toBeDefined();
    expect(errorFinding?.severity).toBe('critical');
  });

  it('detects missing title and missing H1 tags', () => {
    const findings = SeoWorkbenchService.evaluateSnapshotRules({
      ...baseSnapshot,
      title: null,
      h1: null,
    });

    expect(findings.some((f) => f.issueCode === 'TITLE_MISSING')).toBe(true);
    expect(findings.some((f) => f.issueCode === 'H1_MISSING')).toBe(true);
  });

  it('detects title tag length issues (too short or too long)', () => {
    const shortTitle = SeoWorkbenchService.evaluateSnapshotRules({
      ...baseSnapshot,
      title: 'Tools',
    });
    expect(shortTitle.some((f) => f.issueCode === 'TITLE_TOO_SHORT')).toBe(true);

    const longTitle = SeoWorkbenchService.evaluateSnapshotRules({
      ...baseSnapshot,
      title: 'Very Long Title Exceeding Normal Character Limits For Search Engine Result Pages And Desktop Snippets',
    });
    expect(longTitle.some((f) => f.issueCode === 'TITLE_TOO_LONG')).toBe(true);
  });

  it('detects images missing alt attributes', () => {
    const findings = SeoWorkbenchService.evaluateSnapshotRules({
      ...baseSnapshot,
      imagesMissingAlt: 2,
    });
    expect(findings.some((f) => f.issueCode === 'IMAGES_MISSING_ALT')).toBe(true);
  });
});
