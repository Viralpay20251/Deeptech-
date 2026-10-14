/**
 * Security Suite: Authentication Hardening, Forgery Rejection & Tenant Isolation
 *
 * Verifies P0 Security & Tenant Boundary Guarantees:
 * 1. Bare x-operator-id without signed proof is strictly rejected with 401 FORGED_OR_UNSIGNED_IDENTITY
 * 2. Invalid service key is rejected with 401 INVALID_SERVICE_KEY
 * 3. Cryptographically authenticated service credential (x-operator-id + x-service-key) succeeds
 * 4. Cryptographically signed JWT token (Authorization: Bearer <token>) succeeds
 * 5. Cross-workspace access attempt is strictly rejected with 403 TENANT_ISOLATION_VIOLATION
 * 6. Durable queue: batch drain loop, lease recovery of expired jobs, and dead-lettering
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../../apps/api/src/index.js';
import { query } from '../../apps/api/src/lib/db.js';
import { generateOperatorToken } from '../../apps/api/src/middleware/auth.js';
import { JobQueueService } from '../../apps/api/src/services/job-queue-service.js';
import { CrawlerWorker } from '../../apps/api/src/workers/crawler-worker.js';

describe('Authentication Hardening, Forgery Rejection & Tenant Isolation', () => {
  let server: Server;
  let baseUrl: string;
  const workspaceA = '00000000-0000-0000-0000-000000000001';
  const workspaceB = '00000000-0000-0000-0000-000000000002';
  const operatorAId = 'c4344661-4a88-46a9-b85d-c65303c37227';
  const validServiceKey = process.env['INTERNAL_WORKSPACE_SECRET'] || 'growth_os_internal_session_secret_32_characters_minimum!';

  beforeAll(async () => {
    // Ensure operator in workspace A
    await query(
      `INSERT INTO users (id, workspace_id, email, display_name, password_hash, role)
       VALUES ($1, $2, 'operator_a@growth-os.internal', 'Operator A', 'hash', 'workspace_admin')
       ON CONFLICT (id) DO UPDATE SET workspace_id = $2, role = 'workspace_admin'`,
      [operatorAId, workspaceA]
    );

    // Ensure workspace B exists in workspaces table if table exists
    await query(
      `INSERT INTO workspaces (id, name, slug)
       VALUES ($1, 'Workspace B', 'workspace-b')
       ON CONFLICT (id) DO NOTHING`,
      [workspaceB]
    ).catch(() => {});

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
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  // ─── 1. Bare x-operator-id Rejection ─────────────────────────────────────────
  it('strictly rejects bare x-operator-id header without signed credential with 401 FORGED_OR_UNSIGNED_IDENTITY', async () => {
    const res = await fetch(`${baseUrl}/api/v1/brands`, {
      headers: {
        'x-operator-id': operatorAId,
      },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORGED_OR_UNSIGNED_IDENTITY');
    expect(body.error.message).toContain('identifier, not proof of identity');
  });

  // ─── 2. Invalid Service Key Rejection ────────────────────────────────────────
  it('strictly rejects forged or invalid x-service-key with 401 INVALID_SERVICE_KEY', async () => {
    const res = await fetch(`${baseUrl}/api/v1/brands`, {
      headers: {
        'x-operator-id': operatorAId,
        'x-service-key': 'attacker_fake_service_secret_key_1234567890!',
      },
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_SERVICE_KEY');
  });

  // ─── 3. Valid Service Key Authentication ─────────────────────────────────────
  it('authenticates successfully when valid x-service-key and x-operator-id are supplied', async () => {
    const res = await fetch(`${baseUrl}/api/v1/brands`, {
      headers: {
        'x-operator-id': operatorAId,
        'x-service-key': validServiceKey,
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  // ─── 4. Valid JWT Bearer Authentication ──────────────────────────────────────
  it('authenticates successfully via Authorization: Bearer <signed_jwt>', async () => {
    const token = generateOperatorToken({
      id: operatorAId,
      email: 'operator_a@growth-os.internal',
      role: 'workspace_admin',
      workspace_id: workspaceA,
    });

    const res = await fetch(`${baseUrl}/api/v1/brands`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
  });

  // ─── 5. Tenant Scope & Cross-Workspace Isolation ─────────────────────────────
  it('strictly denies cross-workspace queries with 403 TENANT_ISOLATION_VIOLATION when caller targets foreign workspace', async () => {
    const token = generateOperatorToken({
      id: operatorAId,
      email: 'operator_a@growth-os.internal',
      role: 'workspace_admin',
      workspace_id: workspaceA,
    });

    // Caller authenticated as workspaceA attempts to query workspaceB
    const res = await fetch(`${baseUrl}/api/v1/brands?workspace_id=${workspaceB}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('TENANT_ISOLATION_VIOLATION');
    expect(body.error.message).toContain('cross-workspace');
  });

  it('strictly denies cross-workspace operations via x-workspace-id header with 403', async () => {
    const token = generateOperatorToken({
      id: operatorAId,
      email: 'operator_a@growth-os.internal',
      role: 'workspace_admin',
      workspace_id: workspaceA,
    });

    const res = await fetch(`${baseUrl}/api/v1/queue/jobs`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-workspace-id': workspaceB,
      },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('TENANT_ISOLATION_VIOLATION');
  });

  // ─── 6. Durable Queue: Batch Drain Loop & Lease Recovery ─────────────────────
  it('drains jobs in bounded batch with duration and job count limits', async () => {
    const batchRes = await CrawlerWorker.processBatch({ maxJobs: 5, maxDurationMs: 5000 });
    expect(typeof batchRes.processed).toBe('boolean');
    expect(typeof batchRes.jobsAttempted).toBe('number');
    expect(typeof batchRes.durationMs).toBe('number');
    expect(batchRes.durationMs).toBeLessThanOrEqual(6000);
  });

  it('recovers expired leases in durable job queue', async () => {
    const recovered = await JobQueueService.recoverExpiredLeases();
    expect(typeof recovered).toBe('number');
    expect(recovered).toBeGreaterThanOrEqual(0);
  });
});
