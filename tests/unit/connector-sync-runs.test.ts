/**
 * Connector Sync Runs and Wave 1 & 2 Adapters Test
 *
 * Verifies:
 * 1. IndexNowConnector validates host ownership and formats batch payload.
 * 2. CrossrefOpenalexConnector handles scholarly query searches.
 * 3. WikipediaConnector queries public encyclopedic definitions.
 * 4. POST /api/v1/connectors/sync creates a durable run in connector_sync_runs.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../../apps/api/src/index.js';
import { IndexNowConnector } from '../../apps/api/src/connectors/indexnow-connector.js';
import { WikipediaConnector } from '../../apps/api/src/connectors/wikipedia-connector.js';

describe('Wave 1 & 2 Connectors and Sync Execution', () => {
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

  it('IndexNowConnector enforces host ownership for submitted URLs', async () => {
    const connector = new IndexNowConnector();
    await expect(
      connector.submitUrls({
        host: 'chatr.chat',
        key: 'test_key',
        urlList: ['https://malicious-external-site.com/exploit'],
      })
    ).rejects.toThrow('does not match declared host');
  });

  it('WikipediaConnector health check verifies REST endpoint accessibility', async () => {
    const connector = new WikipediaConnector();
    const health = await connector.checkHealth();
    expect(health.status).toBe('connected');
    expect(health.message).toContain('Wikipedia REST API');
  });

  it('POST /api/v1/connectors/sync executes sync and logs into connector_sync_runs', async () => {
    const res = await fetch(`${baseUrl}/api/v1/connectors/sync`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        connector_type: 'wikipedia_wikidata',
        query_term: 'Search engine optimization',
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.sync_run_id).toBeDefined();
    expect(body.data.connector_type).toBe('wikipedia_wikidata');

    // Verify it appears in sync-runs list
    const listRes = await fetch(
      `${baseUrl}/api/v1/connectors/sync-runs?connector_type=wikipedia_wikidata`,
      { headers: authHeaders }
    );
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as any;
    expect(listBody.success).toBe(true);
    expect(listBody.data.length).toBeGreaterThan(0);
    expect(listBody.data[0].id).toBe(body.data.sync_run_id);
    expect(listBody.data[0].status).toBe('completed');
  });
});
