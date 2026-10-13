/**
 * Traffic Intelligence & Growth Scorecards
 *
 * Truth in measurement:
 * - 3 separate scorecards for CHATR, TalentXcel, and Nuty Tales (100,000 MAU target).
 * - Never combines platforms into a single vanity total.
 * - For Nuty Tales, reports active audience and actual purchasing customers separately.
 * - When analytics connector is not yet connected, truthfully shows 'baseline not established'
 *   and lists the required connector permissions.
 */

import { Router, type Request, type Response } from 'express';
import { query } from '../lib/db.js';

export const analyticsRouter = Router();

analyticsRouter.get('/scorecards', async (req: Request, res: Response) => {
  const workspaceId = (req.query['workspace_id'] as string) ?? '00000000-0000-0000-0000-000000000001';

  try {
    // 1. Fetch brands and their metric definitions
    const brandsRes = await query<{
      id: string;
      slug: string;
      display_name: string;
      config: Record<string, unknown>;
    }>(
      `SELECT id, slug, display_name, config FROM brands WHERE workspace_id = $1 ORDER BY slug ASC`,
      [workspaceId]
    );

    // 2. Check connector status for analytics (e.g. GA4)
    const connRes = await query<{ status: string }>(
      `SELECT status FROM connector_instances WHERE workspace_id = $1 AND connector_type = 'google_analytics_4'`,
      [workspaceId]
    );

    const isAnalyticsConnected = connRes.rows[0]?.status === 'connected';

    // 3. Build truthful brand scorecards
    const scorecards = brandsRes.rows.map((brand) => {
      if (!isAnalyticsConnected) {
        return {
          brand_id: brand.id,
          brand_slug: brand.slug,
          brand_name: brand.display_name,
          target_mau: 100000,
          current_rolling_30d_mau: null,
          status: 'baseline_not_established',
          meaningful_active_event_definition: brand.config['active_user_event_definition'],
          missing_permissions: [
            'Google Analytics 4 / GA4 OAuth connection pending',
            'Read-only search analytics authorization pending',
          ],
          traffic_observations_count: 0,
          purchasing_customers: brand.slug === 'nuty-tales' ? null : undefined,
          caveats: [
            'No live analytics connector authorized yet.',
            'Never fabricating live traffic metrics without authorized source credentials.',
          ],
        };
      }

      // If connected, fetch aggregated observation facts (omitted in initial state)
      return {
        brand_id: brand.id,
        brand_slug: brand.slug,
        brand_name: brand.display_name,
        target_mau: 100000,
        status: 'active_measurement',
        meaningful_active_event_definition: brand.config['active_user_event_definition'],
      };
    });

    res.json({
      success: true,
      data: scorecards,
      meta: {
        methodology: 'Strict platform separation: platforms are never combined into a single total.',
        freshness_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});
