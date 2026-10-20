import { Hono } from 'hono';
import type { DomainConfig } from '../config/domains.js';
import { loadDimensions, matchDimensionsFromSlugs } from '../lib/dimensionLoader.js';
import {
  encodePageId,
  decodePageId,
  getRingNeighbors,
  getLongDistanceLinks,
  buildPageUrl,
} from '../lib/combinatorialIndex.js';
import { renderLeafPage } from '../lib/htmlRenderer.js';
import { buildJsonLdForDomain } from '../lib/jsonLdBuilders.js';

export const leafPageRoute = new Hono();

// Cache of compiled regex patterns per hostname
const patternRegexCache = new Map<string, { regex: RegExp; keys: string[] }>();

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getCompiledPattern(pattern: string): { regex: RegExp; keys: string[] } {
  const cached = patternRegexCache.get(pattern);
  if (cached) return cached;

  const keys: string[] = [];
  let regexStr = '^';
  let lastIndex = 0;
  const paramRegex = /:([a-zA-Z0-9_]+)/g;
  let match: RegExpExecArray | null;

  const matches: Array<{ name: string; index: number; length: number }> = [];
  while ((match = paramRegex.exec(pattern)) !== null) {
    matches.push({ name: match[1], index: match.index, length: match[0].length });
  }

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const literal = pattern.slice(lastIndex, m.index);
    regexStr += escapeRegex(literal);
    keys.push(m.name);
    const isLast = i === matches.length - 1 && m.index + m.length === pattern.length;
    if (isLast) {
      regexStr += '([a-zA-Z0-9_%-]+)';
    } else {
      regexStr += '([a-zA-Z0-9_%-]+?)';
    }
    lastIndex = m.index + m.length;
  }

  if (lastIndex < pattern.length) {
    regexStr += escapeRegex(pattern.slice(lastIndex));
  }
  regexStr += '\\/?$';

  const compiled = { regex: new RegExp(regexStr, 'i'), keys };
  patternRegexCache.set(pattern, compiled);
  return compiled;
}

function formatTitle(domainConfig: DomainConfig, displayValues: string[]): string {
  if (displayValues.length === 0) return 'Resource Overview';
  if (displayValues.length === 1) return `${displayValues[0]} Guide & Specifications`;
  if (displayValues.length === 2) return `${displayValues[0]} in ${displayValues[1]} Overview & Resources`;
  return `${displayValues[0]} in ${displayValues[1]} with ${displayValues.slice(2).join(', ')}`;
}

function formatMetaDescription(domainConfig: DomainConfig, displayValues: string[]): string {
  const joined = displayValues.join(' | ');
  return `Comprehensive analysis, verified benchmarks, and complete specification guide for ${joined} on ${domainConfig.hostname}.`;
}

// Wildcard route to handle leaf page URLs matching the domainConfig path prefix
leafPageRoute.get('*', async (c, next) => {
  const domainConfig = c.get('domainConfig');
  const hostname = c.get('hostname');

  if (!domainConfig) {
    return next();
  }

  const path = c.req.path;
  if (!path.startsWith(domainConfig.pathPrefix)) {
    return next();
  }

  const { regex, keys } = getCompiledPattern(domainConfig.urlPattern);
  const match = path.match(regex);

  if (!match) {
    return next();
  }

  // Extract raw slug values from URL match groups
  const extractedSlugs: Record<string, string> = {};
  for (let i = 0; i < keys.length; i++) {
    extractedSlugs[keys[i]] = decodeURIComponent(match[i + 1] || '');
  }

  const dimensionSlugs = domainConfig.dimensions.map((dim) => extractedSlugs[dim] || '');

  // Load catalog and match dimensions
  const dimensionMap = await loadDimensions(hostname);
  const counts = domainConfig.dimensions.map((dim) => dimensionMap[dim]?.length ?? 0);

  const { matchedCount, indices, dimensions } = await matchDimensionsFromSlugs(
    hostname,
    domainConfig.dimensions,
    dimensionSlugs
  );

  // Quality gate: If fewer than minQualityDimensions are verified in DB catalog -> HTTP 410 Gone
  if (matchedCount < domainConfig.minQualityDimensions) {
    c.header('Content-Type', 'text/html; charset=utf-8');
    c.header('Cache-Control', 'public, max-age=604800');
    return c.html(
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>410 Resource Retired</title>
  <meta name="robots" content="noindex, follow" />
  <style>body { font-family: sans-serif; text-align: center; padding: 4rem 1rem; color: #334155; } a { color: #2563eb; }</style>
</head>
<body>
  <h1>410 &mdash; Resource Pruned</h1>
  <p>The requested dimension permutation does not meet active quality density standards.</p>
  <p><a href="/">&larr; Return to Directory Home</a></p>
</body>
</html>`,
      410
    );
  }

  // Construct structured dimension dictionary for rendering
  const dimensionValues: Record<string, { slug: string; display_value: string; metadata?: Record<string, unknown> }> = {};
  for (let i = 0; i < domainConfig.dimensions.length; i++) {
    const dimName = domainConfig.dimensions[i];
    const item = dimensions[i];
    const rawSlug = dimensionSlugs[i];
    dimensionValues[dimName] = {
      slug: rawSlug,
      display_value: item?.display_value || rawSlug.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      metadata: item?.metadata,
    };
  }

  const displayList = domainConfig.dimensions.map((d) => dimensionValues[d].display_value);
  const title = formatTitle(domainConfig, displayList);
  const metaDescription = formatMetaDescription(domainConfig, displayList);
  const canonicalUrl = `https://${hostname}${path}`;

  // Deterministic neighbor linking using combinatorial index
  let ringNeighbors: Array<{ url: string; title: string }> = [];
  let longDistanceLinks: Array<{ url: string; title: string }> = [];

  const hasAllCounts = counts.length > 0 && counts.every((cnt) => cnt > 0);
  const hasValidIndices = indices.every((idx) => idx >= 0);

  if (hasAllCounts && hasValidIndices) {
    try {
      const pageId = encodePageId({ indices }, { counts });
      const neighborIds = getRingNeighbors(pageId, { counts }, 12);
      const longIds = getLongDistanceLinks(pageId, { counts }, 5);

      ringNeighbors = neighborIds
        .map((nId) => {
          try {
            const addr = decodePageId(nId, { counts });
            const neighborSlugs = domainConfig.dimensions.map(
              (dim, dIdx) => dimensionMap[dim]?.[addr.indices[dIdx]]?.slug ?? ''
            );
            if (neighborSlugs.some((s) => !s)) return null;
            const nPath = buildPageUrl(domainConfig.pathPrefix, domainConfig.slugJoiner, neighborSlugs);
            const nDisplays = domainConfig.dimensions.map(
              (dim, dIdx) => dimensionMap[dim]?.[addr.indices[dIdx]]?.display_value ?? neighborSlugs[dIdx]
            );
            return {
              url: nPath,
              title: formatTitle(domainConfig, nDisplays),
            };
          } catch {
            return null;
          }
        })
        .filter((n): n is { url: string; title: string } => n !== null);

      longDistanceLinks = longIds
        .map((lId) => {
          try {
            const addr = decodePageId(lId, { counts });
            const longSlugs = domainConfig.dimensions.map(
              (dim, dIdx) => dimensionMap[dim]?.[addr.indices[dIdx]]?.slug ?? ''
            );
            if (longSlugs.some((s) => !s)) return null;
            const lPath = buildPageUrl(domainConfig.pathPrefix, domainConfig.slugJoiner, longSlugs);
            const lDisplays = domainConfig.dimensions.map(
              (dim, dIdx) => dimensionMap[dim]?.[addr.indices[dIdx]]?.display_value ?? longSlugs[dIdx]
            );
            return {
              url: lPath,
              title: formatTitle(domainConfig, lDisplays),
            };
          } catch {
            return null;
          }
        })
        .filter((l): l is { url: string; title: string } => l !== null);
    } catch {
      // Index math error fallback
    }
  }

  // Generate JSON-LD Schema
  const jsonLd = buildJsonLdForDomain(domainConfig, {
    title,
    description: metaDescription,
    canonicalUrl,
    dimensionValues,
  });

  const botWaveUrls = c.get('botWaveUrls') ?? [];

  // Render HTML
  const html = renderLeafPage({
    title,
    metaDescription,
    canonicalUrl,
    domainConfig,
    dimensionValues,
    ringNeighbors,
    longDistanceLinks,
    jsonLd,
    botWaveUrls,
  });

  c.header('Content-Type', 'text/html; charset=utf-8');
  c.header('Cache-Control', 'public, s-maxage=2592000, stale-while-revalidate=86400');
  return c.html(html);
});
