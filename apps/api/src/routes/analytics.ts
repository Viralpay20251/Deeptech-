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

// ─── Audience Insights Endpoint ───────────────────────────────────────────────
analyticsRouter.get('/audience-insights', async (req: Request, res: Response) => {
  const workspaceId = (req.query['workspace_id'] as string) ?? '00000000-0000-0000-0000-000000000001';

  try {
    const brandsRes = await query<{
      id: string;
      slug: string;
      display_name: string;
      base_url: string;
      config: Record<string, unknown>;
    }>(
      `SELECT id, slug, display_name, base_url, config FROM brands WHERE workspace_id = $1 ORDER BY slug ASC`,
      [workspaceId]
    );

    const insights = brandsRes.rows.map((brand) => {
      const activeEventDef = (brand.config['active_user_event_definition'] as string) || 'Active product usage';

      const data: Record<string, unknown> = {
        brand_id: brand.id,
        brand_slug: brand.slug,
        brand_name: brand.display_name,
        canonical_url: brand.base_url,
        active_event_definition: activeEventDef,
        telemetry_status: 'isolated_read_only',
        ga4_sessions_counted_as_mau: false,
        non_conflation_policy:
          'Strict: GA4 sessions and page views represent Google visit definitions and do not qualify as meaningful brand MAU.',
      };

      if (brand.slug === 'chatr') {
        data['qualifying_actions'] = ['interactive_video_creation', 'automated_message_workflow_trigger', 'voice_interaction_completed'];
        data['measured_engagement_tier'] = 'conversational_productivity';
      } else if (brand.slug === 'talentxcel') {
        data['qualifying_actions'] = ['cv_tailoring_export', 'verified_job_application', 'skills_benchmark_audit'];
        data['measured_engagement_tier'] = 'career_advancement_action';
      } else if (brand.slug === 'nuty-tales') {
        data['qualifying_actions'] = ['recipe_gastronomy_exploration', 'artisanal_product_view', 'verified_paid_order'];
        data['active_audience_vs_buyers_separation'] = {
          engaged_audience: 'Tracked via catalogue & story engagement',
          purchasing_customers: 'Tracked strictly via confirmed paid orders with separate reporting',
        };
      }

      return data;
    });

    res.json({
      success: true,
      data: insights,
      meta: {
        enforcement: 'P6: MAU vs Commerce Non-Conflation Guarantee',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});

// ─── Experiments Endpoints ───────────────────────────────────────────────────
analyticsRouter.get('/experiments', async (req: Request, res: Response) => {
  const workspaceId = (req.query['workspace_id'] as string) ?? '00000000-0000-0000-0000-000000000001';
  const brandId = req.query['brand_id'] as string | undefined;

  try {
    let sql = `SELECT e.id, e.workspace_id, e.brand_id, e.hypothesis, e.rationale,
                      e.channel, e.primary_metric, e.guardrail_metrics, e.baseline_value,
                      e.expected_lift_pct, e.status, e.start_date, e.end_date,
                      e.stopping_rules, e.confounders_noted, e.result_summary,
                      b.display_name AS brand_name
               FROM experiments e
               LEFT JOIN brands b ON e.brand_id = b.id
               WHERE e.workspace_id = $1`;
    const params: unknown[] = [workspaceId];

    if (brandId) {
      params.push(brandId);
      sql += ` AND e.brand_id = $${params.length}`;
    }

    sql += ` ORDER BY e.created_at DESC LIMIT 50`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows, meta: { total: result.rowCount } });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});

analyticsRouter.post('/experiments', async (req: Request, res: Response) => {
  const {
    workspace_id,
    brand_id,
    hypothesis,
    rationale,
    channel,
    primary_metric,
    guardrail_metrics,
    baseline_value,
    expected_lift_pct,
    stopping_rules,
  } = req.body as {
    workspace_id?: string;
    brand_id?: string;
    hypothesis?: string;
    rationale?: string;
    channel?: string;
    primary_metric?: string;
    guardrail_metrics?: string[];
    baseline_value?: number;
    expected_lift_pct?: number;
    stopping_rules?: string;
  };

  if (!brand_id || !hypothesis || !channel || !primary_metric) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'brand_id, hypothesis, channel, and primary_metric are required' },
    });
    return;
  }

  const workspaceId = workspace_id ?? '00000000-0000-0000-0000-000000000001';

  try {
    const insertRes = await query<{ id: string }>(
      `INSERT INTO experiments (
        workspace_id, brand_id, hypothesis, rationale, channel,
        primary_metric, guardrail_metrics, baseline_value, expected_lift_pct,
        stopping_rules, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'proposed')
      RETURNING id`,
      [
        workspaceId,
        brand_id,
        hypothesis,
        rationale || '',
        channel,
        primary_metric,
        guardrail_metrics || ['brand_safety_compliance', 'unsubstantiated_claims_zero'],
        baseline_value || null,
        expected_lift_pct || 15.0,
        stopping_rules || 'Halt if error rate exceeds 2% or brand safety violation detected.',
      ]
    );

    res.json({
      success: true,
      message: 'Acquisition experiment proposed successfully.',
      data: { id: insertRes.rows[0]?.id, status: 'proposed' },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: (err as Error).message } });
  }
});

