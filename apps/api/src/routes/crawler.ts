/**
 * Crawler and Web Intelligence API Routes
 *
 * Implements P1 endpoints:
 * - POST /api/v1/crawler/jobs — Create and enqueue a crawl job into durable PostgreSQL queue
 * - GET  /api/v1/crawler/jobs — List crawl jobs
 * - GET  /api/v1/crawler/jobs/:id — Get status & summary of a specific crawl job
 * - GET  /api/v1/crawler/jobs/:id/snapshots — Get page snapshots discovered in a job
 * - POST /api/v1/crawler/inspect-url — Synchronously inspect a single URL
 * - GET/POST /api/v1/crawler/worker/process-next — Protected worker trigger (supports Vercel Cron GET and manual POST)
 */

import { Router, type Request, type Response } from 'express';
import { query } from '../lib/db.js';
import { CrawlEngineService, type CrawlProfile } from '../services/crawl-engine.js';
import { JobQueueService } from '../services/job-queue-service.js';
import { authenticate, requireRole, requireWorkspaceScope, verifyCronSecret } from '../middleware/auth.js';

export const crawlerRouter = Router();

// ─── POST /jobs ───────────────────────────────────────────────────────────────
crawlerRouter.post(
  '/jobs',
  authenticate,
  requireRole(['workspace_admin', 'operator']),
  requireWorkspaceScope,
  async (req: Request, res: Response) => {
    const { brand_id, label, seed_urls, profile, max_pages } = req.body as {
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

    const workspaceId = req.user!.workspace_id;
    let defaultLabel = 'Web Crawl';
    try {
      if (seed_urls[0]) defaultLabel = `Crawl: ${new URL(seed_urls[0]).hostname}`;
    } catch {
      defaultLabel = 'Web Crawl';
    }
    const jobLabel = label || defaultLabel;

    try {
      // 1. Create tracking record in crawl_jobs
      const crawlJob = await CrawlEngineService.createCrawlJob({
        workspaceId,
        brandId: brand_id || null,
        label: jobLabel,
        seedUrls: seed_urls,
        profile: profile || 'discovery',
        maxPages: max_pages || 20,
      });

      // 2. Enqueue into durable PostgreSQL job_queue
      // Worker will claim with FOR UPDATE SKIP LOCKED and execute with lease heartbeats
      const queueJob = await JobQueueService.enqueue({
        jobType: 'crawl',
        workspaceId,
        brandId: brand_id || null,
        payload: {
          crawl_job_id: crawlJob.id,
          label: jobLabel,
          seed_urls,
          profile: profile || 'discovery',
          max_pages: max_pages || 20,
        },
        priority: 70,
      });

      res.status(202).json({
        success: true,
        execution_mode: 'live',
        message: 'Crawl job created and queued in durable PostgreSQL queue.',
        data: {
          id: crawlJob.id,
          queue_job_id: queueJob.id,
          status: 'queued',
          label: jobLabel,
          workspace_id: workspaceId,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: 'CRAWL_CREATION_FAILED', message: (err as Error).message } });
    }
  }
);

// ─── GET /jobs ────────────────────────────────────────────────────────────────
crawlerRouter.get('/jobs', async (req: Request, res: Response) => {
  const workspaceId = (req.query['workspace_id'] as string) || '00000000-0000-0000-0000-000000000001';

  try {
    const result = await query(
      `SELECT cj.id, cj.workspace_id, cj.brand_id, cj.label, cj.seed_urls,
              cj.profile, cj.status, cj.max_pages, cj.pages_crawled, cj.error,
              cj.started_at, cj.completed_at, cj.created_at,
              b.display_name as brand_name
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
    const jobRes = await query(
      `SELECT cj.*, b.display_name as brand_name
       FROM crawl_jobs cj
       LEFT JOIN brands b ON cj.brand_id = b.id
       WHERE cj.id = $1`,
      [id]
    );

    if (!jobRes.rows.length) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Job ${id} not found` } });
      return;
    }

    const job = jobRes.rows[0];

    // Get snapshot count
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM page_snapshots WHERE crawl_job_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...job,
        snapshots_recorded: parseInt(countRes.rows[0]?.count || '0', 10),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});

// ─── GET /jobs/:id/snapshots ──────────────────────────────────────────────────
crawlerRouter.get('/jobs/:id/snapshots', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT id, url, status_code, title, h1, meta_desc, canonical, robots_tag,
              word_count, internal_links, external_links, images_count, images_missing_alt,
              schema_types, open_graph, twitter_card, crawled_at
       FROM page_snapshots
       WHERE crawl_job_id = $1
       ORDER BY crawled_at ASC`,
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

// ─── Worker Tick Handler ──────────────────────────────────────────────────────
const handleWorkerTick = async (_req: Request, res: Response) => {
  try {
    const { CrawlerWorker } = await import('../workers/crawler-worker.js');
    const result = await CrawlerWorker.processBatch();
    res.json({
      success: true,
      execution_mode: 'live',
      observed_at: new Date().toISOString(),
      data: result,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'WORKER_TICK_FAILED', message: (err as Error).message } });
  }
};

// ─── GET & POST /worker/process-next ──────────────────────────────────────────
// Supports Vercel Cron (which sends GET with Authorization: Bearer <CRON_SECRET>)
// and manual administrative triggers (POST with x-cron-secret)
crawlerRouter.get('/worker/process-next', verifyCronSecret, handleWorkerTick);
crawlerRouter.post('/worker/process-next', verifyCronSecret, handleWorkerTick);
