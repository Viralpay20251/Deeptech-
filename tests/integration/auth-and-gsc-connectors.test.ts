/**
 * Integration Test: Operator Authentication & GSC Connectors Framework
 *
 * Verifies:
 * 1. GET /api/v1/auth/session bootstraps an authentic operator session with signed JWT token
 * 2. Protected endpoints (/api/v1/workflows/trigger) authenticate successfully using the bootstrapped token
 * 3. GET /api/v1/auth/me returns operator user profile
 * 4. POST /api/v1/auth/service-account validates Service Account credentials and links GSC & GA4
 * 5. GET /api/v1/auth/connectors-status returns truthful status across all connectors and GSC properties
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../../apps/api/src/index.js';
import { query } from '../../apps/api/src/lib/db.js';

describe('Operator Authentication & GSC Connectors Integration', () => {
  let server: Server;
  let baseUrl: string;
  let operatorToken: string;

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

  it('1. GET /api/v1/auth/session bootstraps a signed JWT operator session without prior auth', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/session`);
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;

    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('token');
    expect(json.data.token_type).toBe('Bearer');
    expect(json.data.user.role).toBe('workspace_admin');
    expect(json.data.user.email).toBe('operator@growth-os.internal');

    operatorToken = json.data.token;
    expect(operatorToken).toMatch(/^eyJ/);
  });

  it('2. GET /api/v1/auth/me verifies the operator identity using the token', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${operatorToken}`,
      },
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.user.role).toBe('workspace_admin');
  });

  it('3. Protected endpoint POST /api/v1/workflows/trigger executes successfully with operator token', async () => {
    const res = await fetch(`${baseUrl}/api/v1/workflows/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${operatorToken}`,
      },
      body: JSON.stringify({
        brand_id: '00000000-0000-0000-0001-000000000001',
        idempotency_key: `test_token_auth_${Date.now()}`,
        signal_summary: {
          topic: 'Autonomous GSC Indexing & Telemetry 2026',
          source_url: 'https://chatr.chat',
          raw_text: 'Verified enterprise demand for real-time GSC indexing automation.',
          intent_type: 'commercial_investigation',
          search_queries: [{ query: 'gsc indexing automation', impressions: 320, clicks: 15, position: 5.4 }],
        },
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('run_id');
  });

  it('4. POST /api/v1/auth/service-account validates and registers Google Cloud Service Account', async () => {
    const mockServiceAccount = {
      type: 'service_account',
      project_id: 'deeptech-omnipulse-gsc',
      private_key_id: 'key123456789',
      private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n',
      client_email: 'omnipulse-bot@deeptech-omnipulse-gsc.iam.gserviceaccount.com',
      client_id: '10987654321',
    };

    const res = await fetch(`${baseUrl}/api/v1/auth/service-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${operatorToken}`,
      },
      body: JSON.stringify({
        service_account_json: mockServiceAccount,
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data.client_email).toBe('omnipulse-bot@deeptech-omnipulse-gsc.iam.gserviceaccount.com');
    expect(json.data.status).toBe('connected');
    expect(json.data.properties_authorized).toBe(26);

    // Verify database record in oauth_tokens
    const tokenRow = await query(
      `SELECT provider, scopes, expires_at FROM oauth_tokens WHERE provider = 'google'`
    );
    expect(tokenRow.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('5. GET /api/v1/auth/connectors-status reports live status of GSC and connectors', async () => {
    const res = await fetch(`${baseUrl}/api/v1/auth/connectors-status`, {
      headers: {
        Authorization: `Bearer ${operatorToken}`,
      },
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.success).toBe(true);
    expect(json.data).toHaveProperty('oauth_tokens');
    expect(json.data).toHaveProperty('connectors');
    expect(json.data.gsc_properties_count).toBe(26);
  });
});
