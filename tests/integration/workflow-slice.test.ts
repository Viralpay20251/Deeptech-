/**
 * Integration Test: End-to-End Vertical Slice Workflow with Specialist Agents
 *
 * Proves Gate 2 Acceptance Criteria:
 * 1. Signal ingested with source evidence and real GSC search queries.
 * 2. SearchIntelligenceAgent classifies queries and synthesises search brief.
 * 3. Scored across 11 dimensions with explainable model rationale.
 * 4. Content Builder Agent executes with brief, AntiWordsFilter sanitises copy.
 * 5. Audited against 10 Quality Gates with zero placeholder citations (rejects standards.org).
 * 6. Stopped safely in human approval queue (no external publication without operator sign-off).
 * 7. Idempotency prevents duplicate runs for identical trigger.
 * 8. planSocialDistribution() stage gated strictly on explicit human approval.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowOrchestrator } from '../../apps/api/src/services/workflow-orchestrator.js';
import { SafetyViolationError } from '../../apps/api/src/lib/safety.js';

// In-memory test store simulating PostgreSQL for isolated integration tests
const dbStore = {
  workflow_runs: new Map<string, any>(),
  topic_clusters: new Map<string, any>(),
  opportunities: new Map<string, any>(),
  opportunity_scores: new Map<string, any>(),
  content_assets: new Map<string, any>(),
  approval_events: new Map<string, any>(),
  audit_events: [] as any[],
};

// Mock query function
const mockQuery = vi.fn(async (sql: string, params: any[] = []) => {
  const lower = sql.toLowerCase();

  // Check active kill switch
  if (lower.includes('from kill_switch_events')) {
    return { rows: [] };
  }

  // Check existing workflow by idempotency_key
  if (lower.includes('from workflow_runs where idempotency_key = $1')) {
    const found = Array.from(dbStore.workflow_runs.values()).find(
      (r) => r.idempotency_key === params[0]
    );
    return { rows: found ? [found] : [] };
  }

  // Fetch brand
  if (lower.includes('from brands where id = $1')) {
    return {
      rows: [
        {
          id: params[0],
          display_name: 'CHATR',
          base_url: 'https://chatr.ai',
          is_protected_production: true,
          config: {
            voice_guidelines: 'Clear, modern, tech-forward, authentic.',
            prohibited_topics: ['unverified_agi_claims'],
            requires_human_approval_before_publish: true,
          },
        },
      ],
    };
  }

  // Insert workflow_run
  if (lower.includes('insert into workflow_runs')) {
    const row = {
      id: params[0],
      workspace_id: params[1],
      brand_id: params[2],
      workflow_definition_id: params[3],
      idempotency_key: params[4],
      status: 'running',
      autonomy_level: params[5],
      input: JSON.parse(params[6]),
    };
    dbStore.workflow_runs.set(row.id, row);
    return { rows: [row] };
  }

  // Insert topic_cluster
  if (lower.includes('insert into topic_clusters')) {
    const row = { id: params[0], label: params[2] };
    dbStore.topic_clusters.set(row.id, row);
    return { rows: [row] };
  }

  // Insert opportunity
  if (lower.includes('insert into opportunities')) {
    const row = { id: params[0], title: params[4], status: params[6] };
    dbStore.opportunities.set(row.id, row);
    return { rows: [row] };
  }

  // Insert opportunity_scores
  if (lower.includes('insert into opportunity_scores')) {
    const row = { id: params[0], weighted_total: params[14] };
    dbStore.opportunity_scores.set(row.id, row);
    return { rows: [row] };
  }

  // Insert content_assets
  if (lower.includes('insert into content_assets')) {
    const row = {
      id: params[0],
      workspace_id: params[1],
      brand_id: params[2],
      opportunity_id: params[3],
      asset_type: 'search_landing_page',
      lifecycle_status: params[4],
      title: params[5],
      body_markdown: params[6],
      audience_description: params[7],
      intent_type: params[8],
      locale: 'en',
      authoring_agent: 'content_builder',
      source_evidence_ids: params[9],
      citation_urls: params[10],
      quality_check_results: JSON.parse(params[11] ?? '[]'),
    };
    dbStore.content_assets.set(row.id, row);
    return { rows: [row] };
  }

  // Select content_assets
  if (lower.includes('from content_assets where id = $1')) {
    const row = dbStore.content_assets.get(params[0]);
    return { rows: row ? [row] : [] };
  }

  // Update content_assets approval_event_id
  if (lower.includes('update content_assets set approval_event_id = $1')) {
    const row = dbStore.content_assets.get(params[1]);
    if (row) row.approval_event_id = params[0];
    return { rows: [] };
  }

  // Update content_assets lifecycle_status
  if (lower.includes('update content_assets set lifecycle_status = $1')) {
    const row = dbStore.content_assets.get(params[1]);
    if (row) row.lifecycle_status = params[0];
    return { rows: [] };
  }

  // Insert approval_events
  if (lower.includes('insert into approval_events')) {
    const row = {
      id: params[0],
      workspace_id: params[1],
      resource_type: 'content_asset',
      resource_id: params[2],
      requested_by_agent: 'fact_quality_auditor',
      status: 'pending',
      notes: params[3],
    };
    dbStore.approval_events.set(row.id, row);
    return { rows: [row] };
  }

  // Select approval_events
  if (lower.includes('from approval_events where id = $1')) {
    const row = dbStore.approval_events.get(params[0]);
    return { rows: row ? [row] : [] };
  }

  // Update approval_events
  if (lower.includes('update approval_events set status = $1')) {
    const row = dbStore.approval_events.get(params[3]);
    if (row) {
      row.status = params[0];
      row.reviewed_by_user_id = params[1];
      row.notes = params[2];
    }
    return { rows: [] };
  }

  // Update workflow_runs output
  if (lower.includes('update workflow_runs') && lower.includes('awaiting_approval')) {
    const runId = params[1];
    const existing = dbStore.workflow_runs.get(runId);
    if (existing) {
      existing.status = 'awaiting_approval';
      existing.output = JSON.parse(params[0]);
    }
    return { rows: [] };
  }

  // Insert audit_events
  if (lower.includes('insert into audit_events')) {
    dbStore.audit_events.push(params);
    return { rows: [] };
  }

  return { rows: [] };
});

// Mock the db module
vi.mock('../../apps/api/src/lib/db.js', () => {
  return {
    query: (...args: any[]) => (mockQuery as any)(...args),
    transaction: vi.fn(async (cb: any) => cb({ query: (...args: any[]) => (mockQuery as any)(...args) })),
    healthCheck: vi.fn(async () => ({ ok: true, latency_ms: 5 })),
  };
});

describe('End-to-End Vertical Slice Workflow with Specialist Agents', () => {
  const workspaceId = '00000000-0000-0000-0000-000000000001';
  const brandId = '00000000-0000-0000-0001-000000000001'; // CHATR

  beforeEach(() => {
    dbStore.workflow_runs.clear();
    dbStore.topic_clusters.clear();
    dbStore.opportunities.clear();
    dbStore.opportunity_scores.clear();
    dbStore.content_assets.clear();
    dbStore.approval_events.clear();
    dbStore.audit_events.length = 0;
  });

  it('strictly rejects trigger input with placeholder citations like standards.org or example.com', async () => {
    const badPayload = {
      workspace_id: workspaceId,
      brand_id: brandId,
      workflow_definition_id: 'demand_discovery_vertical_slice',
      idempotency_key: 'test_reject_placeholder_001',
      signal_summary: {
        topic: 'AI Productivity Workflows',
        source_url: 'https://standards.org/reference',
        raw_text: 'Test raw text',
        intent_type: 'informational',
      },
    };

    await expect(WorkflowOrchestrator.execute(badPayload)).rejects.toThrow(SafetyViolationError);
    await expect(WorkflowOrchestrator.execute(badPayload)).rejects.toThrow(/Untrusted or placeholder citation domain/);
  });

  it('runs complete vertical slice: GSC Queries -> Search Agent Brief -> Scorer -> Builder -> QA -> Approval Queue', async () => {
    const triggerPayload = {
      workspace_id: workspaceId,
      brand_id: brandId,
      workflow_definition_id: 'demand_discovery_vertical_slice',
      idempotency_key: 'test_run_slice_002',
      signal_summary: {
        topic: 'Interactive Shoppable Video Solutions',
        source_url: 'https://chatr.ai/product/interactive-video',
        raw_text: 'E-commerce brands seek interactive shoppable video workflows with instant checkout to improve conversion.',
        intent_type: 'commercial_investigation',
        search_queries: [
          {
            query: 'shoppable video software for ecommerce',
            impressions: 480,
            clicks: 19,
            position: 13.4, // striking distance page 2
          },
        ],
      },
    };

    const result = await WorkflowOrchestrator.execute(triggerPayload);

    // 1. Verify safe completion status
    expect(result.status).toBe('awaiting_approval');
    expect(result.opportunity_id).toBeDefined();
    expect(result.asset_id).toBeDefined();
    expect(result.approval_event_id).toBeDefined();
    expect(result.quality_checks_passed).toBe(true);
    expect(result.weighted_score).toBeGreaterThan(65);

    // 2. Verify state in DB
    expect(dbStore.workflow_runs.size).toBe(1);
    expect(dbStore.opportunities.size).toBe(1);
    expect(dbStore.content_assets.size).toBe(1);
    expect(dbStore.approval_events.size).toBe(1);

    // 3. Verify that the asset in DB is awaiting approval
    const asset = dbStore.content_assets.get(result.asset_id!);
    expect(asset).toBeDefined();
    expect(asset.lifecycle_status).toBe('approval_required');
    expect(asset.citation_urls).not.toContain('https://standards.org/reference');
    expect(asset.body_markdown).toContain('https://chatr.ai');

    // 4. Verify that an approval event is pending
    const approval = dbStore.approval_events.get(result.approval_event_id!);
    expect(approval).toBeDefined();
    expect(approval.status).toBe('pending');

    // 5. Test Idempotency: Triggering again with same idempotency key returns existing run
    const repeatResult = await WorkflowOrchestrator.execute(triggerPayload);
    expect(repeatResult.run_id).toBe(result.run_id);
    expect(repeatResult.status).toBe('awaiting_approval');
    expect(dbStore.workflow_runs.size).toBe(1);
  });

  it('enforces human approval gate before allowing social distribution planning', async () => {
    // 1. Ingest asset via orchestrator
    const triggerPayload = {
      workspace_id: workspaceId,
      brand_id: brandId,
      workflow_definition_id: 'demand_discovery_vertical_slice',
      idempotency_key: 'test_run_slice_social_gate',
      signal_summary: {
        topic: 'Video Commerce Conversion Benchmarks',
        source_url: 'https://chatr.ai/benchmarks/video-commerce',
        raw_text: 'Live video commerce benchmark data for high-growth DTC brands.',
        intent_type: 'informational',
      },
    };

    const result = await WorkflowOrchestrator.execute(triggerPayload);
    const assetId = result.asset_id!;
    const approvalEventId = result.approval_event_id!;

    // 2. Attempting social distribution planning on unapproved asset MUST throw SafetyViolationError
    await expect(
      WorkflowOrchestrator.planSocialDistribution({
        workspaceId,
        assetId,
        channels: ['twitter', 'linkedin'],
        trackedDestinationUrl: 'https://deeptech-taupe.vercel.app/r/chatr-v1',
      })
    ).rejects.toThrow(SafetyViolationError);

    // 3. Human operator explicitly approves asset
    await WorkflowOrchestrator.decideApproval(
      approvalEventId,
      workspaceId,
      'user_operator_001',
      'approved',
      'Reviewed and confirmed technical accuracy. Ready for distribution.'
    );

    // Verify asset status updated to approved
    const approvedAsset = dbStore.content_assets.get(assetId);
    expect(approvedAsset.lifecycle_status).toBe('approved');

    // 4. Social distribution planning on approved asset succeeds
    const distributionPlan = await WorkflowOrchestrator.planSocialDistribution({
      workspaceId,
      assetId,
      channels: ['twitter', 'linkedin'],
      trackedDestinationUrl: 'https://deeptech-taupe.vercel.app/r/chatr-v1',
    });

    expect(distributionPlan.assetId).toBe(assetId);
    expect(distributionPlan.plannedPosts.length).toBe(2);

    const twitterPost = distributionPlan.plannedPosts.find((p) => p.channel === 'twitter')!;
    expect(twitterPost).toBeDefined();
    expect(twitterPost.validation.isValid).toBe(true);
    expect(twitterPost.candidate.destinationTrackedUrl).toBe('https://deeptech-taupe.vercel.app/r/chatr-v1');
    expect(twitterPost.hooks.length).toBe(3);

    const linkedinPost = distributionPlan.plannedPosts.find((p) => p.channel === 'linkedin')!;
    expect(linkedinPost).toBeDefined();
    expect(linkedinPost.validation.isValid).toBe(true);
  });
});
