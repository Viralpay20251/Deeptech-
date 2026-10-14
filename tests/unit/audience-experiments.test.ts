/**
 * Audience Insights & Experiment Management Test (P6)
 *
 * Verifies:
 * 1. GET /api/v1/analytics/audience-insights enforces non-conflation of GA4 sessions with brand MAU.
 * 2. Nuty Tales separates engaged audience from purchasing customers.
 * 3. POST /api/v1/analytics/experiments proposes acquisition experiment with stopping rules.
 * 4. GET /api/v1/analytics/experiments retrieves proposed experiments.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../../apps/api/src/index.js';

describe('P6: Audience Insights & Experiment Management', () => {
  let server: Server;
  let baseUrl: string;

  const authHeaders = {
    'Content-Type': 'application/json',
    'x-operator-id': 'c4344661-4a88-46a9-b85d-c65303c37227',
    'x-service-key': process.env['INTERNAL_WORKSPACE_SECRET'] || 'growth_os_internal_session_secret_32_characters_minimum!',
  };

  beforeAll(async () => {
    const { query } = await import('../../apps/api/src/lib/db.js');
    await query(
      `INSERT INTO users (id, workspace_id, email, display_name, password_hash, role)
       VALUES ('c4344661-4a88-46a9-b85d-c65303c37227', '00000000-0000-0000-0000-000000000001', 'operator@growth-os.internal', 'Test Operator', 'hash', 'workspace_admin')
       ON CONFLICT (id) DO UPDATE SET role = 'workspace_admin'`
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

  it('GET /api/v1/analytics/audience-insights reports non-conflation policy across brands', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/audience-insights`, { headers: authHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    for (const brand of body.data) {
      expect(brand.ga4_sessions_counted_as_mau).toBe(false);
      expect(brand.non_conflation_policy).toContain('Strict: GA4 sessions');
    }

    const nuty = body.data.find((b: any) => b.brand_slug === 'nuty-tales');
    expect(nuty).toBeDefined();
    expect(nuty.active_audience_vs_buyers_separation).toBeDefined();
    expect(nuty.active_audience_vs_buyers_separation.purchasing_customers).toContain('confirmed paid orders');
  });

  it('POST /api/v1/analytics/experiments records a proposed experiment', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/experiments`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        brand_id: '00000000-0000-0000-0001-000000000001',
        hypothesis: 'Interactive video landing page increases verified productivity interaction rate by 20%',
        channel: 'organic_search',
        primary_metric: 'meaningful_ai_productivity_interaction',
        baseline_value: 4.2,
        expected_lift_pct: 20.0,
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    expect(body.data.status).toBe('proposed');

    // List experiments
    const listRes = await fetch(`${baseUrl}/api/v1/analytics/experiments`, { headers: authHeaders });
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as any;
    expect(listBody.data.some((e: any) => e.id === body.data.id)).toBe(true);
  });
});
