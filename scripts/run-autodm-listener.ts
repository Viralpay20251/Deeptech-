/**
 * Autonomous Growth OS — Stealth Social Auto-DM Listener Daemon
 *
 * Continuously polls or listens for incoming social comments across
 * Instagram, LinkedIn, YouTube, Twitter/X, and Facebook.
 * Detects viral trigger keywords (CTC, HAMPER, AGENT, KASHMIR, RESUME)
 * and dispatches immediate 0-click-friction public replies & private DM deep links.
 */

import { executeCommentAutoFunnel, VIRAL_TRIGGER_KEYWORDS, type SocialCommentEvent } from '../omnipulse-engine/services/stealth-distributor/src/viralFunnel.js';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const POLL_INTERVAL_MS = parseInt(process.env.AUTO_DM_POLL_INTERVAL_MS || '30000', 10);
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

let isRunning = true;

process.on('SIGINT', () => {
  console.log('\n[Auto-DM Daemon] Received SIGINT. Shutting down gracefully...');
  isRunning = false;
});

process.on('SIGTERM', () => {
  console.log('\n[Auto-DM Daemon] Received SIGTERM. Shutting down gracefully...');
  isRunning = false;
});

async function pollAndProcessComments(client: Client | null): Promise<number> {
  // In production, queries social inbox webhooks / database comment queue
  // If database client is present, checks for pending social comments
  let processed = 0;

  if (client) {
    try {
      // Check if a social_inbox or pending_comments table exists
      const res = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'social_comments_queue'
        );
      `);

      if (res.rows[0]?.exists) {
        const comments = await client.query(`
          SELECT id, platform, post_id, comment_id, author_username, comment_text, created_at
          FROM public.social_comments_queue
          WHERE status = 'pending'
          ORDER BY created_at ASC
          LIMIT 10
          FOR UPDATE SKIP LOCKED;
        `);

        for (const row of comments.rows) {
          const event: SocialCommentEvent = {
            platform: row.platform,
            postId: row.post_id,
            commentId: row.comment_id,
            authorUsername: row.author_username,
            commentText: row.comment_text,
            createdAt: new Date(row.created_at),
          };

          const result = await executeCommentAutoFunnel(event);
          if (result) {
            await client.query(
              `UPDATE public.social_comments_queue 
               SET status = 'funneled', matched_keyword = $1, deep_link = $2, funneled_at = NOW() 
               WHERE id = $3`,
              [result.matchedKeyword, result.deepLink, row.id]
            );
            processed++;
          } else {
            await client.query(
              `UPDATE public.social_comments_queue SET status = 'ignored', funneled_at = NOW() WHERE id = $1`,
              [row.id]
            );
          }
        }
      }
    } catch (err) {
      console.warn('[Auto-DM Daemon] Polling notice:', (err as Error).message);
    }
  }

  return processed;
}

export async function startAutoDmDaemon(): Promise<void> {
  console.log('======================================================================');
  console.log('🤖 AUTONOMOUS STEALTH SOCIAL AUTO-DM LISTENER DAEMON');
  console.log('======================================================================');
  console.log(`Poll Interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`Active Triggers: ${Object.keys(VIRAL_TRIGGER_KEYWORDS).join(', ')}`);
  console.log('Target Platforms: LinkedIn, Instagram, YouTube, Twitter/X, Facebook');
  console.log('----------------------------------------------------------------------');

  let client: Client | null = null;
  if (dbUrl) {
    try {
      client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
      await client.connect();
      console.log('✔ Connected to Supabase event queue');
    } catch {
      console.warn('⚠️ Running in standalone webhook mode without database queue');
    }
  }

  console.log('🚀 Daemon active and listening for viral comment triggers...\n');

  while (isRunning) {
    try {
      const processed = await pollAndProcessComments(client);
      if (processed > 0) {
        console.log(`[Auto-DM Daemon] Processed ${processed} inbound comment trigger(s).`);
      }
    } catch (err) {
      console.error('[Auto-DM Daemon] Error in listener cycle:', err);
    }

    // Non-blocking sleep
    for (let i = 0; i < POLL_INTERVAL_MS / 1000; i++) {
      if (!isRunning) break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  if (client) {
    await client.end();
  }

  console.log('[Auto-DM Daemon] Stopped.');
}

if (process.argv.includes('--run') || process.argv.includes('--daemon')) {
  startAutoDmDaemon().catch(console.error);
}
