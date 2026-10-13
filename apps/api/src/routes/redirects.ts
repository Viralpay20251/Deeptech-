/**
 * Express Route Handlers for Outbound Redirect Router & Link Management
 */

import { Router, type Request, type Response } from 'express';
import { RedirectRouterService } from '../services/redirect-router.js';

export const redirectsRouter = Router();

/**
 * Public Redirect Endpoint: GET /r/:short_code
 * Handles incoming clicks, logs bot/human classification, and redirects (HTTP 302)
 */
redirectsRouter.get('/r/:short_code', async (req: Request, res: Response) => {
  const rawCode = req.params['short_code'];
  const shortCode = Array.isArray(rawCode) ? rawCode[0] : rawCode;
  if (!shortCode) {
    res.status(400).send('Bad Request: Short code is required');
    return;
  }

  // Extract client network and agent metadata
  const userAgent = req.headers['user-agent'];
  const referer = req.headers['referer'] as string | undefined;
  const ipAddress =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  try {
    const result = await RedirectRouterService.processRedirect({
      shortCode,
      userAgent,
      ipAddress,
      referer,
      incomingQueryParams: req.query as Record<string, string | string[] | undefined>,
    });

    if (!result.found || !result.destinationUrl) {
      res.status(404).send(`Tracked link not found or inactive for short code: ${shortCode}`);
      return;
    }

    // HTTP 302 redirect with Destination Location header
    res.redirect(302, result.destinationUrl);
  } catch (err) {
    res.status(500).send(`Redirect error: ${(err as Error).message}`);
  }
});

export const trackedLinksApiRouter = Router();

/**
 * Create a new tracked link: POST /api/v1/tracked-links
 */
trackedLinksApiRouter.post('/', async (req: Request, res: Response) => {
  const {
    workspace_id,
    brand_id,
    target_url,
    short_code,
    title,
    campaign_id,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
  } = req.body;

  if (!brand_id || !target_url) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'brand_id and target_url are required fields.' },
    });
    return;
  }

  const workspaceId = workspace_id ?? '00000000-0000-0000-0000-000000000001';

  try {
    const link = await RedirectRouterService.createTrackedLink({
      workspaceId,
      brandId: brand_id,
      targetUrl: target_url,
      shortCode: short_code,
      title,
      campaignId: campaign_id,
      utmSource: utm_source,
      utmMedium: utm_medium,
      utmCampaign: utm_campaign,
      utmTerm: utm_term,
      utmContent: utm_content,
    });

    res.status(201).json({ success: true, data: link });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: { code: 'CREATE_LINK_FAILED', message: (err as Error).message },
    });
  }
});

/**
 * List tracked links: GET /api/v1/tracked-links
 */
trackedLinksApiRouter.get('/', async (req: Request, res: Response) => {
  const workspaceId = (req.query['workspace_id'] as string) ?? '00000000-0000-0000-0000-000000000001';
  const brandId = req.query['brand_id'] as string | undefined;

  try {
    const links = await RedirectRouterService.getTrackedLinks(workspaceId, brandId);
    res.json({ success: true, data: links });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_ERROR', message: (err as Error).message },
    });
  }
});

/**
 * Direct Redirect Alias via API: GET /api/v1/tracked-links/r/:short_code
 */
trackedLinksApiRouter.get('/r/:short_code', async (req: Request, res: Response) => {
  const rawCode = req.params['short_code'];
  const shortCode = Array.isArray(rawCode) ? rawCode[0] : rawCode;
  if (!shortCode) {
    res.status(400).send('Bad Request: Short code is required');
    return;
  }

  const userAgent = req.headers['user-agent'];
  const referer = req.headers['referer'] as string | undefined;
  const ipAddress =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  try {
    const result = await RedirectRouterService.processRedirect({
      shortCode,
      userAgent,
      ipAddress,
      referer,
      incomingQueryParams: req.query as Record<string, string | string[] | undefined>,
    });

    if (!result.found || !result.destinationUrl) {
      res.status(404).send(`Tracked link not found or inactive for short code: ${shortCode}`);
      return;
    }

    res.redirect(302, result.destinationUrl);
  } catch (err) {
    res.status(500).send(`Redirect error: ${(err as Error).message}`);
  }
});
