/**
 * Transparent Outbound Redirect Router & Click Intelligence Service
 *
 * Implements Section 39 & 40 requirement:
 * - Measures real, bot-filtered outbound traffic and campaign attribution
 * - Operates independently on OS endpoint (/r/:short_code)
 * - Zero code changes or scripts on CHATR, TalentXcel, or Nuty Tales
 * - Preserves UTM tags and client query parameters
 * - Hashes client IP with SHA-256 for GDPR/privacy compliance
 */

import crypto from 'crypto';
import { query } from '../lib/db.js';
import { TrafficClassifier, type TrafficClassification } from './traffic-classifier.js';
import { assertSafeOutboundUrl } from '../lib/safety.js';

export interface TrackedLinkRecord {
  id: string;
  workspace_id: string;
  brand_id: string;
  campaign_id: string | null;
  short_code: string;
  target_url: string;
  title: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  clicks_total: number;
  clicks_human: number;
  clicks_bot: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTrackedLinkInput {
  workspaceId: string;
  brandId: string;
  targetUrl: string;
  shortCode?: string;
  title?: string;
  campaignId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

export interface ProcessRedirectRequest {
  shortCode: string;
  userAgent?: string;
  ipAddress?: string;
  referer?: string;
  incomingQueryParams?: Record<string, string | string[] | undefined>;
}

export interface ProcessRedirectResult {
  found: boolean;
  destinationUrl?: string;
  classification?: TrafficClassification;
  isEligibleForMau?: boolean;
  link?: TrackedLinkRecord;
}

export class RedirectRouterService {
  private static readonly SALT = 'growth-os-privacy-salt-2026';

  /**
   * Hashes client IP with SHA-256 for privacy compliance
   */
  public static hashIp(ip: string): string {
    return crypto
      .createHash('sha256')
      .update(`${ip}:${this.SALT}`)
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Generates a random alphanumeric short code
   */
  public static generateShortCode(length = 7): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i]! % chars.length];
    }
    return result;
  }

  /**
   * Creates a new tracked link
   */
  public static async createTrackedLink(input: CreateTrackedLinkInput): Promise<TrackedLinkRecord> {
    // 1. SSRF and protocol safety assertion
    assertSafeOutboundUrl(input.targetUrl);

    const parsed = new URL(input.targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Invalid URL protocol: ${parsed.protocol}. Only http and https are allowed.`);
    }

    // 2. Resolve short code
    const shortCode = input.shortCode?.trim() || this.generateShortCode();

    // 3. Insert into database
    const res = await query<TrackedLinkRecord>(
      `INSERT INTO tracked_links (
        workspace_id, brand_id, campaign_id, short_code, target_url,
        title, utm_source, utm_medium, utm_campaign, utm_term, utm_content
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        input.workspaceId,
        input.brandId,
        input.campaignId ?? null,
        shortCode,
        input.targetUrl,
        input.title ?? '',
        input.utmSource ?? null,
        input.utmMedium ?? null,
        input.utmCampaign ?? null,
        input.utmTerm ?? null,
        input.utmContent ?? null,
      ]
    );

    return res.rows[0]!;
  }

  /**
   * Processes a redirect click:
   * 1. Resolves short_code
   * 2. Evaluates bot vs human traffic
   * 3. Records click telemetry & traffic observations
   * 4. Synthesizes destination URL with preserved query parameters
   */
  public static async processRedirect(req: ProcessRedirectRequest): Promise<ProcessRedirectResult> {
    // 1. Look up tracked link
    const linkRes = await query<TrackedLinkRecord>(
      `SELECT * FROM tracked_links WHERE short_code = $1 AND is_active = true`,
      [req.shortCode]
    );

    if (linkRes.rows.length === 0) {
      return { found: false };
    }

    const link = linkRes.rows[0]!;

    // 2. Classify traffic with TrafficClassifier
    const ip = req.ipAddress ?? '127.0.0.1';
    const ua = req.userAgent ?? '';
    const ref = req.referer ?? '';

    const evalResult = TrafficClassifier.evaluate({
      userAgent: ua,
      ipAddress: ip,
      pageviewsCount: 1,
      sessionDurationSeconds: 0,
    });

    const ipHash = this.hashIp(ip);
    const isBot = evalResult.classification === 'verified_bot' || evalResult.classification === 'likely_bot';

    // 3. Record individual click asynchronously/safely
    try {
      await query(
        `INSERT INTO tracked_link_clicks (
          tracked_link_id, brand_id, ip_hash, user_agent, referer,
          traffic_classification, confidence, is_eligible_for_mau
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          link.id,
          link.brand_id,
          ipHash,
          ua.substring(0, 500),
          ref.substring(0, 500),
          evalResult.classification,
          evalResult.confidence,
          evalResult.isEligibleForMau,
        ]
      );

      // Increment click counters on tracked_link
      await query(
        `UPDATE tracked_links
         SET clicks_total = clicks_total + 1,
             clicks_human = clicks_human + (CASE WHEN $2 THEN 1 ELSE 0 END),
             clicks_bot = clicks_bot + (CASE WHEN $3 THEN 1 ELSE 0 END),
             updated_at = NOW()
         WHERE id = $1`,
        [link.id, evalResult.isEligibleForMau, isBot]
      );

      // Ingest traffic observation fact into traffic_observations
      const trafficQuality = isBot ? 'likely_bot' : (evalResult.isEligibleForMau ? 'likely_human' : 'uncertain');
      await query(
        `INSERT INTO traffic_observations (
          workspace_id, brand_id, campaign_id, source_connector_type,
          observed_date, traffic_source, utm_source, utm_medium, utm_campaign,
          landing_page_path, sessions, session_quality, quality_confidence, is_demo_data
        ) VALUES ($1, $2, $3, 'redirect_router', CURRENT_DATE, 'referral', $4, $5, $6, $7, 1, $8, $9, false)`,
        [
          link.workspace_id,
          link.brand_id,
          link.campaign_id,
          link.utm_source ?? 'growth_os',
          link.utm_medium ?? 'redirect',
          link.utm_campaign ?? 'outbound',
          new URL(link.target_url).pathname,
          trafficQuality,
          evalResult.confidence,
        ]
      );
    } catch {
      // Never block the user redirect even if telemetry write encounters transient error
    }

    // 4. Build destination URL with preserved and augmented parameters
    const dest = new URL(link.target_url);

    // Apply link UTM parameters if defined
    if (link.utm_source) dest.searchParams.set('utm_source', link.utm_source);
    if (link.utm_medium) dest.searchParams.set('utm_medium', link.utm_medium);
    if (link.utm_campaign) dest.searchParams.set('utm_campaign', link.utm_campaign);
    if (link.utm_term) dest.searchParams.set('utm_term', link.utm_term);
    if (link.utm_content) dest.searchParams.set('utm_content', link.utm_content);

    // Merge incoming query parameters (without overwriting explicit UTMs unless needed)
    if (req.incomingQueryParams) {
      for (const [key, value] of Object.entries(req.incomingQueryParams)) {
        if (value !== undefined && !dest.searchParams.has(key)) {
          const strVal = Array.isArray(value) ? value[0] : value;
          if (strVal) dest.searchParams.set(key, strVal);
        }
      }
    }

    return {
      found: true,
      destinationUrl: dest.toString(),
      classification: evalResult.classification,
      isEligibleForMau: evalResult.isEligibleForMau,
      link,
    };
  }

  /**
   * Retrieves all tracked links for a brand or workspace
   */
  public static async getTrackedLinks(workspaceId: string, brandId?: string): Promise<TrackedLinkRecord[]> {
    if (brandId) {
      const res = await query<TrackedLinkRecord>(
        `SELECT * FROM tracked_links WHERE workspace_id = $1 AND brand_id = $2 ORDER BY created_at DESC`,
        [workspaceId, brandId]
      );
      return res.rows;
    }

    const res = await query<TrackedLinkRecord>(
      `SELECT * FROM tracked_links WHERE workspace_id = $1 ORDER BY created_at DESC`,
      [workspaceId]
    );
    return res.rows;
  }
}
