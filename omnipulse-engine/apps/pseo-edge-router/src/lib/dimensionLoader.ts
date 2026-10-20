import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';

const CACHE_TTL_SECONDS = 3600; // 1 hour — dimensions rarely change
const CACHE_PREFIX = 'omnipulse:dims:';

export interface Dimension {
  slug: string;
  display_value: string;
  metadata: Record<string, unknown>;
  search_volume_estimate: number;
}

export interface DimensionMap {
  [dimensionType: string]: Dimension[];
}

let supabase: ReturnType<typeof createClient> | null = null;
let redis: Redis | null = null;

export function getSupabase(): ReturnType<typeof createClient> | null {
  if (!supabase) {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
    if (url && key) {
      supabase = createClient(url, key);
    }
  }
  return supabase;
}

export function getRedis(): Redis | null {
  if (!redis) {
    const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
    try {
      redis = new Redis(redisUrl, {
        lazyConnect: true,
        enableReadyCheck: false,
        maxRetriesPerRequest: 0,
        retryStrategy: () => null,
        connectTimeout: 300,
      });
      redis.on('error', () => {
        // Silently swallow connection errors so edge router proceeds to DB
      });
    } catch {
      redis = null;
    }
  }
  return redis;
}

/**
 * Load all dimensions for a hostname, using Redis cache.
 * Returns a map of dimensionType -> Dimension[]
 */
export async function loadDimensions(hostname: string): Promise<DimensionMap> {
  const cacheKey = `${CACHE_PREFIX}${hostname}`;

  try {
    const r = getRedis();
    if (r) {
      if (r.status === 'wait') {
        await r.connect().catch(() => {});
      }
      const cached = await r.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as DimensionMap;
      }
    }
  } catch {
    // Redis unavailable — fall through to DB
  }

  // Fetch from Supabase
  const sb = getSupabase();
  if (!sb) {
    console.warn(`[dimensionLoader] Supabase client not configured. Returning empty catalog.`);
    return {};
  }

  interface CatalogRow {
    dimension_type: string;
    slug: string;
    display_value: string;
    metadata?: Record<string, unknown> | null;
    search_volume_estimate?: number | null;
  }

  const { data, error } = await sb
    .from('pseo_dimension_catalog')
    .select('dimension_type, slug, display_value, metadata, search_volume_estimate')
    .eq('hostname', hostname)
    .eq('active', true)
    .order('search_volume_estimate', { ascending: false });

  if (error) {
    console.error(`Failed to load dimensions for ${hostname}: ${error.message}`);
    return {};
  }

  // Group by dimension_type
  const map: DimensionMap = {};
  const rows = (data ?? []) as unknown as CatalogRow[];
  for (const row of rows) {
    if (!map[row.dimension_type]) map[row.dimension_type] = [];
    map[row.dimension_type].push({
      slug: row.slug,
      display_value: row.display_value,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      search_volume_estimate: row.search_volume_estimate ?? 0,
    });
  }

  // Cache it
  try {
    const r = getRedis();
    if (r) {
      await r.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(map));
    }
  } catch {
    // Non-fatal cache write failure
  }

  return map;
}

/**
 * Resolve dimension indices to slugs for a given hostname.
 */
export async function resolveDimensions(
  hostname: string,
  dimensionTypes: string[],
  indices: number[]
): Promise<{ slugs: string[]; displayValues: string[]; metadata: Record<string, unknown>[] } | null> {
  const map = await loadDimensions(hostname);
  const slugs: string[] = [];
  const displayValues: string[] = [];
  const metadata: Record<string, unknown>[] = [];

  for (let i = 0; i < dimensionTypes.length; i++) {
    const dimType = dimensionTypes[i];
    const dimList = map[dimType];
    if (!dimList || indices[i] === undefined || indices[i] >= dimList.length) return null; // Dimension not found
    const dim = dimList[indices[i]];
    if (!dim) return null;
    slugs.push(dim.slug);
    displayValues.push(dim.display_value);
    metadata.push(dim.metadata);
  }

  return { slugs, displayValues, metadata };
}

/**
 * Get dimension counts for a hostname (for combinatorial index).
 */
export async function getDimensionCounts(hostname: string, dimensionTypes: string[]): Promise<number[]> {
  const map = await loadDimensions(hostname);
  return dimensionTypes.map((t) => map[t]?.length ?? 0);
}

/**
 * Match dimension slugs to their catalog entries and indices.
 */
export async function matchDimensionsFromSlugs(
  hostname: string,
  dimensionTypes: string[],
  slugs: string[]
): Promise<{
  matchedCount: number;
  indices: number[];
  dimensions: (Dimension | null)[];
}> {
  const map = await loadDimensions(hostname);
  const indices: number[] = [];
  const dimensions: (Dimension | null)[] = [];
  let matchedCount = 0;

  for (let i = 0; i < dimensionTypes.length; i++) {
    const type = dimensionTypes[i];
    const slug = slugs[i];
    const list = map[type] || [];
    const foundIndex = list.findIndex((item) => item.slug.toLowerCase() === slug?.toLowerCase());
    if (foundIndex !== -1) {
      indices.push(foundIndex);
      dimensions.push(list[foundIndex]);
      matchedCount++;
    } else {
      indices.push(-1);
      dimensions.push(null);
    }
  }

  return { matchedCount, indices, dimensions };
}
