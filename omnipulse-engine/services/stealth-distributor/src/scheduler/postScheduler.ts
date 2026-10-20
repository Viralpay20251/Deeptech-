import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import type { OptimalSlot, SocialAccount, AccountPostHistory } from '../types.js';

dayjs.extend(utc);
dayjs.extend(timezone);

// Optimal posting slots in IST (Indian Standard Time, Asia/Kolkata)
export const OPTIMAL_SLOTS: Record<string, OptimalSlot[]> = {
  youtube: [
    { hour: 7, minute: 0 },
    { hour: 12, minute: 0 },
    { hour: 18, minute: 0 },
  ],
  instagram: [
    { hour: 8, minute: 0 },
    { hour: 13, minute: 0 },
    { hour: 19, minute: 0 },
  ],
  facebook: [
    { hour: 9, minute: 0 },
    { hour: 15, minute: 0 },
    { hour: 20, minute: 0 },
  ],
  linkedin: [
    { hour: 8, minute: 0, weekdaysOnly: true },
    { hour: 12, minute: 0, weekdaysOnly: true },
  ],
  twitter: [
    { hour: 9, minute: 0 },
    { hour: 14, minute: 0 },
    { hour: 21, minute: 0 },
  ],
};

const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours cooldown between posts for the same account
const MAX_DAILY_POSTS = 3;

export class PostScheduler {
  private accountHistories: Map<string, AccountPostHistory> = new Map();
  private ignoreSlotsEnv: boolean;

  constructor() {
    this.ignoreSlotsEnv = process.env.IGNORE_POSTING_SLOTS === 'true';
  }

  /**
   * Returns the current date-time in IST (Asia/Kolkata)
   */
  public getISTNow(): dayjs.Dayjs {
    return dayjs().utcOffset(330); // UTC + 5:30
  }

  /**
   * Checks if the current time is within an optimal posting slot window (+/- windowMinutes)
   * for the given platform.
   */
  public isPostingSlotAvailable(platform: string, windowMinutes: number = 45): boolean {
    if (this.ignoreSlotsEnv) {
      return true;
    }

    const platformKey = platform.toLowerCase();
    const slots = OPTIMAL_SLOTS[platformKey];
    if (!slots || slots.length === 0) {
      // Default to true if platform has no defined slot limits
      return true;
    }

    const istNow = this.getISTNow();
    const dayOfWeek = istNow.day(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    for (const slot of slots) {
      // LinkedIn is weekdays only
      if (slot.weekdaysOnly && isWeekend) {
        continue;
      }

      const slotTime = istNow
        .hour(slot.hour)
        .minute(slot.minute)
        .second(0)
        .millisecond(0);

      const diffMinutes = Math.abs(istNow.diff(slotTime, 'minute'));
      if (diffMinutes <= windowMinutes) {
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluates candidate accounts and selects the best healthy account using round-robin rotation,
   * respecting 2-hour cooldown and max 3 posts per day limits.
   */
  public selectEligibleAccount(
    accounts: SocialAccount[],
    now: Date = new Date()
  ): SocialAccount | null {
    const todayKey = dayjs(now).utcOffset(330).format('YYYY-MM-DD');

    // Filter eligible accounts
    const eligible = accounts.filter((account) => {
      // Skip non-healthy accounts
      if (account.health_status.toLowerCase() !== 'healthy') {
        return false;
      }

      // Check daily post limit from in-memory tracking or account properties
      const history = this.accountHistories.get(account.id);
      const postCountToday =
        history && history.dateKey === todayKey
          ? history.postCountToday
          : account.posts_today || 0;

      const dailyLimit = account.daily_post_limit || MAX_DAILY_POSTS;
      if (postCountToday >= dailyLimit) {
        return false;
      }

      // Check 2-hour cooldown
      const lastPostedTime = history
        ? history.lastPostedAt
        : account.last_posted_at
        ? new Date(account.last_posted_at).getTime()
        : 0;

      if (lastPostedTime > 0 && now.getTime() - lastPostedTime < COOLDOWN_MS) {
        return false;
      }

      return true;
    });

    if (eligible.length === 0) {
      return null;
    }

    // Sort round-robin: pick account with oldest last_posted_at or never posted
    eligible.sort((a, b) => {
      const histA = this.accountHistories.get(a.id);
      const histB = this.accountHistories.get(b.id);

      const timeA = histA
        ? histA.lastPostedAt
        : a.last_posted_at
        ? new Date(a.last_posted_at).getTime()
        : 0;

      const timeB = histB
        ? histB.lastPostedAt
        : b.last_posted_at
        ? new Date(b.last_posted_at).getTime()
        : 0;

      return timeA - timeB;
    });

    return eligible[0];
  }

  /**
   * Record a post event for an account to maintain rate limits and cooldown
   */
  public recordAccountPost(accountId: string, timestamp: number = Date.now()): void {
    const todayKey = dayjs(timestamp).utcOffset(330).format('YYYY-MM-DD');
    const existing = this.accountHistories.get(accountId);

    if (existing && existing.dateKey === todayKey) {
      existing.postCountToday += 1;
      existing.lastPostedAt = timestamp;
    } else {
      this.accountHistories.set(accountId, {
        accountId,
        lastPostedAt: timestamp,
        postCountToday: 1,
        dateKey: todayKey,
      });
    }
  }

  /**
   * Reset in-memory history (e.g. for testing)
   */
  public resetHistory(): void {
    this.accountHistories.clear();
  }
}

export const postScheduler = new PostScheduler();
