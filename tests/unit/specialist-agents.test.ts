import { describe, it, expect } from 'vitest';
import {
  AntiWordsFilter,
  SearchIntelligenceAgent,
  SocialDistributionAgent,
  CHANNEL_CONSTRAINTS,
  type GscQueryRecord,
} from '../../apps/api/src/agents/index.js';

describe('Specialist Agent Architecture & Comparative Spike Tests', () => {
  describe('AntiWordsFilter (Anti-Slop Verification)', () => {
    it('detects overused AI phrases and penalizes cleanliness score', () => {
      const slopText =
        'In today\'s fast-paced world, we delve into a revolutionary tapestry of features that serve as a testament to our game-changer platform.';
      const result = AntiWordsFilter.check(slopText);

      expect(result.hasBannedWords).toBe(true);
      expect(result.bannedWordsFound.length).toBeGreaterThanOrEqual(4);
      expect(result.bannedWordsFound).toContain('delve');
      expect(result.bannedWordsFound).toContain('tapestry');
      expect(result.bannedWordsFound).toContain('game-changer');
      expect(result.cleanlinessScore).toBeLessThan(50);
      expect(result.remediationSuggestions.length).toBeGreaterThanOrEqual(4);
    });

    it('returns cleanlinessScore 100 for factual, non-cliche text', () => {
      const cleanText =
        'Our database benchmarks recorded a P99 query latency of 14ms across 100,000 synthetic requests.';
      const result = AntiWordsFilter.check(cleanText);

      expect(result.hasBannedWords).toBe(false);
      expect(result.bannedWordsFound).toEqual([]);
      expect(result.cleanlinessScore).toBe(100);
    });

    it('sanitizes common AI phrases with direct factual equivalents', () => {
      const input = 'We will delve into the data and seamlessly present a deep dive.';
      const sanitized = AntiWordsFilter.sanitize(input);

      expect(sanitized.toLowerCase()).not.toContain('delve into');
      expect(sanitized.toLowerCase()).not.toContain('seamlessly');
      expect(sanitized).toContain('examine');
      expect(sanitized).toContain('detailed analysis');
    });
  });

  describe('SearchIntelligenceAgent (GSC & AEO Engine)', () => {
    const agent = new SearchIntelligenceAgent();
    const mockContext = {
      workspaceId: '00000000-0000-0000-0000-000000000001',
      brandId: '00000000-0000-0000-0001-000000000001',
      brandName: 'CHATR',
    };

    it('enforces least-privilege tool access boundaries', () => {
      // Trying to call an unauthorized tool must throw
      expect(() => {
        (agent as any).assertToolAllowed('unauthorized_database_drop');
      }).toThrow(/Security boundary violation/);
    });

    it('correctly classifies striking distance queries (positions 11-20 with high impressions)', () => {
      const queries: GscQueryRecord[] = [
        {
          query: 'conversational video shopping',
          pageUrl: 'https://chatr.ai/product/video',
          impressions: 1200,
          clicks: 15,
          ctr: 0.012,
          position: 13.4,
        },
      ];

      const classified = agent.classifyQueries(queries);
      expect(classified).toHaveLength(1);
      expect(classified[0]!.category).toBe('striking_distance');
      expect(classified[0]!.priorityScore).toBeGreaterThanOrEqual(75);
      expect(classified[0]!.recommendedAction).toContain('Expand page depth');
    });

    it('correctly classifies high-impression low-CTR queries ranking in top 5', () => {
      const queries: GscQueryRecord[] = [
        {
          query: 'shoppable video platform',
          pageUrl: 'https://chatr.ai/pricing',
          impressions: 3400,
          clicks: 40,
          ctr: 0.011, // 1.1% CTR is low for top 3
          position: 2.8,
        },
      ];

      const classified = agent.classifyQueries(queries);
      expect(classified).toHaveLength(1);
      expect(classified[0]!.category).toBe('high_impression_low_ctr');
      expect(classified[0]!.priorityScore).toBe(88);
      expect(classified[0]!.recommendedAction).toContain('Rewrite meta title and description');
    });

    it('audits AEO/GEO deliverability and detects empty body SPA traps', () => {
      const thinHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>App Shell</title></head>
          <body><div id="root"></div></body>
        </html>
      `;

      const audit = agent.auditAeo(thinHtml, 'https://chatr.ai/spa');
      expect(audit.isAiDeliverable).toBe(false);
      expect(audit.findings.some((f) => f.rule === 'ai_page_body_empty')).toBe(true);
      expect(audit.findings.some((f) => f.rule === 'missing_structured_data')).toBe(true);
    });

    it('passes AEO deliverability for rich HTML containing JSON-LD', () => {
      const richHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Interactive Video Commerce Benchmark 2026</title>
            <meta name="description" content="Comprehensive benchmark of interactive video commerce showing average conversion uplift of 32% across 500 Shopify stores." />
            <script type="application/ld+json">
              {"@context": "https://schema.org", "@type": "Article", "headline": "Interactive Video Benchmark"}
            </script>
          </head>
          <body>
            <h1>Interactive Video Commerce Benchmark 2026</h1>
            <p>Our comprehensive performance study analyzes interactive shoppable video performance across verified merchant storefronts. Across over 100,000 shopper sessions, direct in-video checkout reduced funnel abandonment by 41% compared to traditional static image carousels.</p>
            <p>Full dataset available for download below with verified methodology.</p>
          </body>
        </html>
      `;

      const audit = agent.auditAeo(richHtml, 'https://chatr.ai/benchmarks');
      expect(audit.isAiDeliverable).toBe(true);
      expect(audit.findings.filter((f) => f.severity === 'critical')).toHaveLength(0);
      expect(audit.hasStructuredData).toBe(true);
    });

    it('generates an anti-slop, evidence-grounded content brief', () => {
      const opportunity = {
        query: 'technical vetting benchmarks',
        pageUrl: 'https://talentxcel.com/benchmarks',
        category: 'striking_distance' as const,
        priorityScore: 85,
        rationale: 'High impressions',
        recommendedAction: 'Add original benchmarks',
      };

      const brief = agent.generateBrief(opportunity, {
        workspaceId: mockContext.workspaceId,
        brandId: mockContext.brandId,
        brandName: 'TalentXcel',
      });

      expect(brief.targetQuery).toBe('technical vetting benchmarks');
      expect(brief.suggestedTitle).toContain('TalentXcel');
      expect(brief.cleanlinessScore).toBe(100);
      expect(brief.keyTopicsToCover.length).toBeGreaterThan(2);
    });
  });

  describe('SocialDistributionAgent (Platform Constraint & Hook Generation)', () => {
    const agent = new SocialDistributionAgent();
    const mockContext = {
      workspaceId: '00000000-0000-0000-0000-000000000001',
      brandId: '00000000-0000-0000-0001-000000000001',
      brandName: 'Nuty Tales',
    };

    it('validates Twitter character bounds and rejects posts exceeding 280 chars', () => {
      const longText = 'A'.repeat(290);
      const candidate = {
        channel: 'twitter' as const,
        text: longText,
        hashtags: ['#healthy'],
        destinationTrackedUrl: 'https://nutytales.com/r/xyz123',
        hookStyle: 'data_driven' as const,
      };

      const result = agent.validatePost(candidate);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('exceeds twitter limit of 280'))).toBe(true);
    });

    it('rejects social posts containing banned AI filler cliches', () => {
      const slopPost = {
        channel: 'linkedin' as const,
        text: 'In today\'s fast-paced landscape, we are thrilled to delve into this game-changer snack.',
        hashtags: ['#nutrition'],
        destinationTrackedUrl: 'https://nutytales.com/r/xyz123',
        hookStyle: 'data_driven' as const,
      };

      const result = agent.validatePost(slopPost);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('banned AI cliches'))).toBe(true);
    });

    it('approves compliant social post with valid tracked destination link', () => {
      const validPost = {
        channel: 'twitter' as const,
        text: 'Makhana contains 67% less fat than fried chips while providing 9g of plant protein per serving.',
        hashtags: ['#CleanSnacks', '#Nutrition'],
        destinationTrackedUrl: 'https://nutytales.com/r/clean123',
        hookStyle: 'data_driven' as const,
      };

      const result = agent.validatePost(validPost);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.antiWordsAudit.cleanlinessScore).toBe(100);
    });

    it('generates 3 differentiated hook styles for multi-armed bandit exploration', () => {
      const hooks = agent.generateHookVariants('clean plant protein snacking', mockContext);

      expect(hooks).toHaveLength(3);
      const styles = hooks.map((h) => h.hookStyle);
      expect(styles).toContain('data_driven');
      expect(styles).toContain('contrarian');
      expect(styles).toContain('problem_solution');
      for (const hook of hooks) {
        expect(hook.headline).toContain('Nuty Tales');
        expect(hook.estimatedCuriosityScore).toBeGreaterThan(70);
      }
    });
  });
});
