/**
 * Source Evidence and Claim Verification API Routes
 *
 * Implements P5 endpoints:
 * - POST /api/v1/evidence/register — Register verified source evidence
 * - GET  /api/v1/evidence — List verified sources in workspace
 * - POST /api/v1/evidence/audit-claims — Verify factual/statistical assertions in copy
 */

import { Router, type Request, type Response } from 'express';
import { EvidenceService, type RegisterEvidenceInput } from '../services/evidence-service.js';

export const evidenceRouter = Router();

// ─── POST /register ───────────────────────────────────────────────────────────
evidenceRouter.post('/register', async (req: Request, res: Response) => {
  const {
    workspace_id,
    url,
    title,
    authors,
    published_date,
    publisher,
    doi,
    evidence_type,
    verification_notes,
  } = req.body as {
    workspace_id?: string;
    url?: string;
    title?: string;
    authors?: string[];
    published_date?: string;
    publisher?: string;
    doi?: string;
    evidence_type?: any;
    verification_notes?: string;
  };

  if (!url) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'url is required' } });
    return;
  }

  const workspaceId = workspace_id || '00000000-0000-0000-0000-000000000001';

  try {
    const input: RegisterEvidenceInput = {
      workspaceId,
      url,
      title,
      authors,
      publishedDate: published_date,
      publisher,
      doi,
      evidenceType: evidence_type,
      verificationNotes: verification_notes,
    };

    const result = await EvidenceService.registerEvidence(input);
    res.json({ success: true, message: 'Source evidence registered and verified.', data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'REGISTRATION_FAILED', message: (err as Error).message } });
  }
});

// ─── GET / ────────────────────────────────────────────────────────────────────
evidenceRouter.get('/', async (req: Request, res: Response) => {
  const workspaceId = (req.query['workspace_id'] as string) || '00000000-0000-0000-0000-000000000001';

  try {
    const records = await EvidenceService.listEvidence(workspaceId);
    res.json({ success: true, data: records, meta: { total: records.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});

// ─── POST /audit-claims ───────────────────────────────────────────────────────
evidenceRouter.post('/audit-claims', async (req: Request, res: Response) => {
  const { text, workspace_id, citation_urls } = req.body as {
    text?: string;
    workspace_id?: string;
    citation_urls?: string[];
  };

  if (!text) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'text is required' } });
    return;
  }

  const workspaceId = workspace_id || '00000000-0000-0000-0000-000000000001';

  try {
    const auditResult = await EvidenceService.auditClaims(text, workspaceId, citation_urls || []);
    res.json({ success: true, data: auditResult });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'CLAIM_AUDIT_FAILED', message: (err as Error).message } });
  }
});
