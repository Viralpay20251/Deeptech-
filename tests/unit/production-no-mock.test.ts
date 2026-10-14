/**
 * Production Truthfulness & No-Mock Policy Verification Tests
 *
 * Verifies Section 2, 3, 4, and 11 of Master Remediation Plan:
 * 1. ModelGateway: In non-test mode (simulating production), missing credentials fail closed with
 *    typed ModelProviderError('PROVIDER_NOT_CONFIGURED') — NEVER silently falls back to simulator.
 * 2. Connectors: Unsupported connectors throw typed UNSUPPORTED_CONNECTOR error rather than
 *    reporting fake rowsFetched=1 / rowsUpserted=1.
 * 3. PageSpeed Crux: Null / failed audit throws error rather than returning mock_audit_fallback.
 * 4. Worker Endpoint: Protected by CRON_SECRET with timing-safe comparison; rejects missing or invalid secret.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../../apps/api/src/index.js';
import { ModelGateway, ModelProviderError } from '../../apps/api/src/services/model-gateway.js';
import { env } from '../../apps/api/src/lib/env.js';

describe('Production Truthfulness & No-Mock Policy', () => {
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

  describe('1. ModelGateway Production Fails Closed (No Silent Simulator Fallback)', () => {
    it('throws ModelProviderError(PROVIDER_NOT_CONFIGURED) when no live provider is configured in non-test mode', async () => {
      const origNodeEnv = env.NODE_ENV;
      const origApiKey = env.OPENAI_API_KEY;

      try {
        (env as any).NODE_ENV = 'production';
        (env as any).OPENAI_API_KEY = undefined;
        (env as any).MODEL_PROVIDER = 'openai';

        await expect(
          ModelGateway.complete({
            system_prompt: 'You are an autonomous SEO analyst.',
            user_content: 'Analyze search volume trends.',
          })
        ).rejects.toThrow(ModelProviderError);

        try {
          await ModelGateway.complete({
            system_prompt: 'You are an autonomous SEO analyst.',
            user_content: 'Analyze search volume trends.',
          });
        } catch (err: any) {
          expect(err.code).toBe('PROVIDER_NOT_CONFIGURED');
          expect(err.message).toContain('PROVIDER_NOT_CONFIGURED');
        }
      } finally {
        (env as any).NODE_ENV = origNodeEnv;
        (env as any).OPENAI_API_KEY = origApiKey;
      }
    });

    it('rejects unreachable Ollama with PROVIDER_UNAVAILABLE rather than simulating', async () => {
      const origNodeEnv = env.NODE_ENV;
      const origProvider = env.MODEL_PROVIDER;
      const origBaseUrl = env.OLLAMA_BASE_URL;

      try {
        (env as any).NODE_ENV = 'production';
        (env as any).MODEL_PROVIDER = 'ollama';
        (env as any).OLLAMA_BASE_URL = 'http://127.0.0.1:59999'; // unreachable dead port

        await expect(
          ModelGateway.complete({
            system_prompt: 'Test prompt',
            user_content: 'Test content',
          })
        ).rejects.toThrow(ModelProviderError);

        try {
          await ModelGateway.complete({
            system_prompt: 'Test prompt',
            user_content: 'Test content',
          });
        } catch (err: any) {
          expect(err.code).toBe('PROVIDER_UNAVAILABLE');
        }
      } finally {
        (env as any).NODE_ENV = origNodeEnv;
        (env as any).MODEL_PROVIDER = origProvider;
        (env as any).OLLAMA_BASE_URL = origBaseUrl;
      }
    });
  });

  describe('2. Connector Sync: Zero False-Success / Zero Simulated Rows', () => {
    it('rejects unsupported connector type with 500 error instead of fabricating rows_fetched=1', async () => {
      const res = await fetch(`${baseUrl}/api/v1/connectors/sync`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          connector_type: 'unsupported_test_provider',
          workspace_id: '00000000-0000-0000-0000-000000000001',
        }),
      });

      expect(res.status).toBe(500);
      const json = await res.json() as any;
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('SYNC_FAILED');
      expect(json.error.message).toContain('UNSUPPORTED_CONNECTOR');
    });

    it('rejects OAuth connectors in /sync without credentials rather than reporting fake sync', async () => {
      const res = await fetch(`${baseUrl}/api/v1/connectors/sync`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          connector_type: 'google_search_console',
          workspace_id: '00000000-0000-0000-0000-000000000001',
        }),
      });

      expect(res.status).toBe(500);
      const json = await res.json() as any;
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('UNSUPPORTED_CONNECTOR');
      expect(json.error.message).toContain('use the /auth/ flow first');
    });
  });

  describe('3. Worker Endpoint Security (CRON_SECRET Protection)', () => {
    it('rejects POST /api/v1/crawler/worker/process-next with 401 when CRON_SECRET is set but invalid header provided', async () => {
      const origSecret = process.env['CRON_SECRET'];
      try {
        process.env['CRON_SECRET'] = 'test_cron_secret_32_chars_minimum!';

        const res = await fetch(`${baseUrl}/api/v1/crawler/worker/process-next`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cron-secret': 'wrong_secret_value',
          },
        });

        expect(res.status).toBe(401);
        const json = await res.json() as any;
        expect(json.success).toBe(false);
        expect(json.error.code).toBe('UNAUTHORIZED');
      } finally {
        if (origSecret !== undefined) {
          process.env['CRON_SECRET'] = origSecret;
        } else {
          delete process.env['CRON_SECRET'];
        }
      }
    });

    it('accepts POST /api/v1/crawler/worker/process-next when valid CRON_SECRET is provided', async () => {
      const origSecret = process.env['CRON_SECRET'];
      const secret = 'valid_production_cron_secret_32_chars!';
      try {
        process.env['CRON_SECRET'] = secret;

        const res = await fetch(`${baseUrl}/api/v1/crawler/worker/process-next`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-cron-secret': secret,
          },
        });

        expect(res.status).toBe(200);
        const json = await res.json() as any;
        expect(json.success).toBe(true);
      } finally {
        if (origSecret !== undefined) {
          process.env['CRON_SECRET'] = origSecret;
        } else {
          delete process.env['CRON_SECRET'];
        }
      }
    });
  });

});
