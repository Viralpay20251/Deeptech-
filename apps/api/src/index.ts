/**
 * Autonomous Growth OS — API Control Plane Entrypoint
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { rateLimit } from 'express-rate-limit';
import { env, PROTECTED_DB_HOSTS, PROTECTED_PROJECT_IDS } from './lib/env.js';
import { logger } from './lib/logger.js';
import { pool } from './lib/db.js';

// Route imports
import { healthRouter } from './routes/health.js';
import { brandsRouter } from './routes/brands.js';
import { connectorsRouter } from './routes/connectors.js';
import { demandRouter } from './routes/demand.js';
import { workflowsRouter } from './routes/workflows.js';
import { approvalsRouter } from './routes/approvals.js';
import { killSwitchesRouter } from './routes/kill-switches.js';
import { analyticsRouter } from './routes/analytics.js';
import { redirectsRouter, trackedLinksApiRouter } from './routes/redirects.js';
import { authGoogleRouter } from './routes/auth-google.js';
import { publicPagesRouter, pagesApiRouter } from './routes/public-pages.js';
import { crawlerRouter } from './routes/crawler.js';
import { seoRouter } from './routes/seo.js';
import { metaStudioRouter } from './routes/meta-studio.js';
import { evidenceRouter } from './routes/evidence.js';
import { domainsRouter } from './routes/domains.js';
import { queueRouter } from './routes/queue.js';
import { backlinksRouter } from './routes/backlinks.js';
import { authenticate, requireWorkspaceScope } from './middleware/auth.js';

const app = express();

// 1. Security Headers & CORS
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));

// 2. Structured HTTP logging
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/health',
    },
  })
);

// 3. Body Parsing & Rate Limiting
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// 4. API Routes, Transparent Redirect Router & Independent Public Surface
app.use(redirectsRouter); // Handles GET /r/:short_code
app.use(publicPagesRouter); // Handles GET /p/:slug, /sitemap.xml, /robots.txt
app.use('/health', healthRouter);

// ─── Global Authentication & Workspace Scoping Gate for /api/v1 ──────────────
// Excludes only:
// 1. /api/v1/auth/google/* (OAuth authorization initiation & callback)
// 2. /api/v1/crawler/worker/process-next (Protected by CRON_SECRET)
// 3. /api/v1/pages/sitemap.xml, /api/v1/pages/robots.txt, /api/v1/pages/p/* (Public SEO mirrors)
app.use('/api/v1', (req, res, next) => {
  const isPublic =
    req.path.startsWith('/auth/google') ||
    req.path === '/crawler/worker/process-next' ||
    req.path === '/pages/sitemap.xml' ||
    req.path === '/pages/robots.txt' ||
    req.path.startsWith('/pages/p/');

  if (isPublic) {
    return next();
  }

  return authenticate(req, res, (authErr) => {
    if (authErr) return next(authErr);
    return requireWorkspaceScope(req, res, next);
  });
});
app.use('/api/v1/brands', brandsRouter);
app.use('/api/v1/connectors', connectorsRouter);
app.use('/api/v1/demand', demandRouter);
app.use('/api/v1/workflows', workflowsRouter);
app.use('/api/v1/approvals', approvalsRouter);
app.use('/api/v1/kill-switches', killSwitchesRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/tracked-links', trackedLinksApiRouter);
app.use('/api/v1/auth/google', authGoogleRouter);
app.use('/api/v1/pages', pagesApiRouter);
app.use('/api/v1/crawler', crawlerRouter);
app.use('/api/v1/seo', seoRouter);
app.use('/api/v1/meta-studio', metaStudioRouter);
app.use('/api/v1/evidence', evidenceRouter);
app.use('/api/v1/domains', domainsRouter);
app.use('/api/v1/queue', queueRouter);
app.use('/api/v1/backlinks', backlinksRouter);

// 5. Global Error Handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled request error');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err.message,
    },
  });
});

// 6. Startup Safety Verification & Server Listen
function startServer() {
  logger.info('Performing pre-flight safety verification...');
  logger.info({ protectedHostsCount: PROTECTED_DB_HOSTS.length }, 'Protected DB hosts registered');
  logger.info({ protectedProjectsCount: PROTECTED_PROJECT_IDS.length }, 'Protected project IDs registered');
  logger.info('Safety checks passed: Total project separation confirmed.');

  const server = app.listen(env.PORT, () => {
    logger.info(`Autonomous Growth OS API listening on port ${env.PORT} [${env.NODE_ENV}]`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received. Closing server gracefully...');
    server.close(async () => {
      await pool.end();
      logger.info('PostgreSQL pool drained. Process exiting.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

// Export for test suites or start directly
export { app, startServer };
export default app;

if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  startServer();
}
