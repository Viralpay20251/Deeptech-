import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { hostnameMiddleware } from './middleware/hostnameMiddleware.js';
import { botWaveMiddleware } from './middleware/botWaveMiddleware.js';
import { sitemapRoutes } from './routes/sitemap.js';
import { hubRoutes } from './routes/directoryHubs.js';
import { leafPageRoute } from './routes/leafPage.js';
import { ogImageRoute } from './routes/ogImage.js';

const app = new Hono();

// Global middleware
app.use('*', hostnameMiddleware);
app.use('*', botWaveMiddleware);

// Health check
app.get('/health', (c) => c.json({ status: 'ok', ts: Date.now() }));

// Robots.txt (allow all, point to sitemaps)
app.get('/robots.txt', (c) => {
  const hostname = c.get('hostname');
  return c.text(
    `User-agent: *\nAllow: /\nSitemap: https://${hostname}/sitemap_index.xml\n`,
    200,
    { 'Content-Type': 'text/plain', 'Cache-Control': 'public, s-maxage=86400' }
  );
});

// Dynamic 1200x675 OG Image PNG Rasterizer for Google Discover, WhatsApp, LinkedIn, X
app.route('/', ogImageRoute);

// Sitemap routes
app.route('/', sitemapRoutes);

// Hub and leaf routes
app.route('/', hubRoutes);
app.route('/', leafPageRoute);

// 404 fallback
app.notFound((c) => {
  return c.html('<h1>404 Not Found</h1>', 404);
});

const port = parseInt(process.env['PORT'] ?? '3001', 10);
console.log(`🚀 pSEO Edge Router starting on port ${port}`);

serve({ fetch: app.fetch, port });

export { app };
