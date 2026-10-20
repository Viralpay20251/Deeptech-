import { Hono } from 'hono';
import { Resvg } from '@resvg/resvg-js';
import { DOMAIN_CONFIGS, type BrandCluster } from '../config/domains.js';
import { generate1200x675OgCard } from '../../../../services/discover-igniter/src/discoverEngine.js';

export const ogImageRoute = new Hono();

/**
 * GET /og/:slug.png
 * Dynamic 1200x675 Edge PNG Rasterizer Route
 * Serves crisp, immutable OpenGraph cards for Google Discover, WhatsApp, LinkedIn, and X.
 */
ogImageRoute.get('/og/:slug', async (c) => {
  const rawSlug = c.req.param('slug');
  const slug = rawSlug.replace(/\.png$/i, '');
  const hostname = c.get('hostname') || c.req.header('host') || 'salary.talentxcel.in';

  // Identify domain config & brand cluster
  const config = DOMAIN_CONFIGS[hostname];
  let brand: BrandCluster = config ? config.brand : 'talentxcel';
  if (hostname.includes('chatr')) brand = 'chatr';
  else if (hostname.includes('nutytales')) brand = 'nutytales';

  // Format readable title from hyphenated slug
  const title = slug
    .split(/[-_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  const category = (config?.dimensions[0] || 'REPORT').toUpperCase();
  const subtitle = `2026 In-Depth Analysis & Verified Benchmarks on ${hostname}`;

  const svg = generate1200x675OgCard({
    title,
    subtitle,
    category,
    brandCluster: brand,
    metricValue: 'VERIFIED',
    metricLabel: '1200x675 HD',
  });

  try {
    const resvg = new Resvg(svg, {
      fitTo: {
        mode: 'width',
        value: 1200,
      },
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    return new Response(pngBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(pngBuffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error(`[OgRasterizer] Error rendering PNG for slug "${slug}":`, err);
    // Fallback to SVG if rasterization encounters any error
    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }
});
