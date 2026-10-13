/**
 * Google Analytics 4 (GA4) Read-Only Connector
 *
 * Implements Workstream 1 & Correction B:
 * - Read-only Google Analytics Data API v1beta report execution
 * - Captures sessions, engaged sessions, and channel groupings
 * - Explicitly documents that GA4 active users are NOT equivalent to
 *   brand meaningful product actions (CHATR AI activity, TalentXcel career actions,
 *   or Nuty Tales verified purchasers).
 */

import axios, { type AxiosError } from 'axios';
import { BaseConnector, type ConnectorHealthCheckResult } from './base-connector.js';
import type { ConnectorType, ConnectorCapability } from '@growth-os/shared-types';
import { GoogleAuthService } from '../services/google-auth-service.js';
import { query } from '../lib/db.js';
import { logger } from '../lib/logger.js';

export interface Ga4SyncOptions {
  workspaceId: string;
  brandId: string;
  propertyId: string; // e.g. "properties/123456789"
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
}

export interface Ga4SyncResult {
  success: boolean;
  propertyId: string;
  startDate: string;
  endDate: string;
  rowsRetrieved: number;
  upsertedCount: number;
  policyNotice: string;
  syncedAt: string;
}

export class GoogleAnalytics4Connector extends BaseConnector {
  readonly type: ConnectorType = 'google_analytics_4';
  readonly version = '1.0.0';
  readonly supportedCapabilities: ConnectorCapability[] = ['read_analytics', 'read_insights'];

  constructor(private workspaceId: string) {
    super();
  }

  /**
   * Health Check: Confirms token validity and GA4 property metadata
   */
  async checkHealth(propertyId?: string): Promise<ConnectorHealthCheckResult> {
    const start = performance.now();
    try {
      const accessToken = await GoogleAuthService.getValidAccessToken(this.workspaceId);
      const prop = propertyId ?? 'properties/0';

      // Test minimal metadata endpoint
      await axios.get(
        `https://analyticsdata.googleapis.com/v1beta/${prop}/metadata`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000,
        }
      );

      const latency = Math.round(performance.now() - start);
      return {
        status: 'connected',
        latency_ms: latency,
        message: 'Verified Google Analytics 4 Data API read access.',
      };
    } catch (err) {
      const latency = Math.round(performance.now() - start);
      const msg = (err as Error).message;

      if (msg.includes('awaiting_oauth') || msg.includes('No Google OAuth tokens')) {
        return {
          status: 'awaiting_oauth',
          latency_ms: latency,
          message: 'Awaiting operator OAuth authorization for Google Analytics 4.',
        };
      }

      return {
        status: 'error',
        latency_ms: latency,
        message: `GA4 health check failed: ${msg}`,
      };
    }
  }

  /**
   * Syncs traffic sessions into traffic_observations with non-conflation policy notice
   */
  async syncTrafficData(options: Ga4SyncOptions): Promise<Ga4SyncResult> {
    const accessToken = await GoogleAuthService.getValidAccessToken(options.workspaceId);
    const prop = options.propertyId.startsWith('properties/')
      ? options.propertyId
      : `properties/${options.propertyId}`;

    const requestBody = {
      dateRanges: [{ startDate: options.startDate, endDate: options.endDate }],
      dimensions: [
        { name: 'date' },
        { name: 'sessionDefaultChannelGroup' },
        { name: 'sessionSourceMedium' },
        { name: 'pagePath' },
      ],
      metrics: [
        { name: 'sessions' },
        { name: 'engagedSessions' },
        { name: 'activeUsers' },
        { name: 'conversions' },
      ],
    };

    let reportRows: Array<{
      dimensionValues: Array<{ value: string }>;
      metricValues: Array<{ value: string }>;
    }> = [];

    try {
      const res = await axios.post(
        `https://analyticsdata.googleapis.com/v1beta/${prop}:runReport`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      reportRows = (res.data as { rows?: typeof reportRows }).rows ?? [];
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 429) {
        logger.warn({ propertyId: options.propertyId }, 'GA4 API quota exceeded (429).');
        throw new Error('Google Analytics 4 API quota exceeded. Backing off.');
      }
      throw new Error(`GA4 runReport failed: ${(err as Error).message}`);
    }

    let upsertedCount = 0;

    for (const row of reportRows) {
      const dateStr = row.dimensionValues[0]?.value ?? options.endDate;
      const channelGroup = row.dimensionValues[1]?.value?.toLowerCase() ?? 'unknown';
      const sourceMedium = row.dimensionValues[2]?.value ?? '';
      const landingPage = row.dimensionValues[3]?.value ?? '/';

      const sessions = parseInt(row.metricValues[0]?.value ?? '0', 10);
      const engagedSessions = parseInt(row.metricValues[1]?.value ?? '0', 10);
      const conversions = parseInt(row.metricValues[3]?.value ?? '0', 10);

      // Map channel group to traffic_source
      let trafficSource: 'organic_search' | 'social' | 'referral' | 'email' | 'paid' | 'direct' | 'unknown' = 'unknown';
      if (channelGroup.includes('organic search')) trafficSource = 'organic_search';
      else if (channelGroup.includes('organic social')) trafficSource = 'social';
      else if (channelGroup.includes('referral')) trafficSource = 'referral';
      else if (channelGroup.includes('email')) trafficSource = 'email';
      else if (channelGroup.includes('paid')) trafficSource = 'paid';
      else if (channelGroup.includes('direct')) trafficSource = 'direct';

      const [utmSource, utmMedium] = sourceMedium.includes('/')
        ? sourceMedium.split('/')
        : [sourceMedium, ''];

      try {
        await query(
          `INSERT INTO traffic_observations (
            workspace_id, brand_id, source_connector_type, observed_date,
            traffic_source, utm_source, utm_medium, landing_page_path,
            sessions, engaged_sessions, conversions, session_quality,
            quality_confidence, caveats
          ) VALUES ($1, $2, 'google_analytics_4', $3, $4, $5, $6, $7, $8, $9, $10, 'uncertain', 0.60, $11)`,
          [
            options.workspaceId,
            options.brandId,
            dateStr,
            trafficSource,
            utmSource?.trim(),
            utmMedium?.trim(),
            landingPage,
            sessions,
            engagedSessions,
            conversions,
            [
              'GA4 active-user metric represents Google session engagement definitions, NOT brand meaningful product actions.',
              'Qualifying product events must be verified separately via dedicated event streams.',
            ],
          ]
        );
        upsertedCount++;
      } catch {
        // Silently continue on duplicate or constraint collision
      }
    }

    return {
      success: true,
      propertyId: options.propertyId,
      startDate: options.startDate,
      endDate: options.endDate,
      rowsRetrieved: reportRows.length,
      upsertedCount,
      policyNotice:
        'GA4 metrics reflect session engagement and do not count as proof of brand qualifying product actions.',
      syncedAt: new Date().toISOString(),
    };
  }
}
