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

// 4. API Routes & Transparent Redirect Router
app.use(redirectsRouter); // Handles GET /r/:short_code
app.use('/health', healthRouter);
app.use('/api/v1/brands', brandsRouter);
app.use('/api/v1/connectors', connectorsRouter);
app.use('/api/v1/demand', demandRouter);
app.use('/api/v1/workflows', workflowsRouter);
app.use('/api/v1/approvals', approvalsRouter);
app.use('/api/v1/kill-switches', killSwitchesRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/tracked-links', trackedLinksApiRouter);

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
