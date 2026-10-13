/**
 * Database migrations runner.
 *
 * Migrations are numbered SQL files in src/db/migrations/.
 * This runner applies them in order and records applied migrations
 * in a `schema_migrations` table.
 *
 * SAFETY: Only operates on the OS database (checked via PROTECTED_DB_HOSTS).
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { query, transaction } from '../lib/db.js';
import { logger } from '../lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          SERIAL PRIMARY KEY,
      filename    TEXT NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY filename'
  );
  return new Set(result.rows.map((r) => r.filename));
}

async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();

  const files = (await fs.readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    logger.info({ migration: file }, 'Applying migration');

    await transaction(async (client) => {
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [file]
      );
    });
    count++;
    logger.info({ migration: file }, 'Migration applied');
  }

  if (count === 0) {
    logger.info('No new migrations to apply');
  } else {
    logger.info({ count }, 'Migrations complete');
  }
}

runMigrations().catch((err) => {
  logger.error({ err }, 'Migration failed');
  process.exit(1);
});
