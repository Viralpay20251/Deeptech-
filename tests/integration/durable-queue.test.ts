/**
 * Durable PostgreSQL Job Queue Integration Tests
 *
 * Verifies Section 5 of Master Remediation Plan:
 * 1. Enqueue job into PostgreSQL job_queue table.
 * 2. Idempotency key deduplication (duplicate key returns existing job).
 * 3. Atomic job claim via FOR UPDATE SKIP LOCKED with worker lease.
 * 4. Lease heartbeat renewal.
 * 5. Job completion with result summary.
 * 6. Queue metrics reporting (depth, status counts, worker heartbeat).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../../apps/api/src/index.js';
import { JobQueueService } from '../../apps/api/src/services/job-queue-service.js';
import { query } from '../../apps/api/src/lib/db.js';

describe('Durable PostgreSQL Job Queue Integration', () => {
  const workspaceId = '00000000-0000-0000-0000-000000000001';
  const testJobType = 'test_integration_crawl';
  const createdJobIds: string[] = [];
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (typeof address === 'object' && address !== null) {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Clean up test jobs
    if (createdJobIds.length > 0) {
      await query(
        `DELETE FROM job_queue WHERE id = ANY($1::uuid[])`,
        [createdJobIds]
      ).catch(() => {});
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('1. Enqueues a job into PostgreSQL and returns durable job record', async () => {
    const job = await JobQueueService.enqueue({
      jobType: testJobType,
      workspaceId,
      payload: { seed_url: 'https://chatr.chat', profile: 'seo_audit' },
      priority: 80,
    });

    expect(job).toBeDefined();
    expect(job.id).toBeDefined();
    expect(job.status).toBe('queued');
    expect(job.priority).toBe(80);
    expect(job.job_type).toBe(testJobType);
    createdJobIds.push(job.id);
  });

  it('2. Enforces idempotency keys: duplicate key returns existing job', async () => {
    const key = `test_idem_${Date.now()}`;

    const job1 = await JobQueueService.enqueue({
      jobType: testJobType,
      workspaceId,
      payload: { seed_url: 'https://talentxcel.in' },
      idempotencyKey: key,
    });
    createdJobIds.push(job1.id);

    const job2 = await JobQueueService.enqueue({
      jobType: testJobType,
      workspaceId,
      payload: { seed_url: 'https://talentxcel.in' },
      idempotencyKey: key,
    });

    expect(job2.id).toBe(job1.id);
  });

  it('3. Atomically claims next job with worker lease (SKIP LOCKED)', async () => {
    const claimed = await JobQueueService.claimNextJob(testJobType);

    expect(claimed).not.toBeNull();
    expect(claimed?.status).toBe('running');
    expect(claimed?.worker_id).toBeDefined();
    expect(claimed?.lease_expires_at).toBeDefined();
    expect(claimed?.attempts).toBeGreaterThanOrEqual(1);
  });

  it('4. Renews lease heartbeat for claimed running job', async () => {
    const job = await JobQueueService.enqueue({
      jobType: `${testJobType}_lease`,
      workspaceId,
      payload: { test: true },
    });
    createdJobIds.push(job.id);

    const claimed = await JobQueueService.claimNextJob(`${testJobType}_lease`);
    expect(claimed).not.toBeNull();

    const renewed = await JobQueueService.renewLease(claimed!.id);
    expect(renewed).toBe(true);
  });

  it('5. Completes job with result summary and marks status succeeded', async () => {
    const job = await JobQueueService.enqueue({
      jobType: `${testJobType}_complete`,
      workspaceId,
      payload: { test: true },
    });
    createdJobIds.push(job.id);

    const claimed = await JobQueueService.claimNextJob(`${testJobType}_complete`);
    expect(claimed).not.toBeNull();

    const ok = await JobQueueService.completeJob(claimed!.id, {
      rows_fetched: 5,
      rows_upserted: 5,
      note: 'Integration test completion',
    });
    expect(ok).toBe(true);

    const updated = await JobQueueService.getJob(claimed!.id);
    expect(updated?.status).toBe('succeeded');
    expect(updated?.completed_at).toBeDefined();
    expect(updated?.result_summary).toEqual({
      rows_fetched: 5,
      rows_upserted: 5,
      note: 'Integration test completion',
    });
  });

  it('6. GET /api/v1/queue/metrics reports queue depth and worker heartbeat', async () => {
    await JobQueueService.recordHeartbeat('local_dev', null);

    const res = await fetch(`${baseUrl}/api/v1/queue/metrics`);
    expect(res.status).toBe(200);
    const json = await res.json() as any;

    expect(json.success).toBe(true);
    expect(json.execution_mode).toBe('live');
    expect(json.data).toBeDefined();
    expect(typeof json.data.queued).toBe('number');
    expect(typeof json.data.running).toBe('number');
    expect(json.data.worker_alive).toBe(true);
  });

  it('7. GET /api/v1/queue/jobs lists jobs scoped to workspace', async () => {
    const res = await fetch(`${baseUrl}/api/v1/queue/jobs?workspace_id=${workspaceId}`);
    expect(res.status).toBe(200);
    const json = await res.json() as any;

    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

});
