/**
 * Autonomous Growth OS — Backlink Engine & Link Equity Service
 *
 * Manages:
 * 1. Backlink tracking & automated verification across the 21 canonical production hosts.
 * 2. Domain Authority (DA) monitoring and DoFollow/NoFollow link classification.
 * 3. Bijective Internal Link Mesh routing for cross-domain PageRank distribution.
 * 4. High-DA zero-cost syndication targets catalog.
 */

import { query } from '../lib/db.js';

export interface BacklinkRecord {
  id: string;
  brand_cluster: 'talentxcel' | 'chatr' | 'nutytales';
  target_canonical_domain: string;
  target_url: string;
  source_url: string;
  source_domain: string;
  anchor_text: string;
  link_type: 'dofollow' | 'nofollow' | 'ugc' | 'sponsored' | 'canonical' | 'internal_mesh';
  domain_authority: number;
  backlink_strategy: 'open_data_asset' | 'web2_syndication' | 'curated_directory' | 'digital_pr_citation' | 'cross_domain_mesh' | 'github_open_source';
  verification_status: 'verified_active' | 'pending_crawl' | 'lost' | 'flagged';
  http_status_code: number;
  last_verified_at: string;
  created_at: string;
}

export interface BacklinkStats {
  totalBacklinks: number;
  averageDomainAuthority: number;
  dofollowCount: number;
  dofollowRatioPercent: number;
  uniqueReferringDomains: number;
  byBrandCluster: Record<string, number>;
  byStrategy: Record<string, number>;
  byCanonicalHost: Record<string, number>;
}

export class BacklinkService {
  /**
   * List backlinks with optional filtering.
   */
  public static async listBacklinks(filters: {
    brand_cluster?: string;
    target_canonical_domain?: string;
    link_type?: string;
    verification_status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<BacklinkRecord[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (filters.brand_cluster) {
      conditions.push(`brand_cluster = $${pIdx++}`);
      params.push(filters.brand_cluster);
    }
    if (filters.target_canonical_domain) {
      conditions.push(`target_canonical_domain = $${pIdx++}`);
      params.push(filters.target_canonical_domain);
    }
    if (filters.link_type) {
      conditions.push(`link_type = $${pIdx++}`);
      params.push(filters.link_type);
    }
    if (filters.verification_status) {
      conditions.push(`verification_status = $${pIdx++}`);
      params.push(filters.verification_status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const sql = `
      SELECT *
      FROM public.backlinks_registry
      ${whereClause}
      ORDER BY domain_authority DESC, last_verified_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const res = await query(sql, params);
    return res.rows as unknown as BacklinkRecord[];
  }

  /**
   * Get aggregate statistics across the backlink inventory.
   */
  public static async getBacklinkStats(): Promise<BacklinkStats> {
    const totalRes = await query(`
      SELECT 
        COUNT(*)::int AS total,
        ROUND(COALESCE(AVG(domain_authority), 0), 1)::float AS avg_da,
        COUNT(CASE WHEN link_type = 'dofollow' THEN 1 END)::int AS dofollow_count,
        COUNT(DISTINCT source_domain)::int AS unique_domains
      FROM public.backlinks_registry
    `);

    const clusterRes = await query(`
      SELECT brand_cluster, COUNT(*)::int AS count
      FROM public.backlinks_registry
      GROUP BY brand_cluster
    `);

    const strategyRes = await query(`
      SELECT backlink_strategy, COUNT(*)::int AS count
      FROM public.backlinks_registry
      GROUP BY backlink_strategy
      ORDER BY count DESC
    `);

    const hostRes = await query(`
      SELECT target_canonical_domain, COUNT(*)::int AS count
      FROM public.backlinks_registry
      GROUP BY target_canonical_domain
      ORDER BY count DESC
    `);

    const row = (totalRes.rows[0] ?? {}) as Record<string, any>;
    const total = Number(row['total'] ?? 0);
    const dofollow = Number(row['dofollow_count'] ?? 0);

    const byBrandCluster: Record<string, number> = {};
    for (const r of clusterRes.rows as Array<Record<string, any>>) {
      const cluster = String(r['brand_cluster'] ?? '');
      if (cluster) byBrandCluster[cluster] = Number(r['count'] ?? 0);
    }

    const byStrategy: Record<string, number> = {};
    for (const r of strategyRes.rows as Array<Record<string, any>>) {
      const strat = String(r['backlink_strategy'] ?? '');
      if (strat) byStrategy[strat] = Number(r['count'] ?? 0);
    }

    const byCanonicalHost: Record<string, number> = {};
    for (const r of hostRes.rows as Array<Record<string, any>>) {
      const host = String(r['target_canonical_domain'] ?? '');
      if (host) byCanonicalHost[host] = Number(r['count'] ?? 0);
    }

    return {
      totalBacklinks: total,
      averageDomainAuthority: Number(row['avg_da'] ?? 0),
      dofollowCount: dofollow,
      dofollowRatioPercent: total > 0 ? Math.round((dofollow / total) * 100) : 0,
      uniqueReferringDomains: Number(row['unique_domains'] ?? 0),
      byBrandCluster,
      byStrategy,
      byCanonicalHost,
    };
  }

  /**
   * Retrieve the internal link mesh edges for passing link equity.
   */
  public static async getInternalLinkMesh(sourceHost?: string) {
    if (sourceHost) {
      const res = await query(
        `SELECT * FROM public.internal_link_mesh WHERE source_host = $1 AND active = TRUE ORDER BY equity_weight DESC`,
        [sourceHost]
      );
      return res.rows;
    }
    const res = await query(
      `SELECT * FROM public.internal_link_mesh WHERE active = TRUE ORDER BY source_host, equity_weight DESC`
    );
    return res.rows;
  }

  /**
   * Retrieve curated high-DA syndication targets.
   */
  public static async getSyndicationTargets(brandCluster?: string) {
    if (brandCluster) {
      const res = await query(
        `SELECT * FROM public.backlink_targets_catalog WHERE brand_cluster = $1 ORDER BY estimated_da DESC`,
        [brandCluster]
      );
      return res.rows;
    }
    const res = await query(
      `SELECT * FROM public.backlink_targets_catalog ORDER BY estimated_da DESC`
    );
    return res.rows;
  }

  /**
   * Automated verification of a backlink record.
   */
  public static async verifyBacklink(id: string): Promise<BacklinkRecord> {
    const existing = await query(`SELECT * FROM public.backlinks_registry WHERE id = $1`, [id]);
    if (existing.rows.length === 0 || !existing.rows[0]) {
      throw new Error(`Backlink record with ID ${id} not found.`);
    }

    const bl = existing.rows[0] as unknown as BacklinkRecord;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const resp = await fetch(bl.source_url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AutonomousGrowthOS-Verifier/1.0; +https://talentxcel.in/bot)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
      clearTimeout(timeout);

      const statusCode = resp.status;
      const html = await resp.text();
      const lowerHtml = html.toLowerCase();
      const containsTarget =
        lowerHtml.includes(bl.target_canonical_domain.toLowerCase()) ||
        lowerHtml.includes(bl.target_url.toLowerCase()) ||
        lowerHtml.includes(bl.anchor_text.toLowerCase());

      let status: 'verified_active' | 'pending_crawl' | 'lost' | 'flagged' = 'pending_crawl';
      if (statusCode >= 200 && statusCode < 300) {
        status = containsTarget ? 'verified_active' : 'pending_crawl';
      } else if (statusCode === 404 || statusCode === 410) {
        status = 'lost';
      } else {
        status = 'flagged';
      }

      const updateRes = await query(
        `
        UPDATE public.backlinks_registry 
        SET 
          http_status_code = $1,
          verification_status = $2,
          last_verified_at = NOW()
        WHERE id = $3
        RETURNING *
      `,
        [statusCode, status, id]
      );

      const updated = updateRes.rows[0] as unknown as BacklinkRecord;
      if (!updated) throw new Error('Failed to update backlink record');
      return updated;
    } catch {
      // If network probe fails (timeout or network barrier), log HTTP 0 and retain pending crawl
      const updateRes = await query(
        `
        UPDATE public.backlinks_registry 
        SET 
          http_status_code = 0,
          verification_status = 'pending_crawl',
          last_verified_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
        [id]
      );
      const fallback = updateRes.rows[0] as unknown as BacklinkRecord;
      if (!fallback) throw new Error('Failed to update backlink fallback record');
      return fallback;
    }
  }
}
