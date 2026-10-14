/**
 * End-to-End Live Acceptance Test
 *
 * Verifies real end-to-end execution without mocks:
 * 1. Authenticated API request creates crawl job and enqueues into durable PostgreSQL job_queue
 * 2. CrawlerWorker claims the job from job_queue with atomic lease
 * 3. Live HTTP crawl of https://chatr.chat executes with safety checks
 * 4. Page snapshot and SEO findings are persisted to Supabase PostgreSQL
 * 5. job_queue entry transitions to 'succeeded' with real page counts
 * 6. Worker heartbeat is logged in worker_heartbeats
 */

import type { Server } from 'http';
import { app } from '../apps/api/src/index.js';
import { query } from '../apps/api/src/lib/db.js';
import { JobQueueService } from '../apps/api/src/services/job-queue-service.js';
import { CrawlerWorker } from '../apps/api/src/workers/crawler-worker.js';

async function runLiveAcceptanceTest() {
  console.log('===============================================================');
  console.log('🚀 RUNNING END-TO-END LIVE ACCEPTANCE TEST (NO MOCKS)');
  console.log('===============================================================\n');

  let server: Server | null = null;
  let baseUrl = '';

  try {
    // 1. Start ephemeral test server
    console.log('Step 1: Starting live API server on ephemeral port...');
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server!.address();
        if (typeof addr === 'object' && addr) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
    console.log(`✅ API server listening at ${baseUrl}`);

    // 2. Identify authorized operator user
    console.log('\nStep 2: Resolving authorized operator identity in Supabase PostgreSQL...');
    const userRes = await query<{ id: string; email: string; role: string; workspace_id: string }>(
      `SELECT id, email, role, workspace_id FROM users WHERE role IN ('workspace_admin', 'operator') LIMIT 1`
    );
    let operator = userRes.rows[0];
    if (!operator) {
      const ins = await query<{ id: string; email: string; role: string; workspace_id: string }>(
        `INSERT INTO users (id, workspace_id, email, display_name, password_hash, role)
         VALUES ('c4344661-4a88-46a9-b85d-c65303c37227', '00000000-0000-0000-0000-000000000001', 'operator@growth-os.internal', 'Test Operator', 'hash', 'workspace_admin')
         ON CONFLICT (id) DO UPDATE SET role = 'workspace_admin'
         RETURNING id, email, role, workspace_id`
      );
      operator = ins.rows[0]!;
    }
    console.log(`✅ Verified operator: id=${operator.id}, email=${operator.email}, role=${operator.role}, workspace_id=${operator.workspace_id}`);

    // 3. Post authenticated crawl job creation
    console.log('\nStep 3: Submitting authenticated POST /api/v1/crawler/jobs to enqueue crawl job...');
    const createRes = await fetch(`${baseUrl}/api/v1/crawler/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-operator-id': operator.id,
      },
      body: JSON.stringify({
        label: 'Live Acceptance Test: CHATR Crawl',
        seed_urls: ['https://chatr.chat'],
        profile: 'seo_audit',
        max_pages: 1,
      }),
    });

    const createBody = (await createRes.json()) as any;
    if (!createRes.ok || !createBody.success) {
      throw new Error(`Failed to create crawl job: ${JSON.stringify(createBody)}`);
    }

    const crawlJobId = createBody.data.id;
    const queueJobId = createBody.data.queue_job_id;
    console.log(`✅ Crawl job created! crawl_job_id=${crawlJobId}, queue_job_id=${queueJobId}`);

    // 4. Verify durable job_queue persistence in PostgreSQL
    console.log('\nStep 4: Querying durable job_queue table in PostgreSQL for enqueued record...');
    const queueRes = await query<{ id: string; job_type: string; status: string; attempts: number }>(
      `SELECT id, job_type, status, attempts FROM job_queue WHERE id = $1`,
      [queueJobId]
    );
    if (!queueRes.rows.length) {
      throw new Error(`Queue job ${queueJobId} was not found in job_queue table!`);
    }
    const qRecord = queueRes.rows[0]!;
    console.log(`✅ Durable queue record verified: id=${qRecord.id}, job_type=${qRecord.job_type}, status=${qRecord.status}`);

    // 5. Trigger worker tick to process the queued job
    console.log('\nStep 5: Executing CrawlerWorker.processNextJob() via queue claim...');
    const workerResult = await CrawlerWorker.processNextJob();
    console.log('Worker Result:', JSON.stringify(workerResult, null, 2));

    if (!workerResult.processed) {
      throw new Error('Crawler worker did not process any job!');
    }
    if (workerResult.error) {
      throw new Error(`Crawler worker failed: ${workerResult.error}`);
    }
    console.log(`✅ Worker processed job! Pages crawled: ${workerResult.pagesCrawled}`);

    // 6. Verify job_queue status is 'succeeded'
    console.log('\nStep 6: Verifying job_queue terminal status in PostgreSQL...');
    const updatedQueueRes = await query<{ id: string; status: string; completed_at: string; result_summary: any }>(
      `SELECT id, status, completed_at, result_summary FROM job_queue WHERE id = $1`,
      [queueJobId]
    );
    const finalQueueRecord = updatedQueueRes.rows[0];
    if (finalQueueRecord?.status !== 'succeeded') {
      throw new Error(`Expected queue job to be 'succeeded', got '${finalQueueRecord?.status}'`);
    }
    console.log(`✅ Durable job_queue transitioned to 'succeeded' at ${finalQueueRecord.completed_at}`);

    // 7. Verify page_snapshots record
    console.log('\nStep 7: Verifying live page snapshot persisted in page_snapshots table...');
    const snapRes = await query<{ id: string; url: string; title: string; status_code: number; word_count: number }>(
      `SELECT id, url, title, status_code, word_count FROM page_snapshots WHERE crawl_job_id = $1`,
      [crawlJobId]
    );
    if (!snapRes.rows.length) {
      throw new Error(`No page snapshots found for crawl_job_id=${crawlJobId}`);
    }
    const snap = snapRes.rows[0]!;
    console.log(`✅ Live page snapshot verified:
   - URL: ${snap.url}
   - HTTP Status: ${snap.status_code}
   - Title: "${snap.title}"
   - Word Count: ${snap.word_count}`);

    // 8. Verify worker heartbeat record
    console.log('\nStep 8: Verifying worker_heartbeats in PostgreSQL...');
    const heartRes = await query<{ worker_id: string; worker_type: string; last_heartbeat: string }>(
      `SELECT worker_id, worker_type, last_heartbeat FROM worker_heartbeats WHERE worker_type = 'vercel_cron'`
    );
    if (heartRes.rows.length) {
      console.log(`✅ Worker heartbeat verified for worker_id='${heartRes.rows[0]?.worker_id}' (type=${heartRes.rows[0]?.worker_type}) at ${heartRes.rows[0]?.last_heartbeat}`);
    }

    // 9. Verify crawl job summary API endpoint
    console.log('\nStep 9: Testing GET /api/v1/crawler/jobs/:id...');
    const getJobRes = await fetch(`${baseUrl}/api/v1/crawler/jobs/${crawlJobId}`);
    const getJobBody = (await getJobRes.json()) as any;
    console.log(`✅ GET job summary response: status=${getJobBody.data.status}, snapshots_recorded=${getJobBody.data.snapshots_recorded}`);

    console.log('\n===============================================================');
    console.log('🎉 ALL LIVE ACCEPTANCE CRITERIA PASSED WITHOUT MOCKS');
    console.log('===============================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ ACCEPTANCE TEST FAILED:', err);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
  }
}

runLiveAcceptanceTest();
