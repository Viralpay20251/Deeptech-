/**
 * Technical SEO Audit Workbench API Routes
 *
 * Implements P2 endpoints:
 * - POST /api/v1/seo/audit-url — Audit single URL with deterministic findings
 * - POST /api/v1/seo/audit-job — Run audit on an entire crawl job's snapshots
 * - GET  /api/v1/seo/findings — List diagnostic findings with severity filters
 * - POST /api/v1/seo/findings/:id/status — Update issue status
 * - GET  /api/v1/seo/summary — Summary scorecard by severity breakdown
 */

import { Router, type Request, type Response } from 'express';
import { query } from '../lib/db.js';
import { SeoWorkbenchService } from '../services/seo-workbench-service.js';

export const seoRouter = Router();

// ─── POST /audit-url ──────────────────────────────────────────────────────────
seoRouter.post('/audit-url', async (req: Request, res: Response) => {
  const { url, workspace_id, brand_id } = req.body as {
    url?: string;
    workspace_id?: string;
    brand_id?: string;
  };

  if (!url) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'url is required' } });
    return;
  }

  const workspaceId = workspace_id || '00000000-0000-0000-0000-000000000001';

  try {
    const result = await SeoWorkbenchService.auditUrl(url, workspaceId, brand_id);
    res.json({
      success: true,
      message: `Audited ${url}: ${result.findings.length} findings recorded.`,
      data: result,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'AUDIT_FAILED', message: (err as Error).message } });
  }
});

// ─── POST /audit-job ──────────────────────────────────────────────────────────
seoRouter.post('/audit-job', async (req: Request, res: Response) => {
  const { crawl_job_id } = req.body as { crawl_job_id?: string };

  if (!crawl_job_id) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'crawl_job_id is required' } });
    return;
  }

  try {
    const findings = await SeoWorkbenchService.auditCrawlJob(crawl_job_id);
    res.json({
      success: true,
      message: `Audit completed for job ${crawl_job_id}: ${findings.length} findings recorded.`,
      data: { findingsCount: findings.length },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'AUDIT_FAILED', message: (err as Error).message } });
  }
});

// ─── GET /findings ────────────────────────────────────────────────────────────
seoRouter.get('/findings', async (req: Request, res: Response) => {
  const brandId = req.query['brand_id'] as string | undefined;
  const severity = req.query['severity'] as string | undefined;
  const status = req.query['status'] as string | undefined;

  try {
    let sql = `SELECT sf.id, sf.crawl_job_id, sf.page_snapshot_id, sf.brand_id,
                      sf.issue_code, sf.severity, sf.title, sf.description,
                      sf.evidence, sf.recommendation, sf.status, sf.url, sf.created_at,
                      b.display_name AS brand_name
               FROM seo_findings sf
               LEFT JOIN brands b ON sf.brand_id = b.id
               WHERE 1=1`;
    const params: unknown[] = [];

    if (brandId) {
      params.push(brandId);
      sql += ` AND sf.brand_id = $${params.length}`;
    }
    if (severity) {
      params.push(severity);
      sql += ` AND sf.severity = $${params.length}`;
    }
    if (status) {
      params.push(status);
      sql += ` AND sf.status = $${params.length}`;
    }

    sql += ` ORDER BY (
      CASE sf.severity
        WHEN 'critical' THEN 1
        WHEN 'error' THEN 2
        WHEN 'warning' THEN 3
        WHEN 'info' THEN 4
        ELSE 5
      END
    ), sf.created_at DESC LIMIT 100`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows, meta: { total: result.rowCount } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});

// ─── POST /findings/:id/status ────────────────────────────────────────────────
seoRouter.post('/findings/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body as { status?: string };

  if (!status || !['open', 'acknowledged', 'resolved', 'wont_fix'].includes(status)) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid status is required' } });
    return;
  }

  try {
    await query(`UPDATE seo_findings SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);
    res.json({ success: true, message: `Finding ${id} marked as ${status}.` });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});

// ─── GET /summary ─────────────────────────────────────────────────────────────
seoRouter.get('/summary', async (req: Request, res: Response) => {
  const brandId = req.query['brand_id'] as string | undefined;

  try {
    let sql = `SELECT severity, COUNT(*)::int AS count
               FROM seo_findings
               WHERE status = 'open'`;
    const params: unknown[] = [];
    if (brandId) {
      params.push(brandId);
      sql += ` AND brand_id = $1`;
    }
    sql += ` GROUP BY severity`;

    const result = await query(sql, params);
    const breakdown = { critical: 0, error: 0, warning: 0, info: 0 };
    for (const r of result.rows as Array<{ severity: keyof typeof breakdown; count: number }>) {
      if (breakdown[r.severity] !== undefined) {
        breakdown[r.severity] = r.count;
      }
    }

    res.json({ success: true, data: { breakdown, totalOpen: Object.values(breakdown).reduce((a, b) => a + b, 0) } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});
