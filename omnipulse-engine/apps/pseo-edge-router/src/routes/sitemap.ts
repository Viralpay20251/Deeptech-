import { Hono } from 'hono';
import { streamText } from 'hono/streaming';
import { loadDimensions } from '../lib/dimensionLoader.js';
import { totalPages, decodePageId, buildPageUrl } from '../lib/combinatorialIndex.js';

const URLS_PER_SHARD = 50000;
const MAX_SHARDS = 400; // Cap at 400 shards (20,000,000 URLs max per subdomain)
const STREAM_BATCH_SIZE = 1000;

export const sitemapRoutes = new Hono();

/**
 * GET /sitemap_index.xml
 * Returns sitemap index linking to all available shards
 */
sitemapRoutes.get('/sitemap_index.xml', async (c) => {
  const hostname = c.get('hostname');
  const domainConfig = c.get('domainConfig');

  if (!domainConfig) {
    return c.text('Domain not configured', 404);
  }

  const dimensionMap = await loadDimensions(hostname);
  const counts = domainConfig.dimensions.map((dim) => dimensionMap[dim]?.length ?? 0);
  const hasZeroDim = counts.length === 0 || counts.some((cnt) => cnt === 0);

  let numShards = 1;
  if (!hasZeroDim) {
    const total = totalPages({ counts });
    const calculatedShards = Number((total + BigInt(URLS_PER_SHARD) - 1n) / BigInt(URLS_PER_SHARD));
    numShards = Math.min(Math.max(1, calculatedShards), MAX_SHARDS);
  }

  const today = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (let shard = 0; shard < numShards; shard++) {
    xml += `  <sitemap>\n`;
    xml += `    <loc>https://${hostname}/sitemaps/shard-${shard}.xml</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `  </sitemap>\n`;
  }

  xml += `</sitemapindex>`;

  c.header('Content-Type', 'application/xml; charset=utf-8');
  c.header('Cache-Control', 'public, s-maxage=86400');
  return c.body(xml);
});

/**
 * GET /sitemaps/shard-:n.xml
 * Deterministically streams up to 50,000 URLs for shard N
 */
sitemapRoutes.get('/sitemaps/:file', async (c) => {
  const hostname = c.get('hostname');
  const domainConfig = c.get('domainConfig');
  const file = c.req.param('file') ?? '';
  const match = file.match(/^shard-(\d+)\.xml$/i);

  if (!match) {
    return c.text('Invalid sitemap file', 404);
  }

  const shardIndex = parseInt(match[1], 10);

  if (!domainConfig) {
    return c.text('Domain not configured', 404);
  }

  if (isNaN(shardIndex) || shardIndex < 0 || shardIndex >= MAX_SHARDS) {
    return c.text('Invalid shard index', 404);
  }

  const dimensionMap = await loadDimensions(hostname);
  const counts = domainConfig.dimensions.map((dim) => dimensionMap[dim]?.length ?? 0);
  const hasZeroDim = counts.length === 0 || counts.some((cnt) => cnt === 0);

  const priority = domainConfig.sitemapPriority.toFixed(2);
  const changefreq = domainConfig.crawlBudgetTier === 'critical' ? 'daily' : 'weekly';
  const today = new Date().toISOString().split('T')[0];

  c.header('Content-Type', 'application/xml; charset=utf-8');
  c.header('Cache-Control', 'public, s-maxage=86400');

  // Handle empty catalog fallback gracefully
  if (hasZeroDim) {
    if (shardIndex > 0) return c.text('Shard out of range', 404);
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://${hostname}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>
</urlset>`;
    return c.body(fallbackXml);
  }

  const total = totalPages({ counts });
  const startId = BigInt(shardIndex) * BigInt(URLS_PER_SHARD);

  if (startId >= total) {
    return c.text('Shard out of range', 404);
  }

  const endId = startId + BigInt(URLS_PER_SHARD) > total ? total : startId + BigInt(URLS_PER_SHARD);

  return streamText(c, async (stream) => {
    await stream.write(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`);

    let buffer = '';
    let countInBatch = 0;

    for (let currentId = startId; currentId < endId; currentId++) {
      try {
        const address = decodePageId(currentId, { counts });
        const slugs: string[] = [];

        for (let dimIdx = 0; dimIdx < domainConfig.dimensions.length; dimIdx++) {
          const dimType = domainConfig.dimensions[dimIdx];
          const dimItem = dimensionMap[dimType]?.[address.indices[dimIdx]];
          if (dimItem) {
            slugs.push(dimItem.slug);
          }
        }

        if (slugs.length === domainConfig.dimensions.length) {
          const path = buildPageUrl(domainConfig.pathPrefix, domainConfig.slugJoiner, slugs);
          buffer += `  <url>\n    <loc>https://${hostname}${path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
          countInBatch++;
        }

        if (countInBatch >= STREAM_BATCH_SIZE) {
          await stream.write(buffer);
          buffer = '';
          countInBatch = 0;
          // Yield to Node.js event loop
          await new Promise((resolve) => setImmediate(resolve));
        }
      } catch {
        // Skip corrupted index calculation
      }
    }

    if (buffer.length > 0) {
      await stream.write(buffer);
    }

    await stream.write(`</urlset>`);
  });
});
