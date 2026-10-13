/**
 * Crawler and Web Intelligence API Routes
 *
 * Implements P1 endpoints:
 * - POST /api/v1/crawler/jobs — Create and trigger a crawl job
 * - GET  /api/v1/crawler/jobs — List crawl jobs
 * - GET  /api/v1/crawler/jobs/:id — Get status & summary of a specific crawl job
 * - GET  /api/v1/crawler/jobs/:id/snapshots — Get page snapshots discovered in a job
 * - POST /api/v1/crawler/inspect-url — Synchronously inspect a single URL
 */

import { Router, type Request, type Response } from 'express';
import { query } from '../lib/db.js';
import { CrawlEngineService, type CrawlProfile } from '../services/crawl-engine.js';

export const crawlerRouter = Router();

// ─── POST /jobs ───────────────────────────────────────────────────────────────
crawlerRouter.post('/jobs', async (req: Request, res: Response) => {
  const { workspace_id, brand_id, label, seed_urls, profile, max_pages } = req.body as {
    workspace_id?: string;
    brand_id?: string;
    label?: string;
    seed_urls?: string[];
    profile?: CrawlProfile;
    max_pages?: number;
  };

  if (!seed_urls || !Array.isArray(seed_urls) || seed_urls.length === 0) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'seed_urls must be a non-empty array' } });
    return;
  }

  const workspaceId = workspace_id || '00000000-0000-0000-0000-000000000001';
  let defaultLabel = 'Web Crawl';
  try {
    if (seed_urls[0]) defaultLabel = `Crawl: ${new URL(seed_urls[0]).hostname}`;
  } catch {
    defaultLabel = 'Web Crawl';
  }
  const jobLabel = label || defaultLabel;

  try {
    const job = await CrawlEngineService.createCrawlJob({
      workspaceId,
      brandId: brand_id || null,
      label: jobLabel,
      seedUrls: seed_urls,
      profile: profile || 'discovery',
      maxPages: max_pages || 20,
    });

    // Execute crawl asynchronously
    CrawlEngineService.executeCrawlJob(job.id).catch((err) => {
      console.error('Async crawl job execution failed:', err);
    });

    res.json({
      success: true,
      message: 'Crawl job initiated.',
      data: { id: job.id, status: job.status, label: jobLabel },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'CRAWL_CREATION_FAILED', message: (err as Error).message } });
  }
});

// ─── GET /jobs ────────────────────────────────────────────────────────────────
crawlerRouter.get('/jobs', async (req: Request, res: Response) => {
  const workspaceId = (req.query['workspace_id'] as string) || '00000000-0000-0000-0000-000000000001';

  try {
    const result = await query(
      `SELECT cj.id, cj.workspace_id, cj.brand_id, cj.label, cj.seed_urls,
              cj.profile, cj.status, cj.max_pages, cj.pages_crawled, cj.error,
              cj.started_at, cj.completed_at, cj.created_at, b.display_name AS brand_name
       FROM crawl_jobs cj
       LEFT JOIN brands b ON cj.brand_id = b.id
       WHERE cj.workspace_id = $1
       ORDER BY cj.created_at DESC LIMIT 50`,
      [workspaceId]
    );

    res.json({ success: true, data: result.rows, meta: { total: result.rowCount } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});

// ─── GET /jobs/:id ────────────────────────────────────────────────────────────
crawlerRouter.get('/jobs/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT id, workspace_id, brand_id, label, seed_urls, profile, status,
              max_pages, pages_crawled, error, started_at, completed_at, created_at
       FROM crawl_jobs WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Crawl job not found' } });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});

// ─── GET /jobs/:id/snapshots ──────────────────────────────────────────────────
crawlerRouter.get('/jobs/:id/snapshots', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT id, crawl_job_id, url, status_code, title, h1, meta_desc, canonical,
              robots_tag, word_count, internal_links, external_links, images_count,
              images_missing_alt, schema_types, open_graph, twitter_card, snapshot_at
       FROM page_snapshots
       WHERE crawl_job_id = $1
       ORDER BY snapshot_at DESC`,
      [id]
    );

    res.json({ success: true, data: result.rows, meta: { total: result.rowCount } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});

// ─── POST /inspect-url ────────────────────────────────────────────────────────
crawlerRouter.post('/inspect-url', async (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };

  if (!url) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'url is required' } });
    return;
  }

  try {
    const snapshot = await CrawlEngineService.crawlSingleUrl(url);
    res.json({ success: true, data: snapshot });
  } catch (err) {
    res.status(400).json({ success: false, error: { code: 'INSPECT_FAILED', message: (err as Error).message } });
  }
});
