/**
 * Integration Test: Independent Public Publishing Surface & Attribution Reconciliation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../../apps/api/src/index.js';

describe('Public Publishing Surface & Traffic Reconciliation Integration', () => {
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

  it('serves the published anchor page with complete SEO and attribution CTA', async () => {
    const res = await fetch(`${baseUrl}/p/shoppable-video-architecture-benchmark`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');

    const html = await res.text();
    expect(html).toContain('Interactive Shoppable Video Architecture & Zero-Latency Checkout Benchmark (2026)');
    expect(html).toContain('schema.org');
    expect(html).toContain('/r/chatr-v1');
    expect(html).toContain('Explore CHATR Video Commerce');
  });

  it('serves a valid sitemap.xml listing published articles', async () => {
    const res = await fetch(`${baseUrl}/sitemap.xml`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/xml');

    const xml = await res.text();
    expect(xml).toContain('<urlset');
    expect(xml).toContain('shoppable-video-architecture-benchmark');
    expect(xml).toContain('tech-leadership-compensation-index-2026');
  });

  it('serves robots.txt with sitemap directive and no .internal domains', async () => {
    const res = await fetch(`${baseUrl}/robots.txt`);
    expect(res.status).toBe(200);

    const txt = await res.text();
    expect(txt).toContain('User-agent: *');
    expect(txt).toContain('Allow: /p/');
    expect(txt).toContain('Sitemap:');
    expect(txt).not.toContain('.internal');
  });

  it('reports truthful scorecards with unverified product MAU and separated Nuty Tales purchasers', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/scorecards`, { headers: authHeaders });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      success: boolean;
      data: Array<{
        brand_slug: string;
        mau_status: string;
        current_verified_product_mau: unknown;
        measured_traffic_layers: {
          os_public_page_views: number;
          outbound_tracked_clicks: { total: number };
        };
        purchasers_separation_note?: string;
      }>;
    };

    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(3);

    for (const card of body.data) {
      expect(card.mau_status).toBe('unverified');
      expect(card.current_verified_product_mau).toBeNull();
      expect(card.measured_traffic_layers).toBeDefined();
    }

    const nutyCard = body.data.find((c) => c.brand_slug === 'nuty-tales');
    expect(nutyCard?.purchasers_separation_note).toContain('Purchasers are reported strictly separately');
  });

  it('serves attribution reconciliation endpoint', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analytics/reconciliation`, { headers: authHeaders });
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      success: boolean;
      data: {
        clickClassificationBreakdown: unknown[];
        osPublishedPages: Array<{ slug: string }>;
        attributionPrinciples: { associationOnly: string; botFiltering: string };
      };
    };

    expect(body.success).toBe(true);
    expect(body.data.osPublishedPages.length).toBeGreaterThanOrEqual(1);
    expect(body.data.attributionPrinciples.associationOnly).toBeTruthy();
  });
});
