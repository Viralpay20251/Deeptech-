import { Redis } from 'ioredis';
import type { ContentItem } from '../types.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DLQ_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export class RedisQueueClient {
  private client: Redis;
  private isConnected: boolean = false;
  // Fallback in-memory map if Redis is running offline during testing
  private memoryQueues: Map<string, string[]> = new Map();

  constructor(url?: string) {
    const connectionUrl = url || REDIS_URL;
    this.client = new Redis(connectionUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        // Backoff retry: 50ms up to 2000ms
        const delay = Math.min(times * 100, 2000);
        return delay;
      },
      lazyConnect: true,
      enableOfflineQueue: true,
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      console.log(`[RedisClient] Connected successfully to Redis at ${connectionUrl}`);
    });

    this.client.on('error', (err: Error) => {
      this.isConnected = false;
      console.warn(`[RedisClient] Connection warning: ${err.message}`);
    });
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.isConnected = true;
    } catch (err) {
      console.warn('[RedisClient] Could not connect to Redis server immediately. Offline queue enabled.');
    }
  }

  public getRawClient(): Redis {
    return this.client;
  }

  /**
   * Generates redis queue key for brand and platform: omnipulse:media_ready:{brand}:{platform}
   */
  public getMediaReadyKey(brand: string, platform: string): string {
    return `omnipulse:media_ready:${brand.toLowerCase()}:${platform.toLowerCase()}`;
  }

  /**
   * Generates dead-letter queue key for platform: omnipulse:dlq:{platform}
   */
  public getDlqKey(platform: string): string {
    return `omnipulse:dlq:${platform.toLowerCase()}`;
  }

  /**
   * RPOP from omnipulse:media_ready:{brand}:{platform}
   */
  public async getNextMediaReady(brand: string, platform: string): Promise<ContentItem | null> {
    const key = this.getMediaReadyKey(brand, platform);
    try {
      const raw = await this.client.rpop(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as ContentItem;
    } catch (err) {
      console.error(`[RedisClient] Error fetching next item from ${key}:`, err);
      // Check in-memory fallback
      const inMemoryQueue = this.memoryQueues.get(key);
      if (inMemoryQueue && inMemoryQueue.length > 0) {
        const itemStr = inMemoryQueue.pop()!;
        return JSON.parse(itemStr) as ContentItem;
      }
      return null;
    }
  }

  /**
   * Check queue depth using LLEN on omnipulse:media_ready:{brand}:{platform}
   */
  public async countQueueDepth(brand: string, platform: string): Promise<number> {
    const key = this.getMediaReadyKey(brand, platform);
    try {
      const len = await this.client.llen(key);
      return len;
    } catch (err) {
      console.warn(`[RedisClient] Error checking queue length for ${key}:`, err);
      const inMemoryQueue = this.memoryQueues.get(key);
      return inMemoryQueue ? inMemoryQueue.length : 0;
    }
  }

  /**
   * LPUSH to dead letter queue omnipulse:dlq:{platform} with TTL 7 days
   */
  public async pushFailedItem(item: ContentItem & { failure_reason?: string; failed_at?: string }): Promise<void> {
    const key = this.getDlqKey(item.platform);
    const enrichedItem = {
      ...item,
      failed_at: item.failed_at || new Date().toISOString(),
    };
    const payload = JSON.stringify(enrichedItem);

    try {
      const pipeline = this.client.pipeline();
      pipeline.lpush(key, payload);
      pipeline.expire(key, DLQ_TTL_SECONDS);
      await pipeline.exec();
      console.log(`[RedisClient] Pushed failed item ${item.id} to DLQ ${key} with TTL ${DLQ_TTL_SECONDS}s`);
    } catch (err) {
      console.error(`[RedisClient] Error pushing failed item to DLQ ${key}:`, err);
      if (!this.memoryQueues.has(key)) {
        this.memoryQueues.set(key, []);
      }
      this.memoryQueues.get(key)!.unshift(payload);
    }
  }

  /**
   * LPUSH media ready item into queue (used for seeding / production pipelines)
   */
  public async pushMediaReady(brand: string, platform: string, item: ContentItem): Promise<number> {
    const key = this.getMediaReadyKey(brand, platform);
    const payload = JSON.stringify(item);
    try {
      return await this.client.lpush(key, payload);
    } catch (err) {
      console.error(`[RedisClient] Error pushing media item to ${key}:`, err);
      if (!this.memoryQueues.has(key)) {
        this.memoryQueues.set(key, []);
      }
      this.memoryQueues.get(key)!.unshift(payload);
      return this.memoryQueues.get(key)!.length;
    }
  }

  /**
   * Graceful disconnect
   */
  public async close(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}

// Export singleton instance
export const redisClient = new RedisQueueClient();
