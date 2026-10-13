/**
 * Connector Framework Routes
 *
 * Truthful reporting:
 * - Lists catalogue with full capability matrix and documented limits.
 * - Reports connected accounts vs accounts awaiting OAuth credentials.
 * - Never claims a connector works unless actually configured and tested.
 */

import { Router, type Request, type Response } from 'express';
import { query } from '../lib/db.js';

export const connectorsRouter = Router();

connectorsRouter.get('/definitions', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT type, version, display_name, category, official_api_docs_url,
              capabilities, auth_method, required_scopes, rate_limit_notes, known_limitations
       FROM connector_definitions
       ORDER BY category, display_name ASC`
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

connectorsRouter.get('/instances', async (req: Request, res: Response) => {
  const workspaceId = (req.query['workspace_id'] as string) ?? '00000000-0000-0000-0000-000000000001';

  try {
    const result = await query(
      `SELECT ci.id, ci.workspace_id, ci.brand_id, ci.connector_type, ci.status,
              ci.granted_capabilities, ci.last_health_check_at, ci.health_check_message,
              ci.notes, cd.display_name, cd.category, cd.auth_method
       FROM connector_instances ci
       JOIN connector_definitions cd ON ci.connector_type = cd.type
       WHERE ci.workspace_id = $1
       ORDER BY cd.category, cd.display_name ASC`,
      [workspaceId]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: {
        total: result.rowCount,
        verification_policy: 'Instances marked awaiting_credentials require explicit OAuth/API keys in environment.',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});
