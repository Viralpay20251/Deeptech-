/**
 * Public Publishing Routes (SEO Surface, Sitemap, Robots.txt)
 */

import { Router, type Request, type Response } from 'express';
import { PublishingService } from '../services/publishing-service.js';

export const publicPagesRouter = Router();

/**
 * Public HTML Page: GET /p/:slug
 */
publicPagesRouter.get('/p/:slug', async (req: Request, res: Response) => {
  const rawSlug = req.params['slug'];
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  if (!slug) {
    res.status(404).send('Page not found');
    return;
  }

  try {
    const page = await PublishingService.getPageBySlug(slug);
    if (!page) {
      res.status(404).send('Not Found: The requested research article does not exist or has not been approved.');
      return;
    }

    const html = PublishingService.renderHtmlDocument(page);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send(`Server error: ${(err as Error).message}`);
  }
});

/**
 * Public XML Sitemap: GET /sitemap.xml
 */
publicPagesRouter.get('/sitemap.xml', async (_req: Request, res: Response) => {
  try {
    const sitemap = await PublishingService.generateSitemapXml();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(sitemap);
  } catch (err) {
    res.status(500).send(`Sitemap generation error: ${(err as Error).message}`);
  }
});

/**
 * Public Robots.txt: GET /robots.txt
 */
publicPagesRouter.get('/robots.txt', (_req: Request, res: Response) => {
  const robots = PublishingService.generateRobotsTxt();
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(robots);
});

export const pagesApiRouter = Router();

/**
 * Public Surface Sitemap Alias via API: GET /api/v1/pages/sitemap.xml
 */
pagesApiRouter.get('/sitemap.xml', async (_req: Request, res: Response) => {
  try {
    const sitemap = await PublishingService.generateSitemapXml();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.send(sitemap);
  } catch (err) {
    res.status(500).send(`Sitemap generation error: ${(err as Error).message}`);
  }
});

/**
 * Public Surface Robots Alias via API: GET /api/v1/pages/robots.txt
 */
pagesApiRouter.get('/robots.txt', (_req: Request, res: Response) => {
  const robots = PublishingService.generateRobotsTxt();
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(robots);
});

/**
 * Public HTML Page Alias via API: GET /api/v1/pages/p/:slug
 */
pagesApiRouter.get('/p/:slug', async (req: Request, res: Response) => {
  const rawSlug = req.params['slug'];
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  if (!slug) {
    res.status(404).send('Page not found');
    return;
  }
  try {
    const page = await PublishingService.getPageBySlug(slug);
    if (!page) {
      res.status(404).send('Not Found: The requested research article does not exist or has not been approved.');
      return;
    }
    const html = PublishingService.renderHtmlDocument(page);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send(`Server error: ${(err as Error).message}`);
  }
});

/**
 * List all published pages: GET /api/v1/pages
 */
pagesApiRouter.get('/', async (req: Request, res: Response) => {
  const { workspace_id, brand_id } = req.query;
  const workspaceId = req.user?.workspace_id || (workspace_id as string);
  try {
    const pages = await PublishingService.listPages(workspaceId, brand_id as string | undefined);
    res.json({ success: true, data: pages, meta: { total: pages.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: (err as Error).message } });
  }
});

/**
 * Admin API: Publish a new page (requires approved approval_event_id)
 * POST /api/v1/pages/publish
 */
pagesApiRouter.post('/publish', async (req: Request, res: Response) => {
  const {
    workspace_id,
    brand_id,
    asset_id,
    approval_event_id,
    slug,
    title,
    meta_description,
    schema_type,
    html_content,
    cta_tracked_code,
    cta_label,
  } = req.body;

  if (!approval_event_id || !slug || !title || !html_content || !brand_id) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'approval_event_id, brand_id, slug, title, and html_content are required.',
      },
    });
    return;
  }

  const workspaceId = req.user?.workspace_id || workspace_id;

  try {
    const page = await PublishingService.publishPage({
      workspaceId,
      brandId: brand_id,
      assetId: asset_id,
      approvalEventId: approval_event_id,
      slug,
      title,
      metaDescription: meta_description ?? title,
      schemaType: schema_type ?? 'Article',
      htmlContent: html_content,
      ctaTrackedCode: cta_tracked_code,
      ctaLabel: cta_label,
    });

    res.status(201).json({ success: true, data: page });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: { code: 'PUBLISHING_REJECTED', message: (err as Error).message },
    });
  }
});
