/**
 * Demand Intelligence & Opportunity Routes
 */

import { Router, type Request, type Response } from 'express';
import { query } from '../lib/db.js';

export const demandRouter = Router();

demandRouter.get('/opportunities', async (req: Request, res: Response) => {
  const workspaceId = req.user?.workspace_id || (req.query['workspace_id'] as string);
  const brandId = req.query['brand_id'] as string | undefined;

  try {
    let sql = `
      SELECT o.id, o.workspace_id, o.brand_id, b.display_name as brand_name,
             o.title, o.description, o.status, o.rejection_reason,
             o.proposed_asset_type, o.target_locale, o.is_demo_data,
             o.created_at, o.updated_at,
             os.weighted_total, os.demand_evidence, os.brand_relevance,
             os.intent_strength, os.content_gap, os.potential_value,
             os.policy_risk, os.rationale, os.score_model_version
      FROM opportunities o
      JOIN brands b ON o.brand_id = b.id
      LEFT JOIN opportunity_scores os ON o.id = os.opportunity_id
      WHERE o.workspace_id = $1
    `;
    const params: unknown[] = [workspaceId];

    if (brandId) {
      sql += ` AND o.brand_id = $2`;
      params.push(brandId);
    }
    sql += ` ORDER BY os.weighted_total DESC NULLS LAST, o.created_at DESC`;

    const result = await query(sql, params);
    res.json({
      success: true,
      data: result.rows,
      meta: { total: result.rowCount },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});

demandRouter.get('/signals', async (req: Request, res: Response) => {
  const workspaceId = req.user?.workspace_id || (req.query['workspace_id'] as string);

  try {
    const result = await query(
      `SELECT id, workspace_id, brand_id, source_type, source_url,
              intent_type, trend_type, confidence, locale, observed_at,
              ingested_at, permitted_use_notes, is_demo_data
       FROM demand_signals
       WHERE workspace_id = $1
       ORDER BY ingested_at DESC
       LIMIT 100`,
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
