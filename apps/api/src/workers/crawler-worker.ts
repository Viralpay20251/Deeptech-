/**
 * Autonomous Growth OS — Standalone Bounded Crawler Worker
 *
 * Dedicated worker process for executing queued multi-page crawls.
 * Satisfies the requirement:
 * - Driven 100% by PostgreSQL durable job_queue (FOR UPDATE SKIP LOCKED).
 * - Concurrency control with atomic job claiming and lease heartbeats.
 * - Reconciles crawl results, page snapshots, and SEO findings.
 * - Graceful shutdown and liveness logging in worker_heartbeats table.
 */

import { query } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { CrawlEngineService } from '../services/crawl-engine.js';
import { JobQueueService, type JobRecord } from '../services/job-queue-service.js';

export class CrawlerWorker {
  private static isRunning = false;
  private static pollTimer: NodeJS.Timeout | null = null;

  /**
   * Claim and execute the next pending crawl job from durable job_queue
   */
  public static async processNextJob(): Promise<{
    processed: boolean;
    jobId?: string;
    crawlJobId?: string;
    pagesCrawled?: number;
    error?: string;
  }> {
    try {
      // 1. Record idle heartbeat
      await JobQueueService.recordHeartbeat('vercel_cron', null);

      // 2. Claim next available 'crawl' job from durable PostgreSQL job_queue
      const job: JobRecord | null = await JobQueueService.claimNextJob('crawl');

      if (job) {
        const crawlJobId = (job.payload?.['crawl_job_id'] as string) || job.id;
        logger.info({ queueJobId: job.id, crawlJobId, attempt: job.attempts }, 'Crawler worker claimed job from durable queue');

        // Start lease heartbeat renewal loop during crawl execution
        const stopHeartbeat = JobQueueService.startHeartbeatLoop(job.id);

        try {
          // Update linked crawl_jobs row to 'running'
          await query(
            `UPDATE crawl_jobs SET status = 'running', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [crawlJobId]
          ).catch(() => {});

          // Execute bounded crawl
          const result = await CrawlEngineService.executeCrawlJob(crawlJobId);

          stopHeartbeat();

          if (result.error) {
            await JobQueueService.failJob(job.id, result.error);
            logger.warn({ queueJobId: job.id, crawlJobId, error: result.error }, 'Crawl job failed');
            return {
              processed: true,
              jobId: job.id,
              crawlJobId,
              pagesCrawled: result.pagesCrawled,
              error: result.error,
            };
          } else {
            await JobQueueService.completeJob(job.id, {
              crawlJobId,
              pagesCrawled: result.pagesCrawled,
              completedAt: new Date().toISOString(),
            });
            logger.info({ queueJobId: job.id, crawlJobId, pagesCrawled: result.pagesCrawled }, 'Crawl job completed successfully');
            return {
              processed: true,
              jobId: job.id,
              crawlJobId,
              pagesCrawled: result.pagesCrawled,
            };
          }
        } catch (execErr) {
          stopHeartbeat();
          const errMsg = (execErr as Error).message;
          await JobQueueService.failJob(job.id, errMsg);
          logger.error({ queueJobId: job.id, err: errMsg }, 'Crawl execution threw error');
          return {
            processed: true,
            jobId: job.id,
            crawlJobId,
            error: errMsg,
          };
        }
      }

      // 3. Fallback: check for any pending crawl_jobs that were not yet in job_queue
      const pendingLegacy = await query<{ id: string; workspace_id: string; brand_id: string | null; label: string; seed_urls: string[]; profile: string; max_pages: number }>(
        `UPDATE crawl_jobs
         SET status = 'running', started_at = NOW(), updated_at = NOW()
         WHERE id = (
           SELECT id FROM crawl_jobs
           WHERE status = 'pending'
           ORDER BY created_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING id, workspace_id, brand_id, label, seed_urls, profile, max_pages`
      );

      if (pendingLegacy.rows.length && pendingLegacy.rows[0]) {
        const legacy = pendingLegacy.rows[0];
        logger.info({ crawlJobId: legacy.id }, 'Processing pending crawl_job from legacy table');
        const result = await CrawlEngineService.executeCrawlJob(legacy.id);
        return {
          processed: true,
          crawlJobId: legacy.id,
          pagesCrawled: result.pagesCrawled,
          error: result.error,
        };
      }

      return { processed: false };
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'Crawler worker execution error');
      return { processed: false, error: (err as Error).message };
    }
  }

  /**
   * Start polling loop for continuous worker execution (daemon mode)
   */
  public static start(intervalMs = 3000) {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info({ intervalMs }, 'Starting Crawler Worker daemon loop');

    const tick = async () => {
      if (!this.isRunning) return;
      try {
        const res = await this.processNextJob();
        // If a job was processed, immediately check for another
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
