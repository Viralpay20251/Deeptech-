/**
 * Unit Tests: Opportunity Scoring Engine
 */

import { describe, it, expect } from 'vitest';
import { OpportunityScoringEngine, SCORE_MODEL_VERSION } from '../../apps/api/src/services/scoring-engine.js';

describe('OpportunityScoringEngine', () => {
  it('calculates a valid weighted total and selects high-value, safe opportunities', () => {
    const input = {
      demand_evidence: 9.0,
      brand_relevance: 9.5,
      intent_strength: 8.5,
      content_gap: 8.0,
      potential_value: 9.0,
      freshness: 9.0,
      fulfilment_capability: 8.5,
      expected_effort: 3.0, // low effort = high contribution
      cost: 2.0,            // low cost = high contribution
      uncertainty: 2.0,     // low uncertainty
      policy_risk: 1.0,     // very safe
      rationale: 'Verified high-intent search query with strong commercial alignment.',
      evidence_refs: ['https://example.com/source'],
    };

    const result = OpportunityScoringEngine.calculate(input);

    expect(result.score.score_model_version).toBe(SCORE_MODEL_VERSION);
    expect(result.score.weighted_total).toBeGreaterThan(70);
    expect(result.isSelected).toBe(true);
    expect(result.rejectionReason).toBeNull();
    expect(result.score.rationale).toBe(input.rationale);
  });

  it('rejects an opportunity when policy risk exceeds maximum threshold (4.0)', () => {
    const input = {
      demand_evidence: 10.0,
      brand_relevance: 10.0,
      intent_strength: 10.0,
      content_gap: 10.0,
      potential_value: 10.0,
      freshness: 10.0,
      fulfilment_capability: 10.0,
      expected_effort: 1.0,
      cost: 1.0,
      uncertainty: 1.0,
      policy_risk: 6.5, // EXCEEDS 4.0 limit
      rationale: 'High volume but involves unverified health claim.',
      evidence_refs: [],
    };

    const result = OpportunityScoringEngine.calculate(input);

    expect(result.isSelected).toBe(false);
    expect(result.rejectionReason).toContain('Policy risk');
  });

  it('rejects an opportunity when brand relevance is below minimum threshold (5.0)', () => {
    const input = {
      demand_evidence: 9.0,
      brand_relevance: 3.0, // Chasing generic volume without brand fit
      intent_strength: 8.0,
      content_gap: 7.0,
      potential_value: 7.0,
      freshness: 8.0,
      fulfilment_capability: 4.0,
      expected_effort: 3.0,
      cost: 2.0,
      uncertainty: 2.0,
      policy_risk: 1.0,
      rationale: 'High search trend but completely unrelated to platform.',
      evidence_refs: [],
    };

    const result = OpportunityScoringEngine.calculate(input);

    expect(result.isSelected).toBe(false);
    expect(result.rejectionReason).toContain('Brand relevance');
  });

  it('rejects opportunities with weighted total below selection threshold (65.0)', () => {
    const input = {
      demand_evidence: 4.0,
      brand_relevance: 5.5,
      intent_strength: 4.0,
      content_gap: 3.0,
      potential_value: 3.0,
      freshness: 4.0,
      fulfilment_capability: 5.0,
      expected_effort: 8.0, // high effort
      cost: 8.0,            // high cost
      uncertainty: 8.0,     // high uncertainty
      policy_risk: 3.0,
      rationale: 'Weak demand and high implementation friction.',
      evidence_refs: [],
    };

    const result = OpportunityScoringEngine.calculate(input);

    expect(result.isSelected).toBe(false);
    expect(result.rejectionReason).toContain('below selection threshold');
  });
});
