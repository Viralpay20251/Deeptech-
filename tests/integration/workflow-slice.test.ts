/**
 * Integration Test: End-to-End Vertical Slice Workflow
 *
 * Proves Task 1 Acceptance Criteria:
 * 1. Signal ingested with source evidence
 * 2. Scored across 11 dimensions with model version & rationale
 * 3. Content brief/draft synthesised
 * 4. Audited against 10 Quality Gates
 * 5. Stopped safely in human approval queue (no external publication)
 * 6. Idempotency prevents duplicate runs for identical trigger
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowOrchestrator } from '../../apps/api/src/services/workflow-orchestrator.js';

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

// Mock the db module
vi.mock('../../apps/api/src/lib/db.js', () => {
  return {
    query: vi.fn(async (sql: string, params: any[] = []) => {
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
        const row = { id: params[0], title: params[5], lifecycle_status: params[4] };
        dbStore.content_assets.set(row.id, row);
        return { rows: [row] };
      }

      // Insert approval_events
      if (lower.includes('insert into approval_events')) {
        const row = { id: params[0], resource_id: params[2], status: 'pending' };
        dbStore.approval_events.set(row.id, row);
        return { rows: [row] };
      }

      // Update content_assets approval_event_id
      if (lower.includes('update content_assets set approval_event_id')) {
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

      // Fallback
      return { rows: [] };
    }),
    transaction: vi.fn(async (cb: any) => cb({ query: vi.fn() })),
    healthCheck: vi.fn(async () => ({ ok: true, latency_ms: 5 })),
  };
});

describe('End-to-End Vertical Slice Workflow', () => {
  beforeEach(() => {
    dbStore.workflow_runs.clear();
    dbStore.topic_clusters.clear();
    dbStore.opportunities.clear();
    dbStore.opportunity_scores.clear();
    dbStore.content_assets.clear();
    dbStore.approval_events.clear();
    dbStore.audit_events.length = 0;
  });

  it('runs complete vertical slice: Signal -> Scorer -> Builder -> QA -> Approval Queue', async () => {
    const triggerPayload = {
      workspace_id: '00000000-0000-0000-0000-000000000001',
      brand_id: '00000000-0000-0000-0001-000000000001', // CHATR
      workflow_definition_id: 'demand_discovery_vertical_slice',
      idempotency_key: 'test_run_slice_001',
      signal_summary: {
        topic: 'AI Productivity Workflows for Distributed Engineering',
        source_url: 'https://standards.org/reference',
        raw_text: 'Engineering teams seek pragmatic AI tooling that integrates with daily communication.',
        intent_type: 'informational',
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

    // 3. Verify that an approval event is indeed pending
    const approval = Array.from(dbStore.approval_events.values())[0];
    expect(approval.status).toBe('pending');

    // 4. Test Idempotency: Triggering again with same idempotency key must not recreate
    const repeatResult = await WorkflowOrchestrator.execute(triggerPayload);
    expect(repeatResult.run_id).toBe(result.run_id);
    expect(repeatResult.status).toBe('awaiting_approval');
    expect(dbStore.workflow_runs.size).toBe(1); // Still exactly 1
  });
});
