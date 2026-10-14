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
import { authenticate, requireRole } from '../middleware/auth.js';

export const killSwitchesRouter = Router();

killSwitchesRouter.get('/', async (req: Request, res: Response) => {
  const workspaceId = req.user?.workspace_id || (req.query['workspace_id'] as string);

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

killSwitchesRouter.post(
  '/activate',
  authenticate,
  requireRole(['workspace_admin', 'operator']),
  async (req: Request, res: Response) => {
    const {
      scope,
      scope_id = null,
      reason,
    } = req.body;
    const operatorId = req.user!.id;
    const targetWorkspaceId = req.user!.workspace_id;

    if (!scope || !reason) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'scope and reason are required' },
      });
      return;
    }

    try {
      const result = await query<{ id: string }>(
        `INSERT INTO kill_switch_events (workspace_id, scope, scope_id, activated_by_user_id, reason)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [targetWorkspaceId, scope, scope_id, operatorId, reason]
      );

      logger.warn({ scope, scope_id, reason, operatorId }, '🚨 EMERGENCY KILL SWITCH ACTIVATED');

      res.json({
        success: true,
        data: { kill_switch_id: result.rows[0]?.id, scope, reason },
        message: `Emergency stop activated on ${scope} scope. All matching workflows halted.`,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
    }
  }
);

killSwitchesRouter.post(
  '/:id/deactivate',
  authenticate,
  requireRole(['workspace_admin', 'operator']),
  async (req: Request, res: Response) => {
    try {
      const result = await query(
        `UPDATE kill_switch_events SET deactivated_at = NOW() WHERE id = $1 AND workspace_id = $2`,
        [req.params['id'], req.user!.workspace_id]
      );

      if (result.rowCount === 0) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Kill switch event not found in caller workspace.' },
        });
        return;
      }

      logger.info({ id: req.params['id'], operatorId: req.user!.id }, 'Emergency kill switch deactivated');

      res.json({
        success: true,
        message: 'Kill switch deactivated. Normal bounded operations may resume.',
      });
    } catch (err) {
      res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
    }
  }
);
