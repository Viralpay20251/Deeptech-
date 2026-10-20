/**
 * Domain Registry and Multi-Domain Health Matrix Service
 *
 * Implements Phase 1 of Master Multi-Domain Intelligence & Growth Plan:
 * - Central registry for all 26 authoritative hostnames across TalentXcel, CHATR, and Nuty Tales
 * - Multi-dimensional health checking: DNS (A/AAAA/CNAME), TLS/certificate, HTTP/HTTPS response,
 *   redirect chain tracing (with per-hop SSRF validation), HTML metadata extraction,
 *   schema JSON-LD detection, app-shell detection (<200 chars), robots.txt & sitemap.xml probes.
 * - Enforces non-negotiable boundaries:
 *   - Preserves distinctness of employer.talentxcel.in vs employers.talentxcel.in
 *   - Excludes legacy/unauthorized domains (auth, cdn, www.talentxcel.net) from crawling
 *   - Operator confirmation required for sensitive changes (with immutable audit logging)
 *   - Respectful rate-limiting / delay between probe requests.
 */

import dns from 'dns/promises';
import tls from 'tls';
import axios from 'axios';
import { parse as parseHtml } from 'node-html-parser';
import { query } from '../lib/db.js';
import { assertSafeOutboundUrlAsync, SafetyViolationError } from '../lib/safety.js';
import { logger } from '../lib/logger.js';

export interface RegisteredDomainRow {
  id: string;
  workspace_id: string;
  brand_id: string;
  hostname: string;
  scheme_preference: 'https' | 'http';
  host_role: 'primary' | 'www_alias' | 'product_subdomain' | 'deployment_host' | 'search_console_property' | 'unknown' | 'excluded';
  intended_canonical_host: string | null;
  canonical_policy_source: string | null;
  expected_redirect_target: string | null;
  expects_redirect: boolean;
  verification_state: 'owner_supplied' | 'observed' | 'verified' | 'excluded' | 'needs_review';
  indexing_intent: 'indexable' | 'noindex_expected' | 'unknown' | 'deployment_only';
  allowed_for_crawling: boolean;
  allowed_for_content_analysis: boolean;
  allowed_for_index_submission: boolean;
  search_console_property_uri: string | null;
  ga4_property_id: string | null;
  dns_status: 'passed' | 'failed' | 'not_tested' | 'inconclusive';
  tls_status: 'passed' | 'failed' | 'not_tested' | 'inconclusive';
  http_status: number | null;
  robots_policy_status: 'passed' | 'failed' | 'not_tested' | 'inconclusive' | 'missing';
  sitemap_status: 'passed' | 'failed' | 'not_tested' | 'inconclusive' | 'missing';
  canonical_tag: string | null;
  robots_directives: string | null;
  schema_types: string[];
  is_app_shell: boolean | null;
  duplicate_of_hostname: string | null;
  last_checked_at: string | null;
  last_successful_check_at: string | null;
  last_crawl_at: string | null;
  last_error: string | null;
  health_matrix: Record<string, unknown>;
  notes: string | null;
  brand_name?: string;
  brand_slug?: string;
  created_at: string;
  updated_at: string;
}

export interface DomainHealthCheckResult {
  hostname: string;
  dns: {
    status: 'passed' | 'failed' | 'inconclusive';
    ipv4: string[];
    ipv6: string[];
    cnames: string[];
    error?: string;
  };
  tls: {
    status: 'passed' | 'failed' | 'inconclusive';
    validTo?: string;
    validFrom?: string;
    daysRemaining?: number;
    issuer?: string;
    subject?: string;
    authorized?: boolean;
    error?: string;
  };
  http: {
    status: number | null;
    finalUrl: string;
    redirectHops: Array<{ url: string; statusCode: number; location?: string }>;
    hasRedirectLoop: boolean;
    expectsRedirectMatched: boolean;
    error?: string;
  };
  content: {
    title: string | null;
    metaDesc: string | null;
    canonicalTag: string | null;
    canonicalMatchesIntended: boolean;
    robotsDirectives: string | null;
    xRobotsTag: string | null;
    schemaTypes: string[];
    isAppShell: boolean;
    visibleTextLength: number;
  };
  robots: {
    status: 'passed' | 'failed' | 'not_tested' | 'inconclusive' | 'missing';
    sitemapsDeclared: string[];
  };
  sitemap: {
    status: 'passed' | 'failed' | 'not_tested' | 'inconclusive' | 'missing';
    urlCount: number;
    sitemapUrl?: string;
  };
  duplicateCandidate: {
    isDuplicate: boolean;
    duplicateOfHostname: string | null;
    reason?: string;
  };
  overallStatus: 'passed' | 'failed' | 'inconclusive';
  checkedAt: string;
}

export class DomainRegistryService {
  private static readonly PROBE_USER_AGENT =
    'AutonomousGrowthOS-DomainAuditor/2.0 (+https://growth-os.internal/auditor)';
  private static readonly TIMEOUT_MS = 6000;

  /**
   * List all registered domains with optional brand or role filtering
   */
  public static async listDomains(filters?: {
    brandId?: string;
    hostRole?: string;
    verificationState?: string;
    workspaceId?: string;
  }): Promise<RegisteredDomainRow[]> {
    const wsId = filters?.workspaceId ?? '00000000-0000-0000-0000-000000000001';
    let sql = `
      SELECT r.*, b.display_name as brand_name, b.slug as brand_slug
      FROM registered_domains r
      JOIN brands b ON r.brand_id = b.id
      WHERE r.workspace_id = $1
    `;
    const params: unknown[] = [wsId];

    if (filters?.brandId) {
      params.push(filters.brandId);
      sql += ` AND r.brand_id = $${params.length}`;
    }
    if (filters?.hostRole) {
      params.push(filters.hostRole);
      sql += ` AND r.host_role = $${params.length}`;
    }
    if (filters?.verificationState) {
      params.push(filters.verificationState);
      sql += ` AND r.verification_state = $${params.length}`;
    }

    sql += ` ORDER BY b.display_name ASC, r.host_role ASC, r.hostname ASC`;
    const res = await query<RegisteredDomainRow>(sql, params);
    return res.rows;
  }

  /**
   * Get single domain record by hostname
   */
  public static async getDomain(hostname: string): Promise<RegisteredDomainRow | null> {
    const res = await query<RegisteredDomainRow>(
      `SELECT r.*, b.display_name as brand_name, b.slug as brand_slug
       FROM registered_domains r
       JOIN brands b ON r.brand_id = b.id
       WHERE LOWER(r.hostname) = LOWER($1) LIMIT 1`,
      [hostname.trim()]
    );
    return res.rows[0] ?? null;
  }

  /**
   * Safe update for domain attributes with strict policy enforcement and audit logging
   */
  public static async updateDomain(
    hostname: string,
    updates: {
      hostRole?: string;
      intendedCanonicalHost?: string | null;
      canonicalPolicySource?: string | null;
      indexingIntent?: string;
      allowedForCrawling?: boolean;
      allowedForContentAnalysis?: boolean;
      allowedForIndexSubmission?: boolean;
      notes?: string;
      confirmedByOperator?: boolean;
    },
    operatorId = 'operator_system'
  ): Promise<RegisteredDomainRow> {
    const existing = await this.getDomain(hostname);
    if (!existing) {
      throw new Error(`Domain not found: ${hostname}`);
    }

    // STRICT BOUNDARY ENFORCEMENT 1: employer vs employers distinctness
    if (
      (hostname === 'employer.talentxcel.in' || hostname === 'employers.talentxcel.in') &&
      updates.intendedCanonicalHost &&
      (updates.intendedCanonicalHost.includes('employer') && updates.intendedCanonicalHost !== existing.intended_canonical_host)
    ) {
      if (
        (hostname === 'employer.talentxcel.in' && updates.intendedCanonicalHost === 'employers.talentxcel.in') ||
        (hostname === 'employers.talentxcel.in' && updates.intendedCanonicalHost === 'employer.talentxcel.in')
      ) {
        throw new Error(
          'CRITICAL POLICY VIOLATION: employer.talentxcel.in and employers.talentxcel.in are distinct properties. ' +
          'Cross-domain auto-consolidation or canonical redirection between them is prohibited.'
        );
      }
    }

    // STRICT BOUNDARY ENFORCEMENT 2: talentxcel.in and talentxcel.net are separate platforms
    if (updates.intendedCanonicalHost) {
      const lowerHost = hostname.toLowerCase();
      const lowerCanonical = updates.intendedCanonicalHost.toLowerCase();
      if (
        (lowerHost.endsWith('talentxcel.in') && lowerCanonical.endsWith('talentxcel.net')) ||
        (lowerHost.endsWith('talentxcel.net') && lowerCanonical.endsWith('talentxcel.in'))
      ) {
        throw new Error(
          'CRITICAL POLICY VIOLATION: talentxcel.in and talentxcel.net are separate domains and separate platforms. ' +
          'Cross-platform canonical consolidation or redirection between .in and .net is strictly prohibited.'
        );
      }
    }

    // STRICT BOUNDARY ENFORCEMENT 3: Excluded legacy references cannot be enabled for crawling
    const excludedHosts = ['www.talentxcel.net', 'auth.talentxcel.in', 'cdn.talentxcel.in'];
    if (excludedHosts.includes(hostname.toLowerCase()) && updates.allowedForCrawling === true) {
      throw new Error(
        `CRITICAL POLICY VIOLATION: "${hostname}" is an explicitly excluded legacy origin and cannot be enabled for crawling.`
      );
    }

    // OPERATOR SECOND CONFIRMATION: sensitive modifications require operator confirmation
    const isSensitiveChange =
      updates.indexingIntent !== undefined ||
      updates.allowedForCrawling !== undefined ||
      updates.intendedCanonicalHost !== undefined ||
      updates.hostRole !== undefined;

    if (isSensitiveChange && !updates.confirmedByOperator) {
      throw new Error(
        'Operator confirmation required: Modifying host roles, indexing intent, crawling permission, ' +
        'or canonical policy requires explicit confirmed_by_operator=true.'
      );
    }

    const newHostRole = updates.hostRole ?? existing.host_role;
    const newIntendedCanonical = updates.intendedCanonicalHost !== undefined ? updates.intendedCanonicalHost : existing.intended_canonical_host;
    const newPolicySource = updates.canonicalPolicySource ?? existing.canonical_policy_source;
    const newIndexingIntent = updates.indexingIntent ?? existing.indexing_intent;
    const newAllowedCrawl = updates.allowedForCrawling !== undefined ? updates.allowedForCrawling : existing.allowed_for_crawling;
    const newAllowedAnalysis = updates.allowedForContentAnalysis !== undefined ? updates.allowedForContentAnalysis : existing.allowed_for_content_analysis;
    const newAllowedSubmission = updates.allowedForIndexSubmission !== undefined ? updates.allowedForIndexSubmission : existing.allowed_for_index_submission;
    const newNotes = updates.notes !== undefined ? updates.notes : existing.notes;

    const res = await query<RegisteredDomainRow>(
      `UPDATE registered_domains
       SET host_role = $1,
           intended_canonical_host = $2,
           canonical_policy_source = $3,
           indexing_intent = $4,
           allowed_for_crawling = $5,
           allowed_for_content_analysis = $6,
           allowed_for_index_submission = $7,
           notes = $8,
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        newHostRole,
        newIntendedCanonical,
        newPolicySource,
        newIndexingIntent,
        newAllowedCrawl,
        newAllowedAnalysis,
        newAllowedSubmission,
        newNotes,
        existing.id,
      ]
    );

    // Record immutable audit event
    await query(
      `INSERT INTO audit_events (
        workspace_id, actor_type, actor_id, action, resource_type, resource_id, metadata
      ) VALUES ($1, 'user', $2, 'domain_registry.updated', 'registered_domain', $3, $4)`,
      [
        existing.workspace_id,
        operatorId,
        existing.id,
        JSON.stringify({
          hostname,
          previous: {
            host_role: existing.host_role,
            indexing_intent: existing.indexing_intent,
            allowed_for_crawling: existing.allowed_for_crawling,
            intended_canonical_host: existing.intended_canonical_host,
          },
          updated: {
            host_role: newHostRole,
            indexing_intent: newIndexingIntent,
            allowed_for_crawling: newAllowedCrawl,
            intended_canonical_host: newIntendedCanonical,
          },
        }),
      ]
    ).catch((err) => {
      logger.warn({ err }, 'Failed to write domain audit event');
    });

    return res.rows[0]!;
  }

  /**
   * Run full multi-dimensional health check for a single domain
   */
  public static async checkDomainHealth(hostname: string): Promise<DomainHealthCheckResult> {
    const domainRecord = await this.getDomain(hostname);
    const checkedAt = new Date().toISOString();

    // 1. DNS Probe
    const dnsResult = await this.probeDns(hostname);

    // 2. TLS / Certificate Probe
    const tlsResult = await this.probeTls(hostname);

    // 3. HTTP & Safe Redirect Chain Probe
    const httpResult = await this.probeHttpAndRedirects(hostname, domainRecord?.scheme_preference ?? 'https');

    // 4. HTML Content & Metadata Probe
    const contentResult = await this.probeContentAndMetadata(httpResult.finalUrl, domainRecord?.intended_canonical_host);

    // 5. Robots.txt Probe
    const robotsResult = await this.probeRobotsTxt(hostname);

    // 6. Sitemap.xml Probe
    const sitemapResult = await this.probeSitemapXml(hostname, robotsResult.sitemapsDeclared);

    // 7. Duplicate Candidate Detection
    const duplicateCandidate = this.detectDuplicateCandidate(hostname, httpResult, domainRecord);

    // Calculate Overall Status
    const overallPassed =
      dnsResult.status === 'passed' &&
      tlsResult.status === 'passed' &&
      httpResult.status !== null &&
      httpResult.status >= 200 &&
      httpResult.status < 400;

    const overallStatus: 'passed' | 'failed' | 'inconclusive' = overallPassed
      ? 'passed'
      : dnsResult.status === 'failed'
      ? 'failed'
      : 'inconclusive';

    const healthMatrixResult: DomainHealthCheckResult = {
      hostname,
      dns: dnsResult,
      tls: tlsResult,
      http: httpResult,
      content: contentResult,
      robots: robotsResult,
      sitemap: sitemapResult,
      duplicateCandidate,
      overallStatus,
      checkedAt,
    };

    // Update DB with results if domain exists in registry
    if (domainRecord) {
      const newVerificationState =
        domainRecord.host_role === 'excluded'
          ? 'excluded'
          : overallStatus === 'passed'
          ? 'observed'
          : domainRecord.verification_state;

      await query(
        `UPDATE registered_domains
         SET dns_status = $1,
             tls_status = $2,
             http_status = $3,
             robots_policy_status = $4,
             sitemap_status = $5,
             canonical_tag = $6,
             robots_directives = $7,
             schema_types = $8,
             is_app_shell = $9,
             duplicate_of_hostname = $10,
             health_matrix = $11,
             verification_state = $12,
             last_checked_at = NOW(),
             last_successful_check_at = CASE WHEN $13 THEN NOW() ELSE last_successful_check_at END,
             last_error = $14,
             updated_at = NOW()
         WHERE id = $15`,
        [
          dnsResult.status,
          tlsResult.status,
          httpResult.status,
          robotsResult.status,
          sitemapResult.status,
          contentResult.canonicalTag,
          contentResult.robotsDirectives,
          JSON.stringify(contentResult.schemaTypes),
          contentResult.isAppShell,
          duplicateCandidate.duplicateOfHostname,
          JSON.stringify(healthMatrixResult),
          newVerificationState,
          overallPassed,
          httpResult.error || dnsResult.error || tlsResult.error || null,
          domainRecord.id,
        ]
      ).catch((err) => {
        logger.error({ err, hostname }, 'Failed to persist domain health check results');
      });
    }

    return healthMatrixResult;
  }

  /**
   * Batch health checker for multiple domains with polite pacing
   */
  public static async runBatchHealthCheck(
    hostnames: string[],
    pacingMs = 300
  ): Promise<DomainHealthCheckResult[]> {
    const results: DomainHealthCheckResult[] = [];

    for (const host of hostnames) {
      try {
        const res = await this.checkDomainHealth(host);
        results.push(res);
      } catch (err) {
        logger.warn({ host, err: (err as Error).message }, 'Domain health check threw an exception');
      }

      if (pacingMs > 0) {
        await new Promise((r) => setTimeout(r, pacingMs));
      }
    }

    return results;
  }

  // ─── PROBE IMPLEMENTATIONS ──────────────────────────────────────────────────

  private static async probeDns(hostname: string): Promise<DomainHealthCheckResult['dns']> {
    try {
      // Primary: OS resolver via getaddrinfo (consistent with TLS, HTTPS, and browsers)
      const lookupRecords = await dns.lookup(hostname, { all: true }).catch(() => []);
      const ipv4 = lookupRecords.filter((r) => r.family === 4).map((r) => r.address);
      const ipv6 = lookupRecords.filter((r) => r.family === 6).map((r) => r.address);

      let cnames: string[] = [];
      try {
        cnames = await dns.resolveCname(hostname);
      } catch {}

      const hasResolved = ipv4.length > 0 || ipv6.length > 0 || cnames.length > 0;
      return {
        status: hasResolved ? 'passed' : 'failed',
        ipv4,
        ipv6,
        cnames,
        error: hasResolved ? undefined : 'NXDOMAIN or no address records resolved',
      };
    } catch (err) {
      return {
        status: 'failed',
        ipv4: [],
        ipv6: [],
        cnames: [],
        error: (err as Error).message,
      };
    }
  }

  private static probeTls(hostname: string, port = 443): Promise<DomainHealthCheckResult['tls']> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        socket.destroy();
        resolve({ status: 'inconclusive', error: 'TLS handshake timeout' });
      }, this.TIMEOUT_MS);

      let socket: tls.TLSSocket;
      try {
        socket = tls.connect(
          {
            host: hostname,
            port,
            servername: hostname,
            rejectUnauthorized: false, // Inspect certificate even if invalid
          },
          () => {
            clearTimeout(timer);
            try {
              const cert = socket.getPeerCertificate();
              const authorized = socket.authorized;
              const validTo = cert.valid_to;
              const validFrom = cert.valid_from;
              const daysRemaining = validTo
                ? Math.floor((new Date(validTo).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : undefined;
              const isExpired = daysRemaining !== undefined && daysRemaining <= 0;

              socket.end();

              resolve({
                status: authorized && !isExpired ? 'passed' : 'failed',
                validTo,
                validFrom,
                daysRemaining,
                issuer: typeof cert.issuer === 'object' ? JSON.stringify(cert.issuer) : String(cert.issuer ?? ''),
                subject: typeof cert.subject === 'object' ? JSON.stringify(cert.subject) : String(cert.subject ?? ''),
                authorized,
                error: !authorized ? socket.authorizationError?.message : isExpired ? 'Certificate expired' : undefined,
              });
            } catch (certErr) {
              socket.destroy();
              resolve({ status: 'failed', error: (certErr as Error).message });
            }
          }
        );

        socket.on('error', (err) => {
          clearTimeout(timer);
          socket.destroy();
          resolve({ status: 'inconclusive', error: err.message });
        });
      } catch (connErr) {
        clearTimeout(timer);
        resolve({ status: 'inconclusive', error: (connErr as Error).message });
      }
    });
  }

  private static async probeHttpAndRedirects(
    hostname: string,
    scheme: 'https' | 'http'
  ): Promise<DomainHealthCheckResult['http']> {
    let currentUrl = `${scheme}://${hostname}/`;
    const redirectHops: Array<{ url: string; statusCode: number; location?: string }> = [];
    const visited = new Set<string>();
    let hasRedirectLoop = false;
    let finalStatus: number | null = null;
    let finalUrl = currentUrl;
    let lastError: string | undefined;

    for (let hop = 0; hop < 5; hop++) {
      if (visited.has(currentUrl)) {
        hasRedirectLoop = true;
        break;
      }
      visited.add(currentUrl);

      try {
        // Enforce SSRF re-validation at each hop URL
        await assertSafeOutboundUrlAsync(currentUrl);

        const res = await axios.get(currentUrl, {
          headers: { 'User-Agent': this.PROBE_USER_AGENT, Accept: 'text/html,*/*' },
          timeout: this.TIMEOUT_MS,
          maxRedirects: 0,
          validateStatus: () => true, // inspect all status codes
        });

        finalStatus = res.status;
        finalUrl = currentUrl;

        // If redirect
        if ([301, 302, 303, 307, 308].includes(res.status) && res.headers['location']) {
          const loc = res.headers['location'] as string;
          const nextUrl = new URL(loc, currentUrl).toString();

          redirectHops.push({
            url: currentUrl,
            statusCode: res.status,
            location: nextUrl,
          });

          currentUrl = nextUrl;
          continue;
        }

        // Terminal response
        break;
      } catch (err) {
        lastError = (err as Error).message;
        break;
      }
    }

    const expectsRedirectMatched = redirectHops.length > 0;

    return {
      status: finalStatus,
      finalUrl,
      redirectHops,
      hasRedirectLoop,
      expectsRedirectMatched,
      error: lastError,
    };
  }

  private static async probeContentAndMetadata(
    url: string,
    intendedCanonicalHost: string | null | undefined
  ): Promise<DomainHealthCheckResult['content']> {
    const defaultRes: DomainHealthCheckResult['content'] = {
      title: null,
      metaDesc: null,
      canonicalTag: null,
      canonicalMatchesIntended: false,
      robotsDirectives: null,
      xRobotsTag: null,
      schemaTypes: [],
      isAppShell: false,
      visibleTextLength: 0,
    };

    try {
      await assertSafeOutboundUrlAsync(url);
      const res = await axios.get(url, {
        headers: { 'User-Agent': this.PROBE_USER_AGENT, Accept: 'text/html' },
        timeout: this.TIMEOUT_MS,
        maxContentLength: 3 * 1024 * 1024,
        validateStatus: () => true,
      });

      if (typeof res.data !== 'string') return defaultRes;

      const root = parseHtml(res.data);
      const title = root.querySelector('title')?.textContent.trim() || null;
      const metaDesc = root.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || null;
      const canonicalTag = root.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() || null;
      const robotsMeta = root.querySelector('meta[name="robots"]')?.getAttribute('content')?.trim() || null;
      const xRobotsTag = (res.headers['x-robots-tag'] as string) || null;

      // Extract JSON-LD schema types
      const schemaScripts = root.querySelectorAll('script[type="application/ld+json"]');
      const schemaTypesSet = new Set<string>();
      for (const s of schemaScripts) {
        try {
          const parsed = JSON.parse(s.textContent);
          const extractType = (obj: any) => {
            if (!obj) return;
            if (obj['@type']) {
              if (Array.isArray(obj['@type'])) {
                obj['@type'].forEach((t: string) => schemaTypesSet.add(String(t)));
              } else {
                schemaTypesSet.add(String(obj['@type']));
              }
            }
            if (Array.isArray(obj['@graph'])) {
              obj['@graph'].forEach(extractType);
            }
          };
          extractType(parsed);
        } catch {}
      }

      // App-shell detection: stripped visible text length < 200 chars
      const bodyEl = root.querySelector('body') || root;
      // Remove scripts, styles, noscript, svg
      bodyEl.querySelectorAll('script, style, noscript, svg').forEach((el) => el.remove());
      const visibleText = bodyEl.textContent.replace(/\s+/g, ' ').trim();
      const visibleTextLength = visibleText.length;
      const isAppShell =
        visibleTextLength < 200 &&
        Boolean(root.querySelector('#root, #__next, app-root, [id="app"]'));

      const canonicalMatchesIntended = Boolean(
        canonicalTag &&
        intendedCanonicalHost &&
        canonicalTag.toLowerCase().includes(intendedCanonicalHost.toLowerCase())
      );

      return {
        title,
        metaDesc,
        canonicalTag,
        canonicalMatchesIntended,
        robotsDirectives: robotsMeta,
        xRobotsTag,
        schemaTypes: Array.from(schemaTypesSet),
        isAppShell,
        visibleTextLength,
      };
    } catch {
      return defaultRes;
    }
  }

  private static async probeRobotsTxt(hostname: string): Promise<DomainHealthCheckResult['robots']> {
    const robotsUrl = `https://${hostname}/robots.txt`;
    const sitemaps: string[] = [];

    try {
      await assertSafeOutboundUrlAsync(robotsUrl);
      const res = await axios.get(robotsUrl, {
        headers: { 'User-Agent': this.PROBE_USER_AGENT },
        timeout: 4000,
        validateStatus: () => true,
      });

      if (res.status === 200 && typeof res.data === 'string') {
        const lines = res.data.split('\n');
        for (const line of lines) {
          const match = line.match(/^sitemap:\s*(https?:\/\/[^\s]+)/i);
          if (match && match[1]) {
            sitemaps.push(match[1].trim());
          }
        }
        return { status: 'passed', sitemapsDeclared: sitemaps };
      }
      if (res.status === 404) {
        return { status: 'missing', sitemapsDeclared: [] };
      }
      return { status: 'inconclusive', sitemapsDeclared: [] };
    } catch {
      return { status: 'inconclusive', sitemapsDeclared: [] };
    }
  }

  private static async probeSitemapXml(
    hostname: string,
    declaredSitemaps: string[]
  ): Promise<DomainHealthCheckResult['sitemap']> {
    const targetSitemap = declaredSitemaps[0] || `https://${hostname}/sitemap.xml`;

    try {
      await assertSafeOutboundUrlAsync(targetSitemap);
      const res = await axios.get(targetSitemap, {
        headers: { 'User-Agent': this.PROBE_USER_AGENT, Accept: 'application/xml,text/xml' },
        timeout: 4000,
        validateStatus: () => true,
      });

      if (res.status === 200 && typeof res.data === 'string') {
        const count = (res.data.match(/<loc>/gi) || []).length;
        return { status: 'passed', urlCount: count, sitemapUrl: targetSitemap };
      }
      if (res.status === 404) {
        return { status: 'missing', urlCount: 0 };
      }
      return { status: 'inconclusive', urlCount: 0 };
    } catch {
      return { status: 'inconclusive', urlCount: 0 };
    }
  }

  private static detectDuplicateCandidate(
    hostname: string,
    httpResult: DomainHealthCheckResult['http'],
    domainRecord?: RegisteredDomainRow | null
  ): DomainHealthCheckResult['duplicateCandidate'] {
    // 1. Explicit known deployment hosts duplicating primaries
    if (hostname === 'career-pathways-ai-builder.vercel.app') {
      return {
        isDuplicate: true,
        duplicateOfHostname: 'talentxcel.in',
        reason: 'Vercel deployment host for TalentXcel core product',
      };
    }
    if (hostname === 'nutytales.vercel.app') {
      return {
        isDuplicate: true,
        duplicateOfHostname: 'nutytales.com',
        reason: 'Vercel deployment host for Nuty Tales e-commerce application',
      };
    }

    // 2. WWW aliases
    if (hostname.startsWith('www.')) {
      const apex = hostname.replace(/^www\./, '');
      return {
        isDuplicate: true,
        duplicateOfHostname: apex,
        reason: 'WWW alias candidate for apex domain',
      };
    }

    // 3. Hop analysis: if it 301/302 redirects to another known apex
    if (domainRecord?.expected_redirect_target) {
      try {
        const targetHost = new URL(domainRecord.expected_redirect_target).hostname;
        if (targetHost && targetHost !== hostname) {
          return {
            isDuplicate: true,
            duplicateOfHostname: targetHost,
            reason: `Configured to redirect to ${targetHost}`,
          };
        }
      } catch {}
    }

    return {
      isDuplicate: false,
      duplicateOfHostname: null,
    };
  }
}
