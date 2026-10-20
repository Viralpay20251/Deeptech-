/**
 * Human Approval Queue Routes
 *
 * Enforces the human-in-the-loop requirement:
 * No publishing may ever occur without a valid approval event.
 */

import { Router, type Request, type Response } from 'express';
import { WorkflowOrchestrator } from '../services/workflow-orchestrator.js';
import { query } from '../lib/db.js';

import { authenticate, requireRole } from '../middleware/auth.js';

export const approvalsRouter = Router();

approvalsRouter.get('/', async (req: Request, res: Response) => {
  const workspaceId = req.user?.workspace_id || (req.query['workspace_id'] as string) || '00000000-0000-0000-0000-000000000001';
  const status = (req.query['status'] as string) ?? 'pending';

  try {
    const result = await query(
      `SELECT ae.id, ae.workspace_id, ae.resource_type, ae.resource_id,
              ae.requested_by_agent, ae.status, ae.notes, ae.created_at, ae.decided_at,
              ca.title as asset_title, ca.body_markdown as asset_body,
              ca.quality_check_results, ca.citation_urls,
              b.display_name as brand_name
       FROM approval_events ae
       LEFT JOIN content_assets ca ON ae.resource_id = ca.id
       LEFT JOIN brands b ON ca.brand_id = b.id
       WHERE ae.workspace_id = $1 AND ae.status = $2
       ORDER BY ae.created_at DESC`,
      [workspaceId, status]
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

approvalsRouter.post(
  '/:id/decide',
  authenticate,
  requireRole(['workspace_admin', 'operator', 'reviewer', 'publisher']),
  async (req: Request, res: Response) => {
    const { decision, notes = '' } = req.body;
    const operatorId = req.user!.id;
    const workspaceId = req.user!.workspace_id;

  if (decision !== 'approved' && decision !== 'rejected') {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'decision must be "approved" or "rejected"' },
    });
    return;
  }

  try {
    await WorkflowOrchestrator.decideApproval(
      req.params['id'] as string,
      workspaceId,
      operatorId,
      decision,
      notes
    );

    res.json({
      success: true,
      message: `Approval event successfully marked as ${decision}.`,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'APPROVAL_ERROR', message: (err as Error).message },
    });
  }
});
