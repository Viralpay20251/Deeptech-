import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ContentItem, SocialAccount, DistributionMetric, AccountHealthStatus } from '../types.js';
import { postDelayedFirstComment } from './firstCommentPoster.js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_KEY) {
  console.warn('[SupabaseClient] Warning: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY is not defined.');
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

/**
 * Fetch media_ready content items for a platform and optional brand cluster.
 */
export async function getReadyContent(
  platform: string,
  brandCluster?: string
): Promise<ContentItem[]> {
  try {
    let query = supabase
      .from('content_queue')
      .select('*')
      .eq('platform', platform)
      .eq('status', 'media_ready')
      .order('scheduled_for', { ascending: true });

    if (brandCluster) {
      query = query.eq('brand_cluster', brandCluster);
    }

    const { data, error } = await query;
    if (error) {
      console.error(`[SupabaseClient] Failed to fetch ready content for ${platform}:`, error.message);
      return [];
    }

    return (data as ContentItem[]) || [];
  } catch (err) {
    console.error(`[SupabaseClient] Unexpected error fetching content for ${platform}:`, err);
    return [];
  }
}

/**
 * Update content_queue status, published URL, and potential error message.
 */
export async function updateContentStatus(
  id: string,
  status: string,
  postUrl?: string,
  error?: string
): Promise<boolean> {
  try {
    const updatePayload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (postUrl) {
      updatePayload.published_url = postUrl;
    }
    if (error !== undefined) {
      updatePayload.error_message = error;
    }

    const { error: dbError } = await supabase
      .from('content_queue')
      .update(updatePayload)
      .eq('id', id);

    if (dbError) {
      console.error(`[SupabaseClient] Failed to update content ${id} status to ${status}:`, dbError.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[SupabaseClient] Unexpected error updating content ${id}:`, err);
    return false;
  }
}

/**
 * Get an active, healthy account for a given platform and optional brand cluster.
 * Orders by last_posted_at ASC to ensure fair round-robin rotation.
 */
export async function getActiveAccount(
  platform: string,
  brandCluster?: string
): Promise<SocialAccount | null> {
  try {
    let query = supabase
      .from('social_accounts')
      .select('*')
      .eq('platform', platform)
      .eq('health_status', 'healthy')
      .order('last_posted_at', { ascending: true, nullsFirst: true });

    if (brandCluster) {
      query = query.eq('brand_cluster', brandCluster);
    }

    const { data, error } = await query.limit(1);
    if (error) {
      console.error(`[SupabaseClient] Failed to fetch active account for ${platform}:`, error.message);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    return data[0] as SocialAccount;
  } catch (err) {
    console.error(`[SupabaseClient] Unexpected error fetching active account for ${platform}:`, err);
    return null;
  }
}

/**
 * Mark an account with updated health status (e.g. healthy, shadowbanned, rate_limited).
 */
export async function updateAccountHealth(
  accountId: string,
  status: AccountHealthStatus | string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('social_accounts')
      .update({
        health_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId);

    if (error) {
      console.error(`[SupabaseClient] Failed to update account health ${accountId} to ${status}:`, error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[SupabaseClient] Unexpected error updating account health ${accountId}:`, err);
    return false;
  }
}

/**
 * Update the last_posted_at timestamp on an account after successful posting.
 */
export async function updateAccountLastPosted(accountId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('social_accounts')
      .update({
        last_posted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId);

    if (error) {
      console.error(`[SupabaseClient] Failed to update last_posted_at for ${accountId}:`, error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[SupabaseClient] Error updating last_posted_at for ${accountId}:`, err);
    return false;
  }
}

/**
 * Record or upsert metrics into distribution_metrics table.
 */
export async function recordMetrics(metrics: DistributionMetric): Promise<boolean> {
  try {
    const payload = {
      content_id: metrics.content_id,
      platform: metrics.platform,
      social_account_id: metrics.social_account_id,
      brand_cluster: metrics.brand_cluster,
      post_url: metrics.post_url || null,
      status: metrics.status,
      views_count: metrics.views_count ?? 0,
      likes_count: metrics.likes_count ?? 0,
      comments_count: metrics.comments_count ?? 0,
      shares_count: metrics.shares_count ?? 0,
      error_message: metrics.error_message || null,
      published_at: metrics.published_at || new Date().toISOString(),
      created_at: metrics.created_at || new Date().toISOString(),
    };

    const { error } = await supabase
      .from('distribution_metrics')
      .upsert(payload, { onConflict: 'content_id,platform' });

    if (error) {
      console.error(`[SupabaseClient] Failed to record metrics for content ${metrics.content_id}:`, error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[SupabaseClient] Unexpected error recording metrics:`, err);
    return false;
  }
}

/**
 * Schedule and post the first comment after a 60-second delay.
 * Fetches the content item and its associated account cookie file to post the comment.
 */
export async function postFirstComment(
  contentId: string,
  platform: string,
  postUrl: string
): Promise<void> {
  // Run asynchronously without blocking the main distribution flow
  (async () => {
    try {
      console.log(`[SupabaseClient] Scheduling first comment for content ${contentId} on ${platform} (60s delay)...`);

      // Fetch content details for comment text and social account
      const { data: contentData, error: contentError } = await supabase
        .from('content_queue')
        .select('first_comment_text, social_account_id')
        .eq('id', contentId)
        .single();

      if (contentError || !contentData) {
        console.warn(`[SupabaseClient] Could not fetch first comment details for ${contentId}: ${contentError?.message}`);
        return;
      }

      const commentText = contentData.first_comment_text;
      if (!commentText || commentText.trim() === '') {
        console.log(`[SupabaseClient] No first comment text configured for ${contentId}. Skipping.`);
        return;
      }

      // Fetch account cookie file path
      let cookieFilePath = '';
      if (contentData.social_account_id) {
        const { data: accountData } = await supabase
          .from('social_accounts')
          .select('cookie_file_path')
          .eq('id', contentData.social_account_id)
          .single();

        if (accountData?.cookie_file_path) {
          cookieFilePath = accountData.cookie_file_path;
        }
      }

      const commentSuccess = await postDelayedFirstComment(
        platform,
        postUrl,
        commentText,
        cookieFilePath,
        60000 // 60 seconds delay
      );

      if (commentSuccess) {
        console.log(`[SupabaseClient] First comment posted successfully for content ${contentId}`);
      } else {
        console.warn(`[SupabaseClient] First comment posting returned failure for content ${contentId}`);
      }
    } catch (err) {
      console.error(`[SupabaseClient] Exception while posting first comment for ${contentId}:`, err);
    }
  })();
}
