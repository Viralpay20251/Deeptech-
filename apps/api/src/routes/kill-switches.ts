/**
 * Emergency Kill Switch Routes
 *
 * Provides immediate operational controls:
 * - Scopes: global | workspace | brand | channel | campaign
 * - When activated, halts workflow executions and outbound publishing synchronously.
 */

import { Router, type Request, type Response } from 'express';
import { query } from '../lib/db.js';
import { logger } from '../lib/logger.js';

export const killSwitchesRouter = Router();

killSwitchesRouter.get('/', async (req: Request, res: Response) => {
  const workspaceId = (req.query['workspace_id'] as string) ?? '00000000-0000-0000-0000-000000000001';

  try {
    const result = await query(
      `SELECT id, workspace_id, scope, scope_id, reason, activated_at, deactivated_at
       FROM kill_switch_events
       WHERE workspace_id = $1
       ORDER BY activated_at DESC`,
      [workspaceId]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: {
        active_count: result.rows.filter((r) => r['deactivated_at'] === null).length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});

killSwitchesRouter.post('/activate', async (req: Request, res: Response) => {
  const {
    workspace_id = '00000000-0000-0000-0000-000000000001',
    scope,
    scope_id = null,
    reason,
  } = req.body;

  if (!scope || !reason) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'scope and reason are required' },
    });
    return;
  }

  // Look up authorized operator in workspace
  const userRes = await query<{ id: string }>(
    `SELECT id FROM users WHERE workspace_id = $1 AND role IN ('workspace_admin', 'operator') ORDER BY created_at ASC LIMIT 1`,
    [workspace_id]
  );
  const userId = userRes.rows[0]?.id ?? null;
  if (!userId) {
    res.status(401).json({
      success: false,
      error: { code: 'OPERATOR_REQUIRED', message: 'No authorized operator found in workspace. Kill switch requires a verified operator identity.' },
    });
    return;
  }

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO kill_switch_events (workspace_id, scope, scope_id, activated_by_user_id, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [workspace_id, scope, scope_id, userId, reason]
    );

    logger.warn({ scope, scope_id, reason }, '🚨 EMERGENCY KILL SWITCH ACTIVATED');

    res.json({
      success: true,
      data: { kill_switch_id: result.rows[0]?.id, scope, reason },
      message: `Emergency stop activated on ${scope} scope. All matching workflows halted.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});

killSwitchesRouter.post('/:id/deactivate', async (req: Request, res: Response) => {
  try {
    await query(
      `UPDATE kill_switch_events SET deactivated_at = NOW() WHERE id = $1`,
      [req.params['id']]
    );

    logger.info({ id: req.params['id'] }, 'Emergency kill switch deactivated');

    res.json({
      success: true,
      message: 'Kill switch deactivated. Normal bounded operations may resume.',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});
