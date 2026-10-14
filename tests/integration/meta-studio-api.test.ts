/**
 * Integration Test: Meta Tags Studio V3 API Endpoints
 * Tests inspection, image checking, validation, generation, proposal lifecycle, and security controls.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { Server } from 'http';
import { app } from '../../apps/api/src/index.js';
import { query } from '../../apps/api/src/lib/db.js';

describe('Meta Tags Studio V3 API Integration', () => {
  let server: Server;
  let baseUrl: string;
  let authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };

  beforeAll(async () => {
    // Look up or ensure an operator in workspace
    const userRes = await query<{ id: string }>(
      `SELECT id FROM users WHERE role IN ('workspace_admin', 'operator', 'reviewer') LIMIT 1`
    );
    let opId = userRes.rows[0]?.id;
    if (!opId) {
      const ins = await query<{ id: string }>(
        `INSERT INTO users (id, workspace_id, email, display_name, password_hash, role)
         VALUES ('c4344661-4a88-46a9-b85d-c65303c37227', '00000000-0000-0000-0000-000000000001', 'operator@growth-os.internal', 'Test Operator', 'hash', 'workspace_admin')
         ON CONFLICT (id) DO NOTHING
         RETURNING id`
      );
      opId = ins.rows[0]?.id || 'c4344661-4a88-46a9-b85d-c65303c37227';
    }
    authHeaders = {
      'Content-Type': 'application/json',
      'x-operator-id': opId,
    };

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
      headers: authHeaders,
      body: JSON.stringify({
        decision: 'approved',
        notes: 'Verified against brand guidelines and SEO standards.',
      }),
    });

    expect(decideRes.status).toBe(200);
    const decideJson = (await decideRes.json()) as { success: boolean; message: string };
    expect(decideJson.success).toBe(true);
    expect(decideJson.message).toContain('approved');

    // 4. P0 Tenant Isolation: An unauthorized workspace cannot decide this proposal
    const rogueWsRes = await fetch(`${baseUrl}/api/v1/meta-studio/proposals/${proposalId}/decide`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        workspace_id: '00000000-0000-0000-0000-000000000002', // different workspace
        decision: 'rejected',
      }),
    });
    expect(rogueWsRes.status).toBe(404);
    const rogueJson = (await rogueWsRes.json()) as { success: boolean; error: { code: string } };
    expect(rogueJson.error.code).toBe('PROPOSAL_NOT_FOUND');

    // 5. P0 Proposal State Validation: Cannot re-decide an already approved proposal
    const reDecideRes = await fetch(`${baseUrl}/api/v1/meta-studio/proposals/${proposalId}/decide`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        workspace_id: workspaceId,
        decision: 'rejected',
      }),
    });
    expect(reDecideRes.status).toBe(409);
    const reDecideJson = (await reDecideRes.json()) as { success: boolean; error: { code: string } };
    expect(reDecideJson.error.code).toBe('INVALID_PROPOSAL_STATE');
  });

  it('P1: blocks approval when schema has ungrounded claims with 422 unless explicit operator override is provided', async () => {
    const workspaceId = '00000000-0000-0000-0000-000000000001';

    // Create proposal with fabricated product pricing not in observed page
    const createRes = await fetch(`${baseUrl}/api/v1/meta-studio/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: workspaceId,
        url: 'https://chatr.chat/enterprise-tier',
        proposal_type: 'json_ld',
        payload: {
          title: 'CHATR Enterprise Tier',
          jsonLd: {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: 'CHATR Enterprise Tier',
            offers: {
              '@type': 'Offer',
              price: '9999.00',
              priceCurrency: 'USD',
            },
          },
        },
        observed_payload: {
          title: 'CHATR Enterprise Tier',
          h1: 'Enterprise Tier',
          offers: null,
          productPrice: null,
        },
        notes: 'Testing ungrounded schema rejection',
      }),
    });

    const createJson = (await createRes.json()) as { data: { id: string } };
    const proposalId = createJson.data.id;

    // Try to approve without override -> blocked with 422
    const blockedRes = await fetch(`${baseUrl}/api/v1/meta-studio/proposals/${proposalId}/decide`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        workspace_id: workspaceId,
        decision: 'approved',
        override_grounding_warnings: false,
      }),
    });
    expect(blockedRes.status).toBe(422);
    const blockedJson = (await blockedRes.json()) as { error: { code: string; message: string } };
    expect(blockedJson.error.code).toBe('UNGROUNDED_SCHEMA_VIOLATION');
    expect(blockedJson.error.message).toContain('COMMERCIAL_OFFER_FABRICATION');

    // Approve WITH explicit operator override -> succeeds with 200
    const overrideRes = await fetch(`${baseUrl}/api/v1/meta-studio/proposals/${proposalId}/decide`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        workspace_id: workspaceId,
        decision: 'approved',
        override_grounding_warnings: true,
        notes: 'Operator verified off-page contract pricing with sales leadership.',
      }),
    });
    expect(overrideRes.status).toBe(200);
  });

  it('P1 & P2: queries cross-page intelligence, records outcomes, and builds Metadata Intelligence Graph', async () => {
    const workspaceId = '00000000-0000-0000-0000-000000000001';

    // 1. Cross-page intelligence
    const intelRes = await fetch(`${baseUrl}/api/v1/meta-studio/cross-page-intelligence?workspace_id=${workspaceId}`);
    expect(intelRes.status).toBe(200);
    const intelJson = (await intelRes.json()) as { success: boolean; data: { healthDistribution: any; duplicateTitles: any[] } };
    expect(intelJson.success).toBe(true);
    expect(intelJson.data.healthDistribution).toBeDefined();

    // 2. Intelligence Graph linking Crawled URL -> Observed -> Findings -> Evidence -> Proposals -> Outcomes
    const graphRes = await fetch(`${baseUrl}/api/v1/meta-studio/intelligence-graph?workspace_id=${workspaceId}`);
    expect(graphRes.status).toBe(200);
    const graphJson = (await graphRes.json()) as {
      success: boolean;
      data: {
        nodes: Array<{ url: string; pipelineStage: string }>;
        summary: { totalUrls: number; stageBreakdown: Record<string, number> };
      };
    };
    expect(graphJson.success).toBe(true);
    expect(Array.isArray(graphJson.data.nodes)).toBe(true);
    expect(graphJson.data.summary.stageBreakdown).toBeDefined();
  });
});
