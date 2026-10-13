/**
 * Autonomous Growth OS — Technical SEO Audit Workbench Service
 *
 * Implements P2 Specification:
 * - Runs comprehensive diagnostic audits on page snapshots or live URLs.
 * - Categorizes findings into critical, error, warning, info.
 * - Checks HTTP status, canonicalization, robots directives, title tags,
 *   meta descriptions, H1 tags, image alt attributes, Open Graph tags,
 *   Twitter cards, and JSON-LD structured data.
 * - Generates reproducible, evidence-backed records in seo_findings table.
 */

import { query } from '../lib/db.js';
import { CrawlEngineService, type PageSnapshotData } from './crawl-engine.js';
import { logger } from '../lib/logger.js';

export type SeoSeverity = 'critical' | 'error' | 'warning' | 'info';

export interface SeoIssueFinding {
  issueCode: string;
  severity: SeoSeverity;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  recommendation: string;
  url: string;
}

export class SeoWorkbenchService {
  /**
   * Run a full SEO audit against a specific URL and store findings
   */
  public static async auditUrl(
    url: string,
    workspaceId: string,
    brandId?: string | null
  ): Promise<{ snapshot: PageSnapshotData; findings: SeoIssueFinding[] }> {
    logger.info({ url }, 'Executing Technical SEO Audit on URL');

    // 1. Fetch page snapshot
    const snapshot = await CrawlEngineService.crawlSingleUrl(url);

    // 2. Create a mini crawl job to link the findings
    const jobRes = await query<{ id: string }>(
      `INSERT INTO crawl_jobs (workspace_id, brand_id, label, seed_urls, profile, status, pages_crawled)
       VALUES ($1, $2, $3, $4, 'seo_audit', 'completed', 1)
       RETURNING id`,
      [workspaceId, brandId ?? null, `SEO Audit: ${new URL(url).hostname}`, JSON.stringify([url])]
    );
    const crawlJobId = jobRes.rows[0]!.id;

    // 3. Save snapshot
    const snapRes = await query<{ id: string }>(
      `INSERT INTO page_snapshots (
        crawl_job_id, url, status_code, title, h1, meta_desc, canonical,
        robots_tag, word_count, internal_links, external_links,
        images_count, images_missing_alt, schema_types, open_graph,
        twitter_card, raw_headers, snapshot_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
      RETURNING id`,
      [
        crawlJobId,
        url,
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
    const snapshotId = snapRes.rows[0]!.id;

    // 4. Evaluate all diagnostic rules
    const findings = this.evaluateSnapshotRules(snapshot);

    // 5. Persist findings to seo_findings table
    for (const f of findings) {
      await query(
        `INSERT INTO seo_findings (
          crawl_job_id, page_snapshot_id, brand_id, issue_code, severity,
          title, description, evidence, recommendation, url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          crawlJobId,
          snapshotId,
          brandId ?? null,
          f.issueCode,
          f.severity,
          f.title,
          f.description,
          JSON.stringify(f.evidence),
          f.recommendation,
          f.url,
        ]
      );
    }

    return { snapshot, findings };
  }

  /**
   * Run SEO audits for all snapshots in an existing crawl job
   */
  public static async auditCrawlJob(crawlJobId: string): Promise<SeoIssueFinding[]> {
    const snapshotsRes = await query<{
      id: string;
      url: string;
      status_code: number;
      title: string | null;
      h1: string | null;
      meta_desc: string | null;
      canonical: string | null;
      robots_tag: string | null;
      word_count: number;
      internal_links: number;
      external_links: number;
      images_count: number;
      images_missing_alt: number;
      schema_types: string[];
      open_graph: Record<string, string>;
      twitter_card: Record<string, string>;
      raw_headers: Record<string, string>;
    }>(
      `SELECT id, url, status_code, title, h1, meta_desc, canonical, robots_tag,
              word_count, internal_links, external_links, images_count,
              images_missing_alt, schema_types, open_graph, twitter_card, raw_headers
       FROM page_snapshots
       WHERE crawl_job_id = $1`,
      [crawlJobId]
    );

    const allFindings: SeoIssueFinding[] = [];

    for (const snap of snapshotsRes.rows) {
      const data: PageSnapshotData = {
        url: snap.url,
        statusCode: snap.status_code,
        title: snap.title,
        h1: snap.h1,
        metaDesc: snap.meta_desc,
        canonical: snap.canonical,
        robotsTag: snap.robots_tag,
        wordCount: snap.word_count,
        internalLinks: snap.internal_links,
        externalLinks: snap.external_links,
        imagesCount: snap.images_count,
        imagesMissingAlt: snap.images_missing_alt,
        schemaTypes: Array.isArray(snap.schema_types) ? snap.schema_types : [],
        openGraph: snap.open_graph || {},
        twitterCard: snap.twitter_card || {},
        rawHeaders: snap.raw_headers || {},
      };

      const findings = this.evaluateSnapshotRules(data);

      for (const f of findings) {
        allFindings.push(f);
        await query(
          `INSERT INTO seo_findings (
            crawl_job_id, page_snapshot_id, issue_code, severity,
            title, description, evidence, recommendation, url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            crawlJobId,
            snap.id,
            f.issueCode,
            f.severity,
            f.title,
            f.description,
            JSON.stringify(f.evidence),
            f.recommendation,
            f.url,
          ]
        );
      }
    }

    return allFindings;
  }

  /**
   * Deterministic Diagnostic Rule Engine
   */
  public static evaluateSnapshotRules(snapshot: PageSnapshotData): SeoIssueFinding[] {
    const findings: SeoIssueFinding[] = [];
    const url = snapshot.url;

    // 1. HTTP Status Code Checks
    if (snapshot.statusCode >= 500) {
      findings.push({
        issueCode: 'HTTP_5XX_SERVER_ERROR',
        severity: 'critical',
        title: `Server Error (${snapshot.statusCode})`,
        description: `The web server returned a 5xx server error status code.`,
        evidence: { statusCode: snapshot.statusCode },
        recommendation: 'Inspect server logs and backend application health to resolve the crash.',
        url,
      });
    } else if (snapshot.statusCode >= 400) {
      findings.push({
        issueCode: 'HTTP_4XX_CLIENT_ERROR',
        severity: 'critical',
        title: `Page Not Found or Client Error (${snapshot.statusCode})`,
        description: `The URL returned a ${snapshot.statusCode} response code and cannot be indexed.`,
        evidence: { statusCode: snapshot.statusCode },
        recommendation: 'Fix broken internal links or implement a 301 redirect to relevant active content.',
        url,
      });
    }

    // 2. Robots Indexability Directives
    if (snapshot.robotsTag && /noindex/i.test(snapshot.robotsTag)) {
      findings.push({
        issueCode: 'ROBOTS_NOINDEX_DIRECTIVE',
        severity: 'warning',
        title: 'Page Marked as noindex',
        description: 'The robots meta tag contains "noindex", preventing search engines from indexing this page.',
        evidence: { robotsTag: snapshot.robotsTag },
        recommendation: 'Verify if this page is intended to be excluded from public search results.',
        url,
      });
    }

    // 3. Title Tag Checks
    if (!snapshot.title) {
      findings.push({
        issueCode: 'TITLE_MISSING',
        severity: 'error',
        title: 'Missing <title> Tag',
        description: 'The page lacks a title tag, which is essential for SERP snippets and rankings.',
        evidence: { title: null },
        recommendation: 'Add a descriptive, keyword-targeted <title> between 30 and 60 characters.',
        url,
      });
    } else {
      const len = snapshot.title.length;
      if (len < 20) {
        findings.push({
          issueCode: 'TITLE_TOO_SHORT',
          severity: 'warning',
          title: `Title Tag Too Short (${len} chars)`,
          description: `The title tag is only ${len} characters. Search engines prefer titles with 30-60 characters.`,
          evidence: { title: snapshot.title, length: len },
          recommendation: 'Expand title with secondary keywords and brand name.',
          url,
        });
      } else if (len > 65) {
        findings.push({
          issueCode: 'TITLE_TOO_LONG',
          severity: 'warning',
          title: `Title Tag Too Long (${len} chars)`,
          description: `The title tag is ${len} characters and may be truncated on Google desktop and mobile SERPs.`,
          evidence: { title: snapshot.title, length: len },
          recommendation: 'Shorten title to under 60 characters so it fits search result snippet limits.',
          url,
        });
      }
    }

    // 4. Meta Description Checks
    if (!snapshot.metaDesc) {
      findings.push({
        issueCode: 'META_DESC_MISSING',
        severity: 'warning',
        title: 'Missing Meta Description',
        description: 'The page has no meta description tag. Google will auto-generate snippets from body copy.',
        evidence: { metaDesc: null },
        recommendation: 'Add an engaging meta description between 70 and 155 characters with a clear call-to-action.',
        url,
      });
    } else {
      const len = snapshot.metaDesc.length;
      if (len < 50) {
        findings.push({
          issueCode: 'META_DESC_TOO_SHORT',
          severity: 'info',
          title: `Meta Description Too Short (${len} chars)`,
          description: `The meta description is only ${len} characters and does not maximize SERP snippet real estate.`,
          evidence: { metaDesc: snapshot.metaDesc, length: len },
          recommendation: 'Expand meta description to 100-155 characters for higher click-through rates.',
          url,
        });
      } else if (len > 165) {
        findings.push({
          issueCode: 'META_DESC_TOO_LONG',
          severity: 'info',
          title: `Meta Description Too Long (${len} chars)`,
          description: `The meta description exceeds 160 characters and will likely be truncated on search results.`,
          evidence: { metaDesc: snapshot.metaDesc, length: len },
          recommendation: 'Trim description to under 155 characters.',
          url,
        });
      }
    }

    // 5. H1 Tag Checks
    if (!snapshot.h1) {
      findings.push({
        issueCode: 'H1_MISSING',
        severity: 'error',
        title: 'Missing <h1> Heading',
        description: 'The page lacks a primary <h1> heading tag, diminishing topical structure and accessibility.',
        evidence: { h1: null },
        recommendation: 'Add exactly one <h1> heading summarizing the main topic of the page.',
        url,
      });
    }

    // 6. Canonical Tag Checks
    if (!snapshot.canonical) {
      findings.push({
        issueCode: 'CANONICAL_MISSING',
        severity: 'warning',
        title: 'Missing Canonical Tag',
        description: 'The page lacks a <link rel="canonical"> tag, which can lead to duplicate content ambiguity.',
        evidence: { canonical: null },
        recommendation: `Add a self-referencing canonical tag pointing to "${url}".`,
        url,
      });
    }

    // 7. Image Alt Attributes
    if (snapshot.imagesMissingAlt > 0) {
      findings.push({
        issueCode: 'IMAGES_MISSING_ALT',
        severity: 'warning',
        title: `${snapshot.imagesMissingAlt} Image(s) Missing Alt Text`,
        description: `${snapshot.imagesMissingAlt} of ${snapshot.imagesCount} images lack an alt attribute for accessibility and image search.`,
        evidence: { totalImages: snapshot.imagesCount, missingAlt: snapshot.imagesMissingAlt },
        recommendation: 'Add concise, descriptive alt attributes explaining the subject matter of each image.',
        url,
      });
    }

    // 8. Open Graph & Social Cards
    const hasOgTitle = Boolean(snapshot.openGraph['og:title']);
    const hasOgImage = Boolean(snapshot.openGraph['og:image']);
    if (!hasOgTitle || !hasOgImage) {
      findings.push({
        issueCode: 'OPEN_GRAPH_INCOMPLETE',
        severity: 'info',
        title: 'Incomplete Open Graph Tags',
        description: 'Missing og:title or og:image tags prevents high-conversion preview rich cards on LinkedIn & Facebook.',
        evidence: { openGraphPresent: Object.keys(snapshot.openGraph) },
        recommendation: 'Provide og:title, og:description, og:image, and og:type tags.',
        url,
      });
    }

    // 9. Structured Data (JSON-LD)
    if (snapshot.schemaTypes.length === 0) {
      findings.push({
        issueCode: 'STRUCTURED_DATA_MISSING',
        severity: 'info',
        title: 'No Structured Data (JSON-LD) Detected',
        description: 'No schema.org structured data was found. Rich snippets on Google SERP will not be enabled.',
        evidence: { schemaTypes: [] },
        recommendation: 'Add appropriate Schema.org JSON-LD (e.g. WebSite, Organization, Article, Product, or FAQPage).',
        url,
      });
    }

    return findings;
  }
}
