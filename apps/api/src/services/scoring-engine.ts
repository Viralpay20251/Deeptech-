/**
 * Autonomous Growth OS — Opportunity Scoring Engine
 *
 * Implements the 11-dimension explainable scoring model:
 * 1. demand_evidence (weight 0.15)
 * 2. brand_relevance (weight 0.15)
 * 3. intent_strength (weight 0.10)
 * 4. content_gap (weight 0.10)
 * 5. potential_value (weight 0.10)
 * 6. freshness (weight 0.05)
 * 7. fulfilment_capability (weight 0.10)
 * 8. expected_effort (weight 0.05 - inverted: lower effort = higher contribution)
 * 9. cost (weight 0.05 - inverted: lower cost = higher contribution)
 * 10. uncertainty (weight 0.05 - penalty: lower uncertainty = higher contribution)
 * 11. policy_risk (weight 0.10 - penalty: lower risk = higher contribution)
 *
 * Total score: 0 to 100.
 * Transparent: returns formula version, component breakdown, rationale, and evidence references.
 * Never outputs opaque scores without reasoning.
 */

import type { OpportunityScore } from '@growth-os/shared-types';

export const SCORE_MODEL_VERSION = '1.0.0';

export interface ScoreInputComponents {
  demand_evidence: number;        // 0–10
  brand_relevance: number;        // 0–10
  intent_strength: number;        // 0–10
  content_gap: number;            // 0–10
  potential_value: number;        // 0–10
  freshness: number;              // 0–10
  fulfilment_capability: number;  // 0–10
  expected_effort: number;        // 0–10 (10 = massive effort, 0 = minimal)
  cost: number;                   // 0–10 (10 = expensive, 0 = free)
  uncertainty: number;            // 0–10 (10 = total unknown, 0 = proven)
  policy_risk: number;            // 0–10 (10 = dangerous, 0 = completely safe)
  rationale: string;
  evidence_refs: string[];
}

export interface ScoreEvaluationResult {
  score: OpportunityScore;
  isSelected: boolean;
  rejectionReason: string | null;
}

export class OpportunityScoringEngine {
  public static readonly SELECTION_THRESHOLD = 65.0; // minimum weighted total to select
  public static readonly MAX_ALLOWED_POLICY_RISK = 4.0; // hard gate: reject if risk > 4.0
  public static readonly MIN_BRAND_RELEVANCE = 5.0;   // hard gate: reject if irrelevant to brand

  /**
   * Calculates the weighted total score and checks selection/rejection gates.
   */
  public static calculate(input: ScoreInputComponents): ScoreEvaluationResult {
    // Clamp inputs between 0 and 10
    const de = this.clamp(input.demand_evidence);
    const br = this.clamp(input.brand_relevance);
    const is = this.clamp(input.intent_strength);
    const cg = this.clamp(input.content_gap);
    const pv = this.clamp(input.potential_value);
    const fr = this.clamp(input.freshness);
    const fc = this.clamp(input.fulfilment_capability);

    // Inverted dimensions (higher quality = lower friction/cost)
    const effortContrib = 10 - this.clamp(input.expected_effort);
    const costContrib = 10 - this.clamp(input.cost);
    const uncertaintyContrib = 10 - this.clamp(input.uncertainty);
    const riskContrib = 10 - this.clamp(input.policy_risk);

    // Weighted components: weights sum to 1.0, scaled to 0-100
    const weightedTotal = Number((
      (de * 0.15 +
       br * 0.15 +
       is * 0.10 +
       cg * 0.10 +
       pv * 0.10 +
       fr * 0.05 +
       fc * 0.10 +
       effortContrib * 0.05 +
       costContrib * 0.05 +
       uncertaintyContrib * 0.05 +
       riskContrib * 0.10) * 10
    ).toFixed(2));

    const score: OpportunityScore = {
      demand_evidence: de,
      brand_relevance: br,
      intent_strength: is,
      content_gap: cg,
      potential_value: pv,
      freshness: fr,
      fulfilment_capability: fc,
      expected_effort: input.expected_effort,
      cost: input.cost,
      uncertainty: input.uncertainty,
      policy_risk: input.policy_risk,
      weighted_total: weightedTotal,
      score_model_version: SCORE_MODEL_VERSION,
      rationale: input.rationale,
      evidence_refs: input.evidence_refs,
      calculated_at: new Date().toISOString(),
    };

    // Evaluate gates
    let isSelected = true;
    let rejectionReason: string | null = null;

    if (input.policy_risk > this.MAX_ALLOWED_POLICY_RISK) {
      isSelected = false;
      rejectionReason = `Policy risk (${input.policy_risk}) exceeds maximum allowable threshold (${this.MAX_ALLOWED_POLICY_RISK}). Content poses brand or regulatory risk.`;
    } else if (input.brand_relevance < this.MIN_BRAND_RELEVANCE) {
      isSelected = false;
      rejectionReason = `Brand relevance (${input.brand_relevance}) is below minimum threshold (${this.MIN_BRAND_RELEVANCE}). Chasing search volume without brand fit is rejected.`;
    } else if (weightedTotal < this.SELECTION_THRESHOLD) {
      isSelected = false;
      rejectionReason = `Weighted score (${weightedTotal}) is below selection threshold (${this.SELECTION_THRESHOLD}). Opportunity does not present sufficient expected value.`;
    }

    return {
      score,
      isSelected,
      rejectionReason,
    };
  }

  private static clamp(val: number): number {
    return Math.max(0, Math.min(10, val));
  }
}
