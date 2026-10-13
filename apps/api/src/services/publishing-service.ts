/**
 * Independent Public Publishing Surface Service
 *
 * Implements Workstream 2 & Correction A:
 * - Publicly resolvable domain (strict rejection of .internal)
 * - Mandatory human approval enforcement (assertPublishingApproved)
 * - SEO metadata, JSON-LD Schema.org, Open Graph, canonical links
 * - Valid XML sitemap and robots.txt generation
 * - Transparent attribution CTA routing through /r/:short_code
 */

import { query } from '../lib/db.js';
import { env } from '../lib/env.js';
import { assertPublishingApproved, SafetyViolationError } from '../lib/safety.js';

export interface PublishedPageRecord {
  id: string;
  workspace_id: string;
  brand_id: string;
  asset_id: string | null;
  approval_event_id: string;
  slug: string;
  title: string;
  meta_description: string;
  canonical_url: string;
  schema_type: string;
  html_content: string;
  cta_tracked_code: string | null;
  cta_label: string;
  page_views: number;
  is_indexed: boolean;
  published_at: string;
  updated_at: string;
}

export interface PublishPageInput {
  workspaceId: string;
  brandId: string;
  assetId?: string;
  approvalEventId: string;
  slug: string;
  title: string;
  metaDescription: string;
  schemaType?: string;
  htmlContent: string;
  ctaTrackedCode?: string;
  ctaLabel?: string;
}

export class PublishingService {
  /**
   * Publishes an asset to the independent public publishing surface.
   * STRICT ENFORCEMENT: Fails if approval_event_id is missing or not in 'approved' status.
   */
  public static async publishPage(input: PublishPageInput): Promise<PublishedPageRecord> {
    // 1. Mandatory Human Approval Gate
    assertPublishingApproved(input.approvalEventId);

    // Verify approval event status in database
    const appRes = await query<{ status: string }>(
      `SELECT status FROM approval_events WHERE id = $1`,
      [input.approvalEventId]
    );

    if (appRes.rows.length === 0 || appRes.rows[0]?.status !== 'approved') {
      throw new SafetyViolationError(
        `Publishing rejected: Approval event ${input.approvalEventId} is not approved in database.`,
        'UNAPPROVED_PUBLISHING_ATTEMPT'
      );
    }

    // 2. Validate Public Domain: Must not contain .internal
    const publishingOrigin = env.PUBLIC_PUBLISHING_DOMAIN.replace(/\/+$/, '');
    if (publishingOrigin.toLowerCase().includes('.internal')) {
      throw new SafetyViolationError(
        'Public publishing surface cannot use .internal (ICANN reserved for private networks)',
        'INVALID_PUBLISHING_DOMAIN'
      );
    }

    const canonicalUrl = `${publishingOrigin}/p/${encodeURIComponent(input.slug)}`;

    // 3. Ensure content_assets record exists for referential audit trail
    let assetId = input.assetId;
    if (!assetId) {
      const assetRes = await query<{ id: string }>(
        `INSERT INTO content_assets (
          workspace_id, brand_id, asset_type, lifecycle_status, title,
          body_markdown, intent_type, authoring_agent, approval_event_id, canonical_url
        ) VALUES ($1, $2, 'article', 'published', $3, $4, 'informational', 'publishing_service', $5, $6)
        RETURNING id`,
        [input.workspaceId, input.brandId, input.title, input.htmlContent, input.approvalEventId, canonicalUrl]
      );
      assetId = assetRes.rows[0]!.id;
    }

    // 4. Upsert into public_published_pages
    const pageRes = await query<PublishedPageRecord>(
      `INSERT INTO public_published_pages (
        workspace_id, brand_id, asset_id, approval_event_id, slug,
        title, meta_description, canonical_url, schema_type,
        html_content, cta_tracked_code, cta_label
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (slug) DO UPDATE
      SET title = EXCLUDED.title,
          meta_description = EXCLUDED.meta_description,
          html_content = EXCLUDED.html_content,
          canonical_url = EXCLUDED.canonical_url,
          cta_tracked_code = EXCLUDED.cta_tracked_code,
          cta_label = EXCLUDED.cta_label,
          updated_at = NOW()
      RETURNING *`,
      [
        input.workspaceId,
        input.brandId,
        assetId,
        input.approvalEventId,
        input.slug,
        input.title,
        input.metaDescription,
        canonicalUrl,
        input.schemaType ?? 'Article',
        input.htmlContent,
        input.ctaTrackedCode ?? null,
        input.ctaLabel ?? 'Learn More',
      ]
    );

    const page = pageRes.rows[0]!;

    // 5. Log into immutable publication_records
    await query(
      `INSERT INTO publication_records (
        workspace_id, brand_id, asset_id, channel, destination_type,
        published_url, approval_event_id, status
      ) VALUES ($1, $2, $3, 'os_public_site', 'os_owned_property', $4, $5, 'published')`,
      [input.workspaceId, input.brandId, assetId, canonicalUrl, input.approvalEventId]
    );

    return page;
  }

  /**
   * Fetches published page by slug and increments views
   */
  public static async getPageBySlug(slug: string): Promise<PublishedPageRecord | null> {
    const res = await query<PublishedPageRecord>(
      `UPDATE public_published_pages
       SET page_views = page_views + 1
       WHERE slug = $1 AND is_indexed = true
       RETURNING *`,
      [slug]
    );

    return res.rows[0] ?? null;
  }

  /**
   * Generates a valid XML sitemap for search engines
   */
  public static async generateSitemapXml(): Promise<string> {
    const res = await query<{ slug: string; canonical_url: string; updated_at: string }>(
      `SELECT slug, canonical_url, updated_at FROM public_published_pages WHERE is_indexed = true ORDER BY updated_at DESC`
    );

    const urlsXml = res.rows
      .map(
        (row) => `  <url>
    <loc>${row.canonical_url}</loc>
    <lastmod>${new Date(row.updated_at).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;
  }

  /**
   * Generates standard robots.txt directing crawlers to the sitemap
   */
  public static generateRobotsTxt(): string {
    const publishingOrigin = env.PUBLIC_PUBLISHING_DOMAIN.replace(/\/+$/, '');
    return `# Autonomous Growth OS Public Surface Robots Rules
User-agent: *
Allow: /p/
Allow: /sitemap.xml
Disallow: /api/
Disallow: /health

Sitemap: ${publishingOrigin}/sitemap.xml
`;
  }

  /**
   * Lists all published pages for a workspace and optional brand filter
   */
  public static async listPages(workspaceId: string, brandId?: string): Promise<PublishedPageRecord[]> {
    if (brandId) {
      const res = await query<PublishedPageRecord>(
        `SELECT * FROM public_published_pages WHERE workspace_id = $1 AND brand_id = $2 ORDER BY published_at DESC`,
        [workspaceId, brandId]
      );
      return res.rows;
    }
    const res = await query<PublishedPageRecord>(
      `SELECT * FROM public_published_pages WHERE workspace_id = $1 ORDER BY published_at DESC`,
      [workspaceId]
    );
    return res.rows;
  }

  /**
   * Renders full SEO-compliant HTML page
   */
  public static renderHtmlDocument(page: PublishedPageRecord): string {
    const publishingOrigin = env.PUBLIC_PUBLISHING_DOMAIN.replace(/\/+$/, '');
    const ctaUrl = page.cta_tracked_code ? `${publishingOrigin}/r/${page.cta_tracked_code}` : '#';

    const schemaJson = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': page.schema_type,
      headline: page.title,
      description: page.meta_description,
      url: page.canonical_url,
      datePublished: page.published_at,
      dateModified: page.updated_at,
      publisher: {
        '@type': 'Organization',
        name: 'Autonomous Growth OS Deep-Tech Laboratory',
        url: publishingOrigin,
      },
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(page.title)} | Deep-Tech Research & Insights</title>
  <meta name="description" content="${escapeHtml(page.meta_description)}">
  <link rel="canonical" href="${page.canonical_url}">
  <meta name="robots" content="index, follow">

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(page.title)}">
  <meta property="og:description" content="${escapeHtml(page.meta_description)}">
  <meta property="og:url" content="${page.canonical_url}">
  <meta property="og:type" content="article">

  <!-- Schema.org JSON-LD -->
  <script type="application/ld+json">
    ${schemaJson}
  </script>

  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #111827;
      --text: #f3f4f6;
      --muted: #9ca3af;
      --accent: #3b82f6;
      --accent-hover: #2563eb;
      --border: #1f2937;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.7;
    }
    .container {
      max-width: 860px;
      margin: 0 auto;
      padding: 40px 20px 80px;
    }
    header {
      margin-bottom: 40px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 24px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      background: #1e3a8a;
      color: #93c5fd;
      border-radius: 9999px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 2.4rem;
      line-height: 1.25;
      margin: 0 0 16px;
    }
    .meta {
      font-size: 0.9rem;
      color: var(--muted);
    }
    article {
      font-size: 1.1rem;
      color: #e5e7eb;
    }
    article p { margin-bottom: 1.4rem; }
    article h2 { font-size: 1.6rem; margin-top: 2rem; color: #fff; }
    article h3 { font-size: 1.3rem; margin-top: 1.6rem; color: #f3f4f6; }
    .cta-box {
      margin-top: 50px;
      padding: 30px;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      text-align: center;
    }
    .cta-btn {
      display: inline-block;
      margin-top: 16px;
      padding: 14px 28px;
      background: var(--accent);
      color: #fff;
      text-decoration: none;
      font-weight: 600;
      border-radius: 8px;
      transition: background 0.2s;
    }
    .cta-btn:hover { background: var(--accent-hover); }
    footer {
      margin-top: 60px;
      text-align: center;
      font-size: 0.85rem;
      color: var(--muted);
      border-top: 1px solid var(--border);
      padding-top: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="badge">Verified Technical Intelligence</div>
      <h1>${escapeHtml(page.title)}</h1>
      <div class="meta">
        Published: ${new Date(page.published_at).toLocaleDateString()} · Deep-Tech Engineering Lab
      </div>
    </header>

    <article>
      ${page.html_content}
    </article>

    <div class="cta-box">
      <h3>Explore Further</h3>
      <p>Discover how modern architectures automate this workflow with zero operational overhead.</p>
      <a href="${ctaUrl}" class="cta-btn" target="_blank" rel="noopener">${escapeHtml(page.cta_label)} &rarr;</a>
    </div>

    <footer>
      <p>&copy; 2026 Autonomous Growth OS Independent Research Lab. All rights reserved.</p>
      <p>Independent evaluation platform — transparent attribution and privacy-preserving measurement.</p>
    </footer>
  </div>
</body>
</html>`;
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
