/**
 * Autonomous Growth OS — Durable PostgreSQL Job Queue Service
 *
 * Replaces the in-memory queue driver. Uses FOR UPDATE SKIP LOCKED pattern
 * via the SQL helpers in migration 018_durable_job_queue.sql.
 *
 * Features:
 * - Atomic job claiming (no double-processing)
 * - Lease heartbeats with auto-recovery of abandoned jobs
 * - Dead-letter on max_attempts exhaustion
 * - Per-type, per-workspace job scoping
 * - No in-memory state — durable across serverless restarts
 */

import { query, pool } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { env } from '../lib/env.js';
import { randomUUID } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'partial'
  | 'failed'
  | 'retrying'
  | 'cancelled'
  | 'dead_lettered';

export interface JobRecord {
  id: string;
  idempotency_key: string | null;
  job_type: string;
  workspace_id: string;
  brand_id: string | null;
  payload: Record<string, unknown>;
  scheduled_at: string;
  priority: number;
  status: JobStatus;
  worker_id: string | null;
  lease_expires_at: string | null;
  heartbeat_at: string | null;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string | null;
  result_summary: Record<string, unknown> | null;
  last_error: string | null;
  last_error_at: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface EnqueueOptions {
  jobType: string;
  workspaceId: string;
  brandId?: string | null;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  priority?: number;          // 0–100, default 50
  scheduledAt?: Date;
  maxAttempts?: number;
}

export interface JobResult {
  success: boolean;
  rowsFetched?: number;
  rowsUpserted?: number;
  details?: Record<string, unknown>;
  error?: string;
}

// ─── Worker identity ─────────────────────────────────────────────────────────

const WORKER_ID = `${process.env['VERCEL_DEPLOYMENT_ID'] ?? 'local'}-${randomUUID().substring(0, 8)}`;
const LEASE_SECONDS = 300;    // 5 minutes
const HEARTBEAT_INTERVAL_MS = 60_000; // 1 minute

// ─── Job Queue Service ───────────────────────────────────────────────────────

export class JobQueueService {

  /**
   * Enqueue a new job. If idempotencyKey is provided, a duplicate key
   * returns the existing job rather than inserting a new one.
   */
  static async enqueue(opts: EnqueueOptions): Promise<JobRecord> {
    const {
      jobType,
      workspaceId,
      brandId = null,
      payload,
      idempotencyKey,
      priority = 50,
      scheduledAt = new Date(),
      maxAttempts = env.QUEUE_RETRY_LIMIT + 1,
    } = opts;

    const result = await query<JobRecord>(
      `INSERT INTO job_queue
         (job_type, workspace_id, brand_id, payload, idempotency_key,
          priority, scheduled_at, max_attempts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (idempotency_key) DO UPDATE
         SET updated_at = NOW()   -- no-op update to return the existing row
       RETURNING *`,
      [
        jobType,
        workspaceId,
        brandId,
        JSON.stringify(payload),
        idempotencyKey ?? null,
        priority,
        scheduledAt.toISOString(),
        maxAttempts,
      ]
    );

    const job = result.rows[0]!;
    logger.info({ jobId: job.id, jobType, workspaceId, brandId, priority }, 'Job enqueued');
    return job;
  }

  /**
   * Claim the next available job of the given type.
   * Uses FOR UPDATE SKIP LOCKED to prevent double-claiming.
   * Returns null if no job is available.
   */
  static async claimNextJob(jobType?: string): Promise<JobRecord | null> {
    // First, recover any abandoned jobs
    await JobQueueService.recoverAbandonedJobs();

    const result = await query<JobRecord>(
      `SELECT * FROM claim_next_job($1, $2, $3)`,
      [WORKER_ID, jobType ?? null, LEASE_SECONDS]
    );

    const raw = result.rows[0];
    const job = (raw && raw.id) ? raw : null;
    if (job) {
      logger.info({ jobId: job.id, jobType: job.job_type, attempt: job.attempts }, 'Job claimed');
    }
    return job;
  }

  /**
   * Renew the lease on a running job (heartbeat).
   */
  static async renewLease(jobId: string): Promise<boolean> {
    const result = await query<{ renew_job_lease: boolean }>(
      `SELECT renew_job_lease($1, $2, $3) AS renew_job_lease`,
      [jobId, WORKER_ID, LEASE_SECONDS]
    );
    return Boolean(result.rows[0]?.renew_job_lease);
  }

  /**
   * Mark a job as succeeded with a result summary.
   */
  static async completeJob(
    jobId: string,
    resultSummary: Record<string, unknown>,
    status: 'succeeded' | 'partial' = 'succeeded'
  ): Promise<boolean> {
    const result = await query<{ complete_job: boolean }>(
      `SELECT complete_job($1, $2, $3, $4) AS complete_job`,
      [jobId, WORKER_ID, JSON.stringify(resultSummary), status]
    );
    const ok = Boolean(result.rows[0]?.complete_job);
    if (ok) {
      logger.info({ jobId, status, resultSummary }, 'Job completed');
    }
    return ok;
  }

  /**
   * Mark a job as failed. Retries if attempts < max_attempts, else dead-letters.
   */
  static async failJob(jobId: string, error: string, retryDelaySecs = 300): Promise<string> {
    const result = await query<{ fail_job: string }>(
      `SELECT fail_job($1, $2, $3, $4) AS fail_job`,
      [jobId, WORKER_ID, error, retryDelaySecs]
    );
    const newStatus = result.rows[0]?.fail_job ?? 'unknown';
    logger.warn({ jobId, newStatus, error }, 'Job failed');
    return newStatus;
  }

  /**
   * Cancel a queued (not yet running) job.
   */
  static async cancelJob(jobId: string, workspaceId: string): Promise<boolean> {
    const result = await query(
      `UPDATE job_queue
       SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2 AND status IN ('queued', 'retrying')`,
      [jobId, workspaceId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Recover jobs whose lease has expired.
   */
  static async recoverAbandonedJobs(): Promise<number> {
    const result = await query<{ recover_abandoned_jobs: number }>(
      `SELECT recover_abandoned_jobs() AS recover_abandoned_jobs`
    );
    const count = result.rows[0]?.recover_abandoned_jobs ?? 0;
    if (count > 0) {
      logger.warn({ count }, 'Recovered abandoned jobs with expired leases');
    }
    return count;
  }

  /**
   * Get job status by ID.
   */
  static async getJob(jobId: string): Promise<JobRecord | null> {
    const result = await query<JobRecord>(
      `SELECT * FROM job_queue WHERE id = $1`,
      [jobId]
    );
    return result.rows[0] ?? null;
  }

  /**
   * List jobs for a workspace with optional filters.
   */
  static async listJobs(opts: {
    workspaceId: string;
    brandId?: string;
    jobType?: string;
    status?: JobStatus;
    limit?: number;
  }): Promise<JobRecord[]> {
    const { workspaceId, brandId, jobType, status, limit = 50 } = opts;
    const params: unknown[] = [workspaceId];
    let sql = `SELECT * FROM job_queue WHERE workspace_id = $1`;

    if (brandId) { params.push(brandId); sql += ` AND brand_id = $${params.length}`; }
    if (jobType) { params.push(jobType); sql += ` AND job_type = $${params.length}`; }
    if (status)  { params.push(status);  sql += ` AND status = $${params.length}`; }

    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await query<JobRecord>(sql, params);
    return result.rows;
  }

  /**
   * Get queue depth metrics — for health dashboard.
   */
  static async getQueueMetrics(): Promise<{
    queued: number;
    running: number;
    failed: number;
    dead_lettered: number;
    oldest_queued_at: string | null;
    worker_alive: boolean;
    last_heartbeat: string | null;
  }> {
    const [countsRes, workerRes] = await Promise.all([
      query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) AS count FROM job_queue
         WHERE created_at > NOW() - INTERVAL '24 hours'
         GROUP BY status`
      ),
      query<{ last_heartbeat: string; is_alive: boolean }>(
        `SELECT last_heartbeat,
                (last_heartbeat > NOW() - INTERVAL '10 minutes') AS is_alive
         FROM worker_heartbeats
         ORDER BY last_heartbeat DESC LIMIT 1`
      ),
    ]);

    const counts: Record<string, number> = {};
    for (const row of countsRes.rows) {
      counts[row.status] = parseInt(row.count, 10);
    }

    const oldestRes = await query<{ oldest: string | null }>(
      `SELECT MIN(scheduled_at)::TEXT AS oldest FROM job_queue WHERE status IN ('queued','retrying')`
    );

    const worker = workerRes.rows[0];
    return {
      queued: counts['queued'] ?? 0,
      running: counts['running'] ?? 0,
      failed: counts['failed'] ?? 0,
      dead_lettered: counts['dead_lettered'] ?? 0,
      oldest_queued_at: oldestRes.rows[0]?.oldest ?? null,
      worker_alive: worker?.is_alive ?? false,
      last_heartbeat: worker?.last_heartbeat ?? null,
    };
  }

  /**
   * Record worker heartbeat to the worker_heartbeats table.
   */
  static async recordHeartbeat(
    workerType: 'vercel_cron' | 'dedicated_worker' | 'local_dev',
    currentJobId?: string | null
  ): Promise<void> {
    await query(
      `INSERT INTO worker_heartbeats (worker_id, worker_type, deployment_id, current_job_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (worker_id) DO UPDATE
         SET last_heartbeat = NOW(),
             current_job_id = EXCLUDED.current_job_id`,
      [
        WORKER_ID,
        workerType,
        process.env['VERCEL_DEPLOYMENT_ID'] ?? null,
        currentJobId ?? null,
      ]
    ).catch((err) => {
      logger.warn({ err }, 'Failed to record worker heartbeat (non-fatal)');
    });
  }

  /**
   * Run a heartbeat-renew loop for a long-running job.
   * Returns a cleanup function — call it when the job finishes.
   */
  static startHeartbeatLoop(jobId: string): () => void {
    const interval = setInterval(async () => {
      try {
        await JobQueueService.renewLease(jobId);
        await JobQueueService.recordHeartbeat('dedicated_worker', jobId);
      } catch (err) {
        logger.warn({ err, jobId }, 'Heartbeat renewal failed');
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }
}
