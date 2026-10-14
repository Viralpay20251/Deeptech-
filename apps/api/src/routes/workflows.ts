/**
 * Workflow & Task Orchestration Routes
 */

import { Router, type Request, type Response } from 'express';
import { WorkflowOrchestrator } from '../services/workflow-orchestrator.js';
import { query } from '../lib/db.js';

export const workflowsRouter = Router();

workflowsRouter.post('/trigger', async (req: Request, res: Response) => {
  const {
    workspace_id,
    brand_id,
    workflow_definition_id = 'demand_discovery_vertical_slice',
    idempotency_key,
    signal_summary,
    autonomy_level = 1,
  } = req.body;

  const workspaceId = req.user?.workspace_id || workspace_id;

  if (!brand_id || !idempotency_key || !signal_summary?.topic) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'brand_id, idempotency_key, and signal_summary.topic are required.',
      },
    });
    return;
  }

  try {
    const result = await WorkflowOrchestrator.execute({
      workspace_id: workspaceId,
      brand_id,
      workflow_definition_id,
      idempotency_key,
      autonomy_level,
      signal_summary: {
        topic: signal_summary.topic,
        source_url: signal_summary.source_url,
        raw_text: signal_summary.raw_text ?? signal_summary.topic,
        intent_type: signal_summary.intent_type ?? 'informational',
        target_locale: signal_summary.target_locale ?? 'en',
        search_queries: signal_summary.search_queries,
        is_simulation: signal_summary.is_simulation,
      },
    });

    res.json({
      success: true,
      data: result,
      meta: {
        safety_status: 'Execution stopped safely at approval queue. No external publication occurred.',
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: {
        code: 'WORKFLOW_EXECUTION_ERROR',
        message: (err as Error).message,
      },
    });
  }
});

workflowsRouter.get('/runs', async (req: Request, res: Response) => {
  const workspaceId = req.user?.workspace_id || (req.query['workspace_id'] as string);

  try {
    const result = await query(
      `SELECT wr.id, wr.workspace_id, wr.brand_id, b.display_name as brand_name,
              wr.workflow_definition_id, wr.idempotency_key, wr.status,
              wr.autonomy_level, wr.input, wr.output, wr.error,
              wr.model_cost_usd, wr.started_at, wr.completed_at, wr.created_at
       FROM workflow_runs wr
       JOIN brands b ON wr.brand_id = b.id
       WHERE wr.workspace_id = $1
       ORDER BY wr.created_at DESC
       LIMIT 50`,
      [workspaceId]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: { total: result.rowCount },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});
