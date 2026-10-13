/**
 * Unit Tests: Quality Governor (10 Quality Gates)
 */

import { describe, it, expect } from 'vitest';
import { QualityGovernor } from '../../apps/api/src/services/quality-governor.js';
import type { ContentAsset, BrandConfig } from '@growth-os/shared-types';

describe('QualityGovernor', () => {
  const validBrandConfig: Partial<BrandConfig> = {
    prohibited_topics: ['unverified_agi_claims', 'fabricated_benchmarks'],
    requires_human_approval_before_publish: true,
  };

  it('passes a comprehensive, evidence-grounded asset meeting all 10 gates', () => {
    const validAsset: Partial<ContentAsset> = {
      title: 'Practical Workflows for Engineering Teams in 2026',
      body_markdown:
        '# Practical Workflows for Modern Teams\n\n' +
        'Here is a substantive analysis of workflow automation with verified outcomes.\n\n' +
        '## Evidence & Guidance\n' +
        'Based on verified engineering performance benchmarks.\n' +
        'For next steps, see [CHATR Platform](https://chatr.ai/explore).',
      audience_description: 'Engineering managers and technical leads seeking productivity tools',
      intent_type: 'informational',
      opportunity_id: '00000000-0000-0000-0000-000000000001',
      source_evidence_ids: ['00000000-0000-0000-0000-000000000002'],
      citation_urls: ['https://chatr.ai/docs/benchmarks-2026'],
      asset_type: 'search_landing_page',
    };

    const audit = QualityGovernor.audit(validAsset, validBrandConfig);

    expect(audit.allPassed).toBe(true);
    expect(audit.rejectionReasons).toHaveLength(0);
    expect(audit.results).toHaveLength(10);
  });

  it('fails Gate 10 if content mentions a prohibited topic for that brand', () => {
    const prohibitedAsset: Partial<ContentAsset> = {
      title: 'Our Revolutionary AGI Capability',
      body_markdown:
        '# Revolutionary AI\n\n' +
        'We have achieved unverified agi claims and out-compete all rivals.\n' +
        'For next steps, visit https://chatr.ai/tools.',
      audience_description: 'General audience seeking advanced AI tools',
      intent_type: 'commercial_investigation',
      opportunity_id: '00000000-0000-0000-0000-000000000001',
      source_evidence_ids: ['00000000-0000-0000-0000-000000000002'],
      citation_urls: ['https://example.com/source'],
      asset_type: 'search_landing_page',
    };

    const audit = QualityGovernor.audit(prohibitedAsset, validBrandConfig);

    expect(audit.allPassed).toBe(false);
    expect(audit.rejectionReasons.some((r) => r.includes('prohibited topic'))).toBe(true);
  });

  it('fails Gate 3 if content body is too thin', () => {
    const thinAsset: Partial<ContentAsset> = {
      title: 'Short Note',
      body_markdown: 'Click here: https://chatr.ai', // only 28 chars
      audience_description: 'Job seekers',
      intent_type: 'informational',
      opportunity_id: '00000000-0000-0000-0000-000000000001',
      citation_urls: ['https://example.com/source'],
      asset_type: 'search_landing_page',
    };

    const audit = QualityGovernor.audit(thinAsset, validBrandConfig);

    expect(audit.allPassed).toBe(false);
    expect(audit.rejectionReasons.some((r) => r.includes('Content Depth'))).toBe(true);
  });

  it('fails Gate 4 if content lacks source citations or evidence references', () => {
    const ungroundedAsset: Partial<ContentAsset> = {
      title: 'Unverified Tips & Secrets',
      body_markdown:
        '# Secrets to Instant Success\n\n' +
        'Here is some unverified advice without any citations or references.\n\n' +
        'Visit https://chatr.ai/tools for more info.',
      audience_description: 'General audience seeking tips',
      intent_type: 'informational',
      opportunity_id: '00000000-0000-0000-0000-000000000001',
      source_evidence_ids: [],
      citation_urls: [], // NO CITATIONS
      asset_type: 'search_landing_page',
    };

    const audit = QualityGovernor.audit(ungroundedAsset, validBrandConfig);

    expect(audit.allPassed).toBe(false);
    expect(audit.rejectionReasons.some((r) => r.includes('Factual Citations'))).toBe(true);
  });
});
