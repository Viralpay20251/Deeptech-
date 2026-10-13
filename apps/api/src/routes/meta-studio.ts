/**
 * Meta Tags Maker & Preview Studio V3 API Routes
 *
 * Implements endpoints:
 * - POST /api/v1/meta-studio/inspect     — Live URL inspection extracting observed tags & DOM facts
 * - POST /api/v1/meta-studio/generate    — Generate candidate tags, multi-variants, & JSON-LD
 * - POST /api/v1/meta-studio/image-check — SSRF-safe probe of candidate social image URLs
 * - POST /api/v1/meta-studio/validate    — Run diagnostic health checks across metadata fields
 * - GET  /api/v1/meta-studio/batch/:job  — Batch audit across a completed crawl job
 * - POST /api/v1/meta-studio/proposals   — Submit draft proposal with observed state & diff
 * - GET  /api/v1/meta-studio/proposals   — List tenant-scoped metadata proposals
 * - POST /api/v1/meta-studio/proposals/:id/decide — Operator approval/rejection gate
 */

import { Router, type Request, type Response } from 'express';
import { query } from '../lib/db.js';
import { MetaStudioService, type MetaStudioGenerateInput } from '../services/meta-studio-service.js';

export const metaStudioRouter = Router();

// ─── POST /inspect ────────────────────────────────────────────────────────────
metaStudioRouter.post('/inspect', async (req: Request, res: Response) => {
  const { url, workspace_id, brand_id, allowed_domains } = req.body as {
    url?: string;
    workspace_id?: string;
    brand_id?: string;
    allowed_domains?: string[];
  };

  if (!url) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'url is required' } });
    return;
  }

  const workspaceId = workspace_id || '00000000-0000-0000-0000-000000000001';

  try {
    const inspected = await MetaStudioService.inspectPage(url, workspaceId, brand_id, allowed_domains);
    res.json({
      success: true,
      message: `Page inspected successfully (HTTP ${inspected.statusCode} in ${inspected.fetchDurationMs}ms).`,
      data: inspected,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: { code: 'INSPECT_FAILED', message: (err as Error).message } });
  }
});

// ─── POST /image-check ────────────────────────────────────────────────────────
metaStudioRouter.post('/image-check', async (req: Request, res: Response) => {
  const { image_url } = req.body as { image_url?: string };

  if (!image_url) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'image_url is required' } });
    return;
  }

  try {
    const probe = await MetaStudioService.verifyImageUrl(image_url);
    res.json({ success: true, data: probe });
  } catch (err) {
    res.status(400).json({ success: false, error: { code: 'IMAGE_PROBE_FAILED', message: (err as Error).message } });
  }
});

// ─── POST /validate ───────────────────────────────────────────────────────────
metaStudioRouter.post('/validate', async (req: Request, res: Response) => {
  const { title, meta_desc, canonical, page_url, h1, robots, image_url, json_ld } = req.body as {
    title?: string;
    meta_desc?: string;
    canonical?: string;
    page_url?: string;
    h1?: string;
    robots?: string;
    image_url?: string;
    json_ld?: any;
  };

  if (!page_url) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'page_url is required' } });
    return;
  }

  try {
    const report = MetaStudioService.validateMetadata({
      title: title || null,
      metaDesc: meta_desc || null,
      canonical: canonical || null,
      pageUrl: page_url,
      h1: h1 || null,
      robots: robots || null,
      imageUrl: image_url || null,
      jsonLd: json_ld || null,
    });
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'VALIDATE_FAILED', message: (err as Error).message } });
  }
});

// ─── POST /generate ───────────────────────────────────────────────────────────
metaStudioRouter.post('/generate', async (req: Request, res: Response) => {
  const {
    workspace_id,
    brand_id,
    brand_name,
    brand_domain,
    page_url,
    page_title,
    page_description,
    target_keyword,
    schema_type,
    image_url,
    image_alt,
    author_name,
    date_published,
    date_modified,
    observed_data,
  } = req.body as {
    workspace_id?: string;
    brand_id?: string;
    brand_name?: string;
    brand_domain?: string;
    page_url?: string;
    page_title?: string;
    page_description?: string;
    target_keyword?: string;
    schema_type?: string;
    image_url?: string;
    image_alt?: string;
    author_name?: string;
    date_published?: string;
    date_modified?: string;
    observed_data?: any;
  };

  if (!brand_name || !brand_domain || !page_url) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'brand_name, brand_domain, and page_url are required',
      },
    });
    return;
  }

  const workspaceId = workspace_id || '00000000-0000-0000-0000-000000000001';

  try {
    const input: MetaStudioGenerateInput = {
      workspaceId,
      brandId: brand_id || null,
      brandName: brand_name,
      brandDomain: brand_domain,
      pageUrl: page_url,
      pageTitle: page_title,
      pageDescription: page_description,
      targetKeyword: target_keyword,
      schemaType: schema_type || 'WebSite',
      imageUrl: image_url,
      imageAlt: image_alt,
      authorName: author_name,
      datePublished: date_published,
      dateModified: date_modified,
      observedData: observed_data,
    };

    const result = MetaStudioService.generate(input);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'GENERATION_FAILED', message: (err as Error).message } });
  }
});

// ─── GET /batch/:crawl_job_id ─────────────────────────────────────────────────
metaStudioRouter.get('/batch/:crawl_job_id', async (req: Request, res: Response) => {
  const crawlJobId = String(req.params['crawl_job_id']);

  try {
    const report = await MetaStudioService.auditCrawlJobBatch(crawlJobId);
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'BATCH_AUDIT_FAILED', message: (err as Error).message } });
  }
});

// ─── POST /proposals ──────────────────────────────────────────────────────────
metaStudioRouter.post('/proposals', async (req: Request, res: Response) => {
  const {
    workspace_id,
    brand_id,
    url,
    proposal_type,
    payload,
    observed_payload,
    notes,
  } = req.body as {
    workspace_id?: string;
    brand_id?: string;
    url?: string;
    proposal_type?: 'meta_tags' | 'json_ld' | 'open_graph' | 'twitter_card';
    payload?: Record<string, unknown>;
    observed_payload?: Record<string, unknown>;
    notes?: string;
  };

  if (!url || !payload) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'url and payload are required' } });
    return;
  }

  const workspaceId = workspace_id || '00000000-0000-0000-0000-000000000001';

  try {
    const proposal = await MetaStudioService.createProposal(
      workspaceId,
      brand_id || null,
      url,
      proposal_type || 'meta_tags',
      payload,
      observed_payload,
      notes
    );
    res.json({ success: true, message: 'Proposal submitted to review queue with observed diff.', data: proposal });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});

// ─── GET /proposals ───────────────────────────────────────────────────────────
metaStudioRouter.get('/proposals', async (req: Request, res: Response) => {
  const workspaceId = (req.query['workspace_id'] as string) || '00000000-0000-0000-0000-000000000001';
  const brandId = req.query['brand_id'] as string | undefined;

  try {
    const proposals = await MetaStudioService.listProposals(workspaceId, brandId || null);
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
