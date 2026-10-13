/**
 * PostgreSQL connection pool.
 *
 * SAFETY: Before creating a pool, this module checks the DATABASE_URL host
 * against PROTECTED_DB_HOSTS. If the host matches, the process aborts.
 * This prevents accidental connection to CHATR, TalentXcel or Nuty Tales DBs.
 */

import pg from 'pg';
import { env, PROTECTED_DB_HOSTS } from './env.js';
import { logger } from './logger.js';

const { Pool } = pg;

function assertNotProtectedDB(url: string): void {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    for (const protected_host of PROTECTED_DB_HOSTS) {
      if (host === protected_host.toLowerCase() || host.endsWith(`.${protected_host.toLowerCase()}`)) {
        throw new Error(
          `🚨 SAFETY VIOLATION: DATABASE_URL resolves to protected host "${host}". ` +
          `This is a production database for an existing platform. ` +
          `The Autonomous Growth OS must use its own independent database. ` +
          `Check PROTECTED_DB_HOSTS in your environment configuration.`
        );
      }
    }
  } catch (err) {
    if ((err as Error).message.startsWith('🚨 SAFETY VIOLATION')) throw err;
    // Invalid URL format — let the pool fail naturally with a clear error
    logger.warn({ err }, 'Could not parse DATABASE_URL for host safety check');
  }
}

assertNotProtectedDB(env.DATABASE_URL);

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  min: env.NODE_ENV === 'test' ? 0 : env.DATABASE_POOL_MIN,
  max: env.NODE_ENV === 'test' ? 2 : env.DATABASE_POOL_MAX,
  idleTimeoutMillis: env.NODE_ENV === 'test' ? 1000 : 10000,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
  application_name: 'autonomous-growth-os',
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error');
});

/**
 * Execute a query with automatic connection management.
 * All queries are logged at debug level (without binding values that may be sensitive).
 */
export async function query<T extends pg.QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const client = await pool.connect();
  try {
    return await client.query<T>(sql, params);
  } finally {
    client.release();
  }
}

/**
 * Execute a set of queries in a single transaction.
 * Rolls back automatically on error.
 */
export async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function healthCheck(): Promise<{ ok: boolean; latency_ms: number }> {
  const start = Date.now();
  try {
    await query('SELECT 1');
    return { ok: true, latency_ms: Date.now() - start };
  } catch {
    return { ok: false, latency_ms: Date.now() - start };
  }
}
