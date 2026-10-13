/**
 * Integration Test: Meta Tags Studio V3 API Endpoints
 * Tests inspection, image checking, validation, generation, proposal lifecycle, and security controls.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../../apps/api/src/index.js';

describe('Meta Tags Studio V3 API Integration', () => {
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

  it('POST /api/v1/meta-studio/inspect rejects unsafe loopback / internal URLs', async () => {
    const res = await fetch(`${baseUrl}/api/v1/meta-studio/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'http://127.0.0.1:8080/admin',
      }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { success: boolean; error: { code: string; message: string } };
    expect(json.error.message).toMatch(/internal|private|loopback|SSRF|not permitted|invalid/i);
  });

  it('POST /api/v1/meta-studio/image-check rejects SSRF loopback image addresses', async () => {
    const res = await fetch(`${baseUrl}/api/v1/meta-studio/image-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: 'http://169.254.169.254/latest/meta-data',
      }),
    });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { success: boolean; error: { code: string; message: string } };
    expect(json.error.message).toMatch(/internal|private|metadata|meta-data|blocked|SSRF/i);
  });

  it('POST /api/v1/meta-studio/validate generates explainable diagnostics', async () => {
    const res = await fetch(`${baseUrl}/api/v1/meta-studio/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page_url: 'https://chatr.chat/features',
        title: 'Too short',
        meta_description: '',
        canonical_url: 'https://chatr.chat/features',
        h1: 'CHATR Features',
        image_url: null,
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: {
        overallScore: number;
        status: string;
        findings: Array<{ ruleId: string; category: string; severity: string }>;
      };
    };
    expect(json.success).toBe(true);
    expect(json.data.overallScore).toBeLessThan(90);
    expect(json.data.findings.some((f) => f.ruleId === 'COMP_DESC_MISSING')).toBe(true);
  });

  it('POST /api/v1/meta-studio/generate creates multi-candidate tags with zero-invention policy', async () => {
    const res = await fetch(`${baseUrl}/api/v1/meta-studio/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page_url: 'https://chatr.chat/conversational-video',
        brand_name: 'CHATR',
        brand_domain: 'https://chatr.chat',
        page_title: 'Conversational Video Platform for High-Velocity Teams',
        page_description: 'Streamline team communication and asynchronous updates with interactive conversational video.',
        target_keyword: 'conversational video',
        schema_type: 'SoftwareApplication',
      }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: {
        titleCandidates: Array<{ variant: string; text: string; estimatedPixelWidth: number }>;
        descriptionCandidates: Array<{ variant: string; text: string; estimatedPixelWidth: number }>;
        openGraph: Record<string, string>;
        twitterCard: Record<string, string>;
        jsonLd: Record<string, any>;
        notice: string;
      };
    };

    expect(json.success).toBe(true);
    expect(json.data.titleCandidates.length).toBeGreaterThanOrEqual(3);
    expect(json.data.descriptionCandidates.length).toBeGreaterThanOrEqual(3);
    expect(json.data.openGraph['og:title']).toBeDefined();
    // Verify no synthetic timestamps were injected in jsonLd
    expect(json.data.jsonLd.datePublished).toBeUndefined();
    expect(json.data.notice).toContain('Draft generated from operator inputs');
  });

  it('manages metadata proposals lifecycle: create, list, and decide', async () => {
    const workspaceId = '00000000-0000-0000-0000-000000000001';

    // 1. Create a proposal
    const createRes = await fetch(`${baseUrl}/api/v1/meta-studio/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: workspaceId,
        url: 'https://chatr.chat/pricing',
        proposal_type: 'meta_tags',
        payload: {
          title: 'Transparent Pricing for Enterprise Conversational Video | CHATR',
          description: 'Explore scalable pricing tiers for autonomous video messaging and enterprise collaboration.',
          canonical: 'https://chatr.chat/pricing',
        },
        observed_payload: {
          title: 'Pricing Page',
          description: '',
        },
        notes: 'Verified against brand guidelines and SEO standards.',
      }),
    });

    expect(createRes.status).toBe(200);
    const createJson = (await createRes.json()) as { success: boolean; data: { id: string; status: string } };
    expect(createJson.success).toBe(true);
    expect(createJson.data.id).toBeDefined();
    expect(createJson.data.status).toBe('draft');
    const proposalId = createJson.data.id;

    // 2. List proposals
    const listRes = await fetch(`${baseUrl}/api/v1/meta-studio/proposals?workspace_id=${workspaceId}`);
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { success: boolean; data: Array<{ id: string }> };
    expect(listJson.success).toBe(true);
    expect(listJson.data.some((p) => p.id === proposalId)).toBe(true);

    // 3. Approve proposal
    const decideRes = await fetch(`${baseUrl}/api/v1/meta-studio/proposals/${proposalId}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: 'approved',
        notes: 'Verified against brand guidelines and SEO standards.',
      }),
    });

    expect(decideRes.status).toBe(200);
    const decideJson = (await decideRes.json()) as { success: boolean; message: string };
    expect(decideJson.success).toBe(true);
    expect(decideJson.message).toContain('approved');
  });
});
