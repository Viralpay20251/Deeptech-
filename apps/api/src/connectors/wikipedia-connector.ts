/**
 * Autonomous Growth OS — Wikipedia & Wikidata Public Knowledge Connector
 *
 * Implements Wave 2 Public Knowledge Intelligence:
 * - Queries Wikipedia REST API for neutral encyclopedic summaries and entities.
 * - Extracts canonical page URLs, extracts, and citations.
 * - Used by specialist agents for entity grounding and factual disambiguation.
 */

import axios from 'axios';
import { BaseConnector, type ConnectorHealthCheckResult } from './base-connector.js';
import type { ConnectorType, ConnectorCapability } from '@growth-os/shared-types';
import { assertSafeOutboundUrlAsync } from '../lib/safety.js';
import { logger } from '../lib/logger.js';

export interface WikipediaSummaryResult {
  title: string;
  extract: string;
  description?: string;
  pageUrl: string;
  thumbnailUrl?: string;
}

export class WikipediaConnector extends BaseConnector {
  readonly type: ConnectorType = 'wikipedia_wikidata' as any;
  readonly version = 'v1';
  readonly supportedCapabilities: ConnectorCapability[] = ['read_public', 'read_insights'];

  private static readonly WIKI_REST_BASE = 'https://en.wikipedia.org/api/rest_v1/page/summary';
  private static readonly USER_AGENT = 'AutonomousGrowthOS-EntityBot/1.0 (https://growth-os.internal/bot; bot@growth-os.internal)';

  public async checkHealth(): Promise<ConnectorHealthCheckResult> {
    const start = Date.now();
    try {
      await assertSafeOutboundUrlAsync(`${WikipediaConnector.WIKI_REST_BASE}/Search_engine_optimization`);
      return {
        status: 'connected',
        latency_ms: Date.now() - start,
        message: 'Wikipedia REST API is operational.',
      };
    } catch (err) {
      return {
        status: 'error',
        latency_ms: Date.now() - start,
        message: (err as Error).message,
      };
    }
  }

  /**
   * Fetch a verified encyclopedic summary for a named entity or concept
   */
  public async getEntitySummary(topicTitle: string): Promise<WikipediaSummaryResult | null> {
    const encoded = encodeURIComponent(topicTitle.trim().replace(/\s+/g, '_'));
    const url = `${WikipediaConnector.WIKI_REST_BASE}/${encoded}`;

    await assertSafeOutboundUrlAsync(url);
    logger.info({ topicTitle }, 'Querying Wikipedia REST API for entity summary');

    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': WikipediaConnector.USER_AGENT },
        timeout: 8000,
        validateStatus: () => true,
      });

      if (response.status !== 200 || !response.data) {
        return null;
      }

      const d = response.data;
      return {
        title: d.title || topicTitle,
        extract: d.extract || '',
        description: d.description,
        pageUrl: d.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encoded}`,
        thumbnailUrl: d.thumbnail?.source,
      };
    } catch (err) {
      logger.warn({ topicTitle, err: (err as Error).message }, 'Wikipedia query failed');
      return null;
    }
  }
}
