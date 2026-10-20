import { Hono } from 'hono';
import { loadDimensions } from '../lib/dimensionLoader.js';
import { buildPageUrl } from '../lib/combinatorialIndex.js';
import { renderHubPage } from '../lib/htmlRenderer.js';
import { getCompiledPattern } from './leafPage.js';

export const hubRoutes = new Hono();

/**
 * GET /
 * Click-0: Root Directory Hub
 */
hubRoutes.get('/', async (c, next) => {
  const domainConfig = c.get('domainConfig');
  const hostname = c.get('hostname');

  if (!domainConfig) {
    return c.html(`<h1>Welcome to ${hostname}</h1><p>PSEO Edge Router Active.</p>`, 200);
  }

  const dimensionMap = await loadDimensions(hostname);
  const primaryDimType = domainConfig.dimensions[0] || 'category';
  const primaryList = dimensionMap[primaryDimType] || [];

  const childLinks = primaryList.map((item) => ({
    url: `/${item.slug}`,
    title: item.display_value,
    badge: primaryDimType.toUpperCase(),
  }));

  const brandName =
    domainConfig.brand === 'talentxcel'
      ? 'TalentXcel'
      : domainConfig.brand === 'chatr'
      ? 'Chatr'
      : domainConfig.brand === 'nutytales'
      ? 'NutyTales'
      : domainConfig.brand;

  const hubTitle = `${brandName} Directory & Resource Center`;
  const hubDescription = `Explore comprehensive indexes and verified programmatic catalogs across ${primaryList.length} primary ${primaryDimType} classifications on ${hostname}.`;
  const canonicalUrl = `https://${hostname}/`;

  const html = renderHubPage({
    title: hubTitle,
    metaDescription: hubDescription,
    canonicalUrl,
    domainConfig,
    breadcrumbs: [{ name: 'Home', url: '/' }],
    hubTitle,
    hubDescription,
    childLinks,
    botWaveUrls: c.get('botWaveUrls') ?? [],
  });

  c.header('Content-Type', 'text/html; charset=utf-8');
  c.header('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');
  return c.html(html);
});

/**
 * GET /:hubSlug
 * Click-1: Macro Hub Page
 */
hubRoutes.get('/:hubSlug', async (c, next) => {
  const hubSlug = c.req.param('hubSlug');
  const domainConfig = c.get('domainConfig');
  const hostname = c.get('hostname');

  if (!domainConfig) {
    return next();
  }

  // Skip static files or sitemaps
  if (hubSlug.includes('.') || hubSlug === 'robots.txt' || hubSlug === 'health') {
    return next();
  }

  // Check if this path actually matches a leaf page
  const { regex } = getCompiledPattern(domainConfig.urlPattern);
  if (regex.test(c.req.path)) {
    return next();
  }

  const dimensionMap = await loadDimensions(hostname);
  const primaryDimType = domainConfig.dimensions[0];
  const primaryList = dimensionMap[primaryDimType] || [];

  // Find if hubSlug matches any primary dimension
  const primaryMatch = primaryList.find((item) => item.slug.toLowerCase() === hubSlug.toLowerCase());

  // Also check if hubSlug matches the pathPrefix without slashes (e.g. "job" for "/job/")
  const cleanPrefix = domainConfig.pathPrefix.replace(/\//g, '');
  const isPrefixMatch = hubSlug.toLowerCase() === cleanPrefix.toLowerCase();

  if (!primaryMatch && !isPrefixMatch) {
    return next();
  }

  const currentTitle = primaryMatch ? primaryMatch.display_value : `${cleanPrefix.toUpperCase()} Categories`;
  const secondaryDimType = domainConfig.dimensions[1] || domainConfig.dimensions[0];
  const secondaryList = dimensionMap[secondaryDimType] || [];

  const childLinks = secondaryList.map((sec) => ({
    url: `/${hubSlug}/${sec.slug}`,
    title: `${currentTitle} &mdash; ${sec.display_value}`,
    badge: secondaryDimType.toUpperCase(),
  }));

  const hubTitle = `${currentTitle} Directory`;
  const hubDescription = `Detailed sub-clusters and regional breakdowns for ${currentTitle} on ${hostname}.`;
  const canonicalUrl = `https://${hostname}/${hubSlug}`;

  const html = renderHubPage({
    title: hubTitle,
    metaDescription: hubDescription,
    canonicalUrl,
    domainConfig,
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: currentTitle, url: `/${hubSlug}` },
    ],
    hubTitle,
    hubDescription,
    childLinks,
    botWaveUrls: c.get('botWaveUrls') ?? [],
  });

  c.header('Content-Type', 'text/html; charset=utf-8');
  c.header('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');
  return c.html(html);
});

/**
 * GET /:hubSlug/:clusterSlug
 * Click-2: Micro Cluster Hub Page
 */
hubRoutes.get('/:hubSlug/:clusterSlug', async (c, next) => {
  const hubSlug = c.req.param('hubSlug');
  const clusterSlug = c.req.param('clusterSlug');
  const domainConfig = c.get('domainConfig');
  const hostname = c.get('hostname');

  if (!domainConfig) {
    return next();
  }

  // If this matches the leaf pattern, delegate to leafPageRoute!
  const { regex } = getCompiledPattern(domainConfig.urlPattern);
  if (regex.test(c.req.path)) {
    return next();
  }

  const dimensionMap = await loadDimensions(hostname);
  const primaryDimType = domainConfig.dimensions[0];
  const secondaryDimType = domainConfig.dimensions[1] || domainConfig.dimensions[0];

  const primaryItem = dimensionMap[primaryDimType]?.find((i) => i.slug.toLowerCase() === hubSlug.toLowerCase());
  const secondaryItem = dimensionMap[secondaryDimType]?.find((i) => i.slug.toLowerCase() === clusterSlug.toLowerCase());

  // If not matched to dimensions, pass through
  if (!primaryItem && !secondaryItem) {
    return next();
  }

  const hubName = primaryItem ? primaryItem.display_value : hubSlug;
  const clusterName = secondaryItem ? secondaryItem.display_value : clusterSlug;

  // Generate links to leaf pages
  const tertiaryDimType = domainConfig.dimensions[2];
  const tertiaryList = tertiaryDimType ? dimensionMap[tertiaryDimType] || [] : [];

  let childLinks: Array<{ url: string; title: string; badge?: string }> = [];

  if (tertiaryList.length > 0) {
    childLinks = tertiaryList.slice(0, 50).map((tert) => {
      const slugs = [primaryItem?.slug || hubSlug, secondaryItem?.slug || clusterSlug, tert.slug];
      const leafPath = buildPageUrl(domainConfig.pathPrefix, domainConfig.slugJoiner, slugs);
      return {
        url: leafPath,
        title: `${hubName} in ${clusterName} with ${tert.display_value}`,
        badge: tert.display_value,
      };
    });
  } else {
    // 2-dimension leaf page
    const slugs = [primaryItem?.slug || hubSlug, secondaryItem?.slug || clusterSlug];
    const leafPath = buildPageUrl(domainConfig.pathPrefix, domainConfig.slugJoiner, slugs);
    childLinks = [
      {
        url: leafPath,
        title: `${hubName} with ${clusterName}`,
        badge: 'Direct Specification',
      },
    ];
  }

  const hubTitle = `${hubName} in ${clusterName}`;
  const hubDescription = `Detailed directory cluster and specific resource permutations for ${hubName} in ${clusterName}.`;
  const canonicalUrl = `https://${hostname}/${hubSlug}/${clusterSlug}`;

  const html = renderHubPage({
    title: hubTitle,
    metaDescription: hubDescription,
    canonicalUrl,
    domainConfig,
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: hubName, url: `/${hubSlug}` },
      { name: clusterName, url: `/${hubSlug}/${clusterSlug}` },
    ],
    hubTitle,
    hubDescription,
    childLinks,
    botWaveUrls: c.get('botWaveUrls') ?? [],
  });

  c.header('Content-Type', 'text/html; charset=utf-8');
  c.header('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');
  return c.html(html);
});
