import type { Context, Next } from 'hono';
import { getRedis, getSupabase } from '../lib/dimensionLoader.js';

const BOT_QUEUE_PREFIX = 'omnipulse:botwave:';
const DEFAULT_BURST_SIZE = 25;

export async function botWaveMiddleware(c: Context, next: Next) {
  const isBot = c.get('isBot');
  const hostname = c.get('hostname');

  if (isBot && hostname) {
    let botWaveUrls: string[] = [];

    // 1. Fetch uncrawled URLs from Redis BotWave queue
    try {
      const redis = getRedis();
      if (redis) {
        if (redis.status === 'wait') {
          await redis.connect().catch(() => {});
        }
        const queueKey = `${BOT_QUEUE_PREFIX}${hostname}`;
        
        // Pop up to 25 items from the list
        // Redis lpop supports count parameter in modern versions
        const popped = await redis.lpop(queueKey, DEFAULT_BURST_SIZE);
        if (popped) {
          botWaveUrls = Array.isArray(popped) ? popped : [popped];
        }
      }
    } catch (err) {
      // Non-critical: fail softly if Redis has transient issues
      if (process.env['NODE_ENV'] !== 'test') {
        console.warn(`[botWaveMiddleware] Redis error retrieving bot wave for ${hostname}:`, err);
      }
    }

    c.set('botWaveUrls', botWaveUrls);

    // 2. Asynchronously log bot visit telemetry to Supabase gsc_telemetry
    void (async () => {
      try {
        const sb = getSupabase();
        if (sb) {
          const today = new Date().toISOString().split('T')[0];
          const userAgent = c.req.header('user-agent') ?? '';
          const path = c.req.path;

          // Attempt upsert or increment crawl count in gsc_telemetry
          const { error } = await (sb.from('gsc_telemetry') as any).upsert(
            {
              hostname,
              date: today,
              last_bot_ua: userAgent,
              last_path: path,
              crawl_requests_today: 1,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'hostname,date',
              ignoreDuplicates: false,
            }
          );

          if (error && error.code !== '42P01') {
            // Ignore if table does not exist in local dev, otherwise log
            // 42P01 = undefined_table
            // console.warn(`[gsc_telemetry] logging notice: ${error.message}`);
          }
        }
      } catch {
        // Non-blocking telemetry log
      }
    })();
  } else {
    c.set('botWaveUrls', []);
  }

  await next();
}
