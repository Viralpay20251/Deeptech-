/**
 * Integration Test: Transparent Outbound Redirect Router & Link API
 * Uses native Node http server and fetch (zero external test dependencies).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../../apps/api/src/index.js';

describe('Redirect Router API Integration', () => {
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

  it('returns 404 for an unknown short code', async () => {
    const res = await fetch(`${baseUrl}/r/unknown_code_999`, {
      redirect: 'manual',
    });
    expect(res.status).toBe(404);
  });

  it('creates a tracked link and performs 302 redirect with UTM preservation', async () => {
    // 1. Create a tracked link pointing to CHATR
    const createRes = await fetch(`${baseUrl}/api/v1/tracked-links`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        brand_id: '00000000-0000-0000-0001-000000000001', // CHATR brand ID
        target_url: 'https://chatr.chat',
        title: 'LinkedIn Launch Campaign',
        utm_source: 'linkedin',
        utm_medium: 'organic_social',
        utm_campaign: 'shoppable_video_beta',
      }),
    });

    expect(createRes.status).toBe(201);
    const createData = (await createRes.json()) as { success: boolean; data: { short_code: string } };
    expect(createData.success).toBe(true);
    const shortCode = createData.data.short_code;
    expect(shortCode).toBeTruthy();

    // 2. Request the redirect endpoint as a client browser (manual redirect to inspect 302 header)
    const redirectRes = await fetch(`${baseUrl}/r/${shortCode}?client_ref=partner_post`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Referer: 'https://www.linkedin.com/feed/',
      },
      redirect: 'manual',
    });

    expect(redirectRes.status).toBe(302);
    const location = redirectRes.headers.get('location');
    expect(location).toBeTruthy();
    expect(location).toContain('https://chatr.chat');
    expect(location).toContain('utm_source=linkedin');
    expect(location).toContain('utm_medium=organic_social');
    expect(location).toContain('utm_campaign=shoppable_video_beta');
    expect(location).toContain('client_ref=partner_post');

    // 3. List tracked links to verify recorded click
    const listRes = await fetch(
      `${baseUrl}/api/v1/tracked-links?brand_id=00000000-0000-0000-0001-000000000001`,
      { headers: authHeaders }
    );
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as { success: boolean; data: Array<{ short_code: string; clicks_total: number }> };
    expect(listData.success).toBe(true);
    const matchingLink = listData.data.find((l) => l.short_code === shortCode);
    expect(matchingLink).toBeDefined();
    expect(matchingLink!.clicks_total).toBeGreaterThanOrEqual(1);
  });
});
