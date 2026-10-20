/**
 * Autonomous Growth OS — Backlinks API Routes
 *
 * Endpoints:
 * - GET  /api/v1/backlinks           — List backlinks with filters
 * - GET  /api/v1/backlinks/metrics   — Aggregate statistics and health breakdown
 * - GET  /api/v1/backlinks/mesh      — Bijective internal link mesh between canonical hosts
 * - GET  /api/v1/backlinks/targets   — Curated high-DA syndication targets
 * - POST /api/v1/backlinks/:id/verify— Automated live verification of a backlink
 */

import { Router, type Request, type Response } from 'express';
import { BacklinkService } from '../services/backlink-service.js';

export const backlinksRouter = Router();

// ─── GET /api/v1/backlinks/metrics ──────────────────────────────────────────
backlinksRouter.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const stats = await BacklinkService.getBacklinkStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// ─── GET /api/v1/backlinks/mesh ─────────────────────────────────────────────
backlinksRouter.get('/mesh', async (req: Request, res: Response) => {
  try {
    const sourceHost = req.query['source_host'] as string | undefined;
    const mesh = await BacklinkService.getInternalLinkMesh(sourceHost);
    res.json({ success: true, count: mesh.length, data: mesh });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// ─── GET /api/v1/backlinks/targets ──────────────────────────────────────────
backlinksRouter.get('/targets', async (req: Request, res: Response) => {
  try {
    const brandCluster = req.query['brand_cluster'] as string | undefined;
    const targets = await BacklinkService.getSyndicationTargets(brandCluster);
    res.json({ success: true, count: targets.length, data: targets });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// ─── GET /api/v1/backlinks ──────────────────────────────────────────────────
backlinksRouter.get('/', async (req: Request, res: Response) => {
  try {
    const brandCluster = req.query['brand_cluster'] as string | undefined;
    const targetCanonicalDomain = req.query['target_canonical_domain'] as string | undefined;
    const linkType = req.query['link_type'] as string | undefined;
    const verificationStatus = req.query['verification_status'] as string | undefined;
    const limitParam = req.query['limit'] as string | undefined;
    const offsetParam = req.query['offset'] as string | undefined;

    const records = await BacklinkService.listBacklinks({
      brand_cluster: brandCluster,
      target_canonical_domain: targetCanonicalDomain,
      link_type: linkType,
      verification_status: verificationStatus,
      limit: limitParam ? parseInt(limitParam, 10) : 100,
      offset: offsetParam ? parseInt(offsetParam, 10) : 0,
    });

    res.json({ success: true, count: records.length, data: records });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// ─── POST /api/v1/backlinks/:id/verify ──────────────────────────────────────
backlinksRouter.post('/:id/verify', async (req: Request, res: Response) => {
  try {
    const rawId = req.params['id'];
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, error: 'Missing or invalid backlink id' });
      return;
    }
    const verified = await BacklinkService.verifyBacklink(id);
    res.json({ success: true, data: verified });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});
