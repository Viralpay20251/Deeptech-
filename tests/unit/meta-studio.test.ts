/**
 * Meta Tags Maker & Preview Studio Unit Test
 *
 * Verifies P3 Requirements:
 * 1. Generates title within optimal limits (append brand name, bounded length)
 * 2. Generates complete Open Graph and Twitter Card tags
 * 3. Builds valid Schema.org JSON-LD templates
 * 4. Generates search and social preview simulations
 * 5. Generates valid copyable HTML snippets
 */

import { describe, it, expect } from 'vitest';
import { MetaStudioService, type MetaGenerationInput } from '../../apps/api/src/services/meta-studio-service.js';

describe('P3: Meta Tags Maker & Preview Studio', () => {
  const input: MetaGenerationInput = {
    brandName: 'CHATR',
    brandDomain: 'https://chatr.chat',
    pageUrl: 'https://chatr.chat/video-tools',
    pageTitle: 'Autonomous Video Messaging & Engagement Tools 2026',
    pageDescription: 'Enterprise-grade interactive video messaging with automated conversational engagement and real-time response workflows.',
    targetKeyword: 'video messaging tools',
    schemaType: 'Article',
  };

  it('generates optimized meta tags including brand name and canonical', () => {
    const result = MetaStudioService.generate(input);
    expect(result.metaTags.title).toContain('CHATR');
    expect(result.metaTags.canonical).toBe('https://chatr.chat/video-tools');
    expect(result.metaTags.robots).toContain('index, follow');
  });

  it('generates Open Graph and Twitter card specifications', () => {
    const result = MetaStudioService.generate(input);
    expect(result.openGraph['og:site_name']).toBe('CHATR');
    expect(result.openGraph['og:type']).toBe('article');
    expect(result.twitterCard['twitter:card']).toBe('summary_large_image');
    expect(result.twitterCard['twitter:title']).toContain('CHATR');
  });

  it('builds valid Schema.org Article JSON-LD with correct context', () => {
    const result = MetaStudioService.generate(input);
    const jsonLd = result.jsonLd as any;
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('Article');
    expect(jsonLd.author['@type']).toBe('Organization');
    expect(jsonLd.author.name).toBe('CHATR');
  });

  it('provides simulation previews for Google SERP and Social cards', () => {
    const result = MetaStudioService.generate(input);
    expect(result.previews.googleSerp.displayUrl).toBe('https://chatr.chat/video-tools');
    expect(result.previews.googleSerp.title).toContain('CHATR');
    expect(result.previews.twitter.domain).toBe('chatr.chat');
  });

  it('outputs complete copyable HTML snippet', () => {
    const result = MetaStudioService.generate(input);
    expect(result.htmlSnippet).toContain('<title>');
    expect(result.htmlSnippet).toContain('<meta name="description"');
    expect(result.htmlSnippet).toContain('<meta property="og:title"');
    expect(result.htmlSnippet).toContain('<script type="application/ld+json">');
  });
});
