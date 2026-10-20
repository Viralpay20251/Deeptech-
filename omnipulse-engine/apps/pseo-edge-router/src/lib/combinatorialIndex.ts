/**
 * Bijective combinatorial index system.
 * Converts [dim0_idx, dim1_idx, dim2_idx, ...] ↔ BigInt page_id
 * without storing any permutation rows in the database.
 * 
 * Key properties:
 * - Fully deterministic: same inputs → same output always
 * - Invertible: page_id → dimension indices → dimension slugs
 * - Space-efficient: stores only seed dimension values (~10K rows)
 * - Neighbor math: ring-based (N+1..N+12) + long-distance (N*31%TOTAL)
 */

export interface DimensionSet {
  counts: number[]; // [count_dim0, count_dim1, count_dim2, ...]
}

export interface PageAddress {
  indices: number[]; // [idx_dim0, idx_dim1, idx_dim2, ...]
}

/**
 * Encode dimension indices to a single BigInt page ID.
 * Mixed-radix encoding: page_id = idx0 + count0*(idx1 + count1*(idx2 + ...))
 */
export function encodePageId(address: PageAddress, dims: DimensionSet): bigint {
  if (address.indices.length !== dims.counts.length) {
    throw new Error(`Dimension mismatch: got ${address.indices.length} indices, expected ${dims.counts.length}`);
  }
  let id = 0n;
  let multiplier = 1n;
  for (let i = 0; i < address.indices.length; i++) {
    const idx = address.indices[i];
    const count = dims.counts[i];
    if (idx < 0 || idx >= count) {
      throw new Error(`Index ${idx} out of range for dimension ${i} (count=${count})`);
    }
    id += BigInt(idx) * multiplier;
    multiplier *= BigInt(count);
  }
  return id;
}

/**
 * Decode a BigInt page ID back to dimension indices.
 */
export function decodePageId(pageId: bigint, dims: DimensionSet): PageAddress {
  const indices: number[] = [];
  let remaining = pageId;
  for (const count of dims.counts) {
    if (count <= 0) {
      throw new Error(`Invalid dimension count: ${count}`);
    }
    const c = BigInt(count);
    indices.push(Number(remaining % c));
    remaining = remaining / c;
  }
  if (remaining !== 0n) {
    throw new Error(`Page ID ${pageId} exceeds total page space for given dimensions`);
  }
  return { indices };
}

/**
 * Total page count for a given dimension set.
 */
export function totalPages(dims: DimensionSet): bigint {
  if (dims.counts.length === 0) return 0n;
  return dims.counts.reduce((acc, c) => acc * BigInt(c), 1n);
}

/**
 * Get ring neighbors for internal linking.
 * Returns up to 12 nearby page IDs in the modular ring.
 */
export function getRingNeighbors(pageId: bigint, dims: DimensionSet, count: number = 12): bigint[] {
  const total = totalPages(dims);
  if (total <= 1n) return [];
  const neighbors: bigint[] = [];
  const limit = total < BigInt(count) ? total - 1n : BigInt(count);
  for (let i = 1n; i <= limit; i++) {
    neighbors.push((pageId + i) % total);
  }
  return neighbors;
}

/**
 * Get long-distance jump links (cross-cluster internal links).
 * Uses deterministic modular arithmetic: N * 31 % TOTAL
 */
export function getLongDistanceLinks(pageId: bigint, dims: DimensionSet, count: number = 5): bigint[] {
  const total = totalPages(dims);
  if (total <= 1n) return [];
  const links: bigint[] = [];
  let current = pageId;
  for (let i = 0; i < count; i++) {
    current = ((current + 7n) * 31n) % total;
    if (current !== pageId && !links.includes(current)) {
      links.push(current);
    }
  }
  return links;
}

/**
 * Build a page URL from dimension slugs using a joiner pattern.
 */
export function buildPageUrl(
  pathPrefix: string,
  slugJoiner: string,
  dimensionSlugs: string[]
): string {
  if (dimensionSlugs.length === 0) {
    return pathPrefix;
  }
  if (dimensionSlugs.length === 1) {
    return `${pathPrefix}${dimensionSlugs[0]}`;
  }
  // First two joined with main joiner, rest with '-'
  const parts = [dimensionSlugs[0], dimensionSlugs[1]];
  const base = pathPrefix + parts.join(slugJoiner);
  if (dimensionSlugs.length > 2) {
    return base + '-' + dimensionSlugs.slice(2).join('-');
  }
  return base;
}

/**
 * Shard assignment for sitemap URLs.
 * Maps a page ID to a shard number (0-indexed, max 400 shards, 50k URLs each).
 */
export function getSitemapShard(pageId: bigint, urlsPerShard: number = 50000): number {
  return Number(pageId / BigInt(urlsPerShard));
}
