export type PlatformType = 'youtube' | 'instagram' | 'facebook' | 'linkedin' | 'twitter';

export type AccountHealthStatus = 'healthy' | 'shadowbanned' | 'rate_limited' | 'dead' | 'cooling_down';

export type ContentStatus = 'draft' | 'pending' | 'media_ready' | 'processing' | 'published' | 'failed';

export interface ContentItem {
  id: string;
  brand_cluster: string;
  platform: string;
  social_account_id: string;
  content_type: string;
  script_text: string;
  hook_line: string;
  media_file_path: string;
  thumbnail_path: string;
  caption: string;
  first_comment_text: string;
  source_pseo_url: string;
  scheduled_for: string;
  status?: ContentStatus;
  published_url?: string;
  error_message?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SocialAccount {
  id: string;
  platform: string;
  account_handle: string;
  profile_path: string;
  cookie_file_path: string;
  health_status: AccountHealthStatus | string;
  daily_post_limit: number;
  brand_cluster?: string;
  last_posted_at?: string | null;
  posts_today?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PostResult {
  success: boolean;
  post_url?: string;
  error?: string;
  views_count?: number;
}

export interface DistributionMetric {
  id?: string;
  content_id: string;
  platform: string;
  social_account_id: string;
  brand_cluster: string;
  post_url?: string;
  status: 'success' | 'failed';
  views_count?: number;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
  error_message?: string;
  published_at?: string;
  created_at?: string;
}

export interface OptimalSlot {
  hour: number;
  minute: number;
  weekdaysOnly?: boolean;
}

export interface AccountPostHistory {
  accountId: string;
  lastPostedAt: number;
  postCountToday: number;
  dateKey: string;
}
