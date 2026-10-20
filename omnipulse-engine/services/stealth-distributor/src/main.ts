import PQueue from 'p-queue';
import type { ContentItem, SocialAccount, PostResult, PlatformType } from './types.js';
import { supabase, getReadyContent, updateContentStatus, updateAccountHealth, updateAccountLastPosted, recordMetrics, postFirstComment } from './lib/supabaseClient.js';
import { redisClient } from './lib/redisClient.js';
import { postScheduler } from './scheduler/postScheduler.js';
import { uploadYouTubeShort } from './platforms/youtubeUploader.js';
import { uploadInstagramReel } from './platforms/instagramUploader.js';
import { uploadFacebookReel } from './platforms/facebookUploader.js';
import { uploadLinkedInVideo } from './platforms/linkedinUploader.js';
import { uploadTwitterPost } from './platforms/twitterUploader.js';

// Configuration
const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || String(DEFAULT_POLL_INTERVAL_MS), 10);
const BRAND_CLUSTERS = (process.env.BRAND_CLUSTERS?.split(',') || ['chatr', 'talentxcel', 'nuty_tales']).map((b) => b.trim());
const PLATFORMS: PlatformType[] = ['youtube', 'instagram', 'facebook', 'linkedin', 'twitter'];

// Concurrency limited to 2 parallel browser uploads to manage system resources and emulate stealth behavior
const uploadQueue = new PQueue({ concurrency: 2 });

type UploaderFn = (
  videoPath: string,
  caption: string,
  thumbnailPath: string,
  cookieFile: string
) => Promise<PostResult>;

const UPLOADERS: Record<string, UploaderFn> = {
  youtube: uploadYouTubeShort,
  instagram: uploadInstagramReel,
  facebook: uploadFacebookReel,
  linkedin: uploadLinkedInVideo,
  twitter: uploadTwitterPost,
};

let isRunning = true;
let isCycleActive = false;

function logWithTimestamp(platform: string, message: string): void {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${platform.toUpperCase()}] ${message}`);
}

/**
 * Executes a single upload task for a content item and selected social account
 */
async function processUploadTask(
  item: ContentItem,
  account: SocialAccount,
  brand: string,
  platform: PlatformType
): Promise<void> {
  const uploader = UPLOADERS[platform];
  if (!uploader) {
    logWithTimestamp(platform, `No uploader registered for platform: ${platform}`);
    return;
  }

  logWithTimestamp(platform, `Starting distribution for content ${item.id} (Brand: ${brand}, Account: @${account.account_handle})`);

  // 1. Mark content as processing in Supabase
  await updateContentStatus(item.id, 'processing');

  try {
    // 2. Perform upload via stealth browser
    const result: PostResult = await uploader(
      item.media_file_path,
      item.caption,
      item.thumbnail_path,
      account.cookie_file_path
    );

    if (result.success && result.post_url) {
      logWithTimestamp(platform, `Upload SUCCESS for ${item.id} -> ${result.post_url}`);

      // 3. Update content_queue row to published
      await updateContentStatus(item.id, 'published', result.post_url);

      // 4. Update account last posted & rate-limiting records
      await updateAccountLastPosted(account.id);
      postScheduler.recordAccountPost(account.id);

      // 5. Schedule async first comment (60-second delay)
      postFirstComment(item.id, platform, result.post_url);

      // 6. Record success metrics
      await recordMetrics({
        content_id: item.id,
        platform,
        social_account_id: account.id,
        brand_cluster: brand,
        post_url: result.post_url,
        status: 'success',
        views_count: result.views_count || 0,
      });
    } else {
      const errorMsg = result.error || 'Unknown upload failure';
      logWithTimestamp(platform, `Upload FAILED for ${item.id}: ${errorMsg}`);

      // Check if failure indicates shadowban or authentication revocation
      if (
        errorMsg.toLowerCase().includes('challenge') ||
        errorMsg.toLowerCase().includes('checkpoint') ||
        errorMsg.toLowerCase().includes('expired') ||
        errorMsg.toLowerCase().includes('banned')
      ) {
        logWithTimestamp(platform, `Flagging account @${account.account_handle} as shadowbanned/expired.`);
        await updateAccountHealth(account.id, 'shadowbanned');
      }

      // Update Supabase content_queue to failed
      await updateContentStatus(item.id, 'failed', undefined, errorMsg);

      // Push to Redis Dead Letter Queue with 7-day TTL
      await redisClient.pushFailedItem({
        ...item,
        failure_reason: errorMsg,
      });

      // Record failed metrics
      await recordMetrics({
        content_id: item.id,
        platform,
        social_account_id: account.id,
        brand_cluster: brand,
        status: 'failed',
        error_message: errorMsg,
      });
    }
  } catch (err) {
    const errorMsg = (err as Error).message;
    logWithTimestamp(platform, `Unexpected exception in processUploadTask: ${errorMsg}`);

    await updateContentStatus(item.id, 'failed', undefined, errorMsg);
    await redisClient.pushFailedItem({
      ...item,
      failure_reason: errorMsg,
    });
    await recordMetrics({
      content_id: item.id,
      platform,
      social_account_id: account.id,
      brand_cluster: brand,
      status: 'failed',
      error_message: errorMsg,
    });
  }
}

/**
 * Main distribution cycle:
 * Loops through all platforms and brands, checks scheduling slots,
 * fetches media items, acquires healthy accounts, and dispatches to PQueue.
 */
async function runDistributionCycle(): Promise<void> {
  if (isCycleActive) {
    console.log('[StealthDistributor] Previous distribution cycle still active. Skipping run.');
    return;
  }

  isCycleActive = true;
  console.log(`[StealthDistributor] === Distribution Cycle Started (${new Date().toISOString()}) ===`);

  try {
    for (const brand of BRAND_CLUSTERS) {
      for (const platform of PLATFORMS) {
        // Step a: Check if optimal posting slot is open
        const slotAvailable = postScheduler.isPostingSlotAvailable(platform);
        if (!slotAvailable) {
          logWithTimestamp(platform, `Brand [${brand}]: Outside optimal posting window. Skipping.`);
          continue;
        }

        // Step b: Get next media-ready item from Redis first, fallback to Supabase
        let item = await redisClient.getNextMediaReady(brand, platform);
        if (!item) {
          const readyItems = await getReadyContent(platform, brand);
          if (readyItems && readyItems.length > 0) {
            item = readyItems[0];
          }
        }

        if (!item) {
          // No media ready for this brand/platform combination
          continue;
        }

        logWithTimestamp(platform, `Found ready content: ${item.id} for brand: ${brand}`);

        // Step c: Get healthy social accounts for this platform & brand
        const { data: accountsData, error: accountError } = await supabase
          .from('social_accounts')
          .select('*')
          .eq('platform', platform)
          .eq('brand_cluster', brand);

        let candidateAccounts: SocialAccount[] = (accountsData as SocialAccount[]) || [];

        // Fallback: if no brand-specific accounts exist, query platform accounts
        if (candidateAccounts.length === 0) {
          const { data: genericData } = await supabase
            .from('social_accounts')
            .select('*')
            .eq('platform', platform);
          candidateAccounts = (genericData as SocialAccount[]) || [];
        }

        // Select healthy account according to rate limit and cooldown rules
        const selectedAccount = postScheduler.selectEligibleAccount(candidateAccounts);

        if (!selectedAccount) {
          logWithTimestamp(
            platform,
            `No eligible healthy account available for ${platform} (${brand}) [cooldown or daily limits reached]. Requeuing item.`
          );
          // Push item back to Redis media ready queue
          await redisClient.pushMediaReady(brand, platform, item);
          continue;
        }

        // Assign account to item if not already set
        item.social_account_id = selectedAccount.id;

        // Step d & e & f: Enqueue the upload task into PQueue with concurrency=2
        const currentItem = item;
        const currentAccount = selectedAccount;
        uploadQueue.add(() => processUploadTask(currentItem, currentAccount, brand, platform));
      }
    }
  } catch (cycleErr) {
    console.error('[StealthDistributor] Error during distribution cycle execution:', cycleErr);
  } finally {
    isCycleActive = false;
    console.log(`[StealthDistributor] === Distribution Cycle Queued. Active/Pending in queue: ${uploadQueue.size + uploadQueue.pending} ===`);
  }
}

/**
 * Initializes and starts the polling loop
 */
async function main(): Promise<void> {
  console.log('------------------------------------------------------------');
  console.log(' OmniPulse Engine — Stealth Distributor Service');
  console.log(` Platforms: ${PLATFORMS.join(', ')}`);
  console.log(` Brands: ${BRAND_CLUSTERS.join(', ')}`);
  console.log(` Poll Interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log(` Concurrency: 2`);
  console.log(' Zero External Paid APIs — Pure Stealth Automation');
  console.log('------------------------------------------------------------');

  // Connect to Redis
  await redisClient.connect();

  // Run initial distribution cycle immediately
  await runDistributionCycle();

  // Schedule regular polling
  const intervalId = setInterval(() => {
    if (isRunning) {
      runDistributionCycle().catch((err) => {
        console.error('[StealthDistributor] Unhandled error in distribution cycle:', err);
      });
    }
  }, POLL_INTERVAL_MS);

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n[StealthDistributor] Received ${signal}. Shutting down gracefully...`);
    isRunning = false;
    clearInterval(intervalId);

    console.log('[StealthDistributor] Waiting for active uploads in queue to complete...');
    await uploadQueue.onIdle();

    console.log('[StealthDistributor] Closing Redis connection...');
    await redisClient.close();

    console.log('[StealthDistributor] Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[StealthDistributor] Fatal error during bootstrap:', err);
  process.exit(1);
});
