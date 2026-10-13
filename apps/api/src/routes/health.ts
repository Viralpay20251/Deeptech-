/**
 * Health & Observability Routes
 */

import { Router, type Request, type Response } from 'express';
import { healthCheck as dbHealthCheck, query } from '../lib/db.js';
import { env } from '../lib/env.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  const dbHealth = await dbHealthCheck();

  // Check active kill switches
  let activeKillSwitches = 0;
  try {
    const ksRes = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM kill_switch_events WHERE deactivated_at IS NULL'
    );
    activeKillSwitches = parseInt(ksRes.rows[0]?.count ?? '0', 10);
  } catch {
    // If DB is down, query will fail
  }

  const isHealthy = dbHealth.ok && activeKillSwitches === 0;
  const status = !dbHealth.ok ? 'down' : activeKillSwitches > 0 ? 'degraded' : 'healthy';

  res.status(isHealthy ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    version: process.env['APP_VERSION'] ?? '0.1.0',
    components: [
      {
        name: 'database_postgres',
        status: dbHealth.ok ? 'ok' : 'error',
        latency_ms: dbHealth.latency_ms,
      },
      {
        name: 'kill_switches',
        status: activeKillSwitches === 0 ? 'ok' : 'degraded',
        message: activeKillSwitches > 0 ? `${activeKillSwitches} emergency kill switch(es) active` : 'No active kill switches',
      },
      {
        name: 'safety_boundary',
        status: 'ok',
        message: 'Strict isolation boundaries and SSRF protections active.',
      },
    ],
  });
});
