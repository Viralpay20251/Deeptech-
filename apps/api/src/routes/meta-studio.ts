/**
 * Meta Tags Maker & Preview Studio API Routes
 *
 * Implements P3 endpoints:
 * - POST /api/v1/meta-studio/generate — Synthesize tags, previews, JSON-LD schema
 * - POST /api/v1/meta-studio/proposals — Submit metadata proposal to review queue
 * - GET  /api/v1/meta-studio/proposals — List metadata proposals
 * - POST /api/v1/meta-studio/proposals/:id/decide — Operator approval or rejection
 */

import { Router, type Request, type Response } from 'express';
import { query } from '../lib/db.js';
import { MetaStudioService, type MetaGenerationInput } from '../services/meta-studio-service.js';

export const metaStudioRouter = Router();

// ─── POST /generate ───────────────────────────────────────────────────────────
metaStudioRouter.post('/generate', async (req: Request, res: Response) => {
  const {
    brand_name,
    brand_domain,
    page_url,
    page_title,
    page_description,
    target_keyword,
    schema_type,
    image_url,
  } = req.body as {
    brand_name?: string;
    brand_domain?: string;
    page_url?: string;
    page_title?: string;
    page_description?: string;
    target_keyword?: string;
    schema_type?: 'Organization' | 'WebSite' | 'Article' | 'Product' | 'BreadcrumbList' | 'FAQPage';
    image_url?: string;
  };

  if (!brand_name || !brand_domain || !page_url || !page_title || !page_description) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'brand_name, brand_domain, page_url, page_title, and page_description are required',
      },
    });
    return;
  }

  try {
    const input: MetaGenerationInput = {
      brandName: brand_name,
      brandDomain: brand_domain,
      pageUrl: page_url,
      pageTitle: page_title,
      pageDescription: page_description,
      targetKeyword: target_keyword,
      schemaType: schema_type,
      imageUrl: image_url,
    };

    const result = MetaStudioService.generate(input);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'GENERATION_FAILED', message: (err as Error).message } });
  }
});

// ─── POST /proposals ──────────────────────────────────────────────────────────
metaStudioRouter.post('/proposals', async (req: Request, res: Response) => {
  const { brand_id, url, proposal_type, payload, notes } = req.body as {
    brand_id?: string;
    url?: string;
    proposal_type?: 'meta_tags' | 'json_ld' | 'open_graph' | 'twitter_card';
    payload?: Record<string, unknown>;
    notes?: string;
  };

  if (!url || !payload) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'url and payload are required' } });
    return;
  }

  try {
    const proposal = await MetaStudioService.createProposal(
      brand_id || null,
      url,
      proposal_type || 'meta_tags',
      payload,
      notes
    );
    res.json({ success: true, message: 'Proposal submitted to review queue.', data: proposal });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});

// ─── GET /proposals ───────────────────────────────────────────────────────────
metaStudioRouter.get('/proposals', async (req: Request, res: Response) => {
  const brandId = req.query['brand_id'] as string | undefined;

  try {
    const proposals = await MetaStudioService.listProposals(brandId || null);
    res.json({ success: true, data: proposals, meta: { total: proposals.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});

// ─── POST /proposals/:id/decide ───────────────────────────────────────────────
metaStudioRouter.post('/proposals/:id/decide', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { decision, notes } = req.body as { decision?: 'approved' | 'rejected'; notes?: string };

  if (!decision || !['approved', 'rejected'].includes(decision)) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'decision must be approved or rejected' } });
    return;
  }

  try {
    await query(
      `UPDATE metadata_proposals
       SET status = $1, approved_at = NOW(), notes = COALESCE($2, notes), updated_at = NOW()
       WHERE id = $3`,
      [decision, notes || null, id]
    );

    res.json({ success: true, message: `Metadata proposal ${id} marked as ${decision}.` });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});
