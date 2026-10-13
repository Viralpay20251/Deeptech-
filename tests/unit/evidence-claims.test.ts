/**
 * Evidence and Claim Verification Unit Test
 *
 * Verifies P5 Requirements:
 * 1. Detects statistical language (e.g. 48%, 3x) and flags as needing citation
 * 2. Detects unsubstantiated superlatives (e.g. #1, industry-leading)
 * 3. Confirms that claims backed by verified citations pass verification
 */

import { describe, it, expect } from 'vitest';
import { EvidenceService } from '../../apps/api/src/services/evidence-service.js';

describe('P5: Evidence and Claim Verification', () => {
  const TEST_WS_ID = '00000000-0000-0000-0000-000000000001';

  it('detects statistical assertions and flags them when uncited', async () => {
    const text = 'Our platform increases customer engagement by 48% within 30 days.';
    const result = await EvidenceService.auditClaims(text, TEST_WS_ID, []);

    expect(result.passesVerification).toBe(false);
    expect(result.claimsDetected.length).toBeGreaterThan(0);
    expect(result.claimsDetected[0].claimType).toBe('statistical');
    expect(result.claimsDetected[0].hasVerifiedEvidence).toBe(false);
  });

  it('passes statistical assertions when valid citation URL is provided', async () => {
    const text = 'Our platform increases customer engagement by 48% within 30 days.';
    const citations = ['https://chatr.chat/docs/guidelines'];
    const result = await EvidenceService.auditClaims(text, TEST_WS_ID, citations);

    expect(result.passesVerification).toBe(true);
    expect(result.claimsDetected[0].hasVerifiedEvidence).toBe(true);
    expect(result.claimsDetected[0].evidenceUrl).toBe('https://chatr.chat/docs/guidelines');
  });

  it('flags unverified marketing superlatives as policy violations', async () => {
    const text = 'CHATR is the industry-leading tool with guaranteed 100% conversion.';
    const result = await EvidenceService.auditClaims(text, TEST_WS_ID, []);

    expect(result.passesVerification).toBe(false);
    const superlativeClaim = result.claimsDetected.find((c) => c.claimType === 'superlative');
    expect(superlativeClaim).toBeDefined();
    expect(superlativeClaim?.warning).toContain('Superlative claim violates truthful communication policy');
  });
});
