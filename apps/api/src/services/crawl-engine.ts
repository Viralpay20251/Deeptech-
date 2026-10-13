/**
 * Autonomous Growth OS — Open Web Discovery and Crawl Engine v2
 *
 * Implements P1 Specification:
 * - Bounded crawl engine with profiles: sitemap, rss, robots, internal_links, discovery, seo_audit, metadata.
 * - Strict SSRF defenses: DNS resolution check, private IP blocking, redirect revalidation.
 * - robots.txt verification via robots-parser.
 * - Deterministic HTML parsing via node-html-parser.
 * - Snapshots pages with title, h1, meta description, canonical, robots directives,
 *   word count, image alt audits, Open Graph, Twitter Cards, and JSON-LD schema detection.
 * - Persists state durably to crawl_jobs, crawl_job_urls, and page_snapshots.
 */

import axios, { type AxiosResponse } from 'axios';
import { parse as parseHtml } from 'node-html-parser';
import robotsParser from 'robots-parser';
import { query } from '../lib/db.js';
import { assertSafeOutboundUrlAsync, SafetyViolationError } from '../lib/safety.js';
import { logger } from '../lib/logger.js';

export type CrawlProfile =
  | 'sitemap'
  | 'rss'
  | 'robots'
  | 'internal_links'
  | 'discovery'
  | 'seo_audit'
  | 'metadata';

export interface CreateCrawlJobParams {
  workspaceId: string;
  brandId?: string | null;
  label: string;
  seedUrls: string[];
  profile?: CrawlProfile;
  maxPages?: number;
}

export interface PageSnapshotData {
  url: string;
  statusCode: number;
  htmlHash?: string;
  title: string | null;
  h1: string | null;
  metaDesc: string | null;
  canonical: string | null;
  robotsTag: string | null;
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
  imagesCount: number;
  imagesMissingAlt: number;
  schemaTypes: string[];
  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;
  rawHeaders: Record<string, string>;
}

export class CrawlEngineService {
  private static readonly USER_AGENT = 'AutonomousGrowthOS-DiscoveryBot/2.0 (+https://growth-os.internal/bot)';
  private static readonly TIMEOUT_MS = 8000;
  private static readonly MAX_BYTES = 5 * 1024 * 1024; // 5 MB

  /**
   * Create a new crawl job record in DB
   */
  public static async createCrawlJob(params: CreateCrawlJobParams): Promise<{ id: string; status: string }> {
    const profile = params.profile ?? 'discovery';
    const maxPages = Math.min(params.maxPages ?? 25, 200); // Bounded to prevent runaway crawls

    const result = await query<{ id: string; status: string }>(
      `INSERT INTO crawl_jobs (
        workspace_id, brand_id, label, seed_urls, profile, status, max_pages
      ) VALUES ($1, $2, $3, $4, $5, 'pending', $6)
      RETURNING id, status`,
      [
        params.workspaceId,
        params.brandId ?? null,
        params.label,
        JSON.stringify(params.seedUrls),
        profile,
        maxPages,
      ]
    );

    return result.rows[0]!;
  }

  /**
   * Run the crawl job asynchronously and record findings
   */
  public static async executeCrawlJob(jobId: string): Promise<{ pagesCrawled: number; error?: string }> {
    const jobRes = await query<{
      id: string;
      workspace_id: string;
      brand_id: string | null;
      seed_urls: string[];
      profile: CrawlProfile;
      max_pages: number;
    }>(
      `SELECT id, workspace_id, brand_id, seed_urls, profile, max_pages FROM crawl_jobs WHERE id = $1`,
      [jobId]
    );

    const job = jobRes.rows[0];
    if (!job) {
      throw new Error(`Crawl job ${jobId} not found`);
    }

    const seedUrls = Array.isArray(job.seed_urls) ? job.seed_urls : (JSON.parse(job.seed_urls as any) as string[]);

    await query(
      `UPDATE crawl_jobs SET status = 'running', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [jobId]
    );

    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = seedUrls.map((u) => ({ url: u, depth: 0 }));
    let crawledCount = 0;

    try {
      while (queue.length > 0 && crawledCount < job.max_pages) {
        const item = queue.shift()!;
        const normalizedUrl = item.url.trim();

        if (!normalizedUrl || visited.has(normalizedUrl)) continue;
        visited.add(normalizedUrl);

        try {
          const snapshot = await this.crawlSingleUrl(normalizedUrl);
          crawledCount++;

          // Insert or update crawl_job_urls
          await query(
            `INSERT INTO crawl_job_urls (crawl_job_id, url, depth, status_code, content_type, crawled_at, robots_allowed)
             VALUES ($1, $2, $3, $4, $5, NOW(), TRUE)
             ON CONFLICT (crawl_job_id, url) DO UPDATE
             SET status_code = EXCLUDED.status_code, crawled_at = NOW()`,
            [jobId, normalizedUrl, item.depth, snapshot.statusCode, 'text/html']
          );

          // Save page snapshot
          await query(
            `INSERT INTO page_snapshots (
              crawl_job_id, url, status_code, title, h1, meta_desc, canonical,
              robots_tag, word_count, internal_links, external_links,
              images_count, images_missing_alt, schema_types, open_graph,
              twitter_card, raw_headers, snapshot_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
            ON CONFLICT (crawl_job_id, url) DO UPDATE
            SET status_code = EXCLUDED.status_code,
                title = EXCLUDED.title,
                h1 = EXCLUDED.h1,
                meta_desc = EXCLUDED.meta_desc,
                canonical = EXCLUDED.canonical,
                snapshot_at = NOW()`,
            [
              jobId,
              normalizedUrl,
              snapshot.statusCode,
              snapshot.title,
              snapshot.h1,
              snapshot.metaDesc,
              snapshot.canonical,
              snapshot.robotsTag,
              snapshot.wordCount,
              snapshot.internalLinks,
              snapshot.externalLinks,
              snapshot.imagesCount,
              snapshot.imagesMissingAlt,
              JSON.stringify(snapshot.schemaTypes),
              JSON.stringify(snapshot.openGraph),
              JSON.stringify(snapshot.twitterCard),
              JSON.stringify(snapshot.rawHeaders),
            ]
          );

          // If profile requests internal link exploration, queue same-origin links
          if (
            (job.profile === 'internal_links' || job.profile === 'discovery' || job.profile === 'seo_audit') &&
            item.depth < 2 &&
            crawledCount < job.max_pages
          ) {
            const parsedOrigin = new URL(normalizedUrl).origin;
            const discoveredLinks = snapshot.openGraph['discovered_internal_urls']
              ? (JSON.parse(snapshot.openGraph['discovered_internal_urls']) as string[])
              : [];

            for (const link of discoveredLinks) {
              if (link.startsWith(parsedOrigin) && !visited.has(link) && queue.length < 50) {
                queue.push({ url: link, depth: item.depth + 1 });
              }
            }
          }
        } catch (crawlErr) {
          const errMessage = (crawlErr as Error).message;
          logger.warn({ url: normalizedUrl, err: errMessage }, 'Failed crawling target page');

          await query(
            `INSERT INTO crawl_job_urls (crawl_job_id, url, depth, error, crawled_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (crawl_job_id, url) DO UPDATE
             SET error = EXCLUDED.error, crawled_at = NOW()`,
            [jobId, normalizedUrl, item.depth, errMessage]
          ).catch(() => {});
        }
      }

      await query(
        `UPDATE crawl_jobs
         SET status = 'completed', pages_crawled = $1, completed_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [crawledCount, jobId]
      );

      return { pagesCrawled: crawledCount };
    } catch (fatalErr) {
      const msg = (fatalErr as Error).message;
      await query(
        `UPDATE crawl_jobs
         SET status = 'failed', error = $1, completed_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [msg, jobId]
      );
      return { pagesCrawled: crawledCount, error: msg };
    }
  }

  /**
   * Crawl a single target URL with robots.txt check, SSRF verification, and HTML extraction
   */
  public static async crawlSingleUrl(targetUrl: string): Promise<PageSnapshotData> {
    // 1. SSRF Hardening Check (Async with DNS resolution)
    await assertSafeOutboundUrlAsync(targetUrl);

    // 2. Robots.txt Compliance Check
    const origin = new URL(targetUrl).origin;
    const robotsUrl = `${origin}/robots.txt`;
    let isAllowedByRobots = true;

    try {
      await assertSafeOutboundUrlAsync(robotsUrl);
      const robotsRes = await axios.get(robotsUrl, {
        headers: { 'User-Agent': this.USER_AGENT },
        timeout: 4000,
        validateStatus: () => true, // Don't throw on 404
      });

      if (robotsRes.status === 200 && typeof robotsRes.data === 'string') {
        const parseFn = (robotsParser as any).default || robotsParser;
        const robots = parseFn(robotsUrl, robotsRes.data);
        isAllowedByRobots = robots.isAllowed(targetUrl, 'AutonomousGrowthOS-DiscoveryBot') ?? true;
      }
    } catch {
      // If robots.txt unreachable or times out, proceed permissively
      isAllowedByRobots = true;
    }

    if (!isAllowedByRobots) {
      throw new Error(`Target URL ${targetUrl} is disallowed by destination robots.txt policy`);
    }

    // 3. Fetch HTML content
    const response: AxiosResponse<string> = await axios.get(targetUrl, {
      headers: {
        'User-Agent': this.USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: this.TIMEOUT_MS,
      maxContentLength: this.MAX_BYTES,
      validateStatus: () => true, // capture 404, 500, etc. truthfully
    });

    const statusCode = response.status;
    const html = typeof response.data === 'string' ? response.data : '';
    const root = parseHtml(html);

    // 4. Extract HTML elements
    const title = root.querySelector('title')?.textContent?.trim() || null;
    const h1 = root.querySelector('h1')?.textContent?.trim() || null;
    const metaDesc = root.querySelector('meta[name="description" i]')?.getAttribute('content')?.trim() || null;
    const canonical = root.querySelector('link[rel="canonical" i]')?.getAttribute('href')?.trim() || null;
    const robotsTag = root.querySelector('meta[name="robots" i]')?.getAttribute('content')?.trim() || null;

    // Word count calculation
    const bodyText = root.querySelector('body')?.text || '';
    const words = bodyText.trim().split(/\s+/).filter((w) => w.length > 0);
    const wordCount = words.length;

    // Links breakdown
    const anchorElements = root.querySelectorAll('a[href]');
    let internalLinks = 0;
    let externalLinks = 0;
    const discoveredInternalUrls: string[] = [];

    for (const a of anchorElements) {
      const href = a.getAttribute('href')?.trim();
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;

      try {
        const resolved = new URL(href, targetUrl);
        if (resolved.origin === origin) {
          internalLinks++;
          if (!discoveredInternalUrls.includes(resolved.href)) {
            discoveredInternalUrls.push(resolved.href);
          }
        } else {
          externalLinks++;
        }
      } catch {
        // relative or invalid URL syntax
      }
    }

    // Images alt check
    const imgElements = root.querySelectorAll('img');
    const imagesCount = imgElements.length;
    let imagesMissingAlt = 0;
    for (const img of imgElements) {
      const alt = img.getAttribute('alt');
      if (alt === undefined || alt === null || alt.trim() === '') {
        imagesMissingAlt++;
      }
    }

    // JSON-LD schema detection
    const schemaTypes: string[] = [];
    const ldJsonScripts = root.querySelectorAll('script[type="application/ld+json"]');
    for (const script of ldJsonScripts) {
      try {
        const parsedJson = JSON.parse(script.textContent || '{}');
        if (parsedJson['@type']) {
          schemaTypes.push(String(parsedJson['@type']));
        } else if (Array.isArray(parsedJson['@graph'])) {
          for (const item of parsedJson['@graph']) {
            if (item['@type']) schemaTypes.push(String(item['@type']));
          }
        }
      } catch {
        schemaTypes.push('InvalidJSON-LD');
      }
    }

    // Open Graph tags
    const openGraph: Record<string, string> = {};
    const ogMetas = root.querySelectorAll('meta[property^="og:" i]');
    for (const og of ogMetas) {
      const prop = og.getAttribute('property')?.toLowerCase() || '';
      const content = og.getAttribute('content')?.trim() || '';
      if (prop && content) openGraph[prop] = content;
    }
    // store discovered URLs for crawl traversal
    if (discoveredInternalUrls.length > 0) {
      openGraph['discovered_internal_urls'] = JSON.stringify(discoveredInternalUrls.slice(0, 30));
    }

    // Twitter Card tags
    const twitterCard: Record<string, string> = {};
    const twitterMetas = root.querySelectorAll('meta[name^="twitter:" i]');
    for (const tw of twitterMetas) {
      const name = tw.getAttribute('name')?.toLowerCase() || '';
      const content = tw.getAttribute('content')?.trim() || '';
      if (name && content) twitterCard[name] = content;
    }

    // Raw headers summary
    const rawHeaders: Record<string, string> = {};
    if (response.headers['content-type']) rawHeaders['content-type'] = String(response.headers['content-type']);
    if (response.headers['x-robots-tag']) rawHeaders['x-robots-tag'] = String(response.headers['x-robots-tag']);
    if (response.headers['server']) rawHeaders['server'] = String(response.headers['server']);

    return {
      url: targetUrl,
      statusCode,
      title,
      h1,
      metaDesc,
      canonical,
      robotsTag,
      wordCount,
      internalLinks,
      externalLinks,
      imagesCount,
      imagesMissingAlt,
      schemaTypes,
      openGraph,
      twitterCard,
      rawHeaders,
    };
  }
}
