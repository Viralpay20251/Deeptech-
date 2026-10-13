/**
 * Autonomous Growth OS — Algorithm Benchmarking & Validation Suite
 *
 * Implements Section 30 & 38.4 of the Master Build Specification:
 * - Benchmark 1: Multi-signal opportunity ranking precision & boundary constraints
 * - Benchmark 2: Quality Governor 10-gate rubric precision & rejection recall
 * - Benchmark 3: Traffic quality classification & bot filtering accuracy
 */

import { describe, it, expect } from 'vitest';
import { OpportunityScoringEngine } from '../../apps/api/src/services/scoring-engine.js';
import { QualityGovernor } from '../../apps/api/src/services/quality-governor.js';
import { TrafficClassifier } from '../../apps/api/src/services/traffic-classifier.js';

describe('Algorithm Benchmark Harness', () => {
  describe('Benchmark 1: 11-Dimension Opportunity Scoring Model', () => {
    it('ranks high-intent demand with evidence significantly higher than low-intent queries', () => {
      const highIntentRes = OpportunityScoringEngine.calculate({
        demand_evidence: 9.0,
        brand_relevance: 8.5,
        intent_strength: 9.0,
        content_gap: 7.5,
        potential_value: 8.0,
        freshness: 8.0,
        fulfilment_capability: 8.5,
        expected_effort: 3.0,
        cost: 2.0,
        uncertainty: 2.0,
        policy_risk: 1.0,
        rationale: 'High intent verified search demand with low policy risk.',
        evidence_refs: ['gsc_query_delta_01', 'sitemap_verified_02'],
      });

      const lowIntentRes = OpportunityScoringEngine.calculate({
        demand_evidence: 3.0,
        brand_relevance: 5.5,
        intent_strength: 2.5,
        content_gap: 2.0,
        potential_value: 2.0,
        freshness: 3.0,
        fulfilment_capability: 5.0,
        expected_effort: 7.0,
        cost: 6.0,
        uncertainty: 6.0,
        policy_risk: 2.0,
        rationale: 'Low intent keyword with high competition and effort.',
        evidence_refs: [],
      });

      expect(highIntentRes.isSelected).toBe(true);
      expect(highIntentRes.score.weighted_total).toBeGreaterThan(75.0);

      expect(lowIntentRes.isSelected).toBe(false);
      expect(lowIntentRes.score.weighted_total).toBeLessThan(50.0);
      expect(highIntentRes.score.weighted_total - lowIntentRes.score.weighted_total).toBeGreaterThan(30.0);
    });

    it('enforces hard safety boundary when policy risk is critical', () => {
      const highRiskCandidate = OpportunityScoringEngine.calculate({
        demand_evidence: 10.0, // High demand
        brand_relevance: 9.0,
        intent_strength: 9.0,
        content_gap: 8.0,
        potential_value: 9.0,
        freshness: 8.0,
        fulfilment_capability: 8.0,
        expected_effort: 2.0,
        cost: 2.0,
        uncertainty: 2.0,
        policy_risk: 4.8, // EXCEEDS 4.0 HARD LIMIT
        rationale: 'High search volume but poses severe regulatory claims risk.',
        evidence_refs: ['raw_query_unverified'],
      });

      expect(highRiskCandidate.isSelected).toBe(false);
      expect(highRiskCandidate.rejectionReason).toContain('exceeds maximum allowable threshold');
    });
  });

  describe('Benchmark 2: Quality Governor 10-Gate Rubric', () => {
    it('achieves 100% pass on substantive, source-grounded asset with citations and transparent CTA', () => {
      const audit = QualityGovernor.audit(
        {
          opportunity_id: '00000000-0000-0000-0000-000000000001',
          source_evidence_ids: ['ev-1', 'ev-2'],
          intent_type: 'informational',
          audience_description: 'Engineering managers and technical leads seeking productivity tools',
          title: 'Architecting Resilient Multi-Agent Workflows: Best Practices 2026',
          body_markdown: `
# Architecting Resilient Multi-Agent Workflows: Best Practices 2026

Engineering teams designing autonomous AI systems often face challenges with long-running tasks, unexpected network partitions, and unpredictable model failure rates. In modern architectures, ensuring complete task recovery requires treating agent execution as a state machine.

## Key Principles of Durable Execution

1. **State Persistence:** Every node transition must be written to a transactional database before tool execution begins.
2. **Idempotency Keys:** Outbound actions, especially publishing and external API calls, require unique deterministic keys.
3. **Bounded Jittered Backoff:** Transient API rate limits should retry with exponential backoff rather than immediate failure.

According to the official W3C and industry standards, durable systems minimize compute waste and eliminate duplicate actions.

Explore our technical benchmarks and workflow guides for engineering organizations seeking high reliability.

[Explore CHATR Workflows](https://chatr.ai/guides/agent-workflows)
          `,
          citation_urls: ['https://standards.org/guidelines', 'https://w3c.org/specs/agent-workflows'],
          outbound_cta_url: 'https://chatr.ai/guides/agent-workflows',
          metadata: {
            seo_title: 'Architecting Resilient Multi-Agent Workflows: Best Practices 2026',
            seo_description: 'Comprehensive engineering guide to building durable agent workflows with idempotency and state persistence.',
          },
        },
        {
          prohibited_topics: ['unverified_agi_claims', 'fabricated_benchmarks'],
        }
      );

      expect(audit.allPassed).toBe(true);
      expect(audit.results).toHaveLength(10);
      expect(audit.results.every((g) => g.passed)).toBe(true);
      expect(audit.rejectionReasons).toHaveLength(0);
    });

    it('rejects thin content with zero citations and missing structure', () => {
      const thinAudit = QualityGovernor.audit({
        opportunity_id: '00000000-0000-0000-0000-000000000001',
        title: 'AI Quick Overview',
        body_markdown: 'AI is growing fast in 2026. Use it today for your business.',
        intent_type: 'informational',
        audience_description: 'Job seekers',
        citation_urls: [],
        outbound_cta_url: undefined,
        metadata: {},
      });

      expect(thinAudit.allPassed).toBe(false);
      const failedChecks = thinAudit.results.filter((g) => !g.passed).map((g) => g.check_name);
      expect(failedChecks).toContain('Content Depth & Value');
      expect(failedChecks).toContain('Factual Citations & Provenance');
    });
  });

  describe('Benchmark 3: Traffic Quality & Bot Filtering', () => {
    it('identifies verified search crawlers and excludes them from MAU eligibility', () => {
      const crawlerResult = TrafficClassifier.evaluate({
        userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        ipAddress: '66.249.66.1',
        sessionDurationSeconds: 1,
        pageviewsCount: 1,
      });

      expect(crawlerResult.classification).toBe('verified_bot');
      expect(crawlerResult.isEligibleForMau).toBe(false);
    });

    it('identifies automated test probes and headless browsers', () => {
      const probeResult = TrafficClassifier.evaluate({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/120.0.0.0 Safari/537.36',
        ipAddress: '54.210.12.3',
        sessionDurationSeconds: 0,
      });

      expect(probeResult.classification).toBe('likely_bot');
      expect(probeResult.isEligibleForMau).toBe(false);
    });

    it('identifies legitimate engaged human sessions for MAU counting', () => {
      const humanResult = TrafficClassifier.evaluate({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
        ipAddress: '103.21.244.5', // Residential ISP
        sessionDurationSeconds: 45,
        pageviewsCount: 3,
        hasNaturalInteractionEvents: true,
      });

      expect(humanResult.classification).toBe('likely_human');
      expect(humanResult.isEligibleForMau).toBe(true);
      expect(humanResult.confidence).toBeGreaterThanOrEqual(0.90);
    });
  });
});
