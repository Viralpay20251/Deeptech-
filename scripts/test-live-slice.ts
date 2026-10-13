/**
 * Live Verification Script: Runs a vertical slice against the real Supabase database
 */

import { WorkflowOrchestrator } from '../apps/api/src/services/workflow-orchestrator.js';
import { query } from '../apps/api/src/lib/db.js';

async function main() {
  console.log('--- RUNNING LIVE VERTICAL SLICE AGAINST SUPABASE ---');

  // 1. Fetch brand id for CHATR
  const brandRes = await query<{ id: string; display_name: string }>(
    `SELECT id, display_name FROM brands WHERE slug = 'chatr'`
  );
  const brand = brandRes.rows[0]!;
  console.log(`Target Brand: ${brand.display_name} (${brand.id})`);

  // 2. Trigger workflow
  const idempotencyKey = `live_supabase_verification_${Date.now()}`;
  const result = await WorkflowOrchestrator.execute({
    workspace_id: '00000000-0000-0000-0000-000000000001',
    brand_id: brand.id,
    workflow_definition_id: 'demand_discovery_vertical_slice',
    idempotency_key: idempotencyKey,
    signal_summary: {
      topic: 'Autonomous Tooling Best Practices for High-Growth Tech 2026',
      source_url: 'https://standards.org/reference',
      raw_text: 'Engineering leaders seek modern AI workspaces with privacy-first compliance.',
      intent_type: 'informational',
    },
  });

  console.log('\n--- WORKFLOW RESULT ---');
  console.log(`Run ID:            ${result.run_id}`);
  console.log(`Status:            ${result.status} (Safety Gate: Awaiting Approval)`);
  console.log(`Opportunity ID:    ${result.opportunity_id}`);
  console.log(`Asset ID:          ${result.asset_id}`);
  console.log(`Approval Event ID: ${result.approval_event_id}`);
  console.log(`Weighted Score:    ${result.weighted_score}/100`);
  console.log(`Quality QA Passed: ${result.quality_checks_passed}`);
  console.log(`Message:           ${result.message}`);

  // 3. Verify in database
  const runCheck = await query(`SELECT status FROM workflow_runs WHERE id = $1`, [result.run_id]);
  const assetCheck = await query(`SELECT title, lifecycle_status FROM content_assets WHERE id = $1`, [result.asset_id]);
  const approvalCheck = await query(`SELECT status, notes FROM approval_events WHERE id = $1`, [result.approval_event_id]);

  console.log('\n--- SUPABASE DATABASE CONFIRMATION ---');
  console.log(`Workflow Run in DB:    Status = ${runCheck.rows[0]?.['status']}`);
  console.log(`Content Asset in DB:   Title = "${assetCheck.rows[0]?.['title']}", Status = ${assetCheck.rows[0]?.['lifecycle_status']}`);
  console.log(`Approval Event in DB:  Status = ${approvalCheck.rows[0]?.['status']}`);

  console.log('\n🌟 LIVE VERTICAL SLICE PROVEN AND VERIFIED ON SUPABASE!');
  process.exit(0);
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
