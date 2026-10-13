/**
 * Traffic Intelligence, Attribution Reconciliation & Growth Scorecards
 *
 * Truth in measurement (Workstream 4 & Correction B):
 * - 3 separate scorecards for CHATR, TalentXcel, and Nuty Tales (100,000 MAU target).
 * - Never combines platforms into a single vanity total.
 * - For Nuty Tales, reports active audience and actual purchasing customers strictly separately.
 * - Never conflates GA4 active users with brand meaningful product actions.
 * - Distinguishes 4 traffic layers:
 *   1. Tracked outbound redirect clicks (classified into human vs bot).
 *   2. OS-owned published page views.
 *   3. GA4 analytics sessions (session engagement only).
 *   4. Brand qualifying product actions (marked unverified if event stream not connected).
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

    // 2. Fetch measured outbound redirect clicks from tracked_links
    const clicksRes = await query<{
      brand_id: string;
      clicks_total: string;
      clicks_human: string;
      clicks_bot: string;
    }>(
      `SELECT brand_id,
              COALESCE(SUM(clicks_total), 0) AS clicks_total,
              COALESCE(SUM(clicks_human), 0) AS clicks_human,
              COALESCE(SUM(clicks_bot), 0) AS clicks_bot
       FROM tracked_links
       WHERE workspace_id = $1
       GROUP BY brand_id`,
      [workspaceId]
    );
    const clickMap = new Map(clicksRes.rows.map((r) => [r.brand_id, r]));

    // 3. Fetch OS-published page views
    const viewsRes = await query<{
      brand_id: string;
      total_views: string;
    }>(
      `SELECT brand_id, COALESCE(SUM(page_views), 0) AS total_views
       FROM public_published_pages
       WHERE workspace_id = $1
       GROUP BY brand_id`,
      [workspaceId]
    );
    const viewsMap = new Map(viewsRes.rows.map((r) => [r.brand_id, r]));

    // 4. Check GA4 connector status
    const connRes = await query<{ status: string }>(
      `SELECT status FROM connector_instances WHERE workspace_id = $1 AND connector_type = 'google_analytics_4'`,
      [workspaceId]
    );
    const isAnalyticsConnected = connRes.rows[0]?.status === 'connected';

    // 5. Build truthful brand scorecards
    const scorecards = brandsRes.rows.map((brand) => {
      const clickData = clickMap.get(brand.id);
      const viewData = viewsMap.get(brand.id);

      const totalClicks = parseInt(clickData?.clicks_total ?? '0', 10);
      const humanClicks = parseInt(clickData?.clicks_human ?? '0', 10);
      const botClicks = parseInt(clickData?.clicks_bot ?? '0', 10);
      const osPageViews = parseInt(viewData?.total_views ?? '0', 10);

      const baseScorecard: Record<string, unknown> = {
        brand_id: brand.id,
        brand_slug: brand.slug,
        brand_name: brand.display_name,
        target_mau: 100000,
        current_verified_product_mau: null,
        mau_status: 'unverified',
        meaningful_active_event_definition: brand.config['active_user_event_definition'],
        qualifying_event_note:
          'Qualifying product events require authorized read-only product event stream. GA4 active users are not conflated with meaningful product actions.',
        measured_traffic_layers: {
          os_public_page_views: osPageViews,
          outbound_tracked_clicks: {
            total: totalClicks,
            likely_human: humanClicks,
            filtered_bot: botClicks,
            unknown_or_unclassified: totalClicks - (humanClicks + botClicks),
          },
          ga4_session_engagement: isAnalyticsConnected ? 'connected' : 'baseline_not_established',
        },
      };

      if (brand.slug === 'nuty-tales') {
        baseScorecard['engaged_audience_mau'] = null;
        baseScorecard['verified_purchasing_customers'] = null;
        baseScorecard['purchasers_separation_note'] =
          'Purchasers are reported strictly separately from engaged audience and cannot be estimated from traffic sessions.';
      }

      return baseScorecard;
    });

    res.json({
      success: true,
      data: scorecards,
      meta: {
        methodology:
          'Strict platform separation: platforms are never combined into a single total. GA4 sessions are kept distinct from meaningful product MAU.',
        freshness_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});

/**
 * Traffic Reconciliation Endpoint: GET /api/v1/analytics/reconciliation
 */
analyticsRouter.get('/reconciliation', async (req: Request, res: Response) => {
  const workspaceId = (req.query['workspace_id'] as string) ?? '00000000-0000-0000-0000-000000000001';

  try {
    const clickStats = await query<{
      traffic_classification: string;
      count: string;
    }>(
      `SELECT tlc.traffic_classification, COUNT(*) AS count
       FROM tracked_link_clicks tlc
       JOIN tracked_links tl ON tlc.tracked_link_id = tl.id
       WHERE tl.workspace_id = $1
       GROUP BY tlc.traffic_classification`,
      [workspaceId]
    );

    const publicPages = await query<{
      slug: string;
      title: string;
      page_views: number;
      canonical_url: string;
    }>(
      `SELECT slug, title, page_views, canonical_url
       FROM public_published_pages
       WHERE workspace_id = $1
       ORDER BY page_views DESC`,
      [workspaceId]
    );

    res.json({
      success: true,
      data: {
        clickClassificationBreakdown: clickStats.rows,
        osPublishedPages: publicPages.rows,
        attributionPrinciples: {
          associationOnly: 'Reported traffic is associated with campaigns; causality requires controlled holdout.',
          botFiltering: 'Bot and crawler traffic is quarantined and excluded from human growth counts.',
          productSeparation: 'Traffic does not imply product activation.',
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});
