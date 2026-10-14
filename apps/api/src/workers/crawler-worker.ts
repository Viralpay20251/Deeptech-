/**
 * Autonomous Growth OS — Standalone Bounded Crawler Worker
 *
 * Dedicated worker process for executing queued multi-page crawls.
 * Satisfies the requirement:
 * - Separately bounded worker process using durable PostgreSQL queue.
 * - Concurrency control with atomic job claiming.
 * - Graceful shutdown and liveness logging.
 */

import { query } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { CrawlEngineService } from '../services/crawl-engine.js';
import { JobQueueService } from '../services/job-queue-service.js';

export class CrawlerWorker {
  private static isRunning = false;
  private static pollTimer: NodeJS.Timeout | null = null;

  /**
   * Claim and execute the next pending crawl job
   */
  public static async processNextJob(): Promise<{
    processed: boolean;
    jobId?: string;
    pagesCrawled?: number;
    error?: string;
  }> {
    try {
      // Record idle heartbeat
      await JobQueueService.recordHeartbeat('vercel_cron', null);

      // 1. Atomically claim next pending job using SKIP LOCKED
      const claimRes = await query<{ id: string; label: string; max_pages: number }>(
        `UPDATE crawl_jobs
         SET status = 'running', started_at = NOW(), updated_at = NOW()
         WHERE id = (
           SELECT id FROM crawl_jobs
           WHERE status = 'pending'
           ORDER BY created_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING id, label, max_pages`
      );

      if (!claimRes.rows.length || !claimRes.rows[0]) {
        return { processed: false };
      }

      const job = claimRes.rows[0];
      await JobQueueService.recordHeartbeat('vercel_cron', job.id);
      logger.info({ jobId: job.id, label: job.label, maxPages: job.max_pages }, 'Crawler worker claimed pending job');

      // 2. Execute bounded crawl
      const result = await CrawlEngineService.executeCrawlJob(job.id);
      await JobQueueService.recordHeartbeat('vercel_cron', null);
      logger.info({ jobId: job.id, pagesCrawled: result.pagesCrawled, error: result.error }, 'Crawler worker completed job');

      return {
        processed: true,
        jobId: job.id,
        pagesCrawled: result.pagesCrawled,
        error: result.error,
      };
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'Crawler worker execution error');
      return { processed: false, error: (err as Error).message };
    }
  }

  /**
   * Start polling loop for continuous worker execution
   */
  public static start(intervalMs = 5000) {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info({ intervalMs }, 'Starting Crawler Worker daemon loop');

    const tick = async () => {
      if (!this.isRunning) return;
      try {
        const res = await this.processNextJob();
        // If a job was processed, immediately look for another before waiting
        if (res.processed) {
          setImmediate(tick);
          return;
        }
      } catch (err) {
        logger.error({ err }, 'Error during crawler worker tick');
      }
      if (this.isRunning) {
        this.pollTimer = setTimeout(tick, intervalMs);
      }
    };

    tick();
  }

  /**
   * Graceful stop
   */
  public static stop() {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    logger.info('Crawler Worker stopped');
  }
}

// Standalone execution entrypoint
if (process.argv[1]?.endsWith('crawler-worker.ts') || process.argv[1]?.endsWith('crawler-worker.js')) {
  logger.info('Initializing Autonomous Growth OS Crawler Worker service...');
  CrawlerWorker.start();

  const handleShutdown = (signal: string) => {
    logger.info({ signal }, 'Worker received shutdown signal');
    CrawlerWorker.stop();
    setTimeout(() => process.exit(0), 1000);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}
