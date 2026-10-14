/**
 * Domain Registry and Multi-Domain Health Matrix API Routes
 *
 * Implements Phase 1 of Master Multi-Domain Intelligence & Growth Plan:
 * - Read-only inventory and health matrix for all 26 authoritative hostnames
 * - Multi-dimensional live health probe runner (DNS, TLS, HTTP hops, SSRF check, HTML, robots, sitemap)
 * - Safe operator-confirmed updates with immutable audit logging
 * - Enforces boundary invariants: preserves employer vs employers separation, bars legacy excluded crawling.
 */

import { Router, type Request, type Response } from 'express';
import { DomainRegistryService } from '../services/domain-registry-service.js';
import { logger } from '../lib/logger.js';
import { authenticate, requireRole } from '../middleware/auth.js';

export const domainsRouter = Router();

// ─── GET /api/v1/domains ─────────────────────────────────────────────────────
domainsRouter.get('/', async (req: Request, res: Response) => {
  const brandId = req.query['brand_id'] as string | undefined;
  const hostRole = req.query['host_role'] as string | undefined;
  const verificationState = req.query['verification_state'] as string | undefined;
  const workspaceId = req.user?.workspace_id || (req.query['workspace_id'] as string);

  try {
    const domains = await DomainRegistryService.listDomains({
      brandId,
      hostRole,
      verificationState,
      workspaceId,
    });

    res.json({
      success: true,
      data: domains,
      meta: {
        total: domains.length,
        authoritativeCount: domains.filter((d) => d.host_role !== 'excluded').length,
        excludedCount: domains.filter((d) => d.host_role === 'excluded').length,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_ERROR', message: (err as Error).message },
    });
  }
});

// ─── GET /api/v1/domains/summary ─────────────────────────────────────────────
domainsRouter.get('/summary', async (req: Request, res: Response) => {
  const workspaceId = req.user?.workspace_id || (req.query['workspace_id'] as string);

  try {
    const domains = await DomainRegistryService.listDomains({ workspaceId });

    const total = domains.length;
    const authoritative = domains.filter((d) => d.host_role !== 'excluded');
    const excluded = domains.filter((d) => d.host_role === 'excluded');

    const byBrand: Record<string, { total: number; passed: number; failed: number; inconclusive: number }> = {};
    for (const d of domains) {
      const b = d.brand_slug || 'other';
      byBrand[b] = byBrand[b] || { total: 0, passed: 0, failed: 0, inconclusive: 0 };
      byBrand[b].total++;
      if (d.dns_status === 'passed' && (d.http_status ?? 0) >= 200 && (d.http_status ?? 0) < 400) {
        byBrand[b].passed++;
      } else if (d.dns_status === 'failed') {
        byBrand[b].failed++;
      } else {
        byBrand[b].inconclusive++;
      }
    }

    const appShells = domains.filter((d) => d.is_app_shell === true).map((d) => d.hostname);
    const duplicates = domains.filter((d) => Boolean(d.duplicate_of_hostname)).map((d) => ({
      hostname: d.hostname,
      duplicateOf: d.duplicate_of_hostname,
    }));

    const timestamps = domains
      .map((d) => d.last_checked_at)
      .filter((t): t is string => Boolean(t))
      .map((t) => new Date(t).getTime());

    const latestCheckedAt = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
    const oldestCheckedAt = timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null;
    const ageHours = latestCheckedAt ? (Date.now() - new Date(latestCheckedAt).getTime()) / (1000 * 60 * 60) : null;
    const freshness = ageHours === null ? 'not_tested' : ageHours > 24 ? 'stale' : 'recent';

    res.json({
      success: true,
      execution_mode: 'live',
      source: 'persisted_history',
      is_live_probe: false,
      observed_at: latestCheckedAt,
      freshness,
      caveats: [
        'Summary is calculated from the last persisted health audit results in registered_domains.',
        'This represents historical observations and is not a real-time probe.',
        'To execute a real-time probe across all domains, POST to /api/v1/domains/check-health with { all: true }.',
      ],
      data: {
        totalRegistered: total,
        authoritativeCount: authoritative.length,
        excludedCount: excluded.length,
        byBrand,
        appShellsDetected: appShells,
        duplicatesDetected: duplicates,
        healthOverview: {
          dnsPassed: domains.filter((d) => d.dns_status === 'passed').length,
          dnsFailed: domains.filter((d) => d.dns_status === 'failed').length,
          tlsPassed: domains.filter((d) => d.tls_status === 'passed').length,
          httpResponding: domains.filter((d) => d.http_status !== null && d.http_status >= 200 && d.http_status < 400).length,
          robotsTxtFound: domains.filter((d) => d.robots_policy_status === 'passed').length,
          sitemapFound: domains.filter((d) => d.sitemap_status === 'passed').length,
        },
        auditTimestamps: {
          latestCheckedAt,
          oldestCheckedAt,
          ageHours: ageHours !== null ? Math.round(ageHours * 10) / 10 : null,
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_ERROR', message: (err as Error).message },
    });
  }
});

// ─── POST /api/v1/domains/check-health ────────────────────────────────────────
domainsRouter.post('/check-health', async (req: Request, res: Response) => {
  const { hostname, brand_id, all } = req.body as {
    hostname?: string;
    brand_id?: string;
    all?: boolean;
  };

  try {
    if (hostname) {
      const result = await DomainRegistryService.checkDomainHealth(hostname.trim());
      res.json({ success: true, data: result });
      return;
    }

    // Batch check by brand or all
    const domains = await DomainRegistryService.listDomains({
      brandId: brand_id,
      hostRole: undefined,
    });

    const hostnamesToCheck = (all || brand_id)
      ? domains.map((d) => d.hostname)
      : [];

    if (hostnamesToCheck.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Provide hostname, brand_id, or set all: true.' },
      });
      return;
    }

    logger.info({ count: hostnamesToCheck.length }, 'Initiating batch domain health check');
    const results = await DomainRegistryService.runBatchHealthCheck(hostnamesToCheck, 250);

    res.json({
      success: true,
      data: results,
      meta: {
        totalChecked: results.length,
        passed: results.filter((r) => r.overallStatus === 'passed').length,
        failed: results.filter((r) => r.overallStatus === 'failed').length,
        inconclusive: results.filter((r) => r.overallStatus === 'inconclusive').length,
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'HEALTH_CHECK_FAILED', message: (err as Error).message },
    });
  }
});

// ─── GET /api/v1/domains/:hostname ───────────────────────────────────────────
domainsRouter.get('/:hostname', async (req: Request, res: Response) => {
  const hostname = req.params['hostname'] as string;
  if (!hostname) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Hostname required' } });
    return;
  }

  try {
    const domain = await DomainRegistryService.getDomain(hostname);
    if (!domain) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Domain ${hostname} not found` } });
      return;
    }
    res.json({ success: true, data: domain });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'DATABASE_ERROR', message: (err as Error).message },
    });
  }
});

// ─── PATCH /api/v1/domains/:hostname ──────────────────────────────────────────
domainsRouter.patch(
  '/:hostname',
  authenticate,
  requireRole(['workspace_admin', 'operator']),
  async (req: Request, res: Response) => {
    const hostname = req.params['hostname'] as string;
    if (!hostname) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Hostname required' } });
      return;
    }

    const {
      host_role,
      intended_canonical_host,
      canonical_policy_source,
      indexing_intent,
      allowed_for_crawling,
      allowed_for_content_analysis,
      allowed_for_index_submission,
      notes,
      confirmed_by_operator,
    } = req.body as {
      host_role?: string;
      intended_canonical_host?: string | null;
      canonical_policy_source?: string | null;
      indexing_intent?: string;
      allowed_for_crawling?: boolean;
      allowed_for_content_analysis?: boolean;
      allowed_for_index_submission?: boolean;
      notes?: string;
      confirmed_by_operator?: boolean;
    };

    // Use server-authenticated operator identity — never trust client-supplied operator_id
    const operatorId = req.user!.id;

    try {
      const updated = await DomainRegistryService.updateDomain(
        hostname,
        {
          hostRole: host_role,
          intendedCanonicalHost: intended_canonical_host,
          canonicalPolicySource: canonical_policy_source,
          indexingIntent: indexing_intent,
          allowedForCrawling: allowed_for_crawling,
          allowedForContentAnalysis: allowed_for_content_analysis,
          allowedForIndexSubmission: allowed_for_index_submission,
          notes,
          confirmedByOperator: confirmed_by_operator,
        },
        operatorId
      );

      res.json({
        success: true,
        data: updated,
        message: `Domain ${hostname} updated with operator confirmation and audit logging.`,
      });
    } catch (err) {
      const msg = (err as Error).message;
      const isPolicyViolation = msg.includes('CRITICAL POLICY VIOLATION') || msg.includes('Operator confirmation required');
      res.status(isPolicyViolation ? 403 : 500).json({
        success: false,
        error: {
          code: isPolicyViolation ? 'POLICY_VIOLATION' : 'UPDATE_FAILED',
          message: msg,
        },
      });
    }
  }
);
