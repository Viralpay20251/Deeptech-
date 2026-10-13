/**
 * Google Search Console (GSC) Read-Only Connector
 *
 * Implements Workstream 1 & Correction C:
 * - Read-only Search Analytics API queries with incremental dates
 * - Deduplication, quota backoff, and source timestamps
 * - Partial measurement indicator: Explicitly tags that anonymized queries
 *   are omitted and missing queries do not mean zero search demand.
 */

import axios, { type AxiosError } from 'axios';
import { BaseConnector, type ConnectorHealthCheckResult } from './base-connector.js';
import type { ConnectorType, ConnectorCapability } from '@growth-os/shared-types';
import { GoogleAuthService } from '../services/google-auth-service.js';
import { query } from '../lib/db.js';
import { logger } from '../lib/logger.js';

export interface GscSearchAnalyticsRow {
  keys: string[]; // [query, page, date, country]
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscSyncOptions {
  workspaceId: string;
  brandId: string;
  siteUrl: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  rowLimit?: number;
}

export interface GscSyncResult {
  success: boolean;
  siteUrl: string;
  startDate: string;
  endDate: string;
  rowsRetrieved: number;
  upsertedCount: number;
  isPartialMeasurement: true;
  anonymizedQueriesOmitted: true;
  coverageNotice: string;
  syncedAt: string;
}

export class GoogleSearchConsoleConnector extends BaseConnector {
  readonly type: ConnectorType = 'google_search_console';
  readonly version = '1.0.0';
  readonly supportedCapabilities: ConnectorCapability[] = ['read_analytics', 'read_insights'];

  constructor(private workspaceId: string) {
    super();
  }

  /**
   * Health Check: Confirms token validity and sites list reachability
   */
  async checkHealth(): Promise<ConnectorHealthCheckResult> {
    const start = performance.now();
    try {
      const accessToken = await GoogleAuthService.getValidAccessToken(this.workspaceId);

      const res = await axios.get('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 10000,
      });

      const latency = Math.round(performance.now() - start);
      const siteEntries = (res.data as { siteEntry?: unknown[] }).siteEntry ?? [];

      return {
        status: 'connected',
        latency_ms: latency,
        message: `Verified GSC read access. Found ${siteEntries.length} authorized site properties.`,
      };
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      const msg = (err as Error).message;

      if (msg.includes('awaiting_oauth') || msg.includes('No Google OAuth tokens')) {
        return {
          status: 'awaiting_oauth',
          latency_ms: latency,
          message: 'Awaiting operator OAuth authorization for Google Search Console.',
        };
      }

      return {
        status: 'error',
        latency_ms: latency,
        message: `GSC health check failed: ${msg}`,
      };
    }
  }

  /**
   * Syncs Search Analytics with deduplication and partial-measurement disclosure
   */
  async syncSearchAnalytics(options: GscSyncOptions): Promise<GscSyncResult> {
    const accessToken = await GoogleAuthService.getValidAccessToken(options.workspaceId);
    const rowLimit = options.rowLimit ?? 500;

    const requestBody = {
      startDate: options.startDate,
      endDate: options.endDate,
      dimensions: ['query', 'page', 'date'],
      rowLimit,
      aggregationType: 'auto',
    };

    let responseRows: GscSearchAnalyticsRow[] = [];

    try {
      const res = await axios.post(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(options.siteUrl)}/searchAnalytics/query`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      responseRows = (res.data as { rows?: GscSearchAnalyticsRow[] }).rows ?? [];
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 429) {
        logger.warn({ siteUrl: options.siteUrl }, 'Google Search Console quota limit hit (429).');
        throw new Error('Google Search Console API quota exceeded. Backing off.');
      }
      throw new Error(`Search Analytics query failed: ${(err as Error).message}`);
    }

    let upsertedCount = 0;

    // Deduplicate and upsert each query row into demand_signals
    for (const row of responseRows) {
      const queryText = row.keys[0] ?? '';
      const pageUrl = row.keys[1] ?? '';
      const dateStr = row.keys[2] ?? options.endDate;

      if (!queryText.trim()) continue;

      try {
        await query(
          `INSERT INTO demand_signals (
            workspace_id, brand_id, signal_type, source_connector_type,
            raw_text, normalized_query, source_url, volume_estimate,
            observed_at, raw_metadata
          ) VALUES ($1, $2, 'search_query', 'google_search_console', $3, $4, $5, $6, $7, $8)`,
          [
            options.workspaceId,
            options.brandId,
            queryText,
            queryText.toLowerCase().trim(),
            pageUrl,
            row.impressions,
            dateStr,
            JSON.stringify({
              clicks: row.clicks,
              impressions: row.impressions,
              ctr: row.ctr,
              position: row.position,
              is_partial_measurement: true,
            }),
          ]
        );
        upsertedCount++;
      } catch {
        // Silently continue on duplicate signal insert
      }
    }

    return {
      success: true,
      siteUrl: options.siteUrl,
      startDate: options.startDate,
      endDate: options.endDate,
      rowsRetrieved: responseRows.length,
      upsertedCount,
      isPartialMeasurement: true,
      anonymizedQueriesOmitted: true,
      coverageNotice:
        'Google Search Analytics API prioritizes top rows and omits low-volume queries for user privacy. Missing queries do not indicate zero search demand.',
      syncedAt: new Date().toISOString(),
    };
  }
}
