/**
 * Brand Configuration Routes
 *
 * Exposes brand profiles for CHATR, TalentXcel and Nuty Tales.
 * READ-ONLY: modifications to existing product production configurations are strictly forbidden.
 */

import { Router, type Request, type Response } from 'express';
import { query } from '../lib/db.js';

export const brandsRouter = Router();

brandsRouter.get('/', async (req: Request, res: Response) => {
  const workspaceId = (req.query['workspace_id'] as string) ?? '00000000-0000-0000-0000-000000000001';

  try {
    const result = await query(
      `SELECT id, slug, display_name, base_url, is_protected_production, config, created_at, updated_at
       FROM brands
       WHERE workspace_id = $1
       ORDER BY slug ASC`,
      [workspaceId]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: {
        total: result.rowCount,
        safety_notice: 'All brands marked is_protected_production=TRUE are shielded from automatic modifications.',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});

brandsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, slug, display_name, base_url, is_protected_production, config, created_at, updated_at
       FROM brands
       WHERE id = $1`,
      [req.params['id']]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: { code: 'BRAND_NOT_FOUND', message: 'Brand not found' } });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});
