/**
 * Job Queue API Routes
 * - GET  /api/v1/queue/metrics  — Queue health, depth, worker heartbeat
 * - GET  /api/v1/queue/jobs     — List jobs (workspace-scoped)
 * - GET  /api/v1/queue/jobs/:id — Job detail and result
 * - POST /api/v1/queue/jobs/:id/cancel — Cancel a queued job
 */

import { Router, type Request, type Response } from 'express';
import { JobQueueService } from '../services/job-queue-service.js';

export const queueRouter = Router();

// ─── GET /metrics ─────────────────────────────────────────────────────────────
queueRouter.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = await JobQueueService.getQueueMetrics();
    res.json({
      success: true,
      execution_mode: 'live',
      observed_at: new Date().toISOString(),
      data: metrics,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'METRICS_FAILED', message: (err as Error).message } });
  }
});

// ─── GET /jobs ────────────────────────────────────────────────────────────────
queueRouter.get('/jobs', async (req: Request, res: Response) => {
  const workspaceId = req.user?.workspace_id || (req.query['workspace_id'] as string);
  const jobType = req.query['job_type'] as string | undefined;
  const status = req.query['status'] as string | undefined;

  try {
    const jobs = await JobQueueService.listJobs({
      workspaceId,
      jobType,
      status: status as any,
      limit: 50,
    });
    res.json({ success: true, data: jobs, meta: { total: jobs.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'LIST_FAILED', message: (err as Error).message } });
  }
});

// ─── GET /jobs/:id ────────────────────────────────────────────────────────────
queueRouter.get('/jobs/:id', async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  try {
    const job = await JobQueueService.getJob(id);
    if (!job) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Job ${id} not found` } });
      return;
    }

    if (req.user?.workspace_id && job.workspace_id !== req.user.workspace_id) {
      res.status(403).json({
        success: false,
        error: { code: 'TENANT_ISOLATION_VIOLATION', message: 'Job does not belong to caller workspace.' },
      });
      return;
    }

    res.json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'GET_FAILED', message: (err as Error).message } });
  }
});

// ─── POST /jobs/:id/cancel ────────────────────────────────────────────────────
queueRouter.post('/jobs/:id/cancel', async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const workspaceId = req.user?.workspace_id || (req.body?.workspace_id as string);

  try {
    const cancelled = await JobQueueService.cancelJob(id, workspaceId);
    if (!cancelled) {
      res.status(409).json({
        success: false,
        error: {
          code: 'CANCEL_FAILED',
          message: `Job ${id} cannot be cancelled — it may be running, already completed, or not found in this workspace.`,
        },
      });
      return;
    }
    res.json({ success: true, message: `Job ${id} cancelled.` });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'CANCEL_ERROR', message: (err as Error).message } });
  }
});
