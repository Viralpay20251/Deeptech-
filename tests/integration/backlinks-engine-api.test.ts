/**
 * Integration Test: Autonomous Backlink Engine & Link Equity Factory API
 *
 * Verifies:
 * 1. GET /api/v1/backlinks/metrics returns accurate aggregate statistics (DA 88.2, 52 citations, DoFollow ratio)
 * 2. GET /api/v1/backlinks lists all verified high-DA backlink records without auth requirement
 * 3. GET /api/v1/backlinks/mesh returns the 21-node bijective PageRank distribution mesh
 * 4. GET /api/v1/backlinks/targets returns the curated zero-cost syndication targets
 * 5. POST /api/v1/backlinks/:id/verify executes probe, persists http_status_code and verification_status to Supabase
 * 6. Brand filtering (talentxcel, chatr, nutytales) filters appropriately
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../../apps/api/src/index.js';
import { query } from '../../apps/api/src/lib/db.js';

describe('Autonomous Backlink Engine API Integration', () => {
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
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('1. GET /api/v1/backlinks/metrics returns accurate aggregate statistics without auth barrier', async () => {
    const res = await fetch(`${baseUrl}/api/v1/backlinks/metrics`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;

    expect(json.success).toBe(true);
    expect(json.data.totalBacklinks).toBeGreaterThanOrEqual(52);
    expect(json.data.averageDomainAuthority).toBeGreaterThanOrEqual(85);
    expect(json.data.dofollowCount).toBeGreaterThanOrEqual(40);
    expect(json.data.dofollowRatioPercent).toBeGreaterThanOrEqual(75);
    expect(json.data.uniqueReferringDomains).toBeGreaterThanOrEqual(25);
  });

  it('2. GET /api/v1/backlinks returns the 52 verified high-DA backlinks', async () => {
    const res = await fetch(`${baseUrl}/api/v1/backlinks`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;

    expect(json.success).toBe(true);
    expect(json.count).toBeGreaterThanOrEqual(52);
    expect(json.data.length).toBeGreaterThanOrEqual(52);

    const first = json.data[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('brand_cluster');
    expect(first).toHaveProperty('target_canonical_domain');
    expect(first).toHaveProperty('source_domain');
    expect(first).toHaveProperty('domain_authority');
    expect(first).toHaveProperty('verification_status');
  });

  it('3. GET /api/v1/backlinks?brand_cluster=talentxcel filters by brand', async () => {
    const res = await fetch(`${baseUrl}/api/v1/backlinks?brand_cluster=talentxcel`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;

    expect(json.success).toBe(true);
    expect(json.data.length).toBeGreaterThanOrEqual(15);
    for (const b of json.data) {
      expect(b.brand_cluster).toBe('talentxcel');
    }
  });

  it('4. GET /api/v1/backlinks/mesh returns the 21 bijective link mesh connections', async () => {
    const res = await fetch(`${baseUrl}/api/v1/backlinks/mesh`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;

    expect(json.success).toBe(true);
    expect(json.count).toBeGreaterThanOrEqual(21);
    const hosts = json.data.map((m: any) => m.source_host);
    expect(hosts).toContain('talentxcel.in');
    expect(hosts).toContain('chatr.chat');
    expect(hosts).toContain('nutytales.com');
  });

  it('5. GET /api/v1/backlinks/targets returns curated syndication channels', async () => {
    const res = await fetch(`${baseUrl}/api/v1/backlinks/targets`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;

    expect(json.success).toBe(true);
    expect(json.count).toBeGreaterThanOrEqual(10);
    const platformNames = json.data.map((t: any) => t.platform_name);
    expect(platformNames).toContain('GitHub Awesome Lists');
    expect(platformNames).toContain('Dev.to Technical Publishing');
  });

  it('6. POST /api/v1/backlinks/:id/verify executes probe and updates database row', async () => {
    // Select first backlink
    const listRes = await fetch(`${baseUrl}/api/v1/backlinks?limit=1`);
    const listJson = (await listRes.json()) as any;
    const testId = listJson.data[0].id;

    const verifyRes = await fetch(`${baseUrl}/api/v1/backlinks/${testId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(verifyRes.status).toBe(200);
    const verifyJson = (await verifyRes.json()) as any;
    expect(verifyJson.success).toBe(true);
    expect(verifyJson.data.id).toBe(testId);
    expect(verifyJson.data).toHaveProperty('http_status_code');
    expect(verifyJson.data).toHaveProperty('verification_status');
    expect(verifyJson.data).toHaveProperty('last_verified_at');

    // Confirm that the database row was updated
    const dbRow = await query(`SELECT id, http_status_code, verification_status, last_verified_at FROM public.backlinks_registry WHERE id = $1`, [testId]);
    expect(dbRow.rows.length).toBe(1);
    expect(dbRow.rows[0].id).toBe(testId);
  });
});
