/**
 * Meta Tags Studio V3 Comprehensive Unit Tests
 *
 * Verifies:
 * 1. URL validation rejects malformed URLs, embedded credentials, and unsafe protocols.
 * 2. Zero-invention policy: datePublished/dateModified are never invented.
 * 3. Zero-invention policy: product prices, currency, and availability are never invented.
 * 4. Multi-variant candidate title and description generation with pixel width estimates.
 * 5. Safe HTML entity escaping and script breakout prevention in JSON-LD.
 * 6. Metadata health report diagnostics and explainable scoring.
 * 7. Simulated previews explicitly indicate simulation and do not claim external verification.
 */

import { describe, it, expect } from 'vitest';
import { MetaStudioService, type MetaStudioGenerateInput } from '../../apps/api/src/services/meta-studio-service.js';

describe('Meta Tags Studio V3: Accuracy, Truthfulness, & Governance', () => {
  const baseInput: MetaStudioGenerateInput = {
    workspaceId: '00000000-0000-0000-0000-000000000001',
    brandName: 'CHATR',
    brandDomain: 'https://chatr.chat',
    pageUrl: 'https://chatr.chat/video-tools',
    pageTitle: 'Autonomous Video Messaging & Engagement Tools 2026',
    pageDescription: 'Enterprise-grade interactive video messaging with automated conversational engagement.',
    targetKeyword: 'video messaging tools',
    schemaType: 'Article',
  };

  it('rejects URLs with embedded credentials and invalid protocols', () => {
    const credUrl = MetaStudioService.validateAndNormalizeUrl('https://admin:secret@chatr.chat/path');
    expect(credUrl.isValid).toBe(false);
    expect(credUrl.error).toContain('embedded credentials');

    const fileUrl = MetaStudioService.validateAndNormalizeUrl('file:///etc/passwd');
    expect(fileUrl.isValid).toBe(false);
    expect(fileUrl.error).toContain('Only HTTP and HTTPS are allowed');

    const malformed = MetaStudioService.validateAndNormalizeUrl('not-a-valid-url');
    expect(malformed.isValid).toBe(false);
  });

  it('enforces brand domain allowlist', () => {
    const resValid = MetaStudioService.validateAndNormalizeUrl('https://chatr.chat/features', ['chatr.chat']);
    expect(resValid.isValid).toBe(true);

    const resForeign = MetaStudioService.validateAndNormalizeUrl('https://malicious-site.com/phish', ['chatr.chat']);
    expect(resForeign.isValid).toBe(false);
    expect(resForeign.error).toContain('outside the authorized brand domains');
  });

  it('never invents datePublished or dateModified timestamps when not provided', () => {
    const result = MetaStudioService.generate(baseInput);
    const jsonLd = result.jsonLd as any;

    expect(jsonLd.datePublished).toBeUndefined();
    expect(jsonLd.dateModified).toBeUndefined();
    expect(result.omittedFields.some((f) => f.includes('datePublished'))).toBe(true);
  });

  it('includes datePublished only when explicitly extracted or provided', () => {
    const result = MetaStudioService.generate({
      ...baseInput,
      datePublished: '2026-03-15T10:00:00Z',
    });
    const jsonLd = result.jsonLd as any;
    expect(jsonLd.datePublished).toBe('2026-03-15T10:00:00Z');
  });

  it('never invents product prices, offers, or availability for Product schema', () => {
    const result = MetaStudioService.generate({
      ...baseInput,
      schemaType: 'Product',
    });
    const jsonLd = result.jsonLd as any;
    expect(jsonLd['@type']).toBe('Product');
    expect(jsonLd.offers).toBeUndefined();
    expect(result.omittedFields.some((f) => f.includes('offers/price'))).toBe(true);
  });

  it('generates 3 candidate title variants with pixel width estimations', () => {
    const result = MetaStudioService.generate(baseInput);
    expect(result.titleCandidates.length).toBe(3);

    const variants = result.titleCandidates.map((c) => c.variant);
    expect(variants).toContain('descriptive');
    expect(variants).toContain('benefit_led');
    expect(variants).toContain('brand_concise');

    for (const c of result.titleCandidates) {
      expect(c.charCount).toBeGreaterThan(0);
      expect(c.estimatedPixelWidth).toBeGreaterThan(0);
      expect(typeof c.fitsDesktopSnippet).toBe('boolean');
    }
  });

  it('escapes HTML attributes and prevents </script> breakout injection', () => {
    const injectionInput: MetaStudioGenerateInput = {
      ...baseInput,
      pageTitle: '"><script>alert(1)</script>',
      pageDescription: 'Description with "quotes" & ampersands and </script> tags',
    };
    const result = MetaStudioService.generate(injectionInput);

    expect(result.htmlSnippet).not.toContain('<script>alert(1)</script>');
    expect(result.htmlSnippet).toContain('&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(result.htmlSnippet).not.toContain('</script> tags'); // Escaped as <\/script>
  });

  it('evaluates metadata health report with categorized diagnostic findings', () => {
    const report = MetaStudioService.validateMetadata({
      title: 'Tools', // too short, pixel underflow
      metaDesc: null, // missing description
      canonical: 'https://chatr.chat/video-tools',
      pageUrl: 'https://chatr.chat/video-tools',
      h1: 'Autonomous Video Messaging Tools',
      imageUrl: null, // missing share image
    });

    expect(report.overallScore).toBeLessThan(100);
    expect(report.findings.some((f) => f.ruleId === 'COMP_DESC_MISSING')).toBe(true);
    expect(report.findings.some((f) => f.ruleId === 'SOCIAL_IMAGE_MISSING')).toBe(true);
  });

  it('simulated previews are explicitly labeled with truthful notice', () => {
    const result = MetaStudioService.generate(baseInput);
    expect(result.notice).toContain('Draft generated from operator inputs');
    expect(result.evidenceState).toBe('input_only');
    expect(result.simulatedPreviews.googleSerp).toBeDefined();
    expect(result.simulatedPreviews.twitterLarge.cardType).toBe('summary_large_image');
    expect(result.twitterCard['twitter:card']).toBe('summary');
  });

  it('P1: validates schema grounding against observed page facts and catches ungrounded claims', () => {
    // 1. Catches synthetic temporal fabrication
    const nowIso = new Date().toISOString();
    const groundingReport1 = MetaStudioService.validateSchemaGrounding(
      {
        title: 'Autonomous Messaging',
        canonical: 'https://chatr.chat/video-tools',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: 'Autonomous Messaging',
          datePublished: nowIso, // Synthetic timestamp matching now!
        },
      },
      {
        title: 'Autonomous Messaging',
        canonicalUrl: 'https://chatr.chat/video-tools',
        datePublished: null, // Not on page
      }
    );

    expect(groundingReport1.isGrounded).toBe(false);
    expect(groundingReport1.status).toBe('violation');
    expect(groundingReport1.violations.some((v) => v.groundingRule === 'TEMPORAL_FABRICATION')).toBe(true);

    // 2. Catches ungrounded commercial offers in Product schema
    const groundingReport2 = MetaStudioService.validateSchemaGrounding(
      {
        title: 'CHATR Enterprise Plan',
        canonical: 'https://chatr.chat/pricing',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'CHATR Enterprise Plan',
          offers: {
            '@type': 'Offer',
            price: '499.00',
            priceCurrency: 'USD',
          },
        },
      },
      {
        title: 'CHATR Enterprise Plan',
        canonicalUrl: 'https://chatr.chat/pricing',
        offers: null,
        productPrice: null,
      }
    );

    expect(groundingReport2.isGrounded).toBe(false);
    expect(groundingReport2.status).toBe('violation');
    expect(groundingReport2.violations.some((v) => v.groundingRule === 'COMMERCIAL_OFFER_FABRICATION')).toBe(true);

    // 3. Catches canonical mismatch
    const groundingReport3 = MetaStudioService.validateSchemaGrounding(
      {
        title: 'Page Title',
        canonical: 'https://chatr.chat/alternate-url',
      },
      {
        title: 'Page Title',
        canonicalUrl: 'https://chatr.chat/original-url',
      }
    );

    expect(groundingReport3.isGrounded).toBe(false);
    expect(groundingReport3.violations.some((v) => v.groundingRule === 'CANONICAL_MISMATCH')).toBe(true);
  });

  it('P2: external validation distinguishes local vs external verification', async () => {
    const validJsonLd = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'CHATR',
      url: 'https://chatr.chat',
    });

    const result = await MetaStudioService.runExternalValidation(validJsonLd, 'schema');
    expect(result.conformanceValid).toBe(true);
    expect(result.validatorSource).toBe('local_strict_conformance');
    expect(result.externallyVerified).toBe(false);
    expect(result.validatorNotice).toContain('local');
  });
});
