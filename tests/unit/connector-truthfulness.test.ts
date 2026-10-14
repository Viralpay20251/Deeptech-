/**
 * Connector Truthfulness & P0 Elimination of Fake Tokens Test
 *
 * Verifies P0 Requirements:
 * 1. login-direct rejects requests with missing or empty credentials.
 * 2. login-direct rejects manufactured fake tokens (e.g. token_direct_*, linkedin_token_*).
 * 3. login-direct accepts genuine access tokens and records 4-dimension health status.
 * 4. health-check truthfully distinguishes between real credentials and unauthenticated connectors.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { Server } from 'http';
import { app } from '../../apps/api/src/index.js';
import { query } from '../../apps/api/src/lib/db.js';

const TEST_WS_ID = '00000000-0000-0000-0000-000000000001';

describe('P0: Connector Truthfulness & Elimination of Fake Tokens', () => {
  let server: Server;
  let baseUrl: string;

  const authHeaders = {
    'Content-Type': 'application/json',
    'x-operator-id': 'c4344661-4a88-46a9-b85d-c65303c37227',
    'x-service-key': process.env['INTERNAL_WORKSPACE_SECRET'] || 'growth_os_internal_session_secret_32_characters_minimum!',
  };

  beforeAll(async () => {
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

  beforeEach(async () => {
    // Reset test tokens in database
    await query(`DELETE FROM oauth_tokens WHERE workspace_id = $1`, [TEST_WS_ID]);
  });

  afterEach(async () => {
    await query(`DELETE FROM oauth_tokens WHERE workspace_id = $1`, [TEST_WS_ID]);
  });

  it('rejects login-direct when no credential or token is provided', async () => {
    const res = await fetch(`${baseUrl}/api/v1/connectors/login-direct`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        workspace_id: TEST_WS_ID,
        connector_type: 'google_search_console',
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('CREDENTIAL_REQUIRED');
    expect(body.error.message).toContain('A real access_token, api_key');
  });

  it('rejects manufactured placeholder tokens like token_direct_12345', async () => {
    const res = await fetch(`${baseUrl}/api/v1/connectors/login-direct`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        workspace_id: TEST_WS_ID,
        connector_type: 'google_search_console',
        access_token: `token_direct_${Date.now()}`,
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_CREDENTIAL');
    expect(body.error.message).toContain('does not appear to be a real credential');
  });

  it('truthfully connects when a genuine access token is supplied', async () => {
    const realToken = 'ya29.a0AfH6SMD_REAL_VERIFIED_OAUTH_TOKEN_EXAMPLE_LONG_STRING';
    const res = await fetch(`${baseUrl}/api/v1/connectors/login-direct`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        workspace_id: TEST_WS_ID,
        connector_type: 'google_search_console',
        access_token: realToken,
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.status).toBe('connected');

    // Verify token was actually persisted
    const checkDb = await query(
      `SELECT access_token FROM oauth_tokens WHERE workspace_id = $1 AND provider = 'google'`,
      [TEST_WS_ID]
    );
    expect(checkDb.rowCount).toBe(1);
    expect(checkDb.rows[0].access_token).toBe(realToken);
  });

  it('health check truthfully reports 4 dimensions', async () => {
    // 1. Initially without token -> awaiting_credentials
    const resBefore = await fetch(`${baseUrl}/api/v1/connectors/health-check`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        workspace_id: TEST_WS_ID,
        connector_type: 'google_search_console',
      }),
    });

    expect(resBefore.status).toBe(200);
    const bodyBefore = (await resBefore.json()) as any;
    expect(bodyBefore.data.config_ok).toBe(true);
    expect(bodyBefore.data.auth_ok).toBe(false);
    expect(bodyBefore.data.status).toBe('awaiting_credentials');

    // 2. Insert valid token -> reports connected
    await query(
      `INSERT INTO oauth_tokens (workspace_id, provider, access_token, scopes, expires_at)
       VALUES ($1, 'google', 'ya29.valid_token_test_string_12345678', ARRAY['https://www.googleapis.com/auth/webmasters.readonly'], NOW() + INTERVAL '30 days')`,
      [TEST_WS_ID]
    );
    await query(
      `UPDATE connector_instances SET last_health_check_at = NOW() WHERE workspace_id = $1 AND connector_type = 'google_search_console'`,
      [TEST_WS_ID]
    );

    const resAfter = await fetch(`${baseUrl}/api/v1/connectors/health-check`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        workspace_id: TEST_WS_ID,
        connector_type: 'google_search_console',
      }),
    });

    expect(resAfter.status).toBe(200);
    const bodyAfter = (await resAfter.json()) as any;
    expect(bodyAfter.data.config_ok).toBe(true);
    expect(bodyAfter.data.auth_ok).toBe(true);
    expect(bodyAfter.data.capability_ok).toBe(true);
    expect(bodyAfter.data.data_freshness_ok).toBe(true);
    expect(bodyAfter.data.status).toBe('connected');
  });
});
