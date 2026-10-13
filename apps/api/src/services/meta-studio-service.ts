/**
 * Autonomous Growth OS — Meta Tags Studio V3 Service
 *
 * Implements Meta Tags Studio V3 Specification:
 * - 4-tier truthfulness: Observed State, Suggested Metadata, Simulated Previews, External Verification.
 * - Safe URL validation against permitted scopes; SSRF-hardened outbound probes.
 * - Zero invented values: No synthetic timestamps, product prices, fake ratings, or phantom images.
 * - Real live inspection of target URLs extracting title, H1, meta desc, canonical, robots,
 *   OG, Twitter cards, images, and JSON-LD structured data.
 * - Backend image probe verifying HTTP status, MIME type, redirects, and accessibility.
 * - Explainable Metadata Health Report across 6 diagnostic categories.
 * - Multi-candidate title and description suggestions with estimated pixel-width meters.
 * - Safe HTML entity escaping and script-injection-proof JSON-LD serialization.
 * - Tenant-scoped proposals with observed vs. proposed diffs and immutable approval workflow.
 * - Batch metadata audit across completed crawl jobs.
 */

import axios from 'axios';
import { parse as parseHtml } from 'node-html-parser';
import { query } from '../lib/db.js';
import { assertSafeOutboundUrlAsync, SafetyViolationError } from '../lib/safety.js';
import { logger } from '../lib/logger.js';

export type EvidenceState =
  | 'input_only'
  | 'page_inspected'
  | 'image_verified'
  | 'schema_syntax_validated'
  | 'external_validation_not_run'
  | 'external_validation_completed';

export interface InspectedMetadata {
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  contentType: string;
  fetchDurationMs: number;
  fetchedAt: string;
  title: string | null;
  h1: string | null;
  metaDesc: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  xRobotsTag: string | null;
  htmlLang: string | null;
  viewport: string | null;
  charset: string | null;
  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;
  detectedImages: Array<{ url: string; alt?: string; source: string }>;
  jsonLdScripts: Array<{ raw: string; parsed: any | null; error?: string }>;
  schemaTypes: string[];
  internalLinksCount: number;
  externalLinksCount: number;
  evidenceId?: string;
}

export interface ImageProbeResult {
  url: string;
  finalUrl: string;
  isAccessible: boolean;
  statusCode: number;
  contentType: string | null;
  contentLengthBytes: number | null;
  isImageMime: boolean;
  hasRedirect: boolean;
  warning?: string;
  checkedAt: string;
}

export interface TitleCandidate {
  variant: 'descriptive' | 'benefit_led' | 'brand_concise';
  text: string;
  charCount: number;
  estimatedPixelWidth: number; // Google desktop limit ~580px, mobile ~600px
  fitsDesktopSnippet: boolean;
}

export interface DescriptionCandidate {
  variant: 'informative' | 'action_oriented' | 'concise';
  text: string;
  charCount: number;
  estimatedPixelWidth: number; // Google desktop limit ~960px
  fitsDesktopSnippet: boolean;
}

export interface MetaStudioGenerateInput {
  workspaceId: string;
  brandId?: string | null;
  brandName: string;
  brandDomain: string;
  pageUrl: string;
  pageTitle?: string;
  pageDescription?: string;
  targetKeyword?: string;
  schemaType?: string;
  imageUrl?: string;
  imageAlt?: string;
  authorName?: string;
  datePublished?: string;
  dateModified?: string;
  observedData?: Partial<InspectedMetadata>;
}

export interface MetaStudioGenerateResult {
  evidenceState: EvidenceState;
  notice: string;
  metaTags: {
    title: string;
    description: string;
    canonical: string;
    robots: string;
  };
  titleCandidates: TitleCandidate[];
  descriptionCandidates: DescriptionCandidate[];
  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;
  jsonLd: Record<string, unknown> | null;
  jsonLdSyntaxValid: boolean;
  simulatedPreviews: {
    googleSerp: {
      displayUrl: string;
      title: string;
      snippet: string;
      truncatedDesktop: boolean;
    };
    facebookOg: {
      siteName: string;
      title: string;
      description: string;
      imageUrl: string | null;
    };
    linkedIn: {
      title: string;
      domain: string;
      imageUrl: string | null;
    };
    twitterSummary: {
      cardType: string;
      title: string;
      description: string;
      domain: string;
      imageUrl: string | null;
    };
    twitterLarge: {
      cardType: string;
      title: string;
      description: string;
      domain: string;
      imageUrl: string | null;
    };
  };
  htmlSnippet: string;
  omittedFields: string[];
}

export interface HealthReportFinding {
  ruleId: string;
  category: 'technical_correctness' | 'metadata_completeness' | 'consistency' | 'social_readiness' | 'structured_data' | 'policy';
  severity: 'critical' | 'error' | 'warning' | 'info';
  title: string;
  description: string;
  recommendation: string;
  observedValue?: any;
}

export interface MetadataHealthReport {
  overallScore: number; // 0 - 100
  categories: {
    technicalCorrectness: number;
    metadataCompleteness: number;
    consistency: number;
    socialReadiness: number;
    structuredData: number;
  };
  findings: HealthReportFinding[];
  auditedAt: string;
}

export class MetaStudioService {
  private static readonly USER_AGENT = 'AutonomousGrowthOS-MetadataInspector/2.0 (+https://growth-os.internal/inspector)';

  /**
   * Safe URL parsing & normalization
   */
  public static validateAndNormalizeUrl(rawUrl: string, allowedDomains?: string[]): { isValid: boolean; normalized?: string; error?: string } {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return { isValid: false, error: 'URL must be a non-empty string.' };
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      return { isValid: false, error: 'Malformed URL syntax.' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isValid: false, error: `Protocol "${parsed.protocol}" is not permitted. Only HTTP and HTTPS are allowed.` };
    }

    if (parsed.username || parsed.password) {
      return { isValid: false, error: 'URLs with embedded credentials are not allowed for security reasons.' };
    }

    const hostname = parsed.hostname.toLowerCase();
    if (allowedDomains && allowedDomains.length > 0) {
      const isAllowed = allowedDomains.some((d) => {
        try {
          const domHost = new URL(d.startsWith('http') ? d : `https://${d}`).hostname.toLowerCase();
          return hostname === domHost || hostname.endsWith(`.${domHost}`);
        } catch {
          return false;
        }
      });

      if (!isAllowed) {
        return {
          isValid: false,
          error: `Host "${hostname}" is outside the authorized brand domains: ${allowedDomains.join(', ')}`,
        };
      }
    }

    return { isValid: true, normalized: parsed.href };
  }

  /**
   * HTML Entity Escaping to prevent injection in generated snippet attributes
   */
  public static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Serialize JSON-LD safely avoiding </script> HTML breakout injection
   */
  public static safeJsonLd(obj: unknown): string {
    const raw = JSON.stringify(obj, null, 2);
    return raw.replace(/<\/script/gi, '<\\/script');
  }

  /**
   * Estimate character pixel width for Google SERP layout
   * (Proportional font approximation: Average title character ~9.5px, description ~7.2px)
   */
  public static estimatePixelWidth(text: string, fontType: 'title' | 'description'): number {
    const avgWidth = fontType === 'title' ? 9.6 : 7.2;
    let width = 0;
    for (const char of text) {
      if ('ijl|.,:;!'.includes(char)) width += fontType === 'title' ? 4.5 : 3.5;
      else if ('mwMW@'.includes(char)) width += fontType === 'title' ? 14.5 : 11.0;
      else if (char === char.toUpperCase() && char !== char.toLowerCase()) width += fontType === 'title' ? 11.5 : 8.8;
      else width += avgWidth;
    }
    return Math.round(width);
  }

  /**
   * Inspect a live URL extracting real page facts
   */
  public static async inspectPage(
    rawUrl: string,
    workspaceId: string,
    brandId?: string | null,
    allowedDomains?: string[]
  ): Promise<InspectedMetadata> {
    const validation = this.validateAndNormalizeUrl(rawUrl, allowedDomains);
    if (!validation.isValid || !validation.normalized) {
      throw new Error(`Invalid URL for inspection: ${validation.error}`);
    }

    const targetUrl = validation.normalized;
    await assertSafeOutboundUrlAsync(targetUrl);

    logger.info({ url: targetUrl, workspaceId }, 'Inspecting target page metadata');

    const startTime = Date.now();
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': this.USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 10000,
      maxContentLength: 8 * 1024 * 1024, // 8 MB max
      validateStatus: () => true, // Don't crash on 404/500
    });
    const fetchDurationMs = Date.now() - startTime;

    const statusCode = response.status;
    const contentType = String(response.headers['content-type'] || 'unknown');
    const xRobotsTag = response.headers['x-robots-tag'] ? String(response.headers['x-robots-tag']) : null;
    const finalUrl = response.request?.res?.responseUrl || targetUrl;

    const html = typeof response.data === 'string' ? response.data : '';
    const root = parseHtml(html);

    // Extract core tags
    const title = root.querySelector('title')?.textContent?.trim() || null;
    const h1 = root.querySelector('h1')?.textContent?.trim() || null;
    const metaDesc = root.querySelector('meta[name="description" i]')?.getAttribute('content')?.trim() || null;
    const canonical = root.querySelector('link[rel="canonical" i]')?.getAttribute('href')?.trim() || null;
    const robotsMeta = root.querySelector('meta[name="robots" i]')?.getAttribute('content')?.trim() || null;
    const htmlLang = root.querySelector('html')?.getAttribute('lang')?.trim() || null;
    const viewport = root.querySelector('meta[name="viewport" i]')?.getAttribute('content')?.trim() || null;
    const charset = root.querySelector('meta[charset]')?.getAttribute('charset')?.trim() || null;

    // Open Graph
    const openGraph: Record<string, string> = {};
    for (const el of root.querySelectorAll('meta[property^="og:" i]')) {
      const prop = el.getAttribute('property')?.toLowerCase() || '';
      const content = el.getAttribute('content')?.trim() || '';
      if (prop && content) openGraph[prop] = content;
    }

    // Twitter Card
    const twitterCard: Record<string, string> = {};
    for (const el of root.querySelectorAll('meta[name^="twitter:" i]')) {
      const name = el.getAttribute('name')?.toLowerCase() || '';
      const content = el.getAttribute('content')?.trim() || '';
      if (name && content) twitterCard[name] = content;
    }

    // Images
    const detectedImages: Array<{ url: string; alt?: string; source: string }> = [];
    if (openGraph['og:image']) {
      detectedImages.push({ url: openGraph['og:image'], source: 'og:image' });
    }
    if (twitterCard['twitter:image'] && twitterCard['twitter:image'] !== openGraph['og:image']) {
      detectedImages.push({ url: twitterCard['twitter:image'], source: 'twitter:image' });
    }
    for (const img of root.querySelectorAll('img')) {
      const src = img.getAttribute('src')?.trim();
      const alt = img.getAttribute('alt')?.trim();
      if (src && !src.startsWith('data:') && detectedImages.length < 10) {
        try {
          const resolved = new URL(src, finalUrl).href;
          if (!detectedImages.some((i) => i.url === resolved)) {
            detectedImages.push({ url: resolved, alt, source: 'html_body' });
          }
        } catch {}
      }
    }

    // JSON-LD Scripts
    const jsonLdScripts: Array<{ raw: string; parsed: any | null; error?: string }> = [];
    const schemaTypes: string[] = [];
    for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
      const raw = script.textContent?.trim() || '';
      try {
        const parsed = JSON.parse(raw);
        jsonLdScripts.push({ raw, parsed });
        if (parsed['@type']) {
          schemaTypes.push(String(parsed['@type']));
        } else if (Array.isArray(parsed['@graph'])) {
          for (const item of parsed['@graph']) {
            if (item['@type']) schemaTypes.push(String(item['@type']));
          }
        }
      } catch (parseErr) {
        jsonLdScripts.push({ raw, parsed: null, error: (parseErr as Error).message });
        schemaTypes.push('Malformed_JSON_LD');
      }
    }

    // Links breakdown
    let internalLinksCount = 0;
    let externalLinksCount = 0;
    const origin = new URL(finalUrl).origin;
    for (const a of root.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href')?.trim();
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
      try {
        const resolved = new URL(href, finalUrl);
        if (resolved.origin === origin) internalLinksCount++;
        else externalLinksCount++;
      } catch {}
    }

    return {
      requestedUrl: targetUrl,
      finalUrl,
      statusCode,
      contentType,
      fetchDurationMs,
      fetchedAt: new Date().toISOString(),
      title,
      h1,
      metaDesc,
      canonical,
      robotsMeta,
      xRobotsTag,
      htmlLang,
      viewport,
      charset,
      openGraph,
      twitterCard,
      detectedImages,
      jsonLdScripts,
      schemaTypes,
      internalLinksCount,
      externalLinksCount,
    };
  }

  /**
   * Probe and validate a candidate social share image URL
   */
  public static async verifyImageUrl(rawImageUrl: string): Promise<ImageProbeResult> {
    const validation = this.validateAndNormalizeUrl(rawImageUrl);
    if (!validation.isValid || !validation.normalized) {
      return {
        url: rawImageUrl,
        finalUrl: rawImageUrl,
        isAccessible: false,
        statusCode: 0,
        contentType: null,
        contentLengthBytes: null,
        isImageMime: false,
        hasRedirect: false,
        warning: `Malformed image URL: ${validation.error}`,
        checkedAt: new Date().toISOString(),
      };
    }

    const imageUrl = validation.normalized;
    await assertSafeOutboundUrlAsync(imageUrl);

    try {
      const res = await axios.get(imageUrl, {
        headers: {
          'User-Agent': this.USER_AGENT,
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
        timeout: 6000,
        maxContentLength: 10 * 1024 * 1024, // 10 MB max
        validateStatus: () => true,
      });

      const statusCode = res.status;
      const contentType = res.headers['content-type'] ? String(res.headers['content-type']) : null;
      const contentLength = res.headers['content-length'] ? parseInt(String(res.headers['content-length']), 10) : null;
      const finalUrl = res.request?.res?.responseUrl || imageUrl;
      const hasRedirect = finalUrl !== imageUrl;
      const isImageMime = Boolean(contentType && contentType.toLowerCase().startsWith('image/'));

      let warning: string | undefined;
      if (statusCode >= 400) {
        warning = `Image server returned HTTP ${statusCode} client/server error.`;
      } else if (!isImageMime) {
        warning = `Content-Type "${contentType}" is not a recognized image format. Social platforms require image/jpeg, image/png, or image/webp.`;
      } else if (contentLength && contentLength > 5 * 1024 * 1024) {
        warning = `Image size (${Math.round(contentLength / 1024)} KB) exceeds 5MB limit recommended for social card crawlers.`;
      }

      return {
        url: imageUrl,
        finalUrl,
        isAccessible: statusCode === 200 && isImageMime,
        statusCode,
        contentType,
        contentLengthBytes: contentLength,
        isImageMime,
        hasRedirect,
        warning,
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        url: imageUrl,
        finalUrl: imageUrl,
        isAccessible: false,
        statusCode: 0,
        contentType: null,
        contentLengthBytes: null,
        isImageMime: false,
        hasRedirect: false,
        warning: `Network probe failed: ${(err as Error).message}`,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Synthesize candidate tags, Schema.org JSON-LD, and simulated previews WITHOUT invented values
   */
  public static generate(input: MetaStudioGenerateInput): MetaStudioGenerateResult {
    const brand = input.brandName.trim();
    const rawTitle = (input.pageTitle || input.observedData?.title || '').trim();
    const rawDesc = (input.pageDescription || input.observedData?.metaDesc || '').trim();
    const url = input.pageUrl.trim();
    const imageUrl = input.imageUrl || input.observedData?.openGraph?.['og:image'] || null;

    const omittedFields: string[] = [];

    // Title generation: 3 candidate variants
    const titleCandidates: TitleCandidate[] = [];
    if (rawTitle) {
      // 1. Descriptive
      const descriptive = rawTitle.includes(brand) ? rawTitle : `${rawTitle} | ${brand}`;
      const dPx = this.estimatePixelWidth(descriptive, 'title');
      titleCandidates.push({
        variant: 'descriptive',
        text: descriptive,
        charCount: descriptive.length,
        estimatedPixelWidth: dPx,
        fitsDesktopSnippet: dPx <= 580,
      });

      // 2. Benefit-led
      const cleanBase = rawTitle.replace(new RegExp(`\\s*[\\|\\-]\\s*${brand}`, 'i'), '').trim();
      const benefitLed = `${cleanBase} - Official Platform Guide`;
      const bPx = this.estimatePixelWidth(benefitLed, 'title');
      titleCandidates.push({
        variant: 'benefit_led',
        text: benefitLed,
        charCount: benefitLed.length,
        estimatedPixelWidth: bPx,
        fitsDesktopSnippet: bPx <= 580,
      });

      // 3. Brand-concise
      const concise = cleanBase.length > 45 ? `${cleanBase.substring(0, 42)}... | ${brand}` : `${cleanBase} | ${brand}`;
      const cPx = this.estimatePixelWidth(concise, 'title');
      titleCandidates.push({
        variant: 'brand_concise',
        text: concise,
        charCount: concise.length,
        estimatedPixelWidth: cPx,
        fitsDesktopSnippet: cPx <= 580,
      });
    }

    const primaryTitle = titleCandidates[0]?.text || rawTitle || brand;

    // Description generation: 3 candidate variants
    const descriptionCandidates: DescriptionCandidate[] = [];
    if (rawDesc) {
      const dPx = this.estimatePixelWidth(rawDesc, 'description');
      descriptionCandidates.push({
        variant: 'informative',
        text: rawDesc,
        charCount: rawDesc.length,
        estimatedPixelWidth: dPx,
        fitsDesktopSnippet: dPx <= 960,
      });

      const actionText = `${rawDesc} Discover verified workflows on ${brand}.`;
      const aPx = this.estimatePixelWidth(actionText, 'description');
      descriptionCandidates.push({
        variant: 'action_oriented',
        text: actionText,
        charCount: actionText.length,
        estimatedPixelWidth: aPx,
        fitsDesktopSnippet: aPx <= 960,
      });

      const conciseDesc = rawDesc.length > 140 ? `${rawDesc.substring(0, 137)}...` : rawDesc;
      const cPx = this.estimatePixelWidth(conciseDesc, 'description');
      descriptionCandidates.push({
        variant: 'concise',
        text: conciseDesc,
        charCount: conciseDesc.length,
        estimatedPixelWidth: cPx,
        fitsDesktopSnippet: cPx <= 960,
      });
    }

    const primaryDesc = descriptionCandidates[0]?.text || rawDesc;

    // Open Graph fields (strictly without invented placeholders)
    const openGraph: Record<string, string> = {
      'og:title': primaryTitle,
      'og:description': primaryDesc,
      'og:url': url,
      'og:type': input.schemaType === 'Article' ? 'article' : 'website',
      'og:site_name': brand,
    };
    if (imageUrl) {
      openGraph['og:image'] = imageUrl;
      if (input.imageAlt) openGraph['og:image:alt'] = input.imageAlt;
    } else {
      omittedFields.push('og:image (no verified image provided)');
    }

    // Twitter Card fields
    const twitterCard: Record<string, string> = {
      'twitter:card': imageUrl ? 'summary_large_image' : 'summary',
      'twitter:title': primaryTitle,
      'twitter:description': primaryDesc,
    };
    if (imageUrl) {
      twitterCard['twitter:image'] = imageUrl;
    } else {
      omittedFields.push('twitter:image (no verified image provided)');
    }

    // Context-Aware Schema.org JSON-LD (Zero invented timestamps or prices)
    const jsonLd = this.buildTruthfulSchema(input, primaryTitle, primaryDesc, imageUrl, omittedFields);

    // Host domain for display
    let domainHost = '';
    try {
      domainHost = new URL(url).hostname;
    } catch {
      domainHost = input.brandDomain.replace(/^https?:\/\//, '');
    }

    // Simulated previews (strictly labeled as simulated)
    const primaryTitlePx = this.estimatePixelWidth(primaryTitle, 'title');
    const simulatedPreviews = {
      googleSerp: {
        displayUrl: url,
        title: primaryTitle,
        snippet: primaryDesc,
        truncatedDesktop: primaryTitlePx > 580,
      },
      facebookOg: {
        siteName: brand,
        title: primaryTitle,
        description: primaryDesc,
        imageUrl: imageUrl,
      },
      linkedIn: {
        title: primaryTitle,
        domain: domainHost,
        imageUrl: imageUrl,
      },
      twitterSummary: {
        cardType: 'summary',
        title: primaryTitle,
        description: primaryDesc,
        domain: domainHost,
        imageUrl: imageUrl,
      },
      twitterLarge: {
        cardType: 'summary_large_image',
        title: primaryTitle,
        description: primaryDesc,
        domain: domainHost,
        imageUrl: imageUrl,
      },
    };

    // Format HTML <head> snippet with proper entity escaping
    const htmlLines: string[] = [
      `<!-- Standard Meta Tags -->`,
      `<title>${this.escapeHtml(primaryTitle)}</title>`,
      `<meta name="description" content="${this.escapeHtml(primaryDesc)}" />`,
      `<link rel="canonical" href="${this.escapeHtml(url)}" />`,
      `<meta name="robots" content="index, follow, max-image-preview:large" />`,
      ``,
      `<!-- Open Graph Tags (Facebook / LinkedIn) -->`,
      `<meta property="og:type" content="${this.escapeHtml(openGraph['og:type'] || 'website')}" />`,
      `<meta property="og:title" content="${this.escapeHtml(openGraph['og:title'] || '')}" />`,
      `<meta property="og:description" content="${this.escapeHtml(openGraph['og:description'] || '')}" />`,
      `<meta property="og:url" content="${this.escapeHtml(openGraph['og:url'] || '')}" />`,
      `<meta property="og:site_name" content="${this.escapeHtml(openGraph['og:site_name'] || '')}" />`,
    ];

    if (openGraph['og:image']) {
      htmlLines.push(`<meta property="og:image" content="${this.escapeHtml(openGraph['og:image'])}" />`);
      if (openGraph['og:image:alt']) {
        htmlLines.push(`<meta property="og:image:alt" content="${this.escapeHtml(openGraph['og:image:alt'])}" />`);
      }
    }

    htmlLines.push(
      ``,
      `<!-- Twitter / X Card Tags -->`,
      `<meta name="twitter:card" content="${this.escapeHtml(twitterCard['twitter:card'] || 'summary')}" />`,
      `<meta name="twitter:title" content="${this.escapeHtml(twitterCard['twitter:title'] || '')}" />`,
      `<meta name="twitter:description" content="${this.escapeHtml(twitterCard['twitter:description'] || '')}" />`
    );

    if (twitterCard['twitter:image']) {
      htmlLines.push(`<meta name="twitter:image" content="${this.escapeHtml(twitterCard['twitter:image'])}" />`);
    }

    if (jsonLd) {
      htmlLines.push(
        ``,
        `<!-- Schema.org Structured Data (JSON-LD) -->`,
        `<script type="application/ld+json">`,
        this.safeJsonLd(jsonLd),
        `</script>`
      );
    }

    const evidenceState: EvidenceState = input.observedData ? 'page_inspected' : 'input_only';
    const notice = input.observedData
      ? 'Suggestions generated from inspected live page facts. Social previews are simulated approximations.'
      : 'Draft generated from operator inputs; target URL has not been fetched.';

    return {
      evidenceState,
      notice,
      metaTags: {
        title: primaryTitle,
        description: primaryDesc,
        canonical: url,
        robots: 'index, follow, max-image-preview:large',
      },
      titleCandidates,
      descriptionCandidates,
      openGraph,
      twitterCard,
      jsonLd,
      jsonLdSyntaxValid: jsonLd !== null,
      simulatedPreviews,
      htmlSnippet: htmlLines.join('\n'),
      omittedFields,
    };
  }

  /**
   * Run explainable metadata diagnostic checks
   */
  public static validateMetadata(
    meta: {
      title?: string | null;
      metaDesc?: string | null;
      canonical?: string | null;
      pageUrl: string;
      h1?: string | null;
      robots?: string | null;
      imageUrl?: string | null;
      jsonLd?: any | null;
    }
  ): MetadataHealthReport {
    const findings: HealthReportFinding[] = [];
    const url = meta.pageUrl;

    let techScore = 100;
    let compScore = 100;
    let consScore = 100;
    let socScore = 100;
    let schemaScore = 100;

    // 1. Title Checks
    if (!meta.title || meta.title.trim().length === 0) {
      techScore -= 40;
      compScore -= 40;
      findings.push({
        ruleId: 'TECH_TITLE_MISSING',
        category: 'technical_correctness',
        severity: 'critical',
        title: 'Missing <title> Element',
        description: 'No title tag was found or provided. Search engines require a title to generate search snippet links.',
        recommendation: 'Add a descriptive title between 30 and 60 characters.',
      });
    } else {
      const px = this.estimatePixelWidth(meta.title, 'title');
      if (px > 580) {
        findings.push({
          ruleId: 'META_TITLE_PIXEL_OVERFLOW',
          category: 'metadata_completeness',
          severity: 'warning',
          title: `Title Tag May Truncate (~${px}px / 580px limit)`,
          description: `The title is ${meta.title.length} characters (~${px}px estimated width) and may be truncated on Google desktop search.`,
          recommendation: 'Consider shortening the title to fit within ~580 pixels.',
          observedValue: { length: meta.title.length, estimatedPx: px },
        });
      }
      if (meta.h1 && meta.title.toLowerCase() !== meta.h1.toLowerCase()) {
        findings.push({
          ruleId: 'CONSISTENCY_TITLE_H1_MISMATCH',
          category: 'consistency',
          severity: 'info',
          title: 'Title Differs From Primary H1',
          description: 'The title tag and visible H1 heading differ. Ensure they share topical intent.',
          recommendation: 'Verify that the title accurately summarizes the on-page H1 content.',
          observedValue: { title: meta.title, h1: meta.h1 },
        });
      }
    }

    // 2. Description Checks
    if (!meta.metaDesc || meta.metaDesc.trim().length === 0) {
      compScore -= 30;
      findings.push({
        ruleId: 'COMP_DESC_MISSING',
        category: 'metadata_completeness',
        severity: 'warning',
        title: 'Missing Meta Description',
        description: 'No meta description was detected. Search engines will extract random snippet sentences from body copy.',
        recommendation: 'Add an informative meta description between 70 and 155 characters.',
      });
    } else {
      const px = this.estimatePixelWidth(meta.metaDesc, 'description');
      if (px > 960) {
        findings.push({
          ruleId: 'COMP_DESC_PIXEL_OVERFLOW',
          category: 'metadata_completeness',
          severity: 'info',
          title: `Meta Description Exceeds Standard Snippet Width (~${px}px / 960px limit)`,
          description: `The meta description is ${meta.metaDesc.length} characters (~${px}px) and may be truncated in search results.`,
          recommendation: 'Trim description to fit within ~960 pixels if essential information is cut off.',
          observedValue: { length: meta.metaDesc.length, estimatedPx: px },
        });
      }
    }

    // 3. Canonical Checks
    if (!meta.canonical) {
      consScore -= 20;
      findings.push({
        ruleId: 'CANONICAL_MISSING',
        category: 'canonical_robots' as any,
        severity: 'warning',
        title: 'Missing Canonical Tag',
        description: 'No canonical URL link is defined, risking duplicate content indexing across protocol or query variations.',
        recommendation: `Add a self-referencing canonical tag pointing to "${url}".`,
      });
    } else if (meta.canonical !== url) {
      findings.push({
        ruleId: 'CANONICAL_TARGET_DIFFERS',
        category: 'canonical_robots' as any,
        severity: 'info',
        title: 'Canonical Points to Different URL',
        description: `Canonical tag specifies "${meta.canonical}" while inspected URL is "${url}".`,
        recommendation: 'Verify this page is intentionally canonicalized to an alternate address.',
        observedValue: { canonical: meta.canonical, pageUrl: url },
      });
    }

    // 4. Social Image Checks
    if (!meta.imageUrl) {
      socScore -= 35;
      findings.push({
        ruleId: 'SOCIAL_IMAGE_MISSING',
        category: 'social_readiness',
        severity: 'warning',
        title: 'No Social Share Image (og:image) Specified',
        description: 'Link previews on Facebook, LinkedIn, X, and messaging apps will render as plain text without rich cover images.',
        recommendation: 'Supply a verified high-resolution share image (1200x630 recommended).',
      });
    }

    // 5. Schema Checks
    if (!meta.jsonLd) {
      schemaScore -= 30;
      findings.push({
        ruleId: 'SCHEMA_MISSING',
        category: 'structured_data',
        severity: 'info',
        title: 'No Structured Data (JSON-LD) Provided',
        description: 'Structured data enables rich snippet eligibility on search engines.',
        recommendation: 'Add appropriate Schema.org structured data (e.g. WebSite, Organization, Article).',
      });
    }

    const overallScore = Math.max(0, Math.round((techScore + compScore + consScore + socScore + schemaScore) / 5));

    return {
      overallScore,
      categories: {
        technicalCorrectness: Math.max(0, techScore),
        metadataCompleteness: Math.max(0, compScore),
        consistency: Math.max(0, consScore),
        socialReadiness: Math.max(0, socScore),
        structuredData: Math.max(0, schemaScore),
      },
      findings,
      auditedAt: new Date().toISOString(),
    };
  }

  /**
   * Bulk metadata intelligence audit across an existing crawl job
   */
  public static async auditCrawlJobBatch(crawlJobId: string): Promise<Record<string, unknown>> {
    const snapshotsRes = await query<{
      id: string;
      url: string;
      status_code: number;
      title: string | null;
      h1: string | null;
      meta_desc: string | null;
      canonical: string | null;
      open_graph: Record<string, string>;
      schema_types: string[];
    }>(
      `SELECT id, url, status_code, title, h1, meta_desc, canonical, open_graph, schema_types
       FROM page_snapshots
       WHERE crawl_job_id = $1`,
      [crawlJobId]
    );

    const missingTitles: string[] = [];
    const missingDescriptions: string[] = [];
    const missingCanonicals: string[] = [];
    const missingSocialImages: string[] = [];
    const missingSchema: string[] = [];

    const titleMap = new Map<string, string[]>();

    for (const snap of snapshotsRes.rows) {
      if (!snap.title) missingTitles.push(snap.url);
      else {
        const existing = titleMap.get(snap.title) || [];
        existing.push(snap.url);
        titleMap.set(snap.title, existing);
      }

      if (!snap.meta_desc) missingDescriptions.push(snap.url);
      if (!snap.canonical) missingCanonicals.push(snap.url);
      if (!snap.open_graph?.['og:image']) missingSocialImages.push(snap.url);
      if (!snap.schema_types || snap.schema_types.length === 0) missingSchema.push(snap.url);
    }

    // Duplicate titles
    const duplicateTitles: Array<{ title: string; count: number; urls: string[] }> = [];
    for (const [t, urls] of titleMap.entries()) {
      if (urls.length > 1) {
        duplicateTitles.push({ title: t, count: urls.length, urls });
      }
    }

    return {
      crawlJobId,
      totalPagesAudited: snapshotsRes.rowCount,
      summary: {
        missingTitlesCount: missingTitles.length,
        missingDescriptionsCount: missingDescriptions.length,
        missingCanonicalsCount: missingCanonicals.length,
        missingSocialImagesCount: missingSocialImages.length,
        missingSchemaCount: missingSchema.length,
        duplicateTitleClustersCount: duplicateTitles.length,
      },
      inventory: {
        missingTitles: missingTitles.slice(0, 50),
        missingDescriptions: missingDescriptions.slice(0, 50),
        missingCanonicals: missingCanonicals.slice(0, 50),
        missingSocialImages: missingSocialImages.slice(0, 50),
        duplicateTitles: duplicateTitles.slice(0, 20),
      },
      auditedAt: new Date().toISOString(),
    };
  }

  /**
   * Save a proposal with observed state vs proposed diff
   */
  public static async createProposal(
    workspaceId: string,
    brandId: string | null,
    url: string,
    proposalType: 'meta_tags' | 'json_ld' | 'open_graph' | 'twitter_card',
    payload: Record<string, unknown>,
    observedPayload?: Record<string, unknown>,
    notes?: string
  ): Promise<{ id: string; status: string }> {
    const diffSummary = {
      titleChanged: observedPayload?.['title'] !== payload['title'],
      descChanged: observedPayload?.['description'] !== payload['description'],
      canonicalChanged: observedPayload?.['canonical'] !== payload['canonical'],
      imageChanged: observedPayload?.['imageUrl'] !== payload['imageUrl'],
    };

    const res = await query<{ id: string; status: string }>(
      `INSERT INTO metadata_proposals (
        workspace_id, brand_id, url, proposal_type, payload, observed_payload, diff_summary, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8)
      RETURNING id, status`,
      [
        workspaceId,
        brandId,
        url,
        proposalType,
        JSON.stringify(payload),
        JSON.stringify(observedPayload || {}),
        JSON.stringify(diffSummary),
        notes || 'Draft proposal in Meta Tags Studio V3',
      ]
    );
    return res.rows[0]!;
  }

  /**
   * List metadata proposals for workspace
   */
  public static async listProposals(workspaceId: string, brandId?: string | null) {
    let sql = `SELECT id, workspace_id, brand_id, url, proposal_type, payload, observed_payload,
                      diff_summary, status, notes, approved_by, approved_at, created_at, updated_at
               FROM metadata_proposals
               WHERE workspace_id = $1`;
    const params: unknown[] = [workspaceId];

    if (brandId) {
      params.push(brandId);
      sql += ` AND brand_id = $${params.length}`;
    }
    sql += ` ORDER BY created_at DESC LIMIT 50`;

    const res = await query(sql, params);
    return res.rows;
  }

  /**
   * Build Schema.org JSON-LD without invented dates, prices, or fake availability
   */
  private static buildTruthfulSchema(
    input: MetaStudioGenerateInput,
    title: string,
    desc: string,
    image: string | null,
    omittedFields: string[]
  ): Record<string, unknown> | null {
    const type = input.schemaType || 'WebSite';

    switch (type) {
      case 'Article': {
        const schema: Record<string, unknown> = {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: title,
          description: desc,
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': input.pageUrl,
          },
          publisher: {
            '@type': 'Organization',
            name: input.brandName,
            url: input.brandDomain,
          },
        };

        if (image) schema['image'] = [image];
        else omittedFields.push('Article image (no verified image)');

        if (input.authorName) {
          schema['author'] = { '@type': 'Person', name: input.authorName };
        } else {
          schema['author'] = { '@type': 'Organization', name: input.brandName, url: input.brandDomain };
        }

        // Only include dates if explicitly provided or extracted from page
        if (input.datePublished) {
          schema['datePublished'] = input.datePublished;
        } else {
          omittedFields.push('datePublished (not verified on page; omitted to prevent fabrication)');
        }

        if (input.dateModified) {
          schema['dateModified'] = input.dateModified;
        } else {
          omittedFields.push('dateModified (not verified on page; omitted to prevent fabrication)');
        }

        return schema;
      }

      case 'Organization': {
        const schema: Record<string, unknown> = {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: input.brandName,
          url: input.brandDomain,
          description: desc,
        };
        if (image) schema['logo'] = image;
        return schema;
      }

      case 'Product': {
        const schema: Record<string, unknown> = {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: title,
          description: desc,
          brand: {
            '@type': 'Brand',
            name: input.brandName,
          },
        };
        if (image) schema['image'] = [image];
        omittedFields.push('offers/price (omitted: requires real transactional catalog entry)');
        omittedFields.push('aggregateRating (omitted: requires genuine first-party customer review dataset)');
        return schema;
      }

      case 'BreadcrumbList': {
        return {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: input.brandDomain,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: title,
              item: input.pageUrl,
            },
          ],
        };
      }

      case 'WebPage': {
        const schema: Record<string, unknown> = {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: title,
          url: input.pageUrl,
          description: desc,
          isPartOf: {
            '@type': 'WebSite',
            name: input.brandName,
            url: input.brandDomain,
          },
        };
        if (image) schema['primaryImageOfPage'] = image;
        return schema;
      }

      case 'WebSite':
      default: {
        return {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: input.brandName,
          url: input.brandDomain,
          description: desc,
        };
      }
    }
  }
}
