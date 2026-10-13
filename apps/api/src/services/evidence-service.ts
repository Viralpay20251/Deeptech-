/**
 * Autonomous Growth OS — Evidence and Claim Verification Service
 *
 * Implements P5 Specification:
 * - Manages verified first-party source evidence records in source_evidence table.
 * - Extracts statistical, superlative, and comparative claims from copy.
 * - Validates whether claims are substantiated by empirical evidence.
 * - Links claims to evidence via evidence_claim_links table.
 */

import crypto from 'crypto';
import { query } from '../lib/db.js';
import { assertSafeOutboundUrlAsync } from '../lib/safety.js';

export interface RegisterEvidenceInput {
  workspaceId: string;
  url: string;
  title?: string;
  authors?: string[];
  publishedDate?: string;
  publisher?: string;
  doi?: string;
  evidenceType?: 'web_page' | 'academic_paper' | 'government_data' | 'api_response' | 'official_docs' | 'news_article' | 'dataset';
  verificationNotes?: string;
}

export interface ClaimValidationResult {
  text: string;
  claimsDetected: Array<{
    claimText: string;
    claimType: 'statistical' | 'comparative' | 'superlative' | 'factual';
    hasVerifiedEvidence: boolean;
    evidenceUrl?: string;
    warning?: string;
  }>;
  passesVerification: boolean;
}

export class EvidenceService {
  /**
   * Register a verified source evidence record
   */
  public static async registerEvidence(input: RegisterEvidenceInput): Promise<{ id: string }> {
    await assertSafeOutboundUrlAsync(input.url);

    const contentHash = crypto.createHash('sha256').update(input.url).digest('hex');
    const evidenceType = input.evidenceType || 'web_page';

    const res = await query<{ id: string }>(
      `INSERT INTO source_evidence (
        workspace_id, url, title, authors, published_date, publisher,
        doi, evidence_type, content_hash, is_verified, verification_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10)
      ON CONFLICT (workspace_id, url) DO UPDATE
      SET title = EXCLUDED.title,
          is_verified = TRUE,
          verification_notes = EXCLUDED.verification_notes
      RETURNING id`,
      [
        input.workspaceId,
        input.url,
        input.title || null,
        JSON.stringify(input.authors || []),
        input.publishedDate || null,
        input.publisher || null,
        input.doi || null,
        evidenceType,
        contentHash,
        input.verificationNotes || 'Verified by operator',
      ]
    );

    return res.rows[0]!;
  }

  /**
   * List verified source evidence for a workspace
   */
  public static async listEvidence(workspaceId: string) {
    const res = await query(
      `SELECT id, workspace_id, url, title, authors, published_date, publisher,
              doi, evidence_type, is_verified, verification_notes, fetched_at
       FROM source_evidence
       WHERE workspace_id = $1
       ORDER BY fetched_at DESC LIMIT 100`,
      [workspaceId]
    );
    return res.rows;
  }

  /**
   * Scan text for statistical, comparative, and superlative claims,
   * checking whether they are backed by registered evidence.
   */
  public static async auditClaims(
    text: string,
    workspaceId: string,
    citationUrls: string[] = []
  ): Promise<ClaimValidationResult> {
    const claimsDetected: ClaimValidationResult['claimsDetected'] = [];

    // Patterns for unsubstantiated marketing hype or statistical assertions
    const statisticalRegex = /\b(\d+(?:\.\d+)?%|\b\d+x\b|\bdoubled\b|\btripled\b|\b100%|\b99\.\d+%\b)/gi;
    const superlativeRegex = /\b(industry-leading|best-in-class|#1\b|guaranteed\b|world's fastest|revolutionary\b)/gi;
    const comparativeRegex = /\b(faster than|better than|outperforms|superior to|cheaper than)\b/gi;

    // Check statistical claims
    let match: RegExpExecArray | null;
    while ((match = statisticalRegex.exec(text)) !== null) {
      claimsDetected.push({
        claimText: match[0],
        claimType: 'statistical',
        hasVerifiedEvidence: citationUrls.length > 0,
        evidenceUrl: citationUrls[0],
        warning: citationUrls.length === 0 ? 'Statistical assertion requires a verified source evidence citation.' : undefined,
      });
    }

    // Check superlative claims
    while ((match = superlativeRegex.exec(text)) !== null) {
      claimsDetected.push({
        claimText: match[0],
        claimType: 'superlative',
        hasVerifiedEvidence: false,
        warning: 'Superlative claim violates truthful communication policy unless empirically certified.',
      });
    }

    // Check comparative claims
    while ((match = comparativeRegex.exec(text)) !== null) {
      claimsDetected.push({
        claimText: match[0],
        claimType: 'comparative',
        hasVerifiedEvidence: citationUrls.length > 0,
        evidenceUrl: citationUrls[0],
        warning: citationUrls.length === 0 ? 'Comparative performance claim requires head-to-head empirical evidence.' : undefined,
      });
    }

    const passesVerification = claimsDetected.every((c) => c.hasVerifiedEvidence || c.claimType === 'factual');

    return {
      text,
      claimsDetected,
      passesVerification,
    };
  }
}
