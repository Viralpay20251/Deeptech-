/**
 * Integration Test: Connectors Direct Login and Approval Queue Decisions
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../../apps/api/src/index.js';

describe('Connectors & Approvals Integration', () => {
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

  it('lists connector instances including core search, analytics and social connectors', async () => {
    const res = await fetch(`${baseUrl}/api/v1/connectors/instances`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: Array<{ connector_type: string; status: string }> };
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);

    const types = json.data.map((c) => c.connector_type);
    expect(types).toContain('sitemap_rss_inspector');
    expect(types).toContain('google_search_console');
  });

  it('connects a connector directly via login-direct endpoint', async () => {
    const res = await fetch(`${baseUrl}/api/v1/connectors/login-direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connector_type: 'linkedin',
        access_token: 'test_operator_token_123',
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; status: string };
    expect(json.success).toBe(true);
    expect(json.status).toBe('connected');

    // Verify it now reflects as connected in instances
    const listRes = await fetch(`${baseUrl}/api/v1/connectors/instances`);
    const listJson = (await listRes.json()) as { data: Array<{ connector_type: string; status: string }> };
    const linkedin = listJson.data.find((c) => c.connector_type === 'linkedin');
    expect(linkedin?.status).toBe('connected');
  });

  it('disconnects a connector cleanly', async () => {
    const res = await fetch(`${baseUrl}/api/v1/connectors/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connector_type: 'linkedin',
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; status: string };
    expect(json.success).toBe(true);
    expect(json.status).toBe('awaiting_credentials');
  });

  it('returns valid validation error when connector_type is missing in login-direct', async () => {
    const res = await fetch(`${baseUrl}/api/v1/connectors/login-direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { success: boolean; error: { code: string } };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});
